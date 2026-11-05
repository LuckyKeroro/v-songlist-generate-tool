const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const CONFIG_PATH = path.join(__dirname, '..', 'public', 'config.json')
const VIDEOS_PATH = path.join(__dirname, '..', 'public', 'videos.json')
const SCHEDULE_IMAGE_PATH = path.join(__dirname, '..', 'public', 'schedule.webp')
const SCHEDULE_API = 'https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space'
const VIDEO_API = 'https://api.bilibili.com/x/space/arc/search'
const MAX_ATTEMPTS = 6

function getModule(item, name) {
  return (Array.isArray(item?.modules) ? item.modules : []).find(module => module[name])?.[name]
}

function getPublishedTimestamp(item) {
  const seconds = Number(getModule(item, 'module_author')?.pub_ts)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
}

function findLatestSchedule(items, keyword = '周表') {
  return (items || [])
    .filter(item => String(item.content || getModule(item, 'module_desc')?.text || '').includes(keyword))
    .filter(item => item.opus_id || item.id_str || item.jump_url)
    .sort((a, b) => getPublishedTimestamp(b) - getPublishedTimestamp(a))[0]
}

function getWeekRange(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const publishedDay = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
  const monday = new Date(publishedDay)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const weekStart = monday.toISOString().slice(0, 10)
  const weekEnd = sunday.toISOString().slice(0, 10)
  const endLabel = weekStart.slice(0, 4) === weekEnd.slice(0, 4) ? weekEnd.slice(5) : weekEnd
  return {
    weekStart,
    weekEnd,
    weekLabel: `${weekStart.replaceAll('-', '.')} – ${endLabel.replaceAll('-', '.')}`,
  }
}

function normalizeSchedule(item) {
  const opusId = String(item.opus_id || item.id_str || item.jump_url?.match(/(\d+)$/)?.[1] || '')
  if (!opusId) throw new Error('周表动态缺少有效的 opus ID')
  const content = item.content || getModule(item, 'module_desc')?.text || ''
  const dynamic = getModule(item, 'module_dynamic')
  const cover = item.cover?.url || dynamic?.dyn_draw?.items?.[0]?.src
  const publishedTimestamp = getPublishedTimestamp(item)
  return {
    url: `https://www.bilibili.com/opus/${opusId}`,
    opusId,
    title: String(content).split('\n').map(line => line.trim()).find(Boolean) || '直播周表',
    cover: cover ? cover.replace(/^http:/, 'https:') : null,
    ...(publishedTimestamp ? {
      publishedAt: new Date(publishedTimestamp).toISOString(),
      ...getWeekRange(publishedTimestamp),
    } : {}),
  }
}

function normalizeVideo(video) {
  if (!video?.bvid || !video?.title) throw new Error('视频动态缺少 BV 号或标题')
  return {
    title: video.title,
    bvid: video.bvid,
    url: `https://www.bilibili.com/video/${video.bvid}`,
    cover: video.pic ? video.pic.replace(/^http:/, 'https:') : null,
    publishedAt: video.created ? new Date(video.created * 1000).toISOString() : null,
    play: Number(video.play) || 0,
    duration: video.length || '',
  }
}

async function requestJson(url, referer) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Bilibili API 返回 ${response.status}`)
    const payload = await response.json()
    if (payload.code !== 0) throw new Error(`Bilibili API: ${payload.message || payload.code}`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function waitForRetry(attempt) {
  return new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
}

async function fetchSchedule(mid) {
  const referer = `https://space.bilibili.com/${mid}/dynamic`
  let lastError = new Error('动态接口返回空列表')
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const query = new URLSearchParams({
      host_mid: String(mid),
      page: '1',
      timezone_offset: '-480',
      features: 'itemOpusStyle,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion',
      _: String(Date.now()),
    })
    try {
      const payload = await requestJson(`${SCHEDULE_API}?${query}`, referer)
      const items = payload.data?.items || []
      if (items.length) {
        const latest = findLatestSchedule(items)
        return latest ? normalizeSchedule(latest) : null
      }
    } catch (error) {
      lastError = error
    }
    if (attempt < MAX_ATTEMPTS - 1) await waitForRetry(attempt)
  }
  throw lastError
}

async function fetchLatestVideos(mid, limit = 4) {
  let lastError = new Error('视频接口请求失败')
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const query = new URLSearchParams({ mid: String(mid), ps: String(limit), pn: '1', order: 'pubdate', _: String(Date.now() + attempt) })
    try {
      const payload = await requestJson(`${VIDEO_API}?${query}`, `https://space.bilibili.com/${mid}/`)
      const list = payload.data?.list?.vlist
      if (!Array.isArray(list)) throw new Error('视频接口没有返回投稿列表')
      return list.slice(0, limit).map(normalizeVideo)
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS - 1) await waitForRetry(attempt)
    }
  }
  throw lastError
}

async function downloadScheduleImage(url) {
  if (!url) throw new Error('最新周表没有封面图片，保留现有周表')
  let lastError = new Error('周表图片下载失败')
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      let response
      try {
        response = await fetch(url, {
          headers: { Referer: 'https://www.bilibili.com/', 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (!response.ok) throw new Error(`周表图片返回 ${response.status}`)
      const source = Buffer.from(await response.arrayBuffer())
      const output = await sharp(source).webp({ quality: 88 }).toBuffer()
      const temporaryPath = `${SCHEDULE_IMAGE_PATH}.tmp`
      fs.writeFileSync(temporaryPath, output)
      fs.renameSync(temporaryPath, SCHEDULE_IMAGE_PATH)
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) await waitForRetry(attempt)
    }
  }
  throw lastError
}

function shouldUpdateSchedule(latest, current, imageExists) {
  if (!latest) return false
  if (current?.opusId === latest.opusId) {
    return !current.publishedAt || !current.weekLabel || current.image !== 'schedule.webp' || !imageExists
  }
  if (current?.publishedAt && latest.publishedAt) {
    return new Date(latest.publishedAt) > new Date(current.publishedAt)
  }
  return true
}

function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
  fs.renameSync(temporaryPath, filePath)
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  const scheduleConfig = config.schedule || {}
  const mid = scheduleConfig.mid || '613345189'
  const scheduleLink = (config.links || []).find(link => link.text === '直播周表')
  const fallbackUrl = scheduleLink?.url || scheduleConfig.fallbackUrl || `https://space.bilibili.com/${mid}/dynamic`
  const [scheduleResult, videosResult] = await Promise.allSettled([fetchSchedule(mid), fetchLatestVideos(mid, 4)])

  if (scheduleResult.status === 'fulfilled') {
    const latest = scheduleResult.value
    if (!latest) {
      console.log('最近动态中没有文字包含“周表”的内容，保留现有周表')
    } else if (!shouldUpdateSchedule(latest, scheduleConfig, fs.existsSync(SCHEDULE_IMAGE_PATH))) {
      console.log(`周表没有更新，继续使用 ${scheduleConfig.weekLabel || scheduleConfig.title || fallbackUrl}`)
    } else {
      try {
        await downloadScheduleImage(latest.cover)
        config.schedule = {
          ...scheduleConfig,
          ...latest,
          image: 'schedule.webp',
          mid,
          fallbackUrl: latest.url,
          updatedAt: latest.publishedAt || new Date().toISOString(),
        }
        if (scheduleLink) scheduleLink.url = latest.url
        writeJsonAtomic(CONFIG_PATH, config)
        console.log(`周表已更新: ${latest.weekLabel || latest.title}`)
      } catch (error) {
        console.warn(`新周表未完整下载，保留现有内容: ${error.message}`)
      }
    }
  } else {
    console.warn(`周表更新失败，保留现有内容: ${scheduleResult.reason?.message}`)
  }

  if (videosResult.status === 'fulfilled') {
    writeJsonAtomic(VIDEOS_PATH, videosResult.value)
    console.log(`已更新 ${videosResult.value.length} 条最新视频`)
  } else {
    console.warn(`视频更新失败，保留上一次的视频列表: ${videosResult.reason?.message}`)
  }
}

if (require.main === module) main()

module.exports = {
  findLatestSchedule,
  normalizeSchedule,
  normalizeVideo,
  getWeekRange,
  shouldUpdateSchedule,
  fetchSchedule,
  fetchLatestVideos,
}
