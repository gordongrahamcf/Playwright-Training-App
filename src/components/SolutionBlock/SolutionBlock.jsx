import { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import styles from './SolutionBlock.module.css'

export default function SolutionBlock({ code, label = 'Show solution' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.toggle}
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
      >
        {isOpen ? 'Hide solution' : label}
        <span className={styles.chevron}>{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && (
        <div className={styles.codeWrapper}>
          <button className={styles.copy} onClick={handleCopy} aria-label="Copy code">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <Highlight theme={themes.nightOwl} code={code.trim()} language="javascript">
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={`${className} ${styles.pre}`} style={style}>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    <span className={styles.lineNum}>{i + 1}</span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}
    </div>
  )
}
