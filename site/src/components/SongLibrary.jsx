import { useEffect, useMemo, useRef, useState } from 'react'
import { pinyin } from 'pinyin-pro'
import Icon from './Icon'
import LanguageFilter from './LanguageFilter'
import ScrollableArea from './ScrollableArea'
import { assetUrl } from '../utils/assets'
import { buildSearchIndex, searchSongs } from '../utils/fuzzyMatch'

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
const languageOrder = ['中文', '日语', '英语', '韩语', '其他']
const sortableColumns = [
  { field: 'title', label: '歌名' },
  { field: 'artist', label: '歌手' },
  { field: 'album', label: '专辑' },
  { field: 'date', label: '年份' },
]

function getInitial(text) {
  if (!text) return '#'
  const char = text.charAt(0)
  if (/[a-zA-Z]/.test(char)) return char.toUpperCase()
  if (/[\u4e00-\u9fff]/.test(char)) {
    return pinyin(char, { pattern: 'first', toneType: 'none' }).charAt(0).toUpperCase()
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) return 'J'
  if (/[\uac00-\ud7af]/.test(char)) return 'K'
  return '#'
}

function SongRow({ song, onSelect, onCopy, onSearch }) {
  const [copyState, setCopyState] = useState('idle')
  const copyFromBlank = event => {
    if (event.target !== event.currentTarget) return
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return
    if (event.type === 'keydown') event.preventDefault()
    setCopyState(onCopy(song) ? 'copied' : 'manual')
  }
  const showDetail = () => onSelect(song)

  return (
    <div
      className={`song-row ${copyState}`}
      onClick={copyFromBlank}
      onKeyDown={copyFromBlank}
      tabIndex={0}
      role="group"
      aria-label={`${song.title}，按回车复制点歌格式`}
    >
      <button className="song-cover detail-cell" onClick={showDetail} aria-label={`查看 ${song.title} 的详情`}>
        {song.cover ? <img src={assetUrl(song.cover)} alt="" loading="lazy" /> : <Icon name="music" size={20} />}
      </button>
      <button className="song-title-button detail-cell" onClick={showDetail} title={song.title}>
        <strong>{song.title}</strong>
      </button>
      <button className="song-artist meta-cell" onClick={() => onSearch(song.artist)} title={`搜索歌手：${song.artist}`}>{song.artist || '未知歌手'}</button>
      <button className="song-album meta-cell" onClick={() => onSearch(song.album)} title={`搜索专辑：${song.album}`}>{song.album || '未知专辑'}</button>
      <button className="song-date meta-cell" onClick={() => onSearch(song.releaseDate?.slice(0, 4))} title={`搜索发行年份：${song.releaseDate?.slice(0, 4) || '未知'}`}>{song.releaseDate ? song.releaseDate.slice(0, 4) : '—'}</button>
      <button className="song-language meta-cell" onClick={() => onSearch(song.language)} title={`搜索语言：${song.language || '其他'}`}>
        <span className="language-tag">{song.language || '其他'}</span>
      </button>
    </div>
  )
}

export default function SongLibrary({ songs, onSelect, onCopy, onNotify }) {
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [sortBy, setSortBy] = useState('artist')
  const [sortOrder, setSortOrder] = useState('asc')
  const [activeGroup, setActiveGroup] = useState('')
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const groupRefs = useRef({})
  const previousSortRef = useRef(null)
  const searchIndex = useMemo(() => buildSearchIndex(songs, pinyin), [songs])

  const languages = useMemo(() => {
    const available = new Set(songs.map(song => song.language).filter(Boolean))
    return [...languageOrder.filter(item => available.has(item)), ...[...available].filter(item => !languageOrder.includes(item)).sort(collator.compare)]
  }, [songs])

  const filteredSongs = useMemo(() => {
    const entries = songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => language === 'all' || song.language === language)
    if (!query.trim()) return entries.map(({ song }) => song)
    return searchSongs(
      entries.map(({ song }) => song),
      entries.map(({ index }) => searchIndex[index]),
      query,
      pinyin,
    )
  }, [songs, searchIndex, language, query])

  const groups = useMemo(() => {
    if (sortBy === 'relevance') return filteredSongs.length ? [{ key: '搜索结果', songs: filteredSongs }] : []
    const grouped = new Map()
    const sorted = [...filteredSongs].sort((a, b) => {
      const field = sortBy === 'date' ? 'releaseDate' : sortBy
      const left = a[field] || ''
      const right = b[field] || ''
      if (!left && !right) return 0
      if (!left) return 1
      if (!right) return -1
      return sortOrder === 'asc' ? collator.compare(left, right) : collator.compare(right, left)
    })

    if (query.trim()) return sorted.length ? [{ key: '搜索结果', songs: sorted }] : []

    sorted.forEach(song => {
      let key
      if (sortBy === 'date') key = song.releaseDate?.slice(0, 4) || '未知年份'
      else key = getInitial(song[sortBy])
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(song)
    })

    return [...grouped.entries()]
      .sort(([left], [right]) => {
        if (left === '#' || left === '未知年份') return 1
        if (right === '#' || right === '未知年份') return -1
        return sortOrder === 'asc' ? collator.compare(left, right) : collator.compare(right, left)
      })
      .map(([key, groupedSongs]) => ({ key, songs: groupedSongs }))
  }, [filteredSongs, query, sortBy, sortOrder])

  useEffect(() => {
    const handleShortcut = event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    setActiveGroup(groups[0]?.key || '')
    groupRefs.current = {}
  }, [groups])

  const handleQueryChange = value => {
    const wasSearching = Boolean(query.trim())
    const willSearch = Boolean(value.trim())
    if (!wasSearching && willSearch) {
      previousSortRef.current = { sortBy, sortOrder }
      setSortBy('relevance')
    } else if (wasSearching && !willSearch && previousSortRef.current) {
      setSortBy(previousSortRef.current.sortBy)
      setSortOrder(previousSortRef.current.sortOrder)
      previousSortRef.current = null
    }
    setQuery(value)
  }

  const handleSort = field => {
    if (sortBy === field) setSortOrder(order => order === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const scrollToGroup = key => {
    const element = groupRefs.current[key]
    const container = listRef.current
    if (!element || !container) return
    setActiveGroup(key)
    container.scrollTo({
      top: container.scrollTop + element.getBoundingClientRect().top - container.getBoundingClientRect().top - 56,
      behavior: 'smooth',
    })
  }

  const updateActiveGroup = () => {
    const container = listRef.current
    if (!container || !groups.length) return
    const threshold = container.getBoundingClientRect().top + 112
    let current = groups[0].key
    for (const group of groups) {
      const element = groupRefs.current[group.key]
      if (element && element.getBoundingClientRect().top <= threshold) current = group.key
    }
    if (current !== activeGroup) setActiveGroup(current)
  }

  const searchFor = value => {
    const text = String(value || '').trim()
    if (!text || text === '未知专辑' || text === '未知歌手') return
    setLanguage('all')
    handleQueryChange(text)
    if (listRef.current) listRef.current.scrollTop = 0
  }

  const randomSong = () => {
    if (!filteredSongs.length) return
    const song = filteredSongs[Math.floor(Math.random() * filteredSongs.length)]
    onSelect(song)
    onNotify(`为你抽到了「${song.title}」`)
  }

  const resetFilters = () => {
    handleQueryChange('')
    setLanguage('all')
  }

  return (
    <section className="library-section" id="library">
      <div className="section-heading">
        <div>
          <p className="section-kicker">THE SONG LIBRARY</p>
          <h2>歌曲目录</h2>
        </div>
        <span className="archive-stamp"><Icon name="library" size={17} /> 不完整歌单 · 持续更新</span>
      </div>
      <div className="usage-guide">
        <Icon name="info" size={15} />
        <span>点击封面/歌名查看详情；点击空白处复制点歌文本；点击歌手/专辑/年份/语言筛选搜索。</span>
      </div>

      <div className="library-card">
        <div className="search-toolbar">
          <label className="search-box">
            <Icon name="search" size={23} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={event => handleQueryChange(event.target.value)}
              placeholder="搜索歌名、歌手、专辑、歌词，也支持拼音和首字母…"
              aria-label="搜索歌曲"
            />
            <span className="search-result-count" aria-live="polite">{filteredSongs.length} 首</span>
            {query ? (
              <button onClick={() => handleQueryChange('')} aria-label="清空搜索"><Icon name="close" size={18} /></button>
            ) : <kbd>/</kbd>}
          </label>
          <button className="random-button" onClick={randomSong} disabled={!filteredSongs.length}>
            <Icon name="shuffle" size={19} /><span className="random-button-label">帮我选一首</span>
          </button>
        </div>

        <div className="library-body">
          <ScrollableArea className="song-scroll" shellClassName="song-scroll-shell" scrollRef={listRef} onScroll={updateActiveGroup}>
            <div className="column-labels">
              <span className="column-cover" aria-hidden="true" />
              {sortableColumns.map(column => (
                <button
                  key={column.field}
                  className={`column-sort column-${column.field} ${sortBy === column.field ? 'active' : ''}`}
                  onClick={() => handleSort(column.field)}
                  aria-label={`按${column.label}排序${sortBy === column.field ? sortOrder === 'asc' ? '，当前升序' : '，当前降序' : ''}`}
                >
                  <span>{column.label}</span>
                  <span className="sort-indicator">{sortBy === column.field ? sortOrder === 'asc' ? '↑︎' : '↓︎' : '↕︎'}</span>
                </button>
              ))}
              <LanguageFilter value={language} options={languages} onChange={setLanguage} />
            </div>
            {groups.length === 0 && (
              <div className="empty-state">
                <span><Icon name="search" size={30} /></span>
                <h3>没有找到匹配的歌曲</h3>
                <p>试试歌名的一部分、歌手名字，或者拼音首字母。</p>
                <button onClick={resetFilters}>清空搜索与筛选</button>
              </div>
            )}
            {groups.map(group => (
              <section className="song-group" key={group.key} ref={element => { groupRefs.current[group.key] = element }}>
                {!query && (
                  <header className="group-header">
                    <strong>{group.key}</strong>
                    <span>{group.songs.length} 首</span>
                  </header>
                )}
                {group.songs.map((song, index) => (
                  <SongRow key={`${song.sourceUrl || song.title}-${song.artist}-${index}`} song={song} onSelect={onSelect} onCopy={onCopy} onSearch={searchFor} />
                ))}
              </section>
            ))}
          </ScrollableArea>
          {!query && groups.length > 1 && (
            <nav className="alphabet-rail" aria-label="歌曲分组导航">
              {groups.map(group => (
                <button
                  key={group.key}
                  className={activeGroup === group.key ? 'active' : ''}
                  onClick={() => scrollToGroup(group.key)}
                  aria-current={activeGroup === group.key ? 'true' : undefined}
                  aria-label={`${group.key}，${group.songs.length} 首`}
                >
                  <span>{group.key === '未知年份' ? '?' : group.key}</span>
                  {activeGroup === group.key && <small>{group.songs.length}</small>}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
