import FrogMark from './FrogMark'
import Icon from './Icon'

export default function Header({ config }) {
  const links = config.links || []
  const profile = links.find(link => link.text === '个人空间')
  const live = links.find(link => link.text === '直播间')

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="回到首页">
        <FrogMark />
        <span className="brand-copy">
          <strong>KERORO</strong>
          <small>SONG ARCHIVE</small>
        </span>
      </a>
      <div className="header-actions">
        {profile && (
          <a className="schedule-nav" href={profile.url} target="_blank" rel="noreferrer">
            <span className="profile-label-wide">小蛙主页</span>
            <span className="profile-label-narrow">蛙神主页</span>
            <Icon name="external" size={15} />
          </a>
        )}
        {live && (
          <a className="live-nav" href={live.url} target="_blank" rel="noreferrer">
            <span className="live-dot" />
            去直播间
            <Icon name="arrow" size={17} />
          </a>
        )}
      </div>
    </header>
  )
}
