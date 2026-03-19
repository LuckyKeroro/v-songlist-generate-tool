import { useState } from 'react'
import './SongItem.css'

function SongItem({ song, onCopy }) {
  const [expanded, setExpanded] = useState(false)

  const handleToggle = (e) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleCopy = () => {
    onCopy(song)
  }

  // 格式化发布日期
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="song-item-wrapper">
      <div className="song-item" onClick={handleCopy}>
        <div className="song-info">
          <span className="song-title">{song.title}</span>
          <span className="song-artist">{song.artist}</span>
        </div>
        <div className="song-meta">
          <span className="song-album">{song.album}</span>
          <span className="song-language">{song.language}</span>
        </div>
        <button
          className={`expand-btn ${expanded ? 'expanded' : ''}`}
          onClick={handleToggle}
          title={expanded ? '收起详情' : '展开详情'}
        >
          ›
        </button>
      </div>

      {expanded && (
        <div className="song-details">
          <div className="details-left">
            {song.cover ? (
              <img src={`./${song.cover}`} alt={song.album || '专辑封面'} className="album-cover" />
            ) : (
              <div className="album-cover-placeholder">🎵</div>
            )}
            <div className="album-info">
              <div className="album-name">{song.album || '未知专辑'}</div>
              {song.releaseDate && (
                <div className="release-date">{formatDate(song.releaseDate)}</div>
              )}
            </div>
          </div>
          <div className="details-right">
            {song.lyrics ? (
              <div className="lyrics-container">
                <div className="lyrics-scroll">{song.lyrics}</div>
              </div>
            ) : (
              <div className="no-lyrics">暂无歌词</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SongItem
