import { useState, useEffect, useMemo } from 'react'
import { pinyin } from 'pinyin-pro'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import SongList from './components/SongList'
import Toast from './components/Toast'
import './App.css'

function App() {
  const [config, setConfig] = useState(null)
  const [songsData, setSongsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [toast, setToast] = useState({ show: false, message: '' })

  // 加载数据
  useEffect(() => {
    Promise.all([
      fetch('./config.json').then(r => r.json()),
      fetch('./songs.json').then(r => r.json())
    ])
      .then(([configData, songs]) => {
        setConfig(configData)
        setSongsData(songs || [])
        setLoading(false)
        // 设置网页标题
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

  // 过滤和排序歌曲
  const filteredSongs = useMemo(() => {
    let result = [...songsData]

    // 语言过滤
    if (languageFilter !== 'all') {
      result = result.filter(s => s.language === languageFilter)
    }

    // 搜索过滤
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s =>
        s.title?.toLowerCase().includes(term) ||
        s.artist?.toLowerCase().includes(term) ||
        s.lyrics?.toLowerCase().includes(term)
      )
    }

    // 按歌手首字母排序
    result.sort((a, b) => {
      const initialA = getInitial(a.artist)
      const initialB = getInitial(b.artist)
      return initialA.localeCompare(initialB, 'zh-CN')
    })

    return result
  }, [searchTerm, languageFilter, songsData])

  // 按首字母分组（支持多创作者）
  const groupedSongs = useMemo(() => {
    const groups = {}
    filteredSongs.forEach(song => {
      // 拆分多个创作者
      const artists = song.artist ? song.artist.split(/[\/&\,\、，]/).map(a => a.trim()).filter(a => a) : ['']
      const initials = new Set()

      artists.forEach(artist => {
        const initial = getInitial(artist)
        initials.add(initial)
      })

      // 将歌曲添加到每个创作者的首字母分组
      initials.forEach(initial => {
        if (!groups[initial]) {
          groups[initial] = []
        }
        groups[initial].push(song)
      })
    })

    // 排序分组
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b, 'zh-CN')
    })

    return sortedKeys.map(key => ({
      initial: key,
      songs: groups[key]
    }))
  }, [filteredSongs])

  // 获取首字母
  function getInitial(text) {
    if (!text) return '#'
    const char = text.charAt(0)

    // 英文字母
    if (/[a-zA-Z]/.test(char)) {
      return char.toUpperCase()
    }

    // 中文转拼音首字母
    if (/[\u4e00-\u9fff]/.test(char)) {
      const py = pinyin(char, { pattern: 'first', toneType: 'none' })
      return py.charAt(0).toUpperCase()
    }

    // 日文假名
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      return 'J'
    }

    // 韩文
    if (/[\uac00-\ud7af]/.test(char)) {
      return 'K'
    }

    return '#'
  }

  // 复制到剪贴板
  const handleCopy = async (song) => {
    // 去除括号及括号内的版本信息
    const cleanTitle = song.title.replace(/[\(\[【\(].*?[\)\]】\)]/g, '').trim()
    const text = `点歌 ${cleanTitle}`
    try {
      await navigator.clipboard.writeText(text)
      setToast({ show: true, message: '已复制到剪贴板' })
    } catch (err) {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setToast({ show: true, message: '已复制到剪贴板' })
    }
  }

  const hideToast = () => {
    setToast({ show: false, message: '' })
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
        backgroundImage: config.background ? `url(./${config.background})` : undefined
      }}
    >
      <div className="glass-container">
        <Header config={config} />
        <div className="song-panel">
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            languageFilter={languageFilter}
            setLanguageFilter={setLanguageFilter}
            languages={languages}
          />
          <SongList
            groupedSongs={groupedSongs}
            onCopy={handleCopy}
          />
        </div>
      </div>
      {toast.show && <Toast message={toast.message} onClose={hideToast} />}
    </div>
  )
}

export default App
