import { useExerciseProgress } from '../../hooks/useExerciseProgress'
import SolutionBlock from '../SolutionBlock/SolutionBlock'
import styles from './ScenarioPanel.module.css'

export default function ScenarioPanel({ exercise }) {
  const { isComplete, markComplete } = useExerciseProgress()

  return (
    <div className={styles.panel}>
      <h1 className={styles.title}>{exercise.title}</h1>
      <p className={styles.description}>{exercise.description}</p>

      <div className={styles.scenarios}>
        {exercise.scenarios.map((scenario, i) => {
          const done = isComplete(exercise.id, scenario.id)
          return (
            <div
              key={scenario.id}
              className={`${styles.scenario} ${done ? styles.scenarioDone : ''}`}
            >
              <div className={styles.scenarioHeader}>
                <span className={styles.scenarioNum}>{i + 1}</span>
                <h3 className={styles.scenarioTitle}>{scenario.title}</h3>
              </div>
              <p className={styles.scenarioDesc}>{scenario.description}</p>
              <SolutionBlock code={scenario.solution} />
              <label className={styles.markComplete}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={e => markComplete(exercise.id, scenario.id, e.target.checked)}
                />
                Mark as complete
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
