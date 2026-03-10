# Playwright Training Lab

A self-contained React app for learning [Playwright](https://playwright.dev/) end-to-end testing. Run it locally and write real Playwright tests against a live UI — no mocking, no fake data, no skipping the hard parts.

Each exercise presents a different UI pattern you'll encounter in real-world projects. The left panel shows the scenarios and solution code; the right panel is the live, interactive practice area you write tests against.

<!-- Screenshot: home page -->
<!-- ![Home page](docs/screenshots/home.png) -->

---

## Exercises

### 1. Forms & Inputs

A registration form with text, email, password, select, checkbox, and radio inputs, plus client-side validation on blur and submit.

**Scenarios:**
- Fill and submit a valid form, assert the success message includes the user's name
- Submit an empty form and assert all required-field errors appear
- Enter a short password, blur the field, assert the minimum-length error
- Enter an invalid email, blur, assert the format error

<!-- Screenshot: forms exercise -->
<!-- ![Forms exercise](docs/screenshots/exercise-forms.png) -->

---

### 2. Async & Dynamic Content

Three independent sections covering the most common async patterns in Playwright:

- **Load Users** — a button triggers a simulated 1.5 s fetch; assert the loading spinner appears, then disappears, then 5 user cards are visible
- **Product Search** — a debounced search input (400 ms) filters 20 products; assert the result count updates correctly
- **Load More** — a paginated list starting at 5 items loads 5 more per click (800 ms delay); assert the button disappears when all 20 items are shown

<!-- Screenshot: async exercise -->
<!-- ![Async exercise](docs/screenshots/exercise-async.png) -->

---

### 3. Modals & Overlays

Three overlay patterns that trip up a lot of Playwright beginners:

- **Confirmation modal** — a "Delete Account" button opens a modal; confirm it and assert the success banner appears and the button is gone
- **Tooltip** — conditionally rendered (not just hidden) on hover; assert it mounts and unmounts from the DOM
- **Side drawer** — a slide-in panel opened by a button, closeable via the X or by clicking the backdrop

<!-- Screenshot: modals exercise -->
<!-- ![Modals exercise](docs/screenshots/exercise-modals.png) -->

---

### 4. Tables & Lists

A fully-featured employee data table to practice complex list interactions:

- **Sorting** — click column headers to toggle ascending/descending order
- **Filtering** — a text input filters rows by name or department and resets to page 1
- **Pagination** — 5 rows per page with Prev/Next and numbered page buttons; assert the "Showing X–Y of Z" info text
- **Row selection** — per-row checkboxes plus a select-all checkbox for the current page

<!-- Screenshot: tables exercise -->
<!-- ![Tables exercise](docs/screenshots/exercise-tables.png) -->

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A code editor (VS Code recommended)

### 1. Start the training app

```bash
git clone <this-repo>
cd playwright-training
npm install
npm run dev
# → http://localhost:5173
```

### 2. Create a separate Playwright project

```bash
mkdir my-playwright-tests && cd my-playwright-tests
npm init playwright@latest
```

### 3. Point Playwright at the training app

In `playwright.config.js`, set:

```js
use: {
  baseURL: 'http://localhost:5173',
}
```

### 4. Write your first test

```js
// tests/forms.spec.js
import { test, expect } from '@playwright/test';

test('submits a valid form', async ({ page }) => {
  await page.goto('/#/exercises/forms');
  await page.getByTestId('input-name').fill('Jane Smith');
  // ...
});
```

### 5. Run tests

```bash
npx playwright test --ui
```

---

## Playwright Selector Tips

Every interactive element in these exercises has a `data-testid` attribute, so `getByTestId()` is the primary selector strategy. Other useful locators:

| Locator | When to use |
|---|---|
| `getByTestId('id')` | Preferred — use `data-testid` attributes throughout |
| `getByRole('button', { name: '...' })` | Buttons, inputs, checkboxes by ARIA role |
| `getByText('...')` | Find elements by visible text content |
| `locator.nth(n)` | Select the nth match (0-indexed) from a list |
| `locator.all()` | Get an array of all matching elements |
| `expect(locator).toBeVisible()` | Auto-waits up to the configured timeout |

---

## Tech Stack

- **React 19** + **Vite 7** — frontend framework and build tool
- **React Router v7** (HashRouter) — client-side routing, works as a static deploy
- **prism-react-renderer** — syntax-highlighted solution code blocks
- **CSS Modules** — scoped component styles
- **localStorage** — persists exercise completion progress across page refreshes

---

## Adding Screenshots

To add screenshots to this README, take them at 1280×800 and save them to `docs/screenshots/`, then uncomment the image lines above each exercise section.
