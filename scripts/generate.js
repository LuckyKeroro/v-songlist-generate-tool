const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

// 路径配置
const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'Resources');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITE_PUBLIC_DIR = path.join(ROOT_DIR, 'site/public');
const SITE_DATA_DIR = path.join(ROOT_DIR, 'site/src/data');
const DIST_DIR = path.join(ROOT_DIR, 'docs');

async function main() {
  console.log('🚀 开始生成静态网站...\n');

  // 1. 读取所有歌曲
  console.log('📖 读取歌曲数据...');
  const songs = [];

  if (fs.existsSync(RESOURCES_DIR)) {
    const artists = fs.readdirSync(RESOURCES_DIR);
    for (const artist of artists) {
      const artistDir = path.join(RESOURCES_DIR, artist);
      if (!fs.statSync(artistDir).isDirectory()) continue;

      const albums = fs.readdirSync(artistDir);
      for (const album of albums) {
        const albumDir = path.join(artistDir, album);
        if (!fs.statSync(albumDir).isDirectory()) continue;

        const files = fs.readdirSync(albumDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(albumDir, file);
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              songs.push(JSON.parse(content));
            } catch (e) {
              console.warn(`  警告: 无法解析 ${filePath}`);
            }
          }
        }
      }
    }
  }

  console.log(`  找到 ${songs.length} 首歌曲\n`);

  // 2. 复制配置文件
  console.log('📋 复制配置文件...');
  if (fs.existsSync(path.join(PUBLIC_DIR, 'config.json'))) {
    fs.copyFileSync(
      path.join(PUBLIC_DIR, 'config.json'),
      path.join(SITE_PUBLIC_DIR, 'config.json')
    );
    console.log('  config.json 已复制');
  }

  // 3. 复制图片资源（转换非jpg格式为jpg）
  console.log('🖼️ 处理图片资源...');
  const imageFiles = fs.readdirSync(PUBLIC_DIR).filter(f =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
  );

  const convertedFiles = [];
  const filesToDelete = [];

  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const targetFile = `${baseName}.jpg`;
    const sourcePath = path.join(PUBLIC_DIR, file);
    const targetPath = path.join(SITE_PUBLIC_DIR, targetFile);

    if (ext === '.jpg' || ext === '.jpeg') {
      // 已经是jpg格式，直接复制
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`  ${file} 已复制`);
      convertedFiles.push(targetFile);
    } else {
      // 需要转换格式
      try {
        await sharp(sourcePath)
          .jpeg({ quality: 90 })
          .toFile(targetPath);
        console.log(`  ${file} → ${targetFile} (已转换)`);
        convertedFiles.push(targetFile);
        filesToDelete.push(file);
      } catch (error) {
        console.warn(`  警告: 无法转换 ${file}: ${error.message}`);
        // 转换失败，直接复制原文件
        fs.copyFileSync(sourcePath, targetPath);
        convertedFiles.push(file);
      }
    }
  }

  // 删除已转换的原文件
  for (const file of filesToDelete) {
    try {
      fs.unlinkSync(path.join(PUBLIC_DIR, file));
      console.log(`  已删除原文件: ${file}`);
    } catch (e) {
      console.warn(`  警告: 无法删除 ${file}`);
    }
  }

  // 更新imageFiles为转换后的文件列表
  const finalImageFiles = convertedFiles;

  // 4. 生成 songs.json 并复制封面图片
  console.log('\n📝 生成歌曲数据...');

  // 创建封面图片目录
  const coversDir = path.join(SITE_PUBLIC_DIR, 'covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }

  // 处理每首歌曲的封面图片
  const processedSongs = songs.map(song => {
    if (song.cover) {
      const coverPath = path.join(RESOURCES_DIR, song.cover);
      if (fs.existsSync(coverPath)) {
        const coverFileName = path.basename(song.cover);
        const targetPath = path.join(coversDir, coverFileName);
        fs.copyFileSync(coverPath, targetPath);
        return { ...song, cover: `covers/${coverFileName}` };
      }
    }
    return song;
  });

  fs.writeFileSync(
    path.join(SITE_DATA_DIR, 'songs.json'),
    JSON.stringify(processedSongs, null, 2),
    'utf-8'
  );
  console.log(`  songs.json 已生成 (${processedSongs.length} 首歌曲)`);

  // 4.5 更新 config.json 添加背景和头像字段
  console.log('\n⚙️ 更新配置文件...');
  const configPath = path.join(PUBLIC_DIR, 'config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // 合并 public 和 site/public 的图片文件列表
  let allImageFiles = [...finalImageFiles];
  if (fs.existsSync(SITE_PUBLIC_DIR)) {
    const siteImages = fs.readdirSync(SITE_PUBLIC_DIR).filter(f =>
      /\.(jpg|jpeg)$/i.test(f)
    );
    for (const img of siteImages) {
      if (!allImageFiles.includes(img)) {
        allImageFiles.push(img);
      }
    }
  }

  // 检测背景图片
  const bgFile = allImageFiles.find(f => f.toLowerCase().startsWith('background'));
  if (bgFile) {
    config.background = bgFile;
    console.log(`  背景图片: ${bgFile}`);
  }

  // 检测头像
  const avatarFile = allImageFiles.find(f => f.toLowerCase().startsWith('avatar'));
  if (avatarFile) {
    config.avatar = avatarFile;
    console.log(`  头像图片: ${avatarFile}`);
  }

  // 保存更新后的配置
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // 5. 构建 React 应用
  console.log('\n🔨 构建静态网站...');
  try {
    // 检查是否需要安装依赖
    const siteNodeModules = path.join(ROOT_DIR, 'site/node_modules');
    if (!fs.existsSync(siteNodeModules)) {
      console.log('  安装 site 依赖...');
      execSync('npm install', { cwd: path.join(ROOT_DIR, 'site'), stdio: 'inherit' });
    }

    // 构建
    execSync('npm run build', { cwd: path.join(ROOT_DIR, 'site'), stdio: 'inherit' });

    // 复制配置、歌曲数据和图片到 docs
    console.log('\n📦 复制资源到 docs...');

    // 复制 config.json
    if (fs.existsSync(path.join(PUBLIC_DIR, 'config.json'))) {
      fs.copyFileSync(
        path.join(PUBLIC_DIR, 'config.json'),
        path.join(DIST_DIR, 'config.json')
      );
      console.log('  config.json 已复制');
    }

    // 复制 songs.json (使用处理后的歌曲数据)
    fs.writeFileSync(
      path.join(DIST_DIR, 'songs.json'),
      JSON.stringify(processedSongs, null, 2),
      'utf-8'
    );
    console.log('  songs.json 已复制');

    // 复制封面图片目录
    const docsCoversDir = path.join(DIST_DIR, 'covers');
    if (!fs.existsSync(docsCoversDir)) {
      fs.mkdirSync(docsCoversDir, { recursive: true });
    }
    const coverFiles = fs.readdirSync(coversDir);
    for (const file of coverFiles) {
      fs.copyFileSync(
        path.join(coversDir, file),
        path.join(docsCoversDir, file)
      );
    }
    console.log(`  封面图片已复制 (${coverFiles.length} 个)`);

    // 复制图片(使用转换后的jpg文件)
    for (const file of finalImageFiles) {
      const sourcePath = path.join(SITE_PUBLIC_DIR, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(DIST_DIR, file));
        console.log(`  ${file} 已复制`);
      }
    }

    console.log('\n✅ 生成完成!');
    console.log(`   输出目录: ${DIST_DIR}`);
    console.log(`   歌曲数量: ${processedSongs.length}`);
  } catch (error) {
    console.error('\n❌ 构建失败:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
