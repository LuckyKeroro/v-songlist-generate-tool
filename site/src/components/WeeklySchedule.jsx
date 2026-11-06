import Icon from './Icon'
import { assetUrl } from '../utils/assets'

export default function WeeklySchedule({ schedule }) {
  const image = schedule?.image || schedule?.cover

  return (
    <section className="schedule-section" id="schedule">
      <div className="section-heading">
        <div>
          <p className="section-kicker">WEEKLY SCHEDULE</p>
          <h2>直播周表</h2>
        </div>
        {schedule?.weekLabel && <span className="archive-stamp"><Icon name="calendar" size={16} /> {schedule.weekLabel}</span>}
      </div>
      <div className="schedule-frame">
        {image ? (
          <img src={assetUrl(image)} alt={`蛙吹 Keroro ${schedule.weekLabel || ''} 直播周表`} />
        ) : (
          <p className="schedule-empty">暂时没有可展示的周表图片。</p>
        )}
      </div>
    </section>
  )
}
