import SongItem from './SongItem'
import './SongList.css'

function SongList({ groupedSongs, onCopy }) {
  if (groupedSongs.length === 0) {
    return (
      <div className="song-list-empty">
        <p>没有找到匹配的歌曲</p>
      </div>
    )
  }

  // 获取所有可用的首字母
  const availableInitials = groupedSongs.map(g => g.initial)

  // 滚动到指定首字母分组
  const scrollToInitial = (initial) => {
    const element = document.getElementById(`group-${initial}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="song-list-container">
      {/* 歌曲列表 */}
      <div className="song-list">
        {groupedSongs.map(group => (
          <div key={group.initial} id={`group-${group.initial}`} className="song-group">
            <div className="group-header">{group.initial}</div>
            <div className="group-songs">
              {group.songs.map((song, index) => (
                <SongItem
                  key={`${song.title}-${song.artist}-${index}`}
                  song={song}
                  onCopy={onCopy}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 首字母快速定位栏 */}
      <div className="alphabet-bar">
        {availableInitials.map(initial => (
          <button
            key={initial}
            className="alphabet-btn"
            onClick={() => scrollToInitial(initial)}
          >
            {initial}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SongList
