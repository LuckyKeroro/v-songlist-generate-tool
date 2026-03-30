import SongItem from './SongItem'
import './SongList.css'

function SongList({ groupedSongs, onCopy, sortBy, sortOrder, setSortBy, setSortOrder, isSearching, tableHeader }) {
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
        {isSearching && (
          <div className="search-result-bar">
            <span>搜索结果</span>
            <span
              className={`relevance-sort ${sortBy === 'relevance' ? 'active' : ''}`}
              onClick={() => {
                if (sortBy === 'relevance') {
                  setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('relevance')
                  setSortOrder('desc')
                }
              }}
            >
              相关度{sortBy === 'relevance' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
            </span>
          </div>
        )}
      </div>
      <div className="song-list-wrapper">
        <div className="song-list">
          {groupedSongs.length === 0 && (
            <div className="song-list-empty-hint">没有找到匹配的歌曲</div>
          )}
          {groupedSongs.map(group => (
            <div key={group.initial} id={`group-${group.initial}`} className="song-group">
              {group.initial !== '搜索结果' && (
                <div className="group-header">{getGroupLabel(group.initial)}</div>
              )}
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
          {availableGroups
            .filter(group => group !== '搜索结果')
            .map(group => (
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
