import { useState, useMemo } from 'react'
import { EMPLOYEES } from './data'
import styles from './TablesExercise.module.css'

const PAGE_SIZE = 5

function formatSalary(n) {
  return '$' + n.toLocaleString()
}

export default function TablesExercise() {
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleFilter = (e) => {
    setFilter(e.target.value)
    setPage(1)
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return EMPLOYEES
    const q = filter.toLowerCase()
    return EMPLOYEES.filter(e =>
      e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)
    )
  }, [filter])

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortColumn]
      const bv = b[sortColumn]
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortColumn, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const start = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const end = Math.min(safePage * PAGE_SIZE, sorted.length)

  const pageRowIds = pageRows.map(r => r.id)
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every(id => selectedIds.has(id))

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(prev => new Set([...prev, ...pageRowIds]))
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageRowIds.forEach(id => next.delete(id))
        return next
      })
    }
  }

  const handleRowSelect = (id, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const SortIcon = ({ col }) => {
    if (sortColumn !== col) return <span className={styles.sortIcon}>↕</span>
    return <span className={styles.sortIcon}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <input
          data-testid="table-filter-input"
          type="text"
          placeholder="Filter by name or department…"
          value={filter}
          onChange={handleFilter}
          className={styles.filterInput}
        />
        <span data-testid="selected-count" className={styles.selectedCount}>
          {selectedIds.size} selected
        </span>
      </div>

      <div className={styles.tableWrapper}>
        <table data-testid="table" className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  checked={allPageSelected}
                  onChange={handleSelectAll}
                />
              </th>
              <th className={styles.sortable} onClick={() => handleSort('name')} data-testid="col-header-name">
                Name <SortIcon col="name" />
              </th>
              <th className={styles.sortable} onClick={() => handleSort('department')} data-testid="col-header-department">
                Department <SortIcon col="department" />
              </th>
              <th className={styles.sortable} onClick={() => handleSort('salary')} data-testid="col-header-salary">
                Salary <SortIcon col="salary" />
              </th>
              <th className={styles.sortable} onClick={() => handleSort('status')} data-testid="col-header-status">
                Status <SortIcon col="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row.id} data-testid="table-row">
                <td>
                  <input
                    type="checkbox"
                    data-testid="row-checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={e => handleRowSelect(row.id, e.target.checked)}
                  />
                </td>
                <td>{row.name}</td>
                <td>{row.department}</td>
                <td>{formatSalary(row.salary)}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'Active' ? styles.badgeActive : styles.badgeInactive}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.noResults}>No results found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span data-testid="pagination-info" className={styles.paginationInfo}>
          {sorted.length === 0 ? 'No results' : `Showing ${start}\u2013${end} of ${sorted.length}`}
        </span>
        <div className={styles.pageButtons}>
          <button
            data-testid="pagination-prev"
            disabled={safePage === 1}
            onClick={() => setPage(p => p - 1)}
            className={styles.pageBtn}
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              data-testid={`pagination-page-${i + 1}`}
              onClick={() => setPage(i + 1)}
              className={`${styles.pageBtn} ${safePage === i + 1 ? styles.pageBtnActive : ''}`}
            >
              {i + 1}
            </button>
          ))}
          <button
            data-testid="pagination-next"
            disabled={safePage === totalPages}
            onClick={() => setPage(p => p + 1)}
            className={styles.pageBtn}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
