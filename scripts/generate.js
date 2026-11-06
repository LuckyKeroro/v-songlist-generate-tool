const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const sharp = require('sharp')
const { cleanLyrics } = require('./lyrics')

const ROOT_DIR = path.join(__dirname, '..')
const RESOURCES_DIR = path.join(ROOT_DIR, 'Resources')
const PUBLIC_DIR = path.join(ROOT_DIR, 'public')
const SITE_PUBLIC_DIR = path.join(ROOT_DIR, 'site', 'public')
const COVERS_DIR = path.join(SITE_PUBLIC_DIR, 'covers')

function readSongs() {
  const songs = []
  if (!fs.existsSync(RESOURCES_DIR)) return songs

  for (const artistEntry of fs.readdirSync(RESOURCES_DIR, { withFileTypes: true })) {
    if (!artistEntry.isDirectory()) continue
    const artistDir = path.join(RESOURCES_DIR, artistEntry.name)
    for (const albumEntry of fs.readdirSync(artistDir, { withFileTypes: true })) {
      if (!albumEntry.isDirectory()) continue
      const albumDir = path.join(artistDir, albumEntry.name)
      for (const fileEntry of fs.readdirSync(albumDir, { withFileTypes: true })) {
        if (!fileEntry.isFile() || !fileEntry.name.endsWith('.json')) continue
        const filePath = path.join(albumDir, fileEntry.name)
        try {
          const song = JSON.parse(fs.readFileSync(filePath, 'utf8'))
          songs.push({ ...song, lyrics: cleanLyrics(song.lyrics) })
        } catch (error) {
          throw new Error(`无法解析 ${path.relative(ROOT_DIR, filePath)}: ${error.message}`)
        }
      }
    }
  }

  return songs.sort((a, b) => {
    const artistOrder = String(a.artist || '').localeCompare(String(b.artist || ''), 'zh-CN')
    return artistOrder || String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
  })
}

function versionedAsset(filePath, urlPath) {
  const version = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12)
  return `${urlPath}?v=${version}`
}

async function processSiteImage(filename, outputName, width, quality) {
  const source = path.join(PUBLIC_DIR, filename)
  if (!fs.existsSync(source)) return null
  const destination = path.join(SITE_PUBLIC_DIR, outputName)
  await sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(destination)
  return versionedAsset(destination, outputName)
}

async function processCover(song) {
  if (!song.cover || /^https?:/.test(song.cover)) return { ...song, cover: song.cover || null }
  const source = path.join(RESOURCES_DIR, song.cover)
  if (!fs.existsSync(source)) {
    console.warn(`封面不存在，已跳过: ${song.cover}`)
    return { ...song, cover: null }
  }

  const hash = crypto.createHash('sha1').update(song.cover).digest('hex').slice(0, 10)
  const outputName = `${hash}.webp`
  const destination = path.join(COVERS_DIR, outputName)
  if (!fs.existsSync(destination)) {
    await sharp(source)
      .rotate()
      .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destination)
  }
  return { ...song, cover: versionedAsset(destination, `covers/${outputName}`) }
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function writeCacheManifest(songsVersion) {
  const distDir = path.join(ROOT_DIR, 'dist')
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(match => match[1])
  const config = JSON.parse(fs.readFileSync(path.join(distDir, 'config.json'), 'utf8'))
  const images = [config.background, config.schedule?.image]
    .filter(value => value && !/^https?:/.test(value))
    .map(value => `./${value.replace(/^(?:\.\/|\/)/, '')}`)
  const manifest = {
    version: '',
    shell: ['./', './index.html', './config.json', './videos.json', './favicon.svg', './favicon.png', './apple-touch-icon.png', './site.webmanifest'],
    static: [...new Set([...assets, `./songs.json?v=${songsVersion}`, ...images])],
  }
  manifest.version = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 12)
  fs.writeFileSync(path.join(distDir, 'sw-manifest.js'), `self.__KERORO_CACHE__ = ${JSON.stringify(manifest)}\n`)
}

async function main() {
  console.log('读取歌曲与站点配置…')
  fs.mkdirSync(SITE_PUBLIC_DIR, { recursive: true })
  fs.rmSync(COVERS_DIR, { recursive: true, force: true })
  fs.mkdirSync(COVERS_DIR, { recursive: true })

  const configPath = path.join(PUBLIC_DIR, 'config.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const songs = readSongs()
  console.log(`共读取 ${songs.length} 首歌曲`)

  console.log('压缩主播图片与专辑封面…')
  config.avatar = await processSiteImage(config.avatar || 'avatar.JPG', 'avatar.jpg', 800, 88)
  config.background = await processSiteImage(config.background || 'background.jpg', 'background.jpg', 2200, 84)
  const processedSongs = await mapConcurrent(songs, 8, processCover)
  const songsJson = JSON.stringify(processedSongs)
  const songsVersion = crypto.createHash('sha256').update(songsJson).digest('hex').slice(0, 12)

  const scheduleImage = path.join(PUBLIC_DIR, 'schedule.webp')
  if (fs.existsSync(scheduleImage)) {
    const destination = path.join(SITE_PUBLIC_DIR, 'schedule.webp')
    fs.copyFileSync(scheduleImage, destination)
    if (config.schedule?.image && !/^https?:/.test(config.schedule.image)) {
      config.schedule.image = versionedAsset(destination, config.schedule.image)
    }
  }

  fs.writeFileSync(path.join(SITE_PUBLIC_DIR, 'config.json'), JSON.stringify(config, null, 2))
  fs.writeFileSync(path.join(SITE_PUBLIC_DIR, 'songs.json'), songsJson)
  const videosPath = path.join(PUBLIC_DIR, 'videos.json')
  const videos = fs.existsSync(videosPath) ? JSON.parse(fs.readFileSync(videosPath, 'utf8')) : []
  fs.writeFileSync(path.join(SITE_PUBLIC_DIR, 'videos.json'), JSON.stringify(videos))

  console.log('构建静态网站…')
  execFileSync('npm', ['run', 'build', '--workspace', 'site'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, VITE_SONGS_VERSION: songsVersion },
  })
  writeCacheManifest(songsVersion)
  console.log(`构建完成：dist/（${processedSongs.length} 首歌曲）`)
}

main().catch(error => {
  console.error(`构建失败: ${error.message}`)
  process.exitCode = 1
})
