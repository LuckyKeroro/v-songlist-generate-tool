import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ScrollableArea from './ScrollableArea'
import { assetUrl } from '../utils/assets'

export default function SongDetail({ song, onClose, onCopy }) {
  const closeRef = useRef(null)
  const [copyState, setCopyState] = useState('idle')

  useEffect(() => {
    setCopyState('idle')
  }, [song])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleKey = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const handleCopy = () => {
    setCopyState(onCopy(song) ? 'copied' : 'manual')
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="song-modal" role="dialog" aria-modal="true" aria-labelledby="song-modal-title">
        <button ref={closeRef} className="icon-button modal-close" onClick={onClose} aria-label="关闭详情">
          <Icon name="close" />
        </button>
        <div className="modal-summary">
          <div className="modal-cover">
            {song.cover ? <img src={assetUrl(song.cover)} alt={`${song.album || '歌曲'}封面`} /> : <Icon name="music" size={42} />}
          </div>
          <span className="language-tag">{song.language || '其他'}</span>
          <p className="modal-kicker">NOW YOU PICKED</p>
          <h2 id="song-modal-title">{song.title}</h2>
          <p className="modal-artist">{song.artist || '未知歌手'}</p>
          <button className={`button button-primary modal-copy ${copyState}`} onClick={handleCopy} aria-live="polite">
            <Icon name={copyState === 'copied' ? 'check' : copyState === 'manual' ? 'info' : 'copy'} size={18} />
            {copyState === 'copied' ? '已复制 · 再复制一次' : copyState === 'manual' ? '请手动复制下方格式' : '复制点歌格式'}
          </button>
          <code className="request-format">点歌 {song.title.replace(/\s*[\(（\[【].*?[\)）\]】]/g, '').trim()}</code>
        </div>
        <div className="modal-content">
          <dl className="song-metadata">
            <div><dt>收录专辑</dt><dd>{song.album || '未知专辑'}</dd></div>
            <div><dt>发行时间</dt><dd>{song.releaseDate || '未知'}</dd></div>
          </dl>
          <div className="lyrics-heading"><Icon name="music" size={17} /><h3>歌词节选</h3></div>
          {song.lyrics ? <ScrollableArea className="modal-lyrics">{song.lyrics}</ScrollableArea> : <p className="no-lyrics">这一首还没有收录歌词。</p>}
          {song.sourceUrl && (
            <a className="source-link" href={song.sourceUrl} target="_blank" rel="noreferrer">
              查看原始歌曲信息 <Icon name="external" size={15} />
            </a>
          )}
        </div>
      </section>
    </div>
  )
}
