import { useState } from 'react'
import { Link } from 'react-router-dom'
import EXERCISE_REGISTRY from '../../exercises/index'
import { useExerciseProgress } from '../../hooks/useExerciseProgress'
import styles from './Home.module.css'

const SETUP_CODE = `# 1. Start this app
npm run dev
# → http://localhost:5173

# 2. In a separate directory, create a Playwright project
mkdir my-playwright-tests && cd my-playwright-tests
npm init playwright@latest

# 3. Set baseURL in playwright.config.js
# use: { baseURL: 'http://localhost:5173' }

# 4. Create a test file
touch tests/forms.spec.js

# 5. Run tests
npx playwright test --ui`

export default function Home() {
  const { getExerciseProgress } = useExerciseProgress()
  const [tipsOpen, setTipsOpen] = useState(false)

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Playwright Training Lab</h1>
        <p className={styles.heroSubtitle}>
          Write real Playwright tests against a live practice app. Each exercise covers a
          different UI pattern you'll encounter in real-world testing.
        </p>
      </div>

      {/* Prerequisites */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Prerequisites</h2>
        <ul className={styles.checklist}>
          <li>Node.js 18 or later</li>
          <li>A code editor (VS Code recommended)</li>
          <li>Playwright installed: <code>npm init playwright@latest</code> in your test project</li>
        </ul>
      </section>

      {/* Quick Start */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Start</h2>
        <div className={styles.codeBlock}>
          <pre>{SETUP_CODE}</pre>
        </div>
      </section>

      {/* Tips */}
      <section className={styles.section}>
        <button
          className={styles.tipsToggle}
          onClick={() => setTipsOpen(o => !o)}
          aria-expanded={tipsOpen}
        >
          Playwright Selector Tips {tipsOpen ? '▴' : '▾'}
        </button>
        {tipsOpen && (
          <div className={styles.tips}>
            <ul>
              <li><code>getByTestId()</code> — use for elements with <code>data-testid</code> attributes (preferred in these exercises)</li>
              <li><code>getByRole()</code> — use for interactive elements like buttons, inputs, checkboxes by their ARIA role</li>
              <li><code>getByText()</code> — use to find elements by their visible text</li>
              <li><code>await expect(locator).toBeVisible()</code> — automatically waits up to the configured timeout</li>
              <li><code>locator.nth(n)</code> — select the nth matched element (0-indexed)</li>
              <li><code>locator.all()</code> — returns an array of all matching elements</li>
            </ul>
          </div>
        )}
      </section>

      {/* Exercise cards */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Exercises</h2>
        <div className={styles.exerciseGrid}>
          {EXERCISE_REGISTRY.map((ex, i) => {
            const { done, total } = getExerciseProgress(ex)
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link key={ex.id} to={`/exercises/${ex.slug}`} className={styles.card}>
                <div className={styles.cardNum}>{i + 1}</div>
                <h3 className={styles.cardTitle}>{ex.title}</h3>
                <p className={styles.cardDesc}>{ex.description}</p>
                <div className={styles.cardMeta}>
                  <span>{total} scenarios</span>
                  <span>{done}/{total} complete</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
