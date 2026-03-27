import { useState, useEffect, useRef } from 'react'
import styles from './ModalsExercise.module.css'

export default function ModalsExercise() {
  // Section A: confirmation modal
  const [modalOpen, setModalOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // Section B: tooltip
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Section C: drawer
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Keyboard: close modal on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setModalOpen(false)
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus trap for modal
  const modalRef = useRef(null)
  useEffect(() => {
    if (modalOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [modalOpen])

  return (
    <div className={styles.wrapper}>
      {/* Section A */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>A — Confirmation Modal</h2>
        <p className={styles.hint}>A destructive action guarded by a confirmation dialog.</p>

        {!deleted ? (
          <button
            data-testid="btn-delete-account"
            onClick={() => setModalOpen(true)}
            className={`${styles.btn} ${styles.btnDanger}`}
          >
            Delete Account
          </button>
        ) : (
          <div data-testid="delete-success-message" className={styles.successBanner}>
            Account deleted successfully.
          </div>
        )}
      </section>

      <hr className={styles.divider} />

      {/* Section B */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>B — Tooltip on Hover</h2>
        <p className={styles.hint}>Hover over the icon to reveal contextual information.</p>
        <div className={styles.tooltipWrapper}>
          <button
            data-testid="tooltip-trigger"
            className={styles.tooltipTrigger}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            aria-label="More information"
          >
            ?
          </button>
          {tooltipVisible && (
            <div data-testid="tooltip-content" className={styles.tooltip} role="tooltip">
              This feature requires admin privileges to configure.
            </div>
          )}
        </div>
      </section>

      <hr className={styles.divider} />

      {/* Section C */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>C — Side Drawer</h2>
        <p className={styles.hint}>Opens a panel from the right. Can be closed via the button or the backdrop.</p>
        <button
          data-testid="btn-open-drawer"
          onClick={() => setDrawerOpen(true)}
          className={styles.btn}
        >
          Open Settings
        </button>
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div
            data-testid="confirmation-modal"
            className={styles.modal}
            ref={modalRef}
            tabIndex={-1}
          >
            <h3 className={styles.modalTitle}>Confirm Deletion</h3>
            <p data-testid="modal-message" className={styles.modalMessage}>
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                data-testid="modal-cancel"
                onClick={() => setModalOpen(false)}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                data-testid="modal-confirm"
                onClick={() => { setDeleted(true); setModalOpen(false) }}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div
            data-testid="drawer-backdrop"
            className={styles.drawerBackdrop}
            onClick={() => setDrawerOpen(false)}
          />
          <aside data-testid="drawer" className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <h3>Settings</h3>
              <button
                data-testid="drawer-close"
                onClick={() => setDrawerOpen(false)}
                className={styles.drawerCloseBtn}
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
            <div data-testid="drawer-content" className={styles.drawerContent}>
              <div className={styles.settingRow}>
                <label>Dark Mode</label>
                <input type="checkbox" />
              </div>
              <div className={styles.settingRow}>
                <label>Notifications</label>
                <input type="checkbox" defaultChecked />
              </div>
              <div className={styles.settingRow}>
                <label>Language</label>
                <select>
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
