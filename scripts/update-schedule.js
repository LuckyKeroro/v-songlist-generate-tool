const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')

const CONFIG_PATH = path.join(__dirname, '..', 'public', 'config.json')
const VIDEOS_PATH = path.join(__dirname, '..', 'public', 'videos.json')
const SCHEDULE_IMAGE_PATH = path.join(__dirname, '..', 'public', 'schedule.webp')
const SCHEDULE_API = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/feed/space'
const SCHEDULE_DETAIL_API = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/detail'
const DEVICE_API = 'https://api.bilibili.com/x/frontend/finger/spi'
const VIDEO_API = 'https://api.bilibili.com/x/space/wbi/arc/search'
const NAV_API = 'https://api.bilibili.com/x/web-interface/nav'
const MAX_ATTEMPTS = 6
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

function getModule(item, name) {
  if (Array.isArray(item?.modules)) return item.modules.find(module => module[name])?.[name]
  return item?.modules?.[name]
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

function getMixinKey(imgKey, subKey) {
  const rawKey = `${imgKey}${subKey}`
  return MIXIN_KEY_ENC_TAB.map(index => rawKey[index]).join('').slice(0, 32)
}

function signWbi(params, imgKey, subKey, timestamp = Math.floor(Date.now() / 1000)) {
  const query = Object.keys({ ...params, wts: timestamp })
    .sort()
    .map(key => {
      const value = String({ ...params, wts: timestamp }[key]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')
  const signature = crypto.createHash('md5').update(`${query}${getMixinKey(imgKey, subKey)}`).digest('hex')
  return `${query}&w_rid=${signature}`
}

async function requestJson(url, referer, acceptedCodes = [0], extraHeaders = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        ...extraHeaders,
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Bilibili API 返回 ${response.status}`)
    const payload = await response.json()
    if (!acceptedCodes.includes(payload.code)) {
      const error = new Error(`Bilibili API: ${payload.message || payload.code}`)
      error.code = payload.code
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchDeviceCookie() {
  const payload = await requestJson(DEVICE_API, 'https://www.bilibili.com/')
  const buvid3 = payload.data?.b_3
  if (!buvid3) throw new Error('Bilibili 匿名设备标识缺失')
  return `buvid3=${buvid3}`
}

async function fetchWbiKeys() {
  const payload = await requestJson(NAV_API, 'https://www.bilibili.com/', [0, -101])
  const imgUrl = payload.data?.wbi_img?.img_url
  const subUrl = payload.data?.wbi_img?.sub_url
  if (!imgUrl || !subUrl) throw new Error('Bilibili WBI 口令缺失')
  return {
    imgKey: new URL(imgUrl).pathname.split('/').pop().split('.')[0],
    subKey: new URL(subUrl).pathname.split('/').pop().split('.')[0],
  }
}

function waitForRetry(attempt) {
  return new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
}

async function fetchSchedule(mid, retry = waitForRetry) {
  const referer = `https://space.bilibili.com/${mid}/dynamic`
  let lastError = new Error('动态接口返回空列表')
  let deviceCookie
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const query = new URLSearchParams({
      host_mid: String(mid),
      page: '1',
      type: 'dynamic',
      web_location: '333.1387',
      _: String(Date.now()),
    })
    try {
      const payload = await requestJson(`${SCHEDULE_API}?${query}`, referer)
      const items = payload.data?.items
      if (!Array.isArray(items)) throw new Error('动态接口没有返回图文列表')
      if (!items.length) throw new Error('动态接口返回空列表')
      const latest = findLatestSchedule(items)
      if (!latest) return null

      const schedule = normalizeSchedule(latest)
      if (schedule.publishedAt) return schedule
      if (!deviceCookie) deviceCookie = await fetchDeviceCookie()
      const detailQuery = new URLSearchParams({ id: schedule.opusId })
      const detail = await requestJson(`${SCHEDULE_DETAIL_API}?${detailQuery}`, schedule.url, [0], { Cookie: deviceCookie })
      const publishedTimestamp = getPublishedTimestamp(detail.data?.item)
      if (!publishedTimestamp) throw new Error('周表详情缺少发布时间')
      return {
        ...schedule,
        publishedAt: new Date(publishedTimestamp).toISOString(),
        ...getWeekRange(publishedTimestamp),
      }
    } catch (error) {
      lastError = error
      if (error.code === -352) deviceCookie = null
      console.warn(`周表接口第 ${attempt + 1} 次获取失败: ${error.message}`)
    }
    if (attempt < MAX_ATTEMPTS - 1) await retry(attempt)
  }
  throw lastError
}

async function fetchLatestVideos(mid, limit = 4, retry = waitForRetry) {
  let lastError = new Error('视频接口请求失败')
  let keys
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      if (!keys) keys = await fetchWbiKeys()
      const query = signWbi({ mid: String(mid), ps: String(limit), pn: '1', order: 'pubdate' }, keys.imgKey, keys.subKey)
      const payload = await requestJson(`${VIDEO_API}?${query}`, `https://space.bilibili.com/${mid}/`)
      const list = payload.data?.list?.vlist
      if (!Array.isArray(list)) throw new Error('视频接口没有返回投稿列表')
      if (!list.length) throw new Error('视频接口返回空投稿列表')
      return list.slice(0, limit).map(normalizeVideo)
    } catch (error) {
      lastError = error
      if (error.code === -403) keys = null
      console.warn(`视频接口第 ${attempt + 1} 次获取失败: ${error.message}`)
      if (attempt < MAX_ATTEMPTS - 1) await retry(attempt)
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

  if (videosResult.status === 'fulfilled' && videosResult.value.length) {
    writeJsonAtomic(VIDEOS_PATH, videosResult.value)
    console.log(`已更新 ${videosResult.value.length} 条最新视频`)
  } else if (videosResult.status === 'fulfilled') {
    console.warn('视频接口返回空列表，保留上一次的视频列表')
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
  getMixinKey,
  signWbi,
  fetchSchedule,
  fetchLatestVideos,
}
