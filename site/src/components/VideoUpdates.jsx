import Icon from './Icon'

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai',
  }).format(new Date(value)).replaceAll('/', '.')
}

function formatPlay(value) {
  const count = Number(value) || 0
  return count >= 10000 ? `${(count / 10000).toFixed(1)} 万播放` : `${count} 播放`
}

export default function VideoUpdates({ videos, profileUrl }) {
  if (!videos.length) return null

  return (
    <section className="videos-section" id="videos">
      <div className="section-heading">
        <div>
          <p className="section-kicker">LATEST VIDEOS</p>
          <h2>最近投稿</h2>
        </div>
        {profileUrl && <a className="archive-stamp" href={profileUrl} target="_blank" rel="noreferrer">查看全部投稿 <Icon name="external" size={15} /></a>}
      </div>
      <div className="video-list">
        {videos.slice(0, 4).map(video => (
          <a className="video-item" key={video.bvid} href={video.url} target="_blank" rel="noreferrer">
            <div className="video-thumbnail">
              <img src={video.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <span><Icon name="play" size={18} /></span>
              <small>{video.duration}</small>
            </div>
            <div className="video-info">
              <h3>{video.title}</h3>
              <p><span>{formatDate(video.publishedAt)}</span><span>{formatPlay(video.play)}</span></p>
            </div>
            <Icon name="arrow" size={20} className="video-arrow" />
          </a>
        ))}
      </div>
    </section>
  )
}
