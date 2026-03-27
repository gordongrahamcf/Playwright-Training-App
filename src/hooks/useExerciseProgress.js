import { useState } from 'react'

const STORAGE_KEY = 'playwright-training-progress'

export function useExerciseProgress() {
  const [completions, setCompletions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  })

  const markComplete = (exerciseId, scenarioId, value = true) => {
    const key = `${exerciseId}:${scenarioId}`
    const updated = { ...completions, [key]: value }
    setCompletions(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const isComplete = (exerciseId, scenarioId) =>
    !!completions[`${exerciseId}:${scenarioId}`]

  const getExerciseProgress = (exercise) => {
    const total = exercise.scenarios.length
    const done = exercise.scenarios.filter(s =>
      isComplete(exercise.id, s.id)
    ).length
    return { done, total }
  }

  return { isComplete, markComplete, getExerciseProgress }
}
