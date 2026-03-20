import SongItem from './SongItem'
import './SongList.css'

function SongList({ groupedSongs, onCopy, sortBy, tableHeader }) {
  if (groupedSongs.length === 0) {
    return (
      <div className="song-list-empty">
        <p>没有找到匹配的歌曲</p>
      </div>
    )
  }

  const availableGroups = groupedSongs.map(g => g.initial)

  const scrollToGroup = (group) => {
    const element = document.getElementById(`group-${group}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const getGroupLabel = (initial) => {
    if (sortBy === 'date') {
      if (initial === '未知') return '未知年份'
      return `${initial.substring(0, 4)}-${parseInt(initial.substring(0, 4)) + 4}`
    }
    return initial
  }

  const getNavLabel = (initial) => {
    if (sortBy === 'date') {
      return initial === '未知' ? '?' : initial.substring(0, 4)
    }
    return initial
  }

  return (
    <div className="song-list-container">
      <div className="song-list-header">
        {tableHeader}
      </div>
      <div className="song-list-wrapper">
        <div className="song-list">
          {groupedSongs.map(group => (
            <div key={group.initial} id={`group-${group.initial}`} className="song-group">
              <div className="group-header">{getGroupLabel(group.initial)}</div>
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

        <div className="alphabet-bar">
          {availableGroups.map(group => (
            <button
              key={group}
              className="alphabet-btn"
              onClick={() => scrollToGroup(group)}
            >
              {getNavLabel(group)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SongList
