import { useEffect } from 'react'
import Icon from './Icon'

export default function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2800)
    return () => window.clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="toast" role="status">
      <span><Icon name="check" size={17} /></span>
      {message}
    </div>
  )
}
