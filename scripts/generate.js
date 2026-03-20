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

  // 3. 复制图片资源（转换非jpg格式为jpg，并压缩头像和背景图）
  console.log('🖼️ 处理图片资源...');
  const imageFiles = fs.readdirSync(PUBLIC_DIR).filter(f =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
  );

  const convertedFiles = [];
  const filesToDelete = [];

  // 压缩目标大小
  const AVATAR_TARGET = 100 * 1024; // 100KB
  const BACKGROUND_TARGET = 500 * 1024; // 500KB

  // 压缩图片函数
  async function compressImage(sharpInstance, targetSize, type) {
    const metadata = await sharpInstance.metadata();
    let quality = 90;
    let buffer;
    let attempts = 0;
    const maxAttempts = 15;
    let minQuality = 10;
    let maxQuality = 90;

    while (attempts < maxAttempts) {
      attempts++;

      if (type === 'avatar') {
        const resizeRatio = Math.min(1, Math.sqrt(targetSize / metadata.width / metadata.height / 3) * 2);
        const newWidth = Math.round(metadata.width * Math.max(0.3, resizeRatio));
        buffer = await sharpInstance
          .clone()
          .resize(newWidth)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      } else {
        buffer = await sharpInstance
          .clone()
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      }

      const currentSize = buffer.length;
      const ratio = currentSize / targetSize;

      if (ratio >= 0.9 && ratio <= 1.1) break;

      if (currentSize > targetSize) {
        maxQuality = quality;
        quality = Math.floor((minQuality + quality) / 2);
      } else {
        minQuality = quality;
        quality = Math.floor((quality + maxQuality) / 2);
      }

      if (quality < 10) {
        quality = 10;
        break;
      }
    }

    return buffer;
  }

  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const targetFile = `${baseName}.jpg`;
    const sourcePath = path.join(PUBLIC_DIR, file);
    const targetPath = path.join(SITE_PUBLIC_DIR, targetFile);

    // 判断是否需要压缩
    const isAvatar = baseName.toLowerCase() === 'avatar';
    const isBackground = baseName.toLowerCase() === 'background';
    const needCompress = isAvatar || isBackground;

    try {
      const sharpInstance = sharp(sourcePath);
      const originalSize = fs.statSync(sourcePath).size;

      if (needCompress) {
        const targetSize = isAvatar ? AVATAR_TARGET : BACKGROUND_TARGET;
        const type = isAvatar ? 'avatar' : 'background';

        if (originalSize <= targetSize) {
          // 已经足够小，直接复制或转换
          if (ext === '.jpg' || ext === '.jpeg') {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`  ${file} 已复制 (${(originalSize / 1024).toFixed(0)}KB)`);
          } else {
            await sharpInstance.jpeg({ quality: 90 }).toFile(targetPath);
            console.log(`  ${file} → ${targetFile} (已转换)`);
            filesToDelete.push(file);
          }
        } else {
          // 需要压缩
          const buffer = await compressImage(sharpInstance, targetSize, type);
          fs.writeFileSync(targetPath, buffer);
          const saved = ((1 - buffer.length / originalSize) * 100).toFixed(0);
          console.log(`  ${file} ${(originalSize / 1024).toFixed(0)}KB → ${(buffer.length / 1024).toFixed(0)}KB (压缩${saved}%)`);
          if (ext !== '.jpg' && ext !== '.jpeg') {
            filesToDelete.push(file);
          }
        }
      } else if (ext === '.jpg' || ext === '.jpeg') {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  ${file} 已复制`);
      } else {
        await sharpInstance.jpeg({ quality: 90 }).toFile(targetPath);
        console.log(`  ${file} → ${targetFile} (已转换)`);
        filesToDelete.push(file);
      }

      convertedFiles.push(targetFile);
    } catch (error) {
      console.warn(`  警告: 无法处理 ${file}: ${error.message}`);
      fs.copyFileSync(sourcePath, targetPath);
      convertedFiles.push(file);
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

    // 压缩 docs 目录下的头像和背景图片（确保不超过目标大小）
    console.log('\n🗜️ 检查图片大小...');
    const imagesToCheck = [
      { name: config.avatar, target: AVATAR_TARGET, type: 'avatar' },
      { name: config.background, target: BACKGROUND_TARGET, type: 'background' }
    ].filter(img => img.name);

    for (const img of imagesToCheck) {
      const filePath = path.join(DIST_DIR, img.name);
      if (!fs.existsSync(filePath)) continue;

      const currentSize = fs.statSync(filePath).size;
      if (currentSize <= img.target) {
        console.log(`  ${img.name} ${(currentSize / 1024).toFixed(0)}KB ✓`);
        continue;
      }

      // 需要压缩
      const sharpInstance = sharp(filePath);
      const metadata = await sharpInstance.metadata();
      let quality = 90;
      let buffer;
      let minQuality = 10;
      let maxQuality = 90;

      for (let i = 0; i < 15; i++) {
        if (img.type === 'avatar') {
          const resizeRatio = Math.min(1, Math.sqrt(img.target / currentSize) * 1.5);
          const newWidth = Math.round(metadata.width * Math.max(0.3, resizeRatio));
          buffer = await sharp(filePath).resize(newWidth).jpeg({ quality, mozjpeg: true }).toBuffer();
        } else {
          buffer = await sharp(filePath).jpeg({ quality, mozjpeg: true }).toBuffer();
        }

        const ratio = buffer.length / img.target;
        if (ratio >= 0.9 && ratio <= 1.1) break;

        if (buffer.length > img.target) {
          maxQuality = quality;
          quality = Math.floor((minQuality + quality) / 2);
        } else {
          minQuality = quality;
          quality = Math.floor((quality + maxQuality) / 2);
        }
        if (quality < 10) { quality = 10; break; }
      }

      fs.writeFileSync(filePath, buffer);
      const saved = ((1 - buffer.length / currentSize) * 100).toFixed(0);
      console.log(`  ${img.name} ${(currentSize / 1024).toFixed(0)}KB → ${(buffer.length / 1024).toFixed(0)}KB (压缩${saved}%)`);

      // 同步压缩 site/public 中的源文件
      const sourcePath = path.join(SITE_PUBLIC_DIR, img.name);
      if (fs.existsSync(sourcePath)) {
        fs.writeFileSync(sourcePath, buffer);
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
