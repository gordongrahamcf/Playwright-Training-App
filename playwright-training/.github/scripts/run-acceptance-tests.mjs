/**
 * Codeless acceptance test runner.
 *
 * Uses the GitHub Models API (Copilot's underlying model) as the AI agent and
 * exposes Playwright as function-calling tools so the agent can drive a real
 * browser without writing test files.
 *
 * Required env vars:
 *   GITHUB_TOKEN  – provided automatically in GitHub Actions
 *   BASE_URL      – app origin, defaults to http://localhost:5173
 */

import OpenAI from 'openai'
import { chromium } from 'playwright'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const RESULTS_DIR = join(__dirname, 'test-results')
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

mkdirSync(RESULTS_DIR, { recursive: true })

// ── AI client (GitHub Models = Copilot models via OpenAI-compatible API) ─────
const ai = new OpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: process.env.GITHUB_TOKEN,
})

// ── Browser ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1280, height: 800 } })
const page = await context.newPage()

// ── Selector resolution ───────────────────────────────────────────────────────
// The AI passes a selector object with ONE strategy key populated.
// Mirrors the priority order in AGENTS.md.
function resolveLocator(sel) {
  if (!sel) throw new Error('selector is required')
  const loc = (() => {
    if (sel.testid) return page.getByTestId(sel.testid)
    if (sel.role)   return page.getByRole(sel.role, sel.name ? { name: sel.name } : {})
    if (sel.label)  return page.getByLabel(sel.label)
    if (sel.text)   return page.getByText(sel.text, { exact: sel.exact ?? false })
    if (sel.css)    return page.locator(sel.css)
    throw new Error(`Unknown selector format: ${JSON.stringify(sel)}`)
  })()
  return sel.nth !== undefined ? loc.nth(sel.nth) : loc
}

// ── Tool implementations ──────────────────────────────────────────────────────
const tools = {
  async navigate({ url }) {
    const full = url.startsWith('http') ? url : `${BASE_URL}${url}`
    await page.goto(full, { waitUntil: 'domcontentloaded' })
    return { ok: true, url: page.url() }
  },

  async click({ selector, force }) {
    await resolveLocator(selector).click({ force: force ?? false })
    return { ok: true }
  },

  async fill({ selector, value }) {
    const loc = resolveLocator(selector)
    await loc.clear()
    await loc.fill(String(value))
    return { ok: true }
  },

  async clear_input({ selector }) {
    await resolveLocator(selector).clear()
    return { ok: true }
  },

  async hover({ selector }) {
    await resolveLocator(selector).hover()
    return { ok: true }
  },

  async move_mouse_off() {
    await page.mouse.move(0, 0)
    return { ok: true }
  },

  async press_key({ key }) {
    await page.keyboard.press(key)
    return { ok: true }
  },

  async select_option({ selector, value }) {
    await resolveLocator(selector).selectOption(value)
    return { ok: true }
  },

  async set_checkbox({ selector, checked }) {
    const loc = resolveLocator(selector)
    if (checked) await loc.check()
    else await loc.uncheck()
    return { ok: true }
  },

  async get_snapshot() {
    return page.evaluate(() => ({
      url: window.location.href,
      bodyText: document.body.innerText?.substring(0, 3000),
      interactiveElements: Array.from(
        document.querySelectorAll('[data-testid],[role="dialog"],[role="tooltip"],button,input,select,textarea,a')
      )
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        .slice(0, 80)
        .map(el => ({
          tag:         el.tagName.toLowerCase(),
          testId:      el.getAttribute('data-testid') || undefined,
          role:        el.getAttribute('role') || undefined,
          type:        el.getAttribute('type') || undefined,
          ariaLabel:   el.getAttribute('aria-label') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          text:        el.textContent?.trim().substring(0, 80) || undefined,
          value:       el.value || undefined,
          checked:     (el.type === 'checkbox' || el.type === 'radio') ? el.checked : undefined,
          disabled:    el.disabled || undefined,
        })),
    }))
  },

  async is_visible({ selector }) {
    try   { return { visible: await resolveLocator(selector).isVisible() } }
    catch { return { visible: false } }
  },

  async is_present({ selector }) {
    try {
      const count = await resolveLocator(selector).count()
      return { present: count > 0, count }
    } catch { return { present: false, count: 0 } }
  },

  async is_disabled({ selector }) {
    const disabled = await resolveLocator(selector).isDisabled()
    return { disabled }
  },

  async is_checked({ selector }) {
    const checked = await resolveLocator(selector).isChecked()
    return { checked }
  },

  async get_count({ selector }) {
    const count = await resolveLocator(selector).count()
    return { count }
  },

  async get_text({ selector }) {
    const text = await resolveLocator(selector).textContent()
    return { text: text?.trim() }
  },

  async get_input_value({ selector }) {
    const value = await resolveLocator(selector).inputValue()
    return { value }
  },

  async wait_for_visible({ selector, timeout }) {
    await resolveLocator(selector).waitFor({ state: 'visible', timeout: timeout ?? 10000 })
    return { ok: true }
  },

  async wait_for_hidden({ selector, timeout }) {
    await resolveLocator(selector).waitFor({ state: 'hidden', timeout: timeout ?? 10000 })
    return { ok: true }
  },

  async wait_ms({ ms }) {
    await page.waitForTimeout(ms)
    return { ok: true }
  },

  async evaluate_js({ expression }) {
    const result = await page.evaluate(expression)
    return { result }
  },

  async screenshot({ name }) {
    const file = `${name.replace(/[^\w-]/g, '_')}.png`
    await page.screenshot({ path: join(RESULTS_DIR, file), fullPage: false })
    return { ok: true, file }
  },
}

// ── Tool schemas (OpenAI function-calling format) ─────────────────────────────
const SELECTOR_SCHEMA = {
  type: 'object',
  description: 'Identify a page element. Provide exactly ONE strategy key.',
  properties: {
    testid: { type: 'string', description: 'data-testid attribute value' },
    role:   { type: 'string', description: 'ARIA role: button | textbox | checkbox | combobox | dialog | tooltip …' },
    name:   { type: 'string', description: 'Accessible name — pair with role' },
    label:  { type: 'string', description: 'Associated <label> text' },
    text:   { type: 'string', description: 'Visible text (partial match unless exact:true)' },
    exact:  { type: 'boolean', description: 'Set true to match text exactly (use with text)' },
    css:    { type: 'string', description: 'CSS selector — last resort only' },
    nth:    { type: 'integer', description: 'Zero-based index when multiple elements match' },
  },
}

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the browser to a URL. Use an absolute URL or a path relative to BASE_URL.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click an element.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          force: { type: 'boolean', description: 'Bypass actionability checks (use sparingly)' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fill',
      description: 'Clear an input then type a value into it.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          value: { type: 'string' },
        },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_input',
      description: 'Clear the current value of an input field.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hover',
      description: 'Hover the mouse pointer over an element.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_mouse_off',
      description: 'Move the mouse to the top-left corner (0,0) — use to dismiss tooltips.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press a keyboard key, e.g. "Escape", "Enter", "Tab".',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_option',
      description: 'Choose a value from a <select> dropdown.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          value: { type: 'string', description: 'The option value or visible label' },
        },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_checkbox',
      description: 'Check or uncheck a checkbox or radio button.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          checked: { type: 'boolean' },
        },
        required: ['selector', 'checked'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_snapshot',
      description: 'Return the current page URL, body text, and a list of visible interactive elements. Call this after navigation or any action that changes the page to understand what is on screen.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'is_visible',
      description: 'Return whether an element is visible on the page.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'is_present',
      description: 'Return whether an element exists in the DOM (even if hidden). Also returns the count of matches.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'is_disabled',
      description: 'Return whether an element is disabled.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'is_checked',
      description: 'Return whether a checkbox or radio button is checked.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_count',
      description: 'Return the number of elements matching the selector.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_text',
      description: 'Return the text content of an element.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_input_value',
      description: 'Return the current value of an input or select element.',
      parameters: {
        type: 'object',
        properties: { selector: SELECTOR_SCHEMA },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_visible',
      description: 'Wait until an element becomes visible. Use after triggering async actions.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          timeout: { type: 'integer', description: 'Max wait in ms (default 10000)' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_hidden',
      description: 'Wait until an element is no longer visible. Use to detect loading states resolving.',
      parameters: {
        type: 'object',
        properties: {
          selector: SELECTOR_SCHEMA,
          timeout: { type: 'integer', description: 'Max wait in ms (default 10000)' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait_ms',
      description: 'Pause for a fixed number of milliseconds. Use only for debounce settle periods.',
      parameters: {
        type: 'object',
        properties: { ms: { type: 'integer' } },
        required: ['ms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_js',
      description: 'Evaluate a JavaScript expression in the page context and return the result.',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string', description: 'JS expression to evaluate, e.g. "window.location.href" or "localStorage.clear()"' } },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: 'Capture a screenshot. Always call this when a scenario fails.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Filename prefix, e.g. "forms-valid-submit-failure"' } },
        required: ['name'],
      },
    },
  },
]

// ── Load feature files ────────────────────────────────────────────────────────
const featureDir = join(REPO_ROOT, '.github/acceptance-criteria')
const featureFiles = readdirSync(featureDir).filter(f => f.endsWith('.feature'))

if (featureFiles.length === 0) {
  console.error('No .feature files found in .github/acceptance-criteria/')
  process.exit(1)
}

const featuresText = featureFiles
  .map(f => `### ${f}\n${readFileSync(join(featureDir, f), 'utf-8')}`)
  .join('\n\n---\n\n')

console.log(`Loaded ${featureFiles.length} feature file(s): ${featureFiles.join(', ')}`)

// ── Prompt ────────────────────────────────────────────────────────────────────
const agentInstructions = readFileSync(join(REPO_ROOT, '.github/AGENTS.md'), 'utf-8')

const SYSTEM_PROMPT = `${agentInstructions}

## CI Mode — additional instructions

You are running in a GitHub Actions CI job. The app is already running at ${BASE_URL}.

- Process every Feature and every Scenario in the feature files provided.
- Between scenarios, navigate to a clean page and (where the app uses localStorage) call evaluate_js with "localStorage.clear()".
- Call get_snapshot after every navigation or significant state change so you always know what is on screen before acting.
- Take a screenshot immediately when a scenario fails before moving to the next one.
- When all scenarios are complete, output ONLY a JSON block in this exact format and nothing after it:

\`\`\`json
{
  "summary": { "total": 0, "passed": 0, "failed": 0 },
  "results": [
    { "feature": "Feature name", "scenario": "Scenario title", "status": "pass", "reason": "" },
    { "feature": "Feature name", "scenario": "Scenario title", "status": "fail", "reason": "What was expected vs what was observed", "screenshot": "filename.png" }
  ]
}
\`\`\`
`

// ── Agentic loop ──────────────────────────────────────────────────────────────
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  {
    role: 'user',
    content: `Run all acceptance tests against the app at ${BASE_URL}.\n\nFeature files:\n\n${featuresText}`,
  },
]

console.log('Starting agent…')

let finalReport = null
let iterations = 0
const MAX_ITERATIONS = 300 // guard against infinite loops

while (iterations++ < MAX_ITERATIONS) {
  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools: TOOL_SCHEMAS,
    tool_choice: 'auto',
    max_tokens: 4096,
  })

  const msg = response.choices[0].message
  messages.push(msg)

  // ── Tool calls ──────────────────────────────────────────────────────────────
  if (msg.tool_calls?.length > 0) {
    for (const tc of msg.tool_calls) {
      const fn = tools[tc.function.name]
      let result

      try {
        const args = JSON.parse(tc.function.arguments)
        if (!fn) throw new Error(`Unknown tool: ${tc.function.name}`)
        result = await fn(args)
      } catch (err) {
        console.error(`  Tool error [${tc.function.name}]: ${err.message}`)
        result = { error: err.message }
        // Best-effort screenshot on tool failure
        await tools.screenshot({ name: `tool-error-${tc.function.name}` }).catch(() => {})
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
    continue
  }

  // ── Text response — agent is done ───────────────────────────────────────────
  const content = msg.content ?? ''
  console.log('\n--- Agent output ---\n')
  console.log(content)

  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try { finalReport = JSON.parse(jsonMatch[1]) } catch { /* ignore */ }
  }
  break
}

await browser.close()

// ── Write report & exit ───────────────────────────────────────────────────────
if (!finalReport) {
  console.error('Agent did not produce a structured report.')
  process.exit(1)
}

const reportPath = join(RESULTS_DIR, 'report.json')
writeFileSync(reportPath, JSON.stringify(finalReport, null, 2))
console.log(`\nReport written to ${reportPath}`)

const { summary, results = [] } = finalReport
console.log(`\nTotal: ${summary.total}  |  Passed: ${summary.passed}  |  Failed: ${summary.failed}`)

const failed = results.filter(r => r.status === 'fail')
if (failed.length > 0) {
  console.error('\nFailed scenarios:')
  failed.forEach(r => console.error(`  ✗ [${r.feature}] ${r.scenario}\n    ${r.reason}`))
  process.exit(1)
}

console.log('\n✓ All scenarios passed')
process.exit(0)
