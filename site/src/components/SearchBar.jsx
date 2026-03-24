import './SearchBar.css'

function SearchBar({ searchTerm, setSearchTerm, onRandomCopy }) {
  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="搜索歌名、歌手、歌词..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      <button className="random-btn" onClick={onRandomCopy}>
        🎲 随便听听
      </button>
    </div>
  )
}

export default SearchBar
