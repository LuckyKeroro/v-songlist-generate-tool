#!/usr/bin/env node
/**
 * scripts/backfill-translations.js
 *
 * 一次性脚本：扫描 Resources/ 下所有 language === '日语' 且 title 不含中文括号译名、
 * 且 sourceUrl 是 QQ Music 的歌曲，调用 QQ 搜索 API 用 mid 精确匹配后取 title
 * 字段（含中文译名）回写 JSON、重命名 .json/.jpg。
 *
 * 用法:
 *   node scripts/backfill-translations.js --dry-run
 *   node scripts/backfill-translations.js
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'Resources');

const dryRun = process.argv.includes('--dry-run');
const RATE_LIMIT_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toSafeName(name) { return name.replace(/[\/\\:*?"<>|]/g, '_'); }

function hasChineseInParens(title) {
  // 英文或全角括号内含至少一个 CJK 字符
  return /[（(][^）)]*[一-鿿][^）)]*[）)]/.test(title);
}

function extractQQMid(sourceUrl) {
  if (!sourceUrl || !sourceUrl.includes('y.qq.com')) return null;
  const m = sourceUrl.match(/songDetail\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function primaryArtistBare(artist) {
  // 取 / 前第一段，去掉括号注释
  const first = (artist || '').split('/')[0];
  return first.replace(/\s*[（(].*?[）)]\s*$/, '').trim();
}

async function searchQQMusic(keyword) {
  const body = JSON.stringify({
    comm: { ct: '19', cv: '1859', uin: '0' },
    req: {
      method: 'DoSearchForQQMusicDesktop',
      module: 'music.search.SearchCgiService',
      param: {
        grp: 1,
        num_per_page: 10,
        page_num: 1,
        query: keyword,
        search_type: 0
      }
    }
  });
  const res = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.8',
      'Content-Type': 'application/json;charset=utf-8',
      'Referer': 'https://y.qq.com/'
    },
    body
  });
  const data = await res.json();
  return (data?.req?.data?.body?.song?.list) || [];
}

function collectSongs() {
  const songs = [];
  if (!fs.existsSync(RESOURCES_DIR)) return songs;
  for (const artist of fs.readdirSync(RESOURCES_DIR)) {
    const artistDir = path.join(RESOURCES_DIR, artist);
    if (!fs.statSync(artistDir).isDirectory()) continue;
    for (const album of fs.readdirSync(artistDir)) {
      const albumDir = path.join(artistDir, album);
      if (!fs.statSync(albumDir).isDirectory()) continue;
      for (const f of fs.readdirSync(albumDir)) {
        if (!f.endsWith('.json')) continue;
        const fp = path.join(albumDir, f);
        try {
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          songs.push({ filePath: fp, dir: albumDir, fileBase: f.replace(/\.json$/, ''), data });
        } catch (e) {}
      }
    }
  }
  return songs;
}

async function main() {
  const mode = dryRun ? '[DRY-RUN]' : '[EXEC]';
  console.log(`${mode} 开始日文译名补全\n`);

  const all = collectSongs();
  const targets = all.filter(s =>
    s.data.language === '日语'
    && !hasChineseInParens(s.data.title || '')
    && extractQQMid(s.data.sourceUrl)
  );
  console.log(`候选 ${targets.length} 首 (总 ${all.length} 首)\n`);

  let updated = 0, unmatched = 0, failed = 0;
  const unmatchedList = [];

  for (const s of targets) {
    const mid = extractQQMid(s.data.sourceUrl);
    const query = `${s.data.title} ${primaryArtistBare(s.data.artist)}`.trim();
    try {
      const results = await searchQQMusic(query);
      const match = results.find(r => r.mid === mid);
      if (!match || !hasChineseInParens(match.title || '')) {
        unmatched++;
        unmatchedList.push({ old: s.data.title, artist: s.data.artist, query, gotTitle: match?.title || null });
        console.log(`  ❓ 未匹配: ${s.data.title} (${s.data.artist})`);
      } else {
        const newTitle = match.title;
        const oldSafe = toSafeName(s.data.title);
        const newSafe = toSafeName(newTitle);
        const newJsonPath = path.join(s.dir, `${newSafe}.json`);
        const oldJpg = path.join(s.dir, `${oldSafe}.jpg`);
        const newJpg = path.join(s.dir, `${newSafe}.jpg`);

        console.log(`  ✅ ${s.data.title} → ${newTitle}`);
        if (!dryRun) {
          // 改写 cover 字段中的 title 部分
          if (typeof s.data.cover === 'string' && s.data.cover.endsWith(`/${oldSafe}.jpg`)) {
            s.data.cover = s.data.cover.slice(0, -`${oldSafe}.jpg`.length) + `${newSafe}.jpg`;
          }
          s.data.title = newTitle;
          fs.writeFileSync(s.filePath, JSON.stringify(s.data, null, 2), 'utf-8');
          if (s.filePath !== newJsonPath) fs.renameSync(s.filePath, newJsonPath);
          if (fs.existsSync(oldJpg) && oldJpg !== newJpg) fs.renameSync(oldJpg, newJpg);
        }
        updated++;
      }
    } catch (e) {
      failed++;
      console.error(`  ❌ 失败: ${s.data.title} — ${e.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n${mode} 完成 — 自动补 ${updated} 首 / 未匹配 ${unmatched} 首 / 失败 ${failed} 首`);
  if (unmatchedList.length) {
    console.log('\n未匹配列表（需手动处理）:');
    for (const u of unmatchedList) {
      console.log(`  - ${u.old}  (artist=${u.artist}, query="${u.query}", QQ返回="${u.gotTitle || '无匹配'}")`);
    }
  }
}

main();
