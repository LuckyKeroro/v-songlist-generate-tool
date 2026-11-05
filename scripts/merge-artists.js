#!/usr/bin/env node
/**
 * scripts/merge-artists.js
 *
 * 一次性脚本：读取 admin/aliases.json 中的每条映射 srcArtist → dstArtist，
 * 把 Resources/srcArtist/ 下所有专辑迁移到 Resources/dstArtist/，
 * 并改写每个 JSON 内的 artist、cover 字段。
 *
 * 用法:
 *   node scripts/merge-artists.js --dry-run   # 只打印计划，不动文件
 *   node scripts/merge-artists.js             # 实际执行
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'Resources');
const ALIASES_PATH = path.join(ROOT_DIR, 'admin/aliases.json');

const dryRun = process.argv.includes('--dry-run');

function toSafeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_');
}

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => {
    try { return fs.statSync(path.join(dir, name)).isDirectory(); }
    catch { return false; }
  });
}

function rewriteSongJson(filePath, srcArtist, dstArtist) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;

  if (data.artist === srcArtist) {
    data.artist = dstArtist;
    changed = true;
  } else if (typeof data.artist === 'string' && data.artist.split('/').includes(srcArtist)) {
    data.artist = data.artist.split('/').map(p => p === srcArtist ? dstArtist : p).join('/');
    changed = true;
  }

  if (typeof data.cover === 'string') {
    const safeSrc = toSafeName(srcArtist);
    const safeDst = toSafeName(dstArtist);
    if (data.cover.startsWith(safeSrc + '/')) {
      data.cover = safeDst + data.cover.slice(safeSrc.length);
      changed = true;
    }
  }

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  return changed;
}

function moveAlbumDir(srcAlbumDir, dstAlbumDir) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(dstAlbumDir), { recursive: true });
  fs.renameSync(srcAlbumDir, dstAlbumDir);
}

function main() {
  const aliases = JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf-8'));
  const mode = dryRun ? '[DRY-RUN]' : '[EXEC]';
  console.log(`${mode} 开始执行歌手目录合并\n`);

  // 预检阶段：扫描所有冲突
  const plans = [];
  const conflicts = [];

  for (const [srcArtist, dstArtist] of Object.entries(aliases)) {
    const srcDir = path.join(RESOURCES_DIR, toSafeName(srcArtist));
    if (!fs.existsSync(srcDir)) {
      console.log(`  跳过: ${srcArtist} (目录不存在)`);
      continue;
    }
    const dstDir = path.join(RESOURCES_DIR, toSafeName(dstArtist));
    const albums = listSubdirs(srcDir);
    for (const album of albums) {
      const dstAlbumDir = path.join(dstDir, album);
      if (fs.existsSync(dstAlbumDir)) {
        conflicts.push({ srcArtist, dstArtist, album, dstAlbumDir });
      }
      plans.push({ srcArtist, dstArtist, album, srcDir, dstDir });
    }
  }

  if (conflicts.length > 0) {
    console.error('\n❌ 检测到冲突，中止：');
    for (const c of conflicts) {
      console.error(`  ${c.srcArtist}/${c.album} → 目标已存在 ${c.dstAlbumDir}`);
    }
    process.exit(1);
  }

  // 执行迁移
  for (const p of plans) {
    const srcAlbumDir = path.join(p.srcDir, p.album);
    const dstAlbumDir = path.join(p.dstDir, p.album);
    console.log(`  迁移: ${p.srcArtist}/${p.album} → ${p.dstArtist}/${p.album}`);
    moveAlbumDir(srcAlbumDir, dstAlbumDir);
    // 改写 JSON
    const targetDir = dryRun ? srcAlbumDir : dstAlbumDir;
    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const fp = path.join(targetDir, f);
      const changed = rewriteSongJson(fp, p.srcArtist, p.dstArtist);
      if (changed) console.log(`    改写 JSON: ${f}`);
    }
  }

  // 删除空目录
  for (const srcArtist of new Set(plans.map(p => p.srcArtist))) {
    const srcDir = path.join(RESOURCES_DIR, toSafeName(srcArtist));
    if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).length === 0) {
      console.log(`  删除空目录: ${srcArtist}`);
      if (!dryRun) fs.rmdirSync(srcDir);
    } else if (fs.existsSync(srcDir)) {
      console.warn(`  ⚠️ 残留文件未删除: ${srcDir} (${fs.readdirSync(srcDir).join(', ')})`);
    }
  }

  console.log(`\n${mode} 完成 (计划 ${plans.length} 张专辑迁移)`);
}

main();
