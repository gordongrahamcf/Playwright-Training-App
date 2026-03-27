import { useState, useEffect } from 'react'
import styles from './AsyncExercise.module.css'

const FAKE_USERS = [
  { id: 1, name: 'Alice Chen', role: 'Engineer' },
  { id: 2, name: 'Bob Martinez', role: 'Designer' },
  { id: 3, name: 'Carol White', role: 'PM' },
  { id: 4, name: 'David Kim', role: 'QA' },
  { id: 5, name: 'Eva Rodriguez', role: 'Engineer' },
]

const PRODUCTS = [
  'Blue Widget', 'Red Widget', 'Chrome Widget', 'Desk Lamp', 'Keyboard',
  'Mouse Pad', 'Monitor Stand', 'USB Hub', 'Cable Organizer', 'Webcam',
  'Headphones', 'Microphone', 'Chair Cushion', 'Notebook', 'Pen Set',
  'Sticky Notes', 'Whiteboard Marker', 'Stapler', 'Paper Clips', 'Folder',
]

const ALL_ITEMS = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}: ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon'][i]}`)

export default function AsyncExercise() {
  // Section A: user fetch
  const [fetchStatus, setFetchStatus] = useState('idle')
  const [users, setUsers] = useState([])

  const handleFetch = () => {
    setFetchStatus('loading')
    setTimeout(() => {
      setUsers(FAKE_USERS)
      setFetchStatus('success')
    }, 1500)
  }

  // Section B: debounced search
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  const filteredProducts = debouncedQuery
    ? PRODUCTS.filter(p => p.toLowerCase().includes(debouncedQuery.toLowerCase()))
    : PRODUCTS

  // Section C: load more
  const [visibleCount, setVisibleCount] = useState(5)
  const [loadingMore, setLoadingMore] = useState(false)

  const handleLoadMore = () => {
    setLoadingMore(true)
    setTimeout(() => {
      setVisibleCount(c => Math.min(c + 5, 20))
      setLoadingMore(false)
    }, 800)
  }

  return (
    <div className={styles.wrapper}>
      {/* Section A */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>A — User Fetch</h2>
        <p className={styles.hint}>Click the button and observe the loading state before the data appears.</p>

        <button
          data-testid="btn-fetch-users"
          onClick={handleFetch}
          disabled={fetchStatus !== 'idle'}
          className={styles.btn}
        >
          {fetchStatus === 'idle' ? 'Load Users' : fetchStatus === 'loading' ? 'Loading…' : 'Loaded'}
        </button>

        {fetchStatus === 'loading' && (
          <div data-testid="loading-spinner" className={styles.spinner} aria-label="Loading" />
        )}

        {fetchStatus === 'success' && (
          <ul data-testid="user-list" className={styles.userList}>
            {users.map(u => (
              <li key={u.id} data-testid="user-card" className={styles.userCard}>
                <strong>{u.name}</strong>
                <span>{u.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className={styles.divider} />

      {/* Section B */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>B — Debounced Search</h2>
        <p className={styles.hint}>There is a 400ms debounce — results update after you stop typing.</p>

        <input
          data-testid="search-input"
          type="text"
          placeholder="Search products…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className={styles.input}
        />

        <p data-testid="search-result-count" className={styles.resultCount}>
          {debouncedQuery
            ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''}`
            : `Showing all ${PRODUCTS.length}`}
        </p>

        <ul data-testid="search-results" className={styles.resultList}>
          {filteredProducts.map(p => (
            <li key={p} data-testid="search-result-item">{p}</li>
          ))}
        </ul>
      </section>

      <hr className={styles.divider} />

      {/* Section C */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>C — Load More</h2>
        <p className={styles.hint}>Each click loads 5 more items. The button disappears when all 20 are loaded.</p>

        <ul data-testid="item-list" className={styles.itemList}>
          {ALL_ITEMS.slice(0, visibleCount).map(item => (
            <li key={item} data-testid="list-item" className={styles.item}>{item}</li>
          ))}
        </ul>

        {loadingMore && (
          <div data-testid="load-more-spinner" className={styles.spinner} aria-label="Loading more" />
        )}

        {visibleCount < 20 && !loadingMore && (
          <button data-testid="btn-load-more" onClick={handleLoadMore} className={styles.btn}>
            Load More
          </button>
        )}
      </section>
    </div>
  )
}
