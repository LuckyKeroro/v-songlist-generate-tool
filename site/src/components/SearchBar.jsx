import './SearchBar.css'

function SearchBar({ searchTerm, setSearchTerm, languageFilter, setLanguageFilter, languages }) {
  const languageLabels = {
    'all': '全部',
    '中文': '中文',
    '日语': '日语',
    '英语': '英语',
    '韩语': '韩语',
    '其他': '其他'
  }

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="搜索歌名、歌手、歌词..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      <select
        value={languageFilter}
        onChange={(e) => setLanguageFilter(e.target.value)}
        className="language-select"
      >
        {languages.map(lang => (
          <option key={lang} value={lang}>
            {languageLabels[lang] || lang}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SearchBar
