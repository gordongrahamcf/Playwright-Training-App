import ScenarioPanel from '../ScenarioPanel/ScenarioPanel'
import styles from './ExercisePage.module.css'

export default function ExercisePage({ exercise }) {
  const { Component } = exercise

  return (
    <div className={styles.layout}>
      <div className={styles.instructions}>
        <ScenarioPanel exercise={exercise} />
      </div>
      <div className={styles.practiceArea} data-testid="practice-area">
        <Component />
      </div>
    </div>
  )
}
