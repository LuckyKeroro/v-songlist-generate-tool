// API 基础路径
const API = '';

// 状态管理
let pendingSongs = []; // 待处理的歌曲
let currentSongIndex = -1; // 当前处理的歌曲索引
let reSearchMode = null; // 重新搜索模式: null 表示新增, {artist, album, title} 表示更新
let savedSongsCache = []; // 已保存歌曲缓存，用于比较
let linksData = []; // 链接配置数据

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadSavedSongs();
  setupDropZones();
  setupEventListeners();
});

// ========== 配置管理 ==========

async function loadConfig() {
  try {
    const res = await fetch(`${API}/api/config`);
    const config = await res.json();

    document.getElementById('pageTitle').value = config.title || '';
    document.getElementById('streamerName').value = config.name || '';
    document.getElementById('subtitle').value = config.subtitle || '';
    document.getElementById('announcement').value = config.announcement || '';

    // 加载链接配置
    linksData = config.links || [];
    renderLinks();

    // 加载图片预览
    if (config.background) {
      const ext = config.background.split('.').pop();
      document.getElementById('backgroundPreview').src = `../public/background.${ext}?t=${Date.now()}`;
      document.getElementById('backgroundPreview').style.display = 'block';
    }
    if (config.avatar) {
      const ext = config.avatar.split('.').pop();
      document.getElementById('avatarPreview').src = `../public/avatar.${ext}?t=${Date.now()}`;
      document.getElementById('avatarPreview').style.display = 'block';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// ========== 链接管理 ==========

function renderLinks() {
  const container = document.getElementById('linksContainer');
  container.innerHTML = linksData.map((link, index) => `
    <div class="link-row">
      <input type="text" placeholder="显示文字" value="${escapeHtml(link.text || '')}" onchange="updateLink(${index}, 'text', this.value)">
      <input type="url" placeholder="链接地址" value="${escapeHtml(link.url || '')}" onchange="updateLink(${index}, 'url', this.value)">
      <button type="button" class="btn btn-danger btn-small" onclick="removeLink(${index})">删除</button>
    </div>
  `).join('');
}

function addLink() {
  linksData.push({ text: '', url: '' });
  renderLinks();
}

function removeLink(index) {
  linksData.splice(index, 1);
  renderLinks();
}

function updateLink(index, field, value) {
  if (linksData[index]) {
    linksData[index][field] = value;
  }
}

async function saveConfig() {
  const config = {
    title: document.getElementById('pageTitle').value,
    name: document.getElementById('streamerName').value,
    subtitle: document.getElementById('subtitle').value,
    announcement: document.getElementById('announcement').value,
    links: linksData.filter(link => link.text || link.url) // 过滤掉空白链接
  };

  try {
    const res = await fetch(`${API}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (data.success) {
      showToast('配置已保存');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    showToast('保存失败');
  }
}

// ========== 已保存歌曲 ==========

async function loadSavedSongs() {
  try {
    const res = await fetch(`${API}/api/songs`);
    const data = await res.json();
    savedSongsCache = data.songs || []; // 缓存已保存歌曲
    renderSavedSongs(data.songs);
  } catch (error) {
    console.error('加载歌曲失败:', error);
    document.getElementById('savedSongs').innerHTML = '<p class="empty-hint">加载失败</p>';
  }
}

function filterSavedSongs() {
  const searchInput = document.getElementById('savedSearchInput').value.toLowerCase().trim();
  if (!searchInput) {
    renderSavedSongs(savedSongsCache);
    return;
  }

  const filtered = savedSongsCache.filter(song => {
    return (
      (song.title && song.title.toLowerCase().includes(searchInput)) ||
      (song.artist && song.artist.toLowerCase().includes(searchInput)) ||
      (song.album && song.album.toLowerCase().includes(searchInput)) ||
      (song.lyrics && song.lyrics.toLowerCase().includes(searchInput)) ||
      (song.language && song.language.toLowerCase().includes(searchInput))
    );
  });

  renderSavedSongs(filtered);
}

function renderSavedSongs(songs) {
  const container = document.getElementById('savedSongs');

  if (songs.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无匹配的歌曲</p>';
    return;
  }

  container.innerHTML = songs.map((song, index) => {
    // 在缓存中找到原始索引
    const originalIndex = savedSongsCache.findIndex(s =>
      s.title === song.title && s.artist === song.artist && s.album === song.album
    );

    return `
    <div class="saved-item" id="saved-song-${originalIndex}">
      <div class="saved-info">
        <div class="saved-title">${escapeHtml(song.title)} - ${escapeHtml(song.artist)}</div>
        <div class="saved-meta">${escapeHtml(song.album || '')} · ${song.language || ''}</div>
      </div>
      <div class="saved-actions">
        <button class="btn btn-primary btn-small" onclick="refreshSong(${originalIndex})">刷新</button>
        <button class="btn btn-secondary btn-small" onclick="reSearchSong(${originalIndex})">重新搜索</button>
        <button class="btn btn-secondary btn-small" onclick="editSavedSong(${originalIndex})">编辑</button>
        <button class="btn btn-danger btn-small" onclick="deleteSong(${originalIndex})">删除</button>
      </div>
    </div>
  `}).join('');

  // 保存歌曲列表供重新搜索使用
  window.savedSongsList = savedSongsCache;
}

async function deleteSong(index) {
  const song = window.savedSongsList[index];
  if (!song) return;

  if (!confirm(`确定删除 "${song.title}" 吗？`)) return;

  try {
    const res = await fetch(`${API}/api/song/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.album || '未知专辑')}/${encodeURIComponent(song.title)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('已删除');
      loadSavedSongs();
    } else {
      showToast(data.error || '删除失败');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showToast('删除失败');
  }
}

// ========== 重新搜索已保存歌曲 ==========

async function refreshSong(index) {
  const song = window.savedSongsList[index];
  if (!song.sourceUrl) {
    showToast('该歌曲没有来源URL，无法刷新');
    return;
  }

  showToast('正在刷新元数据...');

  try {
    const res = await fetch(`${API}/api/refresh-song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song })
    });
    const data = await res.json();

    if (data.success) {
      showToast('刷新成功');
      loadSavedSongs();
    } else {
      showToast(data.message || '刷新失败');
    }
  } catch (error) {
    console.error('刷新失败:', error);
    showToast('刷新失败');
  }
}

async function reSearchSong(index) {
  const song = window.savedSongsList[index];
  reSearchMode = { artist: song.artist, album: song.album, title: song.title };

  document.getElementById('searchModal').classList.add('active');
  document.getElementById('searchingText').style.display = 'block';
  document.getElementById('searchResults').innerHTML = '';

  try {
    const res = await fetch(`${API}/api/search-song?keyword=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}`);
    const data = await res.json();

    document.getElementById('searchingText').style.display = 'none';
    renderSearchResults(data.qqSongs || [], data.neteaseSongs || []);
  } catch (error) {
    console.error('搜索失败:', error);
    document.getElementById('searchingText').textContent = '搜索失败，请尝试手动编辑';
  }
}

// ========== 编辑已保存歌曲 ==========

function editSavedSong(index) {
  const song = window.savedSongsList[index];
  reSearchMode = { artist: song.artist, album: song.album, title: song.title };

  document.getElementById('manualTitle').value = song.title;
  document.getElementById('manualArtist').value = song.artist || '';
  document.getElementById('manualAlbum').value = song.album || '';
  document.getElementById('manualDate').value = song.releaseDate || '';
  document.getElementById('manualLanguage').value = song.language || '中文';
  document.getElementById('manualLyrics').value = song.lyrics || '';

  document.getElementById('manualModal').classList.add('active');
}

// ========== 手动添加歌曲 ==========

function openAddManualModal() {
  reSearchMode = null; // 确保是新增模式
  currentSongIndex = -1;

  document.getElementById('manualTitle').value = '';
  document.getElementById('manualArtist').value = '';
  document.getElementById('manualAlbum').value = '';
  document.getElementById('manualDate').value = '';
  document.getElementById('manualLanguage').value = '中文';
  document.getElementById('manualLyrics').value = '';

  document.getElementById('manualModal').classList.add('active');
}

// ========== 搜索添加歌曲 ==========

function openAddSearchModal() {
  reSearchMode = null; // 确保是新增模式
  currentSongIndex = -1;

  // 显示一个简单的搜索输入框
  const keyword = prompt('请输入歌曲名称或歌手：');
  if (!keyword) return;

  document.getElementById('searchModal').classList.add('active');
  document.getElementById('searchingText').style.display = 'block';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchNeteaseBtn').style.display = 'none';

  // 保存当前搜索关键词，供网易云搜索使用
  window.currentSearchKeyword = keyword;
  window.currentSearchArtist = '';

  try {
    // 默认只搜索QQ音乐
    fetch(`${API}/api/search-song?keyword=${encodeURIComponent(keyword)}&source=qq`)
      .then(res => res.json())
      .then(data => {
        document.getElementById('searchingText').style.display = 'none';
        renderSearchResults(data.songs || [], [], 'qq');
      });
  } catch (error) {
    console.error('搜索失败:', error);
    document.getElementById('searchingText').textContent = '搜索失败';
  }
}

// 搜索网易云（手动触发）
async function searchNeteaseOnly() {
  const keyword = window.currentSearchKeyword || '';
  const artist = window.currentSearchArtist || '';

  document.getElementById('searchNeteaseBtn').disabled = true;
  document.getElementById('searchNeteaseBtn').textContent = '搜索中...';

  try {
    const res = await fetch(`${API}/api/search-song?keyword=${encodeURIComponent(keyword)}&artist=${encodeURIComponent(artist)}&source=netease`);
    const data = await res.json();

    // 合并已有的QQ结果和新获取的网易云结果
    const existingQQ = window.currentSearchResults.qq || [];
    renderSearchResults(existingQQ, data.songs || [], 'both');
  } catch (error) {
    console.error('网易云搜索失败:', error);
    showToast('网易云搜索失败');
  } finally {
    document.getElementById('searchNeteaseBtn').disabled = false;
    document.getElementById('searchNeteaseBtn').textContent = '🔍 同时搜索网易云';
  }
}

// ========== 拖拽上传 ==========

function setupDropZones() {
  // Excel 上传
  setupDropZone('excelDrop', 'excelInput', handleExcelUpload);

  // 图片上传
  setupDropZone('backgroundDrop', 'backgroundInput', (file) => handleImageUpload(file, 'background'));
  setupDropZone('avatarDrop', 'avatarInput', (file) => handleImageUpload(file, 'avatar'));
}

function setupDropZone(dropId, inputId, handler) {
  const dropZone = document.getElementById(dropId);
  const input = document.getElementById(inputId);

  dropZone.addEventListener('click', () => input.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handler(file);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handler(file);
  });
}

async function handleExcelUpload(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    showToast('正在解析 Excel...');
    const res = await fetch(`${API}/api/upload-excel`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.songs) {
      // 与已保存歌曲比较，标记已存在的歌曲
      pendingSongs = data.songs.map(song => {
        const exists = checkSongExists(song);
        if (exists) {
          song.status = 'exists';
        }
        return song;
      });
      renderPendingSongs();
      document.getElementById('searchAllBtn').disabled = pendingSongs.length === 0;

      const existCount = pendingSongs.filter(s => s.status === 'exists').length;
      const newCount = pendingSongs.filter(s => s.status === 'pending').length;
      showToast(`已导入 ${data.songs.length} 首（${newCount}首待处理，${existCount}首已存在）`);
    }
  } catch (error) {
    console.error('Excel 上传失败:', error);
    showToast('上传失败');
  }
}

// 检查歌曲是否已存在
function checkSongExists(song) {
  if (!savedSongsCache || savedSongsCache.length === 0) return false;

  return savedSongsCache.some(saved => {
    // 使用 isTitleMatch 检查歌名匹配（支持中文译名）
    if (!isTitleMatch(song.title, saved.title)) return false;

    // 如果Excel只有歌名，歌名匹配即认为存在
    if (!song.artist) return true;

    // 检查歌手是否匹配（支持合作歌手的部分匹配）
    return isArtistMatch(song.artist, saved.artist);
  });
}

// 检查歌手是否匹配（支持合作歌手的部分匹配）
function isArtistMatch(excelArtist, savedArtist) {
  const excelNormalized = normalizeText(excelArtist);
  const savedNormalized = normalizeText(savedArtist || '');

  // 完全匹配
  if (excelNormalized === savedNormalized) return true;

  // 将歌手按分隔符拆分
  const excelArtists = splitArtists(excelNormalized);
  const savedArtists = splitArtists(savedNormalized);

  // 检查是否有交集（Excel中的任意歌手在已保存歌手中出现）
  return excelArtists.some(ea => savedArtists.some(sa => ea === sa || sa.includes(ea) || ea.includes(sa)));
}

// 拆分合作歌手
function splitArtists(text) {
  return text
    .split(/[\/&\,\、，]/) // 按常见分隔符拆分
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

// 规范化文本：去除空格、特殊符号，转小写
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    // 去除括号及其内容（如 "(Explicit)", "(Live)", "（ remix ）"）
    .replace(/[\(\[【\(].*?[\)\]】\)]/gi, '')
    // 去除常见版本标识
    .replace(/\b(explicit|clean|radio\s*edit|edit|remix|live|acoustic|instrumental|demo|remaster|version|slowed|reverb|cover|カバー)\b/gi, '')
    // 去除空格和常见符号
    .replace(/[\s\-_\.\,\·・]/g, '')
    .normalize('NFKC'); // 统一 Unicode 字符（如全角转半角）
}

// 提取括号内的中文译名（排除版本等关键词)
function extractChineseTitle(text) {
  if (!text) return [];
  const chineseTitles = [];
  // 排除关键词列表
  const excludeKeywords = ['カバー', 'cover', 'inst', 'ver', 'acoustic', 'edit', 'remix', 'live', 'remaster'];
  // 匹配括号内的内容
  const matches = text.match(/[\(\[【\(][^\)\]】]+[\)\]】\)]/g);
  if (matches) {
    matches.forEach(match => {
      const content = match.replace(/[\(\[【\)\]】]/g, '').trim();
      // 只保留中文，排除关键词
      if (/^[\u4e00-\u9fff]+$/.test(content) && !excludeKeywords.includes(content.toLowerCase())) {
        chineseTitles.push(content.toLowerCase());
      }
    });
  }
  return chineseTitles;
}

// 检查两个歌名是否匹配（支持中文译名与外文原名互相匹配）
function isTitleMatch(title1, title2) {
  const norm1 = normalizeText(title1);
  const norm2 = normalizeText(title2);

  // 直接匹配
  if (norm1 === norm2) return true;

  // 检查中文译名匹配
  const chinese1 = extractChineseTitle(title1);
  const chinese2 = extractChineseTitle(title2);

  // 情况1: title1是纯中文译名，title2是外文原名+中文译名
  // 例如: "反语" vs "アイロニ (反语) (カバー)"
  // norm1 = "反语", norm2 = "アイロニ", chinese2 = ["反语"]
  // 检查 norm1 是否在 chinese2 中
  if (chinese2.some(c => c === norm1)) return true;

  // 情况2: title2是纯中文译名，title1是外文原名+中文译名
  if (chinese1.some(c => c === norm2)) return true;

  // 情况3: 任一方的中文译名与另一方的原文（非译名部分）匹配
  // 例如: "反语" 匹配 "アイロニ" (如果存在映射关系)
  // 这里我们检查: 如果一方是纯中文且没有括号，它可能就是译名
  const isPureChinese1 = /^[\u4e00-\u9fff]+$/.test(title1) && !title1.includes('(');
  const isPureChinese2 = /^[\u4e00-\u9fff]+$/.test(title2) && !title2.includes('(');

  // 如果一方是纯中文，另一方有中文译名，检查是否匹配
  if (isPureChinese1 && chinese2.length > 0) {
    if (chinese2.includes(norm1)) return true;
  }
  if (isPureChinese2 && chinese1.length > 0) {
    if (chinese1.includes(norm2)) return true;
  }

  // 双方都有中文译名时比较
  if (chinese1.length > 0 && chinese2.length > 0) {
    if (chinese1.some(c => chinese2.includes(c))) return true;
  }

  return false;
}

async function handleImageUpload(file, type) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API}/api/upload-image/${type}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      // 更新预览
      const preview = document.getElementById(`${type}Preview`);
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
      showToast('上传成功');
    }
  } catch (error) {
    console.error('图片上传失败:', error);
    showToast('上传失败');
  }
}

// ========== 歌曲处理 ==========

function renderPendingSongs() {
  const container = document.getElementById('songList');

  if (pendingSongs.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无歌曲，请先上传 Excel 导入</p>';
    return;
  }

  container.innerHTML = pendingSongs.map((song, index) => `
    <div class="song-item ${song.status === 'exists' || song.status === 'confirmed' || song.status === 'manual' ? 'clickable' : ''}"
         ${song.status === 'exists' || song.status === 'confirmed' || song.status === 'manual' ? `onclick="scrollToSavedSong('${escapeHtml(song.title)}', '${escapeHtml(song.artist || '')}')"` : ''}>
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-artist">${song.artist ? escapeHtml(song.artist) : '<span style="color:#999">未知歌手</span>'}</div>
      </div>
      <span class="song-status status-${song.status}">${getStatusText(song.status)}</span>
      <div class="song-actions">
        ${song.status === 'pending' ? `
          <button class="btn btn-primary btn-small" onclick="event.stopPropagation();searchSong(${index})">搜索</button>
          <button class="btn btn-secondary btn-small" onclick="event.stopPropagation();openManualModal(${index})">手动</button>
        ` : ''}
        ${song.status === 'exists' ? `
          <button class="btn btn-secondary btn-small" onclick="event.stopPropagation();searchSong(${index})">重新处理</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function getStatusText(status) {
  switch (status) {
    case 'pending': return '待处理';
    case 'confirmed': return '已确认';
    case 'manual': return '手动输入';
    case 'exists': return '已存在';
    default: return status;
  }
}

// 滚动到已保存歌曲位置
function scrollToSavedSong(title, artist) {
  // 查找匹配的已保存歌曲
  const savedSongs = window.savedSongsList || [];
  let targetIndex = -1;

  for (let i = 0; i < savedSongs.length; i++) {
    if (isTitleMatch(savedSongs[i].title, title)) {
      // 如果指定了歌手，也要匹配歌手
      if (artist && savedSongs[i].artist) {
        if (isArtistMatch(artist, savedSongs[i].artist)) {
          targetIndex = i;
          break;
        }
      } else {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex >= 0) {
    const element = document.getElementById(`saved-song-${targetIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 2000);
    }
  } else {
    showToast('未在已保存列表中找到该歌曲');
  }
}

async function searchSong(index) {
  currentSongIndex = index;
  const song = pendingSongs[index];

  // 如果是重新处理已存在的歌曲，将状态改为pending
  if (song.status === 'exists') {
    song.status = 'pending';
    renderPendingSongs();
  }

  document.getElementById('searchModal').classList.add('active');
  document.getElementById('searchingText').style.display = 'block';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchNeteaseBtn').style.display = 'none';

  // 保存当前搜索关键词，供网易云搜索使用
  window.currentSearchKeyword = song.title;
  window.currentSearchArtist = song.artist || '';

  try {
    // 默认只搜索QQ音乐
    const res = await fetch(`${API}/api/search-song?keyword=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}&source=qq`);
    const data = await res.json();

    document.getElementById('searchingText').style.display = 'none';
    renderSearchResults(data.songs || [], [], 'qq');
  } catch (error) {
    console.error('搜索失败:', error);
    document.getElementById('searchingText').textContent = '搜索失败，请尝试手动输入';
  }
}

function renderSearchResults(qqSongs, neteaseSongs, mode = 'both') {
  const container = document.getElementById('searchResults');

  // 合并所有结果并添加source标识
  window.currentSearchResults = {
    qq: qqSongs || [],
    netease: neteaseSongs || []
  };

  const hasQQ = qqSongs && qqSongs.length > 0;
  const hasNetease = neteaseSongs && neteaseSongs.length > 0;

  // 如果是只搜索QQ模式且没有网易云结果，显示网易云搜索按钮
  if (mode === 'qq' && !hasNetease) {
    document.getElementById('searchNeteaseBtn').style.display = 'inline-block';
  } else {
    document.getElementById('searchNeteaseBtn').style.display = 'none';
  }

  if (!hasQQ && !hasNetease) {
    container.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">未找到匹配的歌曲，请尝试手动输入</p>';
    return;
  }

  let html = '<div class="search-results-grid">';

  // QQ音乐列
  html += '<div class="search-column">';
  html += '<div class="search-column-header qq">QQ音乐</div>';
  if (hasQQ) {
    html += qqSongs.map((song, idx) => `
      <div class="search-result-item" onclick="selectSearchResult('qq', ${idx})">
        <img src="${song.cover || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2260%22/><text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23999%22>🎵</text></svg>'}" alt="">
        <div class="search-result-info">
          <h4>${escapeHtml(song.title)}</h4>
          <p>${escapeHtml(song.artist)} - ${escapeHtml(song.album)}</p>
        </div>
      </div>
    `).join('');
  } else {
    html += '<p class="no-results">无结果</p>';
  }
  html += '</div>';

  // 网易云音乐列（只有在有结果或both模式时显示）
  if (mode === 'both' || hasNetease) {
    html += '<div class="search-column">';
    html += '<div class="search-column-header netease">网易云</div>';
    if (hasNetease) {
      html += neteaseSongs.map((song, idx) => `
        <div class="search-result-item" onclick="selectSearchResult('netease', ${idx})">
          <img src="${song.cover || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2260%22/><text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23999%22>🎵</text></svg>'}" alt="">
          <div class="search-result-info">
            <h4>${escapeHtml(song.title)}</h4>
            <p>${escapeHtml(song.artist)} - ${escapeHtml(song.album)}</p>
          </div>
        </div>
      `).join('');
    } else {
      html += '<p class="no-results">无结果</p>';
    }
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

async function selectSearchResult(source, idx) {
  const song = window.currentSearchResults[source][idx];

  // 获取歌词
  let lyrics = '';
  try {
    const res = await fetch(`${API}/api/song-detail/${source}/${song.id}`);
    const data = await res.json();
    lyrics = data.lyrics || '';
  } catch (error) {
    console.error('获取歌词失败:', error);
  }

  // 保存歌曲数据
  const songData = {
    title: song.title,
    artist: song.artist,
    album: song.album,
    releaseDate: song.releaseDate,
    lyrics: lyrics,
    cover: song.cover,
    sourceUrl: song.sourceUrl || null
  };

  try {
    let res;
    if (reSearchMode) {
      // 更新模式：使用 PUT 请求替换现有歌曲
      res = await fetch(`${API}/api/song/${encodeURIComponent(reSearchMode.artist)}/${encodeURIComponent(reSearchMode.album)}/${encodeURIComponent(reSearchMode.title)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: songData })
      });
    } else {
      // 新增模式
      res = await fetch(`${API}/api/save-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: songData })
      });
    }
    const data = await res.json();

    if (data.success) {
      if (!reSearchMode && currentSongIndex >= 0) {
        pendingSongs[currentSongIndex].status = 'confirmed';
        renderPendingSongs();
      }
      closeModal('searchModal');
      showToast(reSearchMode ? '已更新' : '已保存');
      reSearchMode = null;
      loadSavedSongs();
    }
  } catch (error) {
    console.error('保存失败:', error);
    showToast('保存失败');
  }
}

// ========== 手动输入 ==========

function openManualModal(index) {
  currentSongIndex = index;
  const song = pendingSongs[index];

  // 如果是重新处理已存在的歌曲，将状态改为pending
  if (song.status === 'exists') {
    song.status = 'pending';
    renderPendingSongs();
  }

  document.getElementById('manualTitle').value = song.title;
  document.getElementById('manualArtist').value = song.artist || '';
  document.getElementById('manualAlbum').value = '';
  document.getElementById('manualDate').value = '';
  document.getElementById('manualLanguage').value = '中文';
  document.getElementById('manualLyrics').value = '';

  document.getElementById('manualModal').classList.add('active');
}

async function saveManualInput() {
  const songData = {
    title: document.getElementById('manualTitle').value,
    artist: document.getElementById('manualArtist').value || '未知歌手',
    album: document.getElementById('manualAlbum').value || '未知专辑',
    releaseDate: document.getElementById('manualDate').value || null,
    lyrics: document.getElementById('manualLyrics').value,
    language: document.getElementById('manualLanguage').value
  };

  if (!songData.title) {
    showToast('请填写歌名');
    return;
  }

  try {
    let res;
    if (reSearchMode) {
      // 更新模式
      res = await fetch(`${API}/api/song/${encodeURIComponent(reSearchMode.artist)}/${encodeURIComponent(reSearchMode.album)}/${encodeURIComponent(reSearchMode.title)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: songData })
      });
    } else {
      // 新增模式
      res = await fetch(`${API}/api/save-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: songData })
      });
    }
    const data = await res.json();

    if (data.success) {
      if (!reSearchMode && currentSongIndex >= 0) {
        pendingSongs[currentSongIndex].status = 'manual';
        renderPendingSongs();
      }
      closeModal('manualModal');
      showToast(reSearchMode ? '已更新' : '已保存');
      reSearchMode = null;
      loadSavedSongs();
    }
  } catch (error) {
    console.error('保存失败:', error);
    showToast('保存失败');
  }
}

// ========== 批量搜索 ==========

async function searchAllSongs() {
  const pendingItems = pendingSongs.filter(s => s.status === 'pending');
  if (pendingItems.length === 0) {
    showToast('没有待处理的歌曲');
    return;
  }

  showToast(`开始处理 ${pendingItems.length} 首歌曲...`);

  for (let i = 0; i < pendingSongs.length; i++) {
    if (pendingSongs[i].status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 500)); // 避免请求过快
      await autoSearchSong(i);
    }
  }

  showToast('批量处理完成');
}

async function autoSearchSong(index) {
  const song = pendingSongs[index];

  try {
    // 优先使用QQ音乐搜索
    const res = await fetch(`${API}/api/search-song?keyword=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}&source=qq`);
    const data = await res.json();

    if (data.songs && data.songs.length > 0) {
      const result = data.songs[0];

      // 获取歌词
      let lyrics = '';
      try {
        const lyricRes = await fetch(`${API}/api/song-detail/qq/${result.id}`);
        const lyricData = await lyricRes.json();
        lyrics = lyricData.lyrics || '';
      } catch (e) {}

      // 保存
      await fetch(`${API}/api/save-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: {
            title: result.title,
            artist: result.artist,
            album: result.album,
            releaseDate: result.releaseDate,
            lyrics: lyrics,
            cover: result.cover,
            sourceUrl: result.sourceUrl || null
          }
        })
      });

      pendingSongs[index].status = 'confirmed';
    }
  } catch (error) {
    console.error(`处理歌曲 "${song.title}" 失败:`, error);
  }

  renderPendingSongs();
  loadSavedSongs();
}

// ========== 一键更新所有元数据 ==========

async function refreshAllSongs() {
  if (!confirm('确定要更新所有歌曲的元数据吗？这将根据每首歌的来源URL重新获取歌词和封面。')) {
    return;
  }

  showToast('开始更新所有元数据...');

  try {
    const res = await fetch(`${API}/api/refresh-all-songs`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast(`更新完成！成功: ${data.updated}, 失败: ${data.failed}`);
      loadSavedSongs();
    } else {
      showToast('更新失败');
    }
  } catch (error) {
    console.error('更新失败:', error);
    showToast('更新失败');
  }
}

// ========== 生成网站 ==========

async function generateSite() {
  const statusEl = document.getElementById('generateStatus');
  statusEl.textContent = '正在生成...';

  try {
    const res = await fetch(`${API}/api/generate`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      statusEl.textContent = '生成成功！';
      showToast('网站已生成到 dist/ 目录');
    } else {
      statusEl.textContent = '生成失败';
    }
  } catch (error) {
    console.error('生成失败:', error);
    statusEl.textContent = '生成失败';
    showToast('生成失败，请查看控制台');
  }
}

// ========== 事件监听 ==========

function setupEventListeners() {
  // 保存配置
  document.getElementById('saveConfig').addEventListener('click', saveConfig);

  // 列表高度切换
  document.getElementById('pendingPageSize').addEventListener('change', (e) => {
    const list = document.getElementById('songList');
    list.className = list.className.replace(/height-\d+/, `height-${e.target.value}`);
  });

  document.getElementById('savedPageSize').addEventListener('change', (e) => {
    const list = document.getElementById('savedSongs');
    list.className = list.className.replace(/height-\d+/, `height-${e.target.value}`);
  });

  // 已保存歌曲搜索
  document.getElementById('savedSearchInput').addEventListener('input', filterSavedSongs);

  // 批量搜索
  document.getElementById('searchAllBtn').addEventListener('click', searchAllSongs);

  // 生成网站
  document.getElementById('generateBtn').addEventListener('click', generateSite);

  // 弹窗关闭
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('active');
    });
  });

  // 点击弹窗背景关闭
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // 手动输入保存
  document.getElementById('saveManualBtn').addEventListener('click', saveManualInput);

  // 手动输入弹窗按钮
  document.getElementById('manualInputBtn').addEventListener('click', () => {
    closeModal('searchModal');
    openManualModal(currentSongIndex);
  });

  // 搜索网易云按钮
  document.getElementById('searchNeteaseBtn').addEventListener('click', searchNeteaseOnly);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ========== 工具函数 ==========

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
