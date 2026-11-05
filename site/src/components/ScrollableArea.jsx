import { useEffect, useRef, useState } from 'react'

export default function ScrollableArea({ scrollRef: externalRef, onScroll, className = '', shellClassName = '', children }) {
  const internalRef = useRef(null)
  const scrollRef = externalRef || internalRef
  const [visible, setVisible] = useState(false)
  const thumbRef = useRef(null)
  const hideTimerRef = useRef(null)

  const updateThumb = () => {
    const element = scrollRef.current
    const thumb = thumbRef.current
    if (!element || !thumb) return
    const maxScroll = element.scrollHeight - element.clientHeight
    if (maxScroll <= 0) {
      thumb.style.display = 'none'
      return
    }
    const trackHeight = element.clientHeight - 4
    const thumbHeight = Math.max(32, trackHeight * element.clientHeight / element.scrollHeight)
    const top = 2 + element.scrollTop / maxScroll * (trackHeight - thumbHeight)
    thumb.style.display = 'block'
    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${top}px)`
  }

  const showScrollbar = () => {
    setVisible(true)
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setVisible(false), 1800)
  }

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(updateThumb)
    observer.observe(element)
    updateThumb()
    return () => observer.disconnect()
  }, [scrollRef])

  useEffect(() => {
    updateThumb()
  }, [children])

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), [])

  const handleScroll = () => {
    updateThumb()
    onScroll?.()
    showScrollbar()
  }

  const startDrag = event => {
    if (event.button !== 0) return
    const element = scrollRef.current
    const thumb = thumbRef.current
    if (!element || !thumb) return
    event.preventDefault()
    const startY = event.clientY
    const startScrollTop = element.scrollTop
    const trackHeight = element.clientHeight - 4
    const thumbHeight = thumb.offsetHeight
    const ratio = (element.scrollHeight - element.clientHeight) / (trackHeight - thumbHeight)
    showScrollbar()

    const move = moveEvent => {
      element.scrollTop = startScrollTop + (moveEvent.clientY - startY) * ratio
      showScrollbar()
    }
    const stop = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', stop)
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 1800)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', stop)
  }

  return (
    <div className={`scrollable-shell ${shellClassName}`}>
      <div className={`scrollable-area ${className}`} ref={scrollRef} onScroll={handleScroll} onWheel={showScrollbar} onTouchMove={showScrollbar}>
        {children}
      </div>
      <div className={`custom-scrollbar ${visible ? 'visible' : ''}`} aria-hidden="true">
        <span ref={thumbRef} className="custom-scrollbar-thumb" onPointerDown={startDrag} />
      </div>
    </div>
  )
}
