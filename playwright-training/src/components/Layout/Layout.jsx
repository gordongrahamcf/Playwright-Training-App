import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import EXERCISE_REGISTRY from '../../exercises/index'
import styles from './Layout.module.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <button
        className={styles.hamburger}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <Sidebar exercises={EXERCISE_REGISTRY} onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {sidebarOpen && (
        <div className={styles.backdrop} onClick={() => setSidebarOpen(false)} />
      )}

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
