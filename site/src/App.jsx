import { useState, useEffect, useMemo } from 'react'
import { pinyin } from 'pinyin-pro'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TableHeader from './components/TableHeader'
import SongList from './components/SongList'
import Toast from './components/Toast'
import './App.css'

// 获取基础路径
const BASE_URL = import.meta.env.BASE_URL || './'

function App() {
  const [config, setConfig] = useState(null)
  const [songsData, setSongsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [sortBy, setSortBy] = useState('artist') // 'artist' | 'title' | 'album' | 'date'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
  const [toast, setToast] = useState({ show: false, message: '' })

  // 加载数据
  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}config.json`).then(r => r.json()),
      fetch(`${BASE_URL}songs.json`).then(r => r.json())
    ])
      .then(([configData, songs]) => {
        setConfig(configData)
        setSongsData(songs || [])
        setLoading(false)
        if (configData.title) {
          document.title = configData.title
        }
      })
      .catch(err => {
        console.error('加载数据失败:', err)
        setLoading(false)
      })
  }, [])

  // 获取所有可用语言
  const languages = useMemo(() => {
    const langs = new Set(songsData.map(s => s.language).filter(Boolean))
    return ['all', ...Array.from(langs).sort()]
  }, [songsData])

  // 获取首字母
  function getInitial(text) {
    if (!text) return '#'
    const char = text.charAt(0)
    if (/[a-zA-Z]/.test(char)) return char.toUpperCase()
    if (/[\u4e00-\u9fff]/.test(char)) {
      const py = pinyin(char, { pattern: 'first', toneType: 'none' })
      return py.charAt(0).toUpperCase()
    }
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) return 'J'
    if (/[\uac00-\ud7af]/.test(char)) return 'K'
    return '#'
  }

  // 获取年份区间（5年为单位）
  function getYearRange(dateStr) {
    if (!dateStr) return '未知'
    const year = parseInt(dateStr.substring(0, 4))
    if (isNaN(year)) return '未知'
    const start = Math.floor(year / 5) * 5
    return `${start}s`
  }

  // 过滤歌曲
  const filteredSongs = useMemo(() => {
    let result = [...songsData]

    if (languageFilter !== 'all') {
      result = result.filter(s => s.language === languageFilter)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s =>
        s.title?.toLowerCase().includes(term) ||
        s.artist?.toLowerCase().includes(term) ||
        s.lyrics?.toLowerCase().includes(term)
      )
    }

    return result
  }, [searchTerm, languageFilter, songsData])

  // 排序和分组
  const groupedSongs = useMemo(() => {
    let sorted = [...filteredSongs]

    const getField = (song, field) => {
      switch (field) {
        case 'title': return song.title || ''
        case 'artist': return song.artist || ''
        case 'album': return song.album || ''
        case 'date': return song.releaseDate || ''
        default: return ''
      }
    }

    // 全局排序（按字段值直接排序）
    sorted.sort((a, b) => {
      const valA = getField(a, sortBy)
      const valB = getField(b, sortBy)

      if (sortBy === 'date') {
        // 日期排序
        if (!valA && !valB) return 0
        if (!valA) return 1
        if (!valB) return -1
        const cmp = valA.localeCompare(valB)
        return sortOrder === 'asc' ? cmp : -cmp
      } else {
        // 文本排序（按拼音）
        if (!valA && !valB) return 0
        if (!valA) return 1
        if (!valB) return -1
        const cmp = valA.localeCompare(valB, 'zh-CN')
        return sortOrder === 'asc' ? cmp : -cmp
      }
    })

    // 分组
    const groups = {}

    if (sortBy === 'date') {
      sorted.forEach(song => {
        const range = getYearRange(song.releaseDate)
        if (!groups[range]) groups[range] = []
        groups[range].push(song)
      })
    } else {
      sorted.forEach(song => {
        const val = getField(song, sortBy)
        const initial = getInitial(val)
        if (!groups[initial]) groups[initial] = []
        groups[initial].push(song)
      })
    }

    // 排序分组键
    let sortedKeys = Object.keys(groups).sort((a, b) => {
      if (sortBy === 'date') {
        if (a === '未知') return 1
        if (b === '未知') return -1
        const cmp = a.localeCompare(b)
        return sortOrder === 'asc' ? cmp : -cmp
      }
      if (a === '#') return 1
      if (b === '#') return -1
      const cmp = a.localeCompare(b, 'zh-CN')
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return sortedKeys.map(key => ({
      initial: key,
      songs: groups[key]
    }))
  }, [filteredSongs, sortBy, sortOrder])

  // 复制到剪贴板
  const handleCopy = async (song) => {
    const cleanTitle = song.title.replace(/[\(\[【\(].*?[\)\]】\)]/g, '').trim()
    const text = `点歌 ${cleanTitle}`
    try {
      await navigator.clipboard.writeText(text)
      setToast({ show: true, message: '已复制到剪贴板' })
    } catch (err) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setToast({ show: true, message: '已复制到剪贴板' })
    }
  }

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-text">加载中...</div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="app loading">
        <div className="loading-text">配置加载失败</div>
      </div>
    )
  }

  return (
    <div
      className="app"
      style={{
        backgroundImage: config.background ? `url(${BASE_URL}${config.background})` : undefined
      }}
    >
      <div className="glass-container">
        <Header config={config} />
        <div className="song-panel">
          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          <SongList
            groupedSongs={groupedSongs}
            onCopy={handleCopy}
            sortBy={sortBy}
            tableHeader={
              <TableHeader
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                languageFilter={languageFilter}
                setLanguageFilter={setLanguageFilter}
                languages={languages}
              />
            }
          />
        </div>
      </div>
      {toast.show && <Toast message={toast.message} onClose={() => setToast({ show: false, message: '' })} />}
    </div>
  )
}

export default App
