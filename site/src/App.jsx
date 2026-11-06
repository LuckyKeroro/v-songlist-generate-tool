import { useCallback, useEffect, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import SongLibrary from './components/SongLibrary'
import SongDetail from './components/SongDetail'
import WeeklySchedule from './components/WeeklySchedule'
import VideoUpdates from './components/VideoUpdates'
import Toast from './components/Toast'
import BackToTop from './components/BackToTop'
import FrogMark from './components/FrogMark'

const BASE_URL = import.meta.env.BASE_URL || './'
const SONGS_VERSION = import.meta.env.VITE_SONGS_VERSION
const SONGS_URL = `${BASE_URL}songs.json${SONGS_VERSION ? `?v=${SONGS_VERSION}` : ''}`

export default function App() {
  const [config, setConfig] = useState(null)
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [error, setError] = useState('')
  const [selectedSong, setSelectedSong] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}config.json`).then(response => {
        if (!response.ok) throw new Error('站点配置加载失败')
        return response.json()
      }),
      fetch(SONGS_URL).then(response => {
        if (!response.ok) throw new Error('歌曲数据加载失败')
        return response.json()
      }),
      fetch(`${BASE_URL}videos.json`).then(response => response.ok ? response.json() : []).catch(() => []),
    ]).then(([configData, songsData, videosData]) => {
      setConfig(configData)
      setSongs(Array.isArray(songsData) ? songsData : [])
      setVideos(Array.isArray(videosData) ? videosData : [])
      document.title = configData.title || '蛙吹Keroro·不完整歌单'
    }).catch(loadError => {
      console.error(loadError)
      setError('歌单暂时没有加载成功，请稍后刷新再试。')
    })
  }, [])

  const copySong = useCallback(song => {
    const cleanTitle = song.title.replace(/\s*[\(（\[【].*?[\)）\]】]/g, '').trim()
    const text = `点歌 ${cleanTitle}`
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    textarea.remove()
    setToast(copied ? `已复制：${text}` : `请手动复制：${text}`)

    if (!copied && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => setToast(`已复制：${text}`))
        .catch(() => {})
    }
    return copied
  }, [])

  const closeDetail = useCallback(() => setSelectedSong(null), [])
  const closeToast = useCallback(() => setToast(''), [])

  if (error) {
    return <main className="load-state"><FrogMark size={64} /><h1>电台暂时离线</h1><p>{error}</p><button className="button button-primary" onClick={() => window.location.reload()}>重新加载</button></main>
  }

  if (!config) {
    return <main className="load-state"><FrogMark size={64} /><div className="loading-record"><i /><i /><i /></div><p>正在打开小蛙的歌曲收藏夹…</p></main>
  }

  const profileUrl = config.links?.find(link => link.text === '个人空间')?.url

  return (
    <div className="app-shell">
      <div className="page-noise" />
      <Header config={config} />
      <main>
        <Hero config={config} songs={songs} />
        <SongLibrary songs={songs} onSelect={setSelectedSong} onCopy={copySong} onNotify={setToast} />
        <WeeklySchedule schedule={config.schedule} />
        <VideoUpdates videos={videos} profileUrl={profileUrl} />
      </main>
      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><FrogMark size={34} /><span className="brand-copy"><strong>KERORO</strong><small>SONG ARCHIVE</small></span></a>
        <span>{config.copyright}</span>
      </footer>
      <BackToTop />
      {selectedSong && <SongDetail song={selectedSong} onClose={closeDetail} onCopy={copySong} />}
      {toast && <Toast message={toast} onClose={closeToast} />}
    </div>
  )
}
