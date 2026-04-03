const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { spawn } = require('child_process');

const app = express();
const PORT = 3001;
const PREVIEW_PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 路径配置
const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'Resources');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PUBLIC_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (req.params.type === 'background') {
      cb(null, `background${ext}`);
    } else if (req.params.type === 'avatar') {
      cb(null, `avatar${ext}`);
    } else {
      cb(null, file.originalname);
    }
  }
});
const upload = multer({ storage });

// ========== Excel 解析 ==========

app.post('/api/upload-excel', multer().single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // 解析数据，假设第一行是表头
    const songs = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const song = {
        id: `temp-${Date.now()}-${i}`,
        title: String(row[0] || '').trim(),
        artist: String(row[1] || '').trim() || null,
        status: 'pending' // pending, confirmed, manual
      };

      if (song.title) {
        songs.push(song);
      }
    }

    res.json({ songs });
  } catch (error) {
    console.error('Excel 解析错误:', error);
    res.status(500).json({ error: 'Excel 解析失败' });
  }
});

// ========== 网易云音乐 API 搜索 ==========

app.get('/api/search-song', async (req, res) => {
  try {
    const { keyword, artist, source } = req.query;
    if (!keyword) {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }

    // 构建搜索词
    let searchKeyword = keyword;
    if (artist) {
      searchKeyword = `${keyword} ${artist}`;
    }

    // 根据source参数决定搜索哪个平台，默认只搜索QQ音乐
    if (source === 'netease') {
      const songs = await searchNetEase(searchKeyword);
      return res.json({ songs, source: 'netease' });
    } else {
      // 默认搜索QQ音乐
      const songs = await searchQQMusic(searchKeyword);
      return res.json({ songs, source: 'qq' });
    }
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 带超时的fetch
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 网易云音乐搜索
async function searchNetEase(keyword) {
  try {
    const response = await fetchWithTimeout(`https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&limit=10`, {}, 10000);
    const data = await response.json();

    if (data.code !== 200 || !data.result || !data.result.songs) {
      return [];
    }

    return data.result.songs.map(song => ({
      id: song.id,
      source: 'netease',
      title: song.name,
      artist: song.artists.map(a => a.name).join('/'),
      album: song.album.name,
      cover: song.album.picUrl,
      releaseDate: song.album.publishTime ? new Date(song.album.publishTime).toISOString().split('T')[0] : null,
      sourceUrl: `https://music.163.com/#/song?id=${song.id}`
    }));
  } catch (error) {
    console.error('网易云音乐搜索错误:', error.message);
    return [];
  }
}

// QQ音乐搜索
async function searchQQMusic(keyword) {
  try {
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
    const response = await fetchWithTimeout('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
        'Content-Type': 'application/json;charset=utf-8'
      },
      body
    }, 10000);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('QQ音乐返回非JSON内容 status=%d text=%s', response.status, text.slice(0, 200));
      return [];
    }

    const list = data && data.req && data.req.data && data.req.data.body &&
                 data.req.data.body.song && data.req.data.body.song.list;
    if (!list) {
      return [];
    }

    return list.map(song => ({
      id: song.mid,
      source: 'qq',
      title: song.name,
      artist: (song.singer || []).map(s => s.name).join('/'),
      album: song.album ? song.album.name : '',
      cover: song.album && song.album.pmid
        ? `https://y.qq.com/music/photo_new/T002R300x300M000${song.album.pmid}.jpg`
        : '',
      releaseDate: song.time_public || null,
      sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${song.mid}`
    }));
  } catch (error) {
    console.error('QQ音乐搜索错误:', error.message);
    return [];
  }
}

// ========== 获取歌曲详情（包含歌词） ==========

app.get('/api/song-detail/:source/:id', async (req, res) => {
  try {
    const { source, id } = req.params;
    let lyrics = '';

    if (source === 'qq') {
      lyrics = await getQQMusicLyric(id);
    } else {
      lyrics = await getNetEaseLyric(id);
    }

    res.json({ lyrics });
  } catch (error) {
    console.error('获取歌词错误:', error);
    res.status(500).json({ error: '获取歌词失败' });
  }
});

// 网易云歌词
async function getNetEaseLyric(id) {
  try {
    const response = await fetchWithTimeout(`https://music.163.com/api/song/lyric?id=${id}&lv=1`, {}, 10000);
    const data = await response.json();

    if (data.code === 200 && data.lrc && data.lrc.lyric) {
      return data.lrc.lyric.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    }
    return '';
  } catch (error) {
    console.error('网易云歌词获取错误:', error.message);
    return '';
  }
}

// QQ音乐歌词
async function getQQMusicLyric(songmid) {
  try {
    // 获取歌词 - 使用fcg_query_lyric_new API
    const lyricResponse = await fetchWithTimeout(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json`, {
      headers: {
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, 10000);
    const data = await lyricResponse.json();

    if (data && data.lyric) {
      // Base64解码并去除时间标记
      const lyric = Buffer.from(data.lyric, 'base64').toString('utf-8');
      return lyric.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    }
    return '';
  } catch (error) {
    console.error('QQ音乐歌词获取错误:', error);
    return '';
  }
}

// ========== 下载封面图片到本地 ==========
async function downloadCoverImage(coverUrl, artist, album, title) {
  if (!coverUrl) return null;

  try {
    // 构建本地路径
    const safeArtist = artist.replace(/[\/\\:*?"<>|]/g, '_');
    const safeAlbum = album.replace(/[\/\\:*?"<>|]/g, '_');
    const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '_');
    const coverDir = path.join(RESOURCES_DIR, safeArtist, safeAlbum);
    const coverPath = path.join(coverDir, `${safeTitle}.jpg`);

    // 确保目录存在
    fs.mkdirSync(coverDir, { recursive: true });

    // 下载图片
    const response = await fetch(coverUrl);
    if (!response.ok) {
      console.warn(`下载封面失败: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 使用sharp转换为jpg并保存
    const sharp = require('sharp');
    await sharp(buffer)
      .jpeg({ quality: 85 })
      .toFile(coverPath);

    console.log(`  封面已保存: ${coverPath}`);
    return coverPath;
  } catch (error) {
    console.error(`下载封面图片错误: ${error.message}`);
    return null;
  }
}

// ========== 保存歌曲元数据 ==========

app.post('/api/save-song', async (req, res) => {
  try {
    const { song } = req.body;
    if (!song || !song.title) {
      return res.status(400).json({ error: '缺少必要信息' });
    }

    const artist = (song.artist || '未知歌手').replace(/[\/\\:*?"<>|]/g, '_');
    const album = (song.album || '未知专辑').replace(/[\/\\:*?"<>|]/g, '_');
    const title = song.title.replace(/[\/\\:*?"<>|]/g, '_');

    const dir = path.join(RESOURCES_DIR, artist, album);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${title}.json`);

    // 判断语言
    const language = song.language || detectLanguage(song.title, song.lyrics);

    // 下载封面图片到本地
    let localCover = null;
    if (song.cover) {
      const downloadedPath = await downloadCoverImage(song.cover, song.artist || '未知歌手', song.album || '未知专辑', song.title);
      if (downloadedPath) {
        // 使用相对路径
        localCover = path.relative(RESOURCES_DIR, downloadedPath).replace(/\\/g, '/');
      }
    }

    const songData = {
      title: song.title,
      artist: song.artist || '未知歌手',
      album: song.album || '未知专辑',
      releaseDate: song.releaseDate || null,
      lyrics: song.lyrics || '',
      language: language,
      cover: localCover,
      sourceUrl: song.sourceUrl || null
    };

    fs.writeFileSync(filePath, JSON.stringify(songData, null, 2), 'utf-8');
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('保存歌曲错误:', error);
    res.status(500).json({ error: '保存失败' });
  }
});

// 语言检测
function detectLanguage(title, lyrics) {
  const text = (title + ' ' + (lyrics || '')).toLowerCase();

  // 统计各语言字符数量
  let japaneseCount = 0; // 日语假名
  let koreanCount = 0;   // 韩语
  let chineseCount = 0;  // 中文字符
  let englishCount = 0;  // 英文字母

  for (const char of text) {
    // 日语平假名和片假名
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      japaneseCount++;
    }
    // 韩语
    else if (/[\uac00-\ud7af]/.test(char)) {
      koreanCount++;
    }
    // 中文字符（CJK统一表意文字）
    else if (/[\u4e00-\u9fff]/.test(char)) {
      chineseCount++;
    }
    // 英文字母
    else if (/[a-z]/.test(char)) {
      englishCount++;
    }
  }

  const total = japaneseCount + koreanCount + chineseCount + englishCount;

  if (total === 0) {
    return '其他';
  }

  // 找出占比最高的语言
  const counts = [
    { lang: '日语', count: japaneseCount },
    { lang: '韩语', count: koreanCount },
    { lang: '中文', count: chineseCount },
    { lang: '英语', count: englishCount }
  ];

  // 按数量排序，返回最多的
  counts.sort((a, b) => b.count - a.count);

  // 如果最高占比超过30%，返回该语言
  if (counts[0].count / total > 0.3) {
    return counts[0].lang;
  }

  // 如果英文字母占比最高（即使不到30%），也认为是英语
  if (englishCount > 0 && englishCount >= counts[0].count) {
    return '英语';
  }

  return '其他';
}

// ========== 获取所有歌曲 ==========

app.get('/api/songs', (req, res) => {
  try {
    const songs = [];

    if (!fs.existsSync(RESOURCES_DIR)) {
      return res.json({ songs: [] });
    }

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
            const content = fs.readFileSync(filePath, 'utf-8');
            songs.push(JSON.parse(content));
          }
        }
      }
    }

    res.json({ songs });
  } catch (error) {
    console.error('获取歌曲列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// ========== 获取单个歌曲详情 ==========

app.get('/api/song/:artist/:album/:title', (req, res) => {
  try {
    const { artist, album, title } = req.params;
    // 转换为文件安全的名称
    const safeArtist = toSafeName(artist);
    const safeAlbum = toSafeName(album);
    const safeTitle = toSafeName(title);
    const filePath = path.join(RESOURCES_DIR, safeArtist, safeAlbum, `${safeTitle}.json`);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const song = JSON.parse(content);
      // 添加文件路径信息用于后续操作（使用安全名称）
      song._filePath = { artist: safeArtist, album: safeAlbum, title: safeTitle };
      res.json(song);
    } else {
      res.status(404).json({ error: '歌曲不存在' });
    }
  } catch (error) {
    console.error('获取歌曲详情错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 转换为文件安全名称
function toSafeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_');
}

// ========== 更新/替换歌曲元数据 ==========

app.put('/api/song/:artist/:album/:title', async (req, res) => {
  try {
    const { artist, album, title } = req.params;
    const { song } = req.body;

    if (!song || !song.title) {
      return res.status(400).json({ error: '缺少必要信息' });
    }

    // 转换为文件安全的名称
    const safeOldArtist = toSafeName(artist);
    const safeOldAlbum = toSafeName(album);
    const safeOldTitle = toSafeName(title);

    // 删除旧文件
    const oldFilePath = path.join(RESOURCES_DIR, safeOldArtist, safeOldAlbum, `${safeOldTitle}.json`);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // 创建新文件（可能在不同目录）
    const newArtist = toSafeName(song.artist || '未知歌手');
    const newAlbum = toSafeName(song.album || '未知专辑');
    const newTitle = toSafeName(song.title);

    const dir = path.join(RESOURCES_DIR, newArtist, newAlbum);
    fs.mkdirSync(dir, { recursive: true });

    const newFilePath = path.join(dir, `${newTitle}.json`);

    // 判断语言
    const language = song.language || detectLanguage(song.title, song.lyrics);

    // 下载封面图片到本地
    let localCover = song.cover;
    if (song.cover && song.cover.startsWith('http')) {
      const downloadedPath = await downloadCoverImage(song.cover, song.artist || '未知歌手', song.album || '未知专辑', song.title);
      if (downloadedPath) {
        localCover = path.relative(RESOURCES_DIR, downloadedPath).replace(/\\/g, '/');
      }
    }

    const songData = {
      title: song.title,
      artist: song.artist || '未知歌手',
      album: song.album || '未知专辑',
      releaseDate: song.releaseDate || null,
      lyrics: song.lyrics || '',
      language: language,
      cover: localCover,
      sourceUrl: song.sourceUrl || null
    };

    fs.writeFileSync(newFilePath, JSON.stringify(songData, null, 2), 'utf-8');
    res.json({ success: true, path: newFilePath });
  } catch (error) {
    console.error('更新歌曲错误:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// ========== 删除歌曲 ==========

app.delete('/api/song/:artist/:album/:title', (req, res) => {
  try {
    const { artist, album, title } = req.params;
    // 转换为文件安全的名称
    const safeArtist = toSafeName(artist);
    const safeAlbum = toSafeName(album);
    const safeTitle = toSafeName(title);
    const filePath = path.join(RESOURCES_DIR, safeArtist, safeAlbum, `${safeTitle}.json`);

    console.log('删除请求:', { artist, album, title });
    console.log('文件路径:', filePath);
    console.log('文件存在:', fs.existsSync(filePath));

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '歌曲不存在' });
    }
  } catch (error) {
    console.error('删除歌曲错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// ========== 图片上传 ==========

app.post('/api/upload-image/:type', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    res.json({
      success: true,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// ========== 配置管理 ==========

app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(PUBLIC_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      res.json(config);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('读取配置错误:', error);
    res.status(500).json({ error: '读取配置失败' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const config = req.body;
    const configPath = path.join(PUBLIC_DIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('保存配置错误:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

// ========== 更新单个歌曲元数据 ==========

app.post('/api/refresh-song', async (req, res) => {
  try {
    const { song } = req.body;
    if (!song || !song.title) {
      return res.status(400).json({ error: '缺少歌曲信息' });
    }

    // 根据sourceUrl判断来源并搜索
    let sourceUrl = song.sourceUrl;
    let source = 'netease'
    let songId = null

    if (sourceUrl && sourceUrl.includes('y.qq.com')) {
      source = 'qq'
      // 从URL中提取songmid
      const match = sourceUrl.match(/songDetail\/([a-zA-Z0-9]+)/);
      if (match) {
        songId = match[1]
      }
    } else if (sourceUrl && sourceUrl.includes('music.163.com')) {
      source = 'netease'
      const match = sourceUrl.match(/song\?id=(\d+)/);
      if (match) {
        songId = match[1]
      }
    }

    if (!sourceUrl || !songId) {
      return res.json({
        success: false,
        message: '无法从sourceUrl提取歌曲ID',
        song: song
      });
    }

    // 获取歌词
    let lyrics = ''
    try {
      const detailRes = await fetch(`http://localhost:${PORT}/api/song-detail/${source}/${songId}`);
      const detailData = await detailRes.json()
      lyrics = detailData.lyrics || ''
    } catch (e) {
      console.error('获取歌词失败:', e)
    }

    // 下载封面图片到本地
    let localCover = song.cover;
    if (song.cover && song.cover.startsWith('http')) {
      const downloadedPath = await downloadCoverImage(song.cover, song.artist || '未知歌手', song.album || '未知专辑', song.title);
      if (downloadedPath) {
        localCover = path.relative(RESOURCES_DIR, downloadedPath).replace(/\\/g, '/');
      }
    }

    // 更新文件
    const safeArtist = toSafeName(song.artist || '未知歌手');
    const safeAlbum = toSafeName(song.album || '未知专辑');
    const safeTitle = toSafeName(song.title);
    const filePath = path.join(RESOURCES_DIR, safeArtist, safeAlbum, `${safeTitle}.json`);

    const songData = {
      title: song.title,
      artist: song.artist || '未知歌手',
      album: song.album || '未知专辑',
      releaseDate: song.releaseDate || null,
      lyrics: lyrics,
      language: song.language || detectLanguage(song.title, lyrics),
      cover: localCover,
      sourceUrl: song.sourceUrl || null
    };

    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(songData, null, 2), 'utf-8');
    }

    res.json({
      success: true,
      song: songData
    });
  } catch (error) {
    console.error('更新歌曲元数据错误:', error)
    res.status(500).json({ error: '更新失败' })
  }
})

// ========== 批量更新所有元数据 ==========

app.post('/api/refresh-all-songs', async (req, res) => {
  try {
    // 读取所有歌曲
    const songs = []
    if (!fs.existsSync(RESOURCES_DIR)) {
      return res.json({ songs: [], updated: 0, failed: 0 })
    }

    const artists = fs.readdirSync(RESOURCES_DIR)
    for (const artist of artists) {
      const artistDir = path.join(RESOURCES_DIR, artist)
      if (!fs.statSync(artistDir).isDirectory()) continue

      const albums = fs.readdirSync(artistDir)
      for (const album of albums) {
        const albumDir = path.join(artistDir, album)
        if (!fs.statSync(albumDir).isDirectory()) continue
        const files = fs.readdirSync(albumDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(albumDir, file)
            const content = fs.readFileSync(filePath, 'utf-8')
            songs.push({ ...JSON.parse(content), _filePath: filePath })
          }
        }
      }
    }

    let updated = 0
    let failed = 0

    for (const song of songs) {
      try {
        // 根据sourceUrl判断来源
        let sourceUrl = song.sourceUrl
        let source = 'netease'
        let songId = null

        if (sourceUrl && sourceUrl.includes('y.qq.com')) {
          source = 'qq'
          const match = sourceUrl.match(/songDetail\/([a-zA-Z0-9]+)/)
          if (match) {
            songId = match[1]
          }
        } else if (sourceUrl && sourceUrl.includes('music.163.com')) {
          source = 'netease'
          const match = sourceUrl.match(/song\?id=(\d+)/)
          if (match) {
            songId = match[1]
          }
        }

        if (!sourceUrl || !songId) {
          failed++
          continue
        }

        // 获取歌词
        let lyrics = song.lyrics || ''
        try {
          const detailRes = await fetch(`http://localhost:${PORT}/api/song-detail/${source}/${songId}`)
          const detailData = await detailRes.json()
          lyrics = detailData.lyrics || song.lyrics || ''
        } catch (e) {}

        // 下载封面图片到本地（如果有远程封面URL）
        let localCover = song.cover
        if (song.cover && song.cover.startsWith('http')) {
          const downloadedPath = await downloadCoverImage(song.cover, song.artist || '未知歌手', song.album || '未知专辑', song.title)
          if (downloadedPath) {
            localCover = path.relative(RESOURCES_DIR, downloadedPath).replace(/\\/g, '/')
          }
        }

        // 更新文件
        const songData = {
          title: song.title,
          artist: song.artist || '未知歌手',
          album: song.album || '未知专辑',
          releaseDate: song.releaseDate || null,
          lyrics: lyrics,
          language: song.language || detectLanguage(song.title, lyrics),
          cover: localCover,
          sourceUrl: song.sourceUrl || null
        }
        fs.writeFileSync(song._filePath, JSON.stringify(songData, null, 2), 'utf-8')
        updated++
      } catch (e) {
        console.error(`更新歌曲失败: ${song.title}`, e)
        failed++
      }
    }

    res.json({
      success: true,
      total: songs.length,
      updated: updated,
      failed: failed
    })
  } catch (error) {
    console.error('批量更新错误:', error)
    res.status(500).json({ error: '批量更新失败' })
  }
})

// ========== 生成静态网站 ==========

app.post('/api/generate', async (req, res) => {
  try {
    const { execSync } = require('child_process');

    // 运行生成脚本
    execSync('node scripts/generate.js', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('生成网站错误:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`管理工具已启动: http://localhost:${PORT}`);
  console.log(`Resources 目录: ${RESOURCES_DIR}`);
  console.log(`Public 目录: ${PUBLIC_DIR}`);

  // 启动预览服务器
  startPreviewServer();
});

// 预览服务器
let previewServer = null;

function startPreviewServer() {
  const docsDir = path.join(ROOT_DIR, 'docs');

  // 检查 docs 目录是否存在
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 使用 Python 的简单 HTTP 服务器
  previewServer = spawn('python3', ['-m', 'http.server', String(PREVIEW_PORT)], {
    cwd: docsDir,
    stdio: 'ignore'
  });

  previewServer.on('error', (err) => {
    console.log('预览服务器启动失败:', err.message);
  });

  console.log(`预览服务器已启动: http://localhost:${PREVIEW_PORT}`);
}
