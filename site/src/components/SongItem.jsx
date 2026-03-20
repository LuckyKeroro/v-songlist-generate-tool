import { useState } from 'react'
import './SongItem.css'

const BASE_URL = import.meta.env.BASE_URL || './'

function SongItem({ song, onCopy }) {
  const [expanded, setExpanded] = useState(false)

  const handleToggle = (e) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleCopy = () => {
    onCopy(song)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return dateStr.substring(0, 7)
  }

  return (
    <div className="song-item-wrapper">
      <div className="song-item" onClick={handleCopy}>
        <span className="song-title" title={song.title}>{song.title}</span>
        <span className="song-artist" title={song.artist}>{song.artist}</span>
        <span className="song-album" title={song.album}>{song.album}</span>
        <span className="song-date">{formatDate(song.releaseDate)}</span>
        <span className="song-language">{song.language}</span>
        <button
          className={`expand-btn ${expanded ? 'expanded' : ''}`}
          onClick={handleToggle}
          title={expanded ? '收起详情' : '展开详情'}
        >
          <span className={`expand-icon ${expanded ? 'rotated' : ''}`}>⌄</span>
        </button>
      </div>

      {expanded && (
        <div className="song-details">
          <div className="details-left">
            {song.cover ? (
              <img src={`${BASE_URL}${song.cover}`} alt={song.album || '专辑封面'} className="album-cover" />
            ) : (
              <div className="album-cover-placeholder">🎵</div>
            )}
            <div className="album-info">
              <div className="album-name">{song.album || '未知专辑'}</div>
              {song.releaseDate && (
                <div className="release-date">{song.releaseDate}</div>
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
