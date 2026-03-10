import formsMeta from './forms/meta'
import FormsExercise from './forms/FormsExercise'
import asyncMeta from './async/meta'
import AsyncExercise from './async/AsyncExercise'
import modalsMeta from './modals/meta'
import ModalsExercise from './modals/ModalsExercise'
import tablesMeta from './tables/meta'
import TablesExercise from './tables/TablesExercise'

const EXERCISE_REGISTRY = [
  { ...formsMeta, Component: FormsExercise },
  { ...asyncMeta, Component: AsyncExercise },
  { ...modalsMeta, Component: ModalsExercise },
  { ...tablesMeta, Component: TablesExercise },
]

export default EXERCISE_REGISTRY
