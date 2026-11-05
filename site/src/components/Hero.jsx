import Icon from './Icon'
import AddToHome from './AddToHome'
import { assetUrl } from '../utils/assets'

export default function Hero({ config, songs }) {
  const artists = new Set(songs.map(song => song.artist).filter(Boolean)).size
  const languages = new Set(songs.map(song => song.language).filter(Boolean)).size
  const roomId = config.subtitle?.match(/\d+/)?.[0] || '22344968'
  const sourceText = '蛙神发布的歌单表格'
  const announcement = config.announcement || ''
  const sourceIndex = announcement.indexOf(sourceText)

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="section-kicker">KERORO'S SONG ARCHIVE</p>
        <h1>{config.name} 的<br />不完整歌单</h1>
        <p className="hero-intro">
          {sourceIndex >= 0 && config.sourceTableUrl ? (
            <>
              {announcement.slice(0, sourceIndex)}
              <a className="inline-source-link" href={config.sourceTableUrl} target="_blank" rel="noreferrer">
                {sourceText}<Icon name="external" size={12} />
              </a>
              {announcement.slice(sourceIndex + sourceText.length)}
            </>
          ) : announcement}
        </p>
        <div className="hero-info-links">
          <AddToHome />
          <a href="https://github.com/LuckyKeroro/v-songlist-generate-tool" target="_blank" rel="noreferrer"><Icon name="github" size={16} /> Github</a>
          <a href="mailto:luckykeroro@126.com"><Icon name="mail" size={16} /> 联系维护者</a>
        </div>
        <p className="hero-disclaimer">本站为粉丝为方便查歌制作的非盈利开源项目，资料均来自公开网络。如有 Bug 反馈、歌单错误或侵权删改需求，请直接联系作者，请勿打扰主播。</p>
        <div className="hero-buttons">
          <a className="button button-primary" href="#library"><Icon name="music" size={18} /> 开始找歌</a>
          <a className="button button-quiet" href="#schedule"><Icon name="calendar" size={17} /> 直播周表</a>
          <a className="button button-quiet" href="#videos"><Icon name="play" size={17} /> 最近投稿</a>
        </div>
        <div className="hero-stats" aria-label="歌单统计">
          <div><strong>{songs.length}</strong><span>首歌曲</span></div>
          <div><strong>{artists}</strong><span>位歌手</span></div>
          <div><strong>{languages}</strong><span>种语言</span></div>
        </div>
      </div>
      <div className="hero-art" aria-label="蛙吹 Keroro 主题插画">
        <div className="art-backdrop" />
        <div className="art-frame">
          <img src={assetUrl(config.background)} alt="蛙吹 Keroro 在舞台上演唱" />
          <div className="art-caption">
            <span>ON AIR</span>
            <span className="equalizer"><i /><i /><i /><i /></span>
          </div>
        </div>
        <div className="art-sticker">
          <Icon name="sparkles" size={22} />
          <span>蛙吹Keroro<br /><strong>{roomId}</strong></span>
        </div>
        <div className="art-label">KERORO'S<br />LITTLE RADIO</div>
      </div>
    </section>
  )
}
