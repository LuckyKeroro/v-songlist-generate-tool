import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

export default function AddToHome() {
  const [installEvent, setInstallEvent] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const needsAppleMenuHelp = /iPhone|iPad|iPod/.test(navigator.platform)
    || /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.platform)
      && /Safari/.test(navigator.userAgent)
      && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent))

  useEffect(() => {
    const capturePrompt = event => {
      event.preventDefault()
      setInstallEvent(event)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt)
  }, [])

  useEffect(() => {
    if (!showHelp) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showHelp])

  const handleClick = async () => {
    if (needsAppleMenuHelp) {
      setShowHelp(true)
      return
    }

    if (installEvent) {
      try {
        await installEvent.prompt()
        setInstallEvent(null)
        return
      } catch {
        setShowHelp(true)
        return
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url: window.location.href })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    setShowHelp(true)
  }

  return (
    <>
      <button type="button" className="hero-info-link" onClick={handleClick}>
        <Icon name="home" size={15} /> 加至主屏幕
      </button>
      {showHelp && createPortal(
        <div className="home-help-backdrop" onClick={event => event.target === event.currentTarget && setShowHelp(false)}>
          <section className="home-help-card" role="dialog" aria-modal="true" aria-labelledby="home-help-title">
            <button className="icon-button home-help-close" onClick={() => setShowHelp(false)} aria-label="关闭提示" autoFocus><Icon name="close" size={18} /></button>
            <span className="home-help-icon"><Icon name="home" size={24} /></span>
            <h2 id="home-help-title">添加到主屏幕</h2>
            <p>{needsAppleMenuHelp ? '请点击浏览器中的“…”按钮，再选择“分享”，然后点击“添加到主屏幕”。' : '请打开浏览器菜单或分享菜单，选择“添加到主屏幕”或“安装应用”。'}</p>
            <button className="button button-primary" onClick={() => setShowHelp(false)}>知道了</button>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
