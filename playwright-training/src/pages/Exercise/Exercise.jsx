import { useParams, Link } from 'react-router-dom'
import EXERCISE_REGISTRY from '../../exercises/index'
import ExercisePage from '../../components/ExercisePage/ExercisePage'

export default function Exercise() {
  const { slug } = useParams()
  const exercise = EXERCISE_REGISTRY.find(ex => ex.slug === slug)

  if (!exercise) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h2>Exercise not found</h2>
        <p style={{ marginTop: '0.5rem' }}>
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    )
  }

  return <ExercisePage exercise={exercise} />
}
