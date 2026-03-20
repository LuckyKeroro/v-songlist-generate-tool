import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './TableHeader.css'

function TableHeader({
  sortBy, setSortBy, sortOrder, setSortOrder,
  languageFilter, setLanguageFilter, languages
}) {
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const languageLabels = {
    'all': '全部',
    '中文': '中文',
    '日语': '日语',
    '英语': '英语',
    '韩语': '韩语',
    '其他': '其他'
  }

  useEffect(() => {
    if (showLangDropdown && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
  }, [showLangDropdown])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) {
        setShowLangDropdown(false)
      }
    }
    if (showLangDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showLangDropdown])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (field) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  const columns = [
    { key: 'title', label: '歌名', sortable: true },
    { key: 'artist', label: '歌手', sortable: true },
    { key: 'album', label: '专辑', sortable: true },
    { key: 'date', label: '发布时间', sortable: true },
    { key: 'language', label: '语言', sortable: false }
  ]

  return (
    <>
      <div className="table-header">
        {columns.map(col => (
          <div
            key={col.key}
            className={`header-cell ${col.sortable ? 'sortable' : ''} ${sortBy === col.key ? 'active' : ''}`}
            onClick={col.sortable ? () => handleSort(col.key) : undefined}
          >
            {col.sortable ? (
              <span className="sort-label">
                {col.label}
                <span className="sort-icon">{getSortIcon(col.key)}</span>
              </span>
            ) : (
              <button
                ref={btnRef}
                className="lang-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLangDropdown(v => !v)
                }}
              >
                {languageLabels[languageFilter] || '语言'}
                <span className="dropdown-arrow">▼</span>
              </button>
            )}
          </div>
        ))}
        <div className="header-cell"></div>
      </div>

      {showLangDropdown && createPortal(
        <div
          className="lang-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {languages.map(lang => (
            <div
              key={lang}
              className={`lang-option ${languageFilter === lang ? 'selected' : ''}`}
              onClick={() => {
                setLanguageFilter(lang)
                setShowLangDropdown(false)
              }}
            >
              {languageLabels[lang] || lang}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export default TableHeader
