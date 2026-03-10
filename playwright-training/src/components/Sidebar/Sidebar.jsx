import { NavLink } from 'react-router-dom'
import { useExerciseProgress } from '../../hooks/useExerciseProgress'
import styles from './Sidebar.module.css'

export default function Sidebar({ exercises, onNavigate }) {
  const { getExerciseProgress } = useExerciseProgress()

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🎭</span>
        <span className={styles.brandText}>Playwright Lab</span>
      </div>

      <NavLink
        to="/"
        end
        className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        onClick={onNavigate}
      >
        Home
      </NavLink>

      <div className={styles.section}>Exercises</div>

      {exercises.map((ex, i) => {
        const { done, total } = getExerciseProgress(ex)
        const dotClass = done === 0 ? styles.dotNone : done === total ? styles.dotDone : styles.dotPartial

        return (
          <NavLink
            key={ex.slug}
            to={`/exercises/${ex.slug}`}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            onClick={onNavigate}
          >
            <span className={styles.exerciseNum}>{i + 1}</span>
            <span className={styles.exerciseTitle}>{ex.title}</span>
            <span className={`${styles.dot} ${dotClass}`} title={`${done}/${total} complete`} />
          </NavLink>
        )
      })}
    </nav>
  )
}
