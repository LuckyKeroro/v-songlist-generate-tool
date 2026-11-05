import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export default function LanguageFilter({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handlePointer = event => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKey = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selectLanguage = nextValue => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className={`column-language-filter ${open ? 'open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className="language-trigger"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="按语言筛选"
      >
        <span>{value === 'all' ? '语言' : value}</span>
        <Icon name="down" size={13} />
      </button>
      {open && (
        <div className="language-menu" role="listbox" aria-label="语言选项">
          {[{ value: 'all', label: '全部语言' }, ...options.map(option => ({ value: option, label: option }))].map(option => (
            <button
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={`language-option ${value === option.value ? 'selected' : ''}`}
              key={option.value}
              onClick={() => selectLanguage(option.value)}
            >
              <span>{option.label}</span>
              {value === option.value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
