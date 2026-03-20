import './Header.css'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

function Header({ config }) {
  return (
    <div className="header">
      <div className="header-left">
        <div className="avatar-wrapper">
          <img
            src={`./${config.avatar || 'avatar.jpg'}`}
            alt={config.name}
            className="avatar"
          />
        </div>
        <div className="name-section">
          <div className="name">{config.name}</div>
          {config.subtitle && <div className="subtitle">{config.subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        <div className="links">
          {config.links?.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn"
            >
              {link.text}
            </a>
          ))}
        </div>
        {config.announcement && (
          <div className="announcement">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                )
              }}
            >{config.announcement}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

export default Header
