import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const ACCEPTANCE_DIR = path.join(ROOT, '.github', 'acceptance-criteria');
const RESULTS_DIR = path.join(ROOT, '.github', '.results');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const LATEST_REPORT = path.join(RESULTS_DIR, 'latest-test-run.md');
const LATEST_HTML_REPORT = path.join(RESULTS_DIR, 'latest-test-run.html');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

function fail(step, reason) {
  const err = new Error(reason);
  err.step = step;
  throw err;
}

function assert(step, condition, reason) {
  if (!condition) fail(step, reason);
}

async function exists(locator) {
  return (await locator.count()) > 0;
}

async function visible(locator) {
  if (!(await exists(locator))) return false;
  return locator.first().isVisible();
}

async function textOf(locator) {
  return ((await locator.first().textContent()) || '').trim();
}

async function parseFeatureFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  let featureName = '';
  let inBackground = false;
  let currentScenario = null;
  const backgroundSteps = [];
  const scenarios = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('Feature:')) {
      featureName = trimmed.slice('Feature:'.length).trim();
      inBackground = false;
      currentScenario = null;
      continue;
    }

    if (trimmed.startsWith('Background:')) {
      inBackground = true;
      currentScenario = null;
      continue;
    }

    if (trimmed.startsWith('Scenario:')) {
      inBackground = false;
      currentScenario = {
        title: trimmed.slice('Scenario:'.length).trim(),
        steps: [...backgroundSteps],
      };
      scenarios.push(currentScenario);
      continue;
    }

    const stepMatch = trimmed.match(/^(Given|When|Then|And|But)\s+(.+)$/);
    if (stepMatch) {
      const stepText = stepMatch[2].trim();
      if (inBackground) {
        backgroundSteps.push(stepText);
      } else if (currentScenario) {
        currentScenario.steps.push(stepText);
      }
    }
  }

  return { feature: featureName, scenarios };
}

async function loadAcceptanceModel() {
  const files = (await fs.readdir(ACCEPTANCE_DIR))
    .filter((name) => name.endsWith('.feature'))
    .sort();

  const features = [];
  for (const file of files) {
    const parsed = await parseFeatureFile(path.join(ACCEPTANCE_DIR, file));
    features.push(parsed);
  }
  return features;
}

function parseStartUrlFromSteps(steps) {
  for (const step of steps) {
    const m = step.match(/^I navigate to "([^"]+)"$/);
    if (m) return m[1];
  }
  return BASE_URL;
}

async function resetScenario(page, startUrl) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
}

async function runHomeScenario(page, title) {
  if (title === 'Home page loads with all four exercise cards') {
    assert(title, await visible(page.getByRole('heading', { name: 'Playwright Training Lab' })), 'Main heading not visible');
    const cards = page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Exercises' }) }).locator('a');
    assert(title, (await cards.count()) === 4, 'Expected 4 exercise cards');
    return;
  }

  if (title === 'Each exercise card shows scenario count and progress') {
    const cards = page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Exercises' }) }).locator('a');
    for (let i = 0; i < 4; i++) {
      const txt = await cards.nth(i).innerText();
      assert(title, /\d+ scenarios/.test(txt), `Card ${i + 1} missing scenario count`);
      assert(title, /0\/\d+ complete/.test(txt), `Card ${i + 1} missing progress text`);
      assert(title, (await cards.nth(i).locator('div[style*="width"]').count()) > 0, `Card ${i + 1} missing progress bar`);
    }
    return;
  }

  if (title === 'Navigating to an exercise from a card') {
    await page.getByRole('heading', { name: 'Forms & Inputs' }).click();
    await page.waitForURL(/\/exercises\/forms/);
    assert(title, page.url().includes('/exercises/forms'), 'URL should include /exercises/forms');
    return;
  }

  if (title === 'Playwright Selector Tips panel is collapsed by default') {
    const toggle = page.getByRole('button', { name: /Playwright Selector Tips/ });
    assert(title, (await toggle.getAttribute('aria-expanded')) === 'false', 'Tips should start collapsed');
    assert(title, !(await exists(page.getByText('getByTestId()'))), 'Tips content should be hidden by default');
    return;
  }

  if (title === 'Expanding and collapsing the Selector Tips panel') {
    const toggle = page.getByRole('button', { name: /Playwright Selector Tips/ });
    await toggle.click();
    assert(title, (await toggle.getAttribute('aria-expanded')) === 'true', 'Tips should be expanded after first click');
    await toggle.click();
    assert(title, (await toggle.getAttribute('aria-expanded')) === 'false', 'Tips should be collapsed after second click');
    return;
  }

  if (title === 'Quick Start code block is visible on load') {
    const qs = page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Quick Start' }) });
    assert(title, await visible(qs.getByText('npm run dev')), 'Quick Start should contain npm run dev');
    assert(title, await visible(qs.getByText('http://localhost:5173')), 'Quick Start should contain localhost URL');
    return;
  }

  fail(title, `Unhandled scenario: ${title}`);
}

async function runFormsScenario(page, title) {
  const fillCore = async () => {
    await page.getByLabel('Full Name').fill('Jane Smith');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByLabel('Password').fill('securepass1');
  };

  const acceptTerms = async () => {
    const cb = page.getByRole('checkbox', { name: /I accept the terms and conditions/ });
    if (!(await cb.isChecked())) await cb.click();
    assert(title, await cb.isChecked(), 'Terms checkbox did not become checked');
  };

  if (title === 'Successful registration shows a personalised success message') {
    await fillCore();
    await acceptTerms();
    await page.getByRole('button', { name: 'Create Account' }).click();
    assert(title, await visible(page.getByTestId('success-message')), 'Success message not visible');
    return;
  }

  if (title === 'Role dropdown defaults to Tester and accepts other values') {
    const role = page.getByLabel('Role');
    assert(title, (await role.inputValue()) === 'tester', 'Default role should be tester');
    await role.selectOption('developer');
    assert(title, (await role.inputValue()) === 'developer', 'Role should become developer');
    await role.selectOption('manager');
    assert(title, (await role.inputValue()) === 'manager', 'Role should become manager');
    return;
  }

  if (title === 'Newsletter radio defaults to No') {
    const yes = page.getByRole('radio', { name: 'Yes' });
    const no = page.getByRole('radio', { name: 'No' });
    assert(title, await no.isChecked(), 'No should be selected by default');
    await yes.check();
    assert(title, await yes.isChecked(), 'Yes should be selected after click');
    assert(title, !(await no.isChecked()), 'No should not remain selected');
    return;
  }

  if (title === 'Submitting an empty form shows all required field errors') {
    await page.getByRole('button', { name: 'Create Account' }).click();
    for (const msg of ['Name is required', 'Email is required', 'Password is required', 'You must accept the terms']) {
      assert(title, await visible(page.getByText(msg)), `Missing required error: ${msg}`);
    }
    return;
  }

  if (title === 'Blurring an empty Name field shows an inline error') {
    const name = page.getByLabel('Full Name');
    await name.focus();
    await page.keyboard.press('Tab');
    assert(title, await visible(page.getByText('Name is required')), 'Name error should appear');
    return;
  }

  if (title === 'Blurring an invalid email shows a format error') {
    const email = page.getByLabel('Email');
    await email.fill('not-an-email');
    await email.blur();
    assert(title, await visible(page.getByText('Enter a valid email address')), 'Email format error should appear');
    return;
  }

  if (title === 'Blurring a password that is too short shows a length error') {
    const pw = page.getByLabel('Password');
    await pw.fill('short');
    await pw.blur();
    assert(title, await visible(page.getByText('Password must be at least 8 characters')), 'Password length error should appear');
    return;
  }

  if (title === 'Blurring a valid email clears any previous email error') {
    const email = page.getByLabel('Email');
    await email.fill('bad');
    await email.blur();
    await email.fill('good@example.com');
    await email.blur();
    assert(title, !(await exists(page.getByTestId('error-email'))), 'Email error should clear');
    return;
  }

  if (title === 'Blurring a corrected password field clears the error') {
    const pw = page.getByLabel('Password');
    await pw.fill('short');
    await pw.blur();
    await pw.fill('longenoughpassword');
    await pw.blur();
    assert(title, !(await exists(page.getByTestId('error-password'))), 'Password error should clear');
    return;
  }

  if (title === 'Form does not submit when only the terms checkbox is unchecked') {
    await fillCore();
    await page.getByRole('button', { name: 'Create Account' }).click();
    assert(title, await visible(page.getByText('You must accept the terms')), 'Terms error should appear');
    assert(title, !(await exists(page.getByTestId('success-message'))), 'Success message should not appear');
    return;
  }

  if (title === 'Form does not submit when the password is exactly 7 characters') {
    await page.getByLabel('Full Name').fill('Jane Smith');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByLabel('Password').fill('short12');
    await acceptTerms();
    await page.getByRole('button', { name: 'Create Account' }).click();
    assert(title, await visible(page.getByText('Password must be at least 8 characters')), 'Password length error should appear');
    assert(title, !(await exists(page.getByTestId('success-message'))), 'Success message should not appear');
    return;
  }

  if (title === 'Form does not submit with a malformed email address') {
    await page.getByLabel('Full Name').fill('Jane Smith');
    await page.getByLabel('Email').fill('jane@');
    await page.getByLabel('Password').fill('securepass1');
    await acceptTerms();
    await page.getByRole('button', { name: 'Create Account' }).click();
    assert(title, await visible(page.getByText('Enter a valid email address')), 'Email format error should appear');
    assert(title, !(await exists(page.getByTestId('success-message'))), 'Success message should not appear');
    return;
  }

  fail(title, `Unhandled scenario: ${title}`);
}

async function runAsyncScenario(page, title) {
  if (title === 'Clicking "Load Users" shows a loading spinner then 5 user cards') {
    await page.getByRole('button', { name: 'Load Users' }).click();
    assert(title, await visible(page.getByTestId('loading-spinner')), 'Loading spinner should appear');
    assert(title, await page.getByTestId('btn-fetch-users').isDisabled(), 'Load Users should be disabled while loading');
    await page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden', timeout: 4000 });
    assert(title, (await page.getByTestId('user-card').count()) === 5, 'Expected 5 user cards');
    return;
  }

  if (title === 'User cards display name and role') {
    await page.getByRole('button', { name: 'Load Users' }).click();
    await page.getByTestId('user-list').waitFor({ state: 'visible', timeout: 4000 });
    for (const [name, role] of [['Alice Chen', 'Engineer'], ['Bob Martinez', 'Designer'], ['Carol White', 'PM'], ['David Kim', 'QA'], ['Eva Rodriguez', 'Engineer']]) {
      const card = page.getByTestId('user-card').filter({ hasText: name });
      assert(title, (await card.count()) === 1, `Missing user card: ${name}`);
      assert(title, (await card.first().innerText()).includes(role), `Missing role ${role} for ${name}`);
    }
    return;
  }

  if (title === 'Load Users button cannot be clicked a second time after loading') {
    await page.getByRole('button', { name: 'Load Users' }).click();
    await page.getByTestId('user-list').waitFor({ state: 'visible', timeout: 4000 });
    assert(title, await page.getByTestId('btn-fetch-users').isDisabled(), 'Load Users should remain disabled');
    return;
  }

  if (title === 'Loading spinner is not visible before the button is clicked') {
    assert(title, !(await exists(page.getByTestId('loading-spinner'))), 'Loading spinner should not be visible initially');
    assert(title, !(await exists(page.getByTestId('user-list'))), 'User list should not be visible initially');
    return;
  }

  if (title === 'Search input shows all 20 products on initial load') {
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === 'Showing all 20', 'Result count should be Showing all 20');
    assert(title, (await page.getByTestId('search-result-item').count()) === 20, 'Expected 20 products');
    return;
  }

  if (title === 'Typing a query filters results after the debounce settles') {
    await page.getByTestId('search-input').fill('widget');
    await page.waitForTimeout(500);
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === '3 results', 'Expected 3 results');
    return;
  }

  if (title === 'Search is case-insensitive') {
    await page.getByTestId('search-input').fill('WIDGET');
    await page.waitForTimeout(500);
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === '3 results', 'Search should be case-insensitive');
    return;
  }

  if (title === 'Clearing the search input restores all 20 results') {
    const input = page.getByTestId('search-input');
    await input.fill('keyboard');
    await page.waitForTimeout(500);
    await input.fill('');
    await page.waitForTimeout(500);
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === 'Showing all 20', 'Clearing should restore all results');
    assert(title, (await page.getByTestId('search-result-item').count()) === 20, 'Expected 20 products after clearing');
    return;
  }

  if (title === 'A search term that matches nothing shows zero results') {
    await page.getByTestId('search-input').fill('xyznotaproduct');
    await page.waitForTimeout(500);
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === '0 results', 'Expected 0 results');
    return;
  }

  if (title === 'Result count uses singular "result" for exactly one match') {
    await page.getByTestId('search-input').fill('keyboard');
    await page.waitForTimeout(500);
    assert(title, (await textOf(page.getByTestId('search-result-count'))) === '1 result', 'Expected singular result label');
    return;
  }

  if (title === 'Initially 5 items are visible and the Load More button is shown') {
    assert(title, (await page.getByTestId('list-item').count()) === 5, 'Expected 5 list items initially');
    assert(title, await visible(page.getByRole('button', { name: 'Load More' })), 'Load More button should be visible');
    return;
  }

  if (title === 'Clicking Load More shows a spinner then adds 5 more items') {
    await page.getByRole('button', { name: 'Load More' }).click();
    assert(title, await visible(page.getByTestId('load-more-spinner')), 'Load-more spinner should appear');
    assert(title, !(await exists(page.getByRole('button', { name: 'Load More' }))), 'Load More button should be hidden while loading');
    await page.waitForSelector('[data-testid="load-more-spinner"]', { state: 'hidden', timeout: 3000 });
    assert(title, (await page.getByTestId('list-item').count()) === 10, 'Expected 10 items');
    return;
  }

  if (title === 'Load More button disappears after all 20 items are loaded') {
    while (await exists(page.getByRole('button', { name: 'Load More' }))) {
      await page.getByRole('button', { name: 'Load More' }).click();
      await page.waitForTimeout(900);
    }
    assert(title, (await page.getByTestId('list-item').count()) === 20, 'Expected 20 items');
    assert(title, !(await exists(page.getByRole('button', { name: 'Load More' }))), 'Load More should not be visible after exhaustion');
    return;
  }

  if (title === 'Items are added cumulatively across multiple clicks') {
    await page.getByRole('button', { name: 'Load More' }).click();
    await page.waitForTimeout(900);
    assert(title, (await page.getByTestId('list-item').count()) === 10, 'Expected 10 items after first click');
    await page.getByRole('button', { name: 'Load More' }).click();
    await page.waitForTimeout(900);
    assert(title, (await page.getByTestId('list-item').count()) === 15, 'Expected 15 items after second click');
    await page.getByRole('button', { name: 'Load More' }).click();
    await page.waitForTimeout(900);
    assert(title, (await page.getByTestId('list-item').count()) === 20, 'Expected 20 items after third click');
    return;
  }

  fail(title, `Unhandled scenario: ${title}`);
}

async function runModalsScenario(page, title) {
  if (title === 'Clicking "Delete Account" opens the confirmation modal') {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    assert(title, await visible(page.getByTestId('confirmation-modal')), 'Confirmation modal should be visible');
    assert(title, await visible(page.getByRole('button', { name: 'Cancel' })), 'Cancel button should be visible');
    assert(title, await visible(page.getByTestId('modal-confirm')), 'Delete button should be visible');
    return;
  }

  if (title === 'Cancelling the modal closes it without deleting the account') {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    assert(title, !(await exists(page.getByTestId('confirmation-modal'))), 'Modal should be closed');
    assert(title, await visible(page.getByRole('button', { name: 'Delete Account' })), 'Delete Account should still be visible');
    return;
  }

  if (title === 'Confirming deletion closes the modal and shows the success banner') {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.getByTestId('modal-confirm').click();
    assert(title, !(await exists(page.getByTestId('confirmation-modal'))), 'Modal should close after delete');
    assert(title, await visible(page.getByTestId('delete-success-message')), 'Success banner should appear');
    return;
  }

  if (title === 'Pressing Escape closes the confirmation modal') {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.keyboard.press('Escape');
    assert(title, !(await exists(page.getByTestId('confirmation-modal'))), 'Modal should close on Escape');
    return;
  }

  if (title === 'Delete Account button is not shown after a successful deletion') {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.getByTestId('modal-confirm').click();
    assert(title, !(await exists(page.getByRole('button', { name: 'Delete Account' }))), 'Delete Account button should be hidden');
    return;
  }

  if (title === 'Modal does not appear without clicking Delete Account') {
    assert(title, !(await exists(page.getByTestId('confirmation-modal'))), 'Modal should not appear by default');
    return;
  }

  if (title === 'Tooltip is not present in the DOM before hovering') {
    assert(title, !(await exists(page.getByTestId('tooltip-content'))), 'Tooltip should not be in DOM initially');
    return;
  }

  if (title === 'Hovering the info button mounts the tooltip in the DOM') {
    await page.getByTestId('tooltip-trigger').hover();
    assert(title, await visible(page.getByTestId('tooltip-content')), 'Tooltip should be visible on hover');
    return;
  }

  if (title === 'Moving the cursor away from the trigger unmounts the tooltip') {
    await page.getByTestId('tooltip-trigger').hover();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    assert(title, !(await exists(page.getByTestId('tooltip-content'))), 'Tooltip should unmount when cursor leaves');
    return;
  }

  if (title === 'Clicking "Open Settings" opens the drawer') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    assert(title, await visible(page.getByTestId('drawer')), 'Drawer should be visible');
    assert(title, await visible(page.getByTestId('drawer-backdrop')), 'Drawer backdrop should be visible');
    return;
  }

  if (title === 'Drawer contains the expected settings controls') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    assert(title, (await page.locator('label:has-text("Dark Mode") + input[type="checkbox"]').count()) === 1, 'Dark Mode checkbox missing');
    assert(title, (await page.locator('label:has-text("Notifications") + input[type="checkbox"]').count()) === 1, 'Notifications checkbox missing');
    assert(title, (await page.locator('label:has-text("Language") + select').count()) === 1, 'Language dropdown missing');
    return;
  }

  if (title === 'Notifications checkbox is checked by default') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    const cb = page.locator('label:has-text("Notifications") + input[type="checkbox"]');
    assert(title, await cb.first().isChecked(), 'Notifications checkbox should be checked by default');
    return;
  }

  if (title === 'Closing the drawer via the X button removes it from view') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByTestId('drawer-close').click();
    assert(title, !(await exists(page.getByTestId('drawer'))), 'Drawer should close via X button');
    assert(title, !(await exists(page.getByTestId('drawer-backdrop'))), 'Backdrop should disappear');
    return;
  }

  if (title === 'Clicking the backdrop closes the drawer') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByTestId('drawer-backdrop').click();
    assert(title, !(await exists(page.getByTestId('drawer'))), 'Drawer should close via backdrop click');
    return;
  }

  if (title === 'Pressing Escape closes the drawer') {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.keyboard.press('Escape');
    assert(title, !(await exists(page.getByTestId('drawer'))), 'Drawer should close on Escape');
    return;
  }

  if (title === 'Drawer is not visible before it is opened') {
    assert(title, !(await exists(page.getByTestId('drawer'))), 'Drawer should be hidden initially');
    assert(title, !(await exists(page.getByTestId('drawer-backdrop'))), 'Backdrop should be hidden initially');
    return;
  }

  fail(title, `Unhandled scenario: ${title}`);
}

async function runTablesScenario(page, title) {
  const info = page.getByTestId('pagination-info');

  if (title === 'Table shows 5 rows on the first page with correct pagination info') {
    assert(title, (await page.getByTestId('table-row').count()) === 5, 'Expected 5 rows');
    assert(title, (await textOf(info)) === 'Showing 1–5 of 20', 'Pagination info mismatch');
    assert(title, await page.getByTestId('pagination-prev').isDisabled(), 'Prev should be disabled');
    assert(title, !(await page.getByTestId('pagination-next').isDisabled()), 'Next should be enabled');
    return;
  }

  if (title === 'First row on page 1 is Alice Chen in Engineering') {
    const txt = await page.getByTestId('table-row').first().innerText();
    assert(title, txt.includes('Alice Chen'), 'First row should include Alice Chen');
    assert(title, txt.includes('Engineering'), 'First row should include Engineering');
    return;
  }

  if (title === 'Selected count starts at zero') {
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '0 selected', 'Selected count should start at zero');
    return;
  }

  if (title === 'Clicking the Name column header sorts rows A–Z') {
    await page.getByTestId('col-header-name').click();
    assert(title, (await page.getByTestId('col-header-name').innerText()).includes('↑'), 'Ascending indicator should appear');
    return;
  }

  if (title === 'Clicking the Name column header a second time reverses the sort to Z–A') {
    const h = page.getByTestId('col-header-name');
    await h.click();
    await h.click();
    assert(title, (await h.innerText()).includes('↓'), 'Descending indicator should appear');
    return;
  }

  if (title === 'Clicking the Salary column header sorts by salary ascending') {
    await page.getByTestId('col-header-salary').click();
    assert(title, (await page.getByTestId('col-header-salary').innerText()).includes('↑'), 'Salary ascending indicator should appear');
    return;
  }

  if (title === 'Sorting resets pagination to page 1') {
    await page.getByTestId('pagination-page-2').click();
    await page.getByTestId('col-header-department').click();
    assert(title, (await textOf(info)) === 'Showing 1–5 of 20', 'Sorting should reset to page 1');
    return;
  }

  if (title === 'Clicking a different column replaces the active sort') {
    await page.getByTestId('col-header-name').click();
    await page.getByTestId('col-header-status').click();
    assert(title, (await page.getByTestId('col-header-name').innerText()).includes('↕'), 'Name should return to neutral indicator');
    return;
  }

  if (title === 'Typing a name filter reduces the visible rows') {
    await page.getByTestId('table-filter-input').fill('Alice');
    assert(title, (await page.getByTestId('table-row').count()) === 1, 'Expected 1 row after Alice filter');
    assert(title, (await textOf(info)) === 'Showing 1–1 of 1', 'Pagination info mismatch for Alice filter');
    return;
  }

  if (title === 'Filtering by department shows only matching employees') {
    await page.getByTestId('table-filter-input').fill('Engineering');
    assert(title, (await textOf(info)) === 'Showing 1–5 of 6', 'Engineering filter pagination mismatch');
    return;
  }

  if (title === 'Filter is case-insensitive') {
    await page.getByTestId('table-filter-input').fill('engineering');
    assert(title, (await textOf(info)).includes('of 6'), 'Case-insensitive filter should match same count');
    return;
  }

  if (title === 'Filtering with no match shows an empty state message') {
    await page.getByTestId('table-filter-input').fill('xyznotadepartment');
    assert(title, (await textOf(info)) === 'No results', 'No-results pagination text mismatch');
    return;
  }

  if (title === 'Clearing the filter restores all 20 employees') {
    const input = page.getByTestId('table-filter-input');
    await input.fill('Finance');
    await input.fill('');
    assert(title, (await textOf(info)) === 'Showing 1–5 of 20', 'Clearing filter should restore full dataset');
    return;
  }

  if (title === 'Filtering resets pagination to page 1') {
    await page.getByTestId('pagination-page-2').click();
    await page.getByTestId('table-filter-input').fill('Marketing');
    assert(title, (await textOf(info)).startsWith('Showing 1–'), 'Filtering should reset to page 1');
    return;
  }

  if (title === 'Clicking Next advances to page 2 and shows the next 5 rows') {
    await page.getByTestId('pagination-next').click();
    assert(title, (await textOf(info)) === 'Showing 6–10 of 20', 'Next should move to page 2');
    return;
  }

  if (title === 'Clicking a page number button navigates directly to that page') {
    await page.getByTestId('pagination-page-3').click();
    assert(title, (await textOf(info)) === 'Showing 11–15 of 20', 'Page 3 should be selected');
    return;
  }

  if (title === 'Clicking Prev from page 2 returns to page 1') {
    await page.getByTestId('pagination-next').click();
    await page.getByTestId('pagination-prev').click();
    assert(title, (await textOf(info)) === 'Showing 1–5 of 20', 'Prev should return to page 1');
    return;
  }

  if (title === 'Next button is disabled on the last page') {
    await page.getByTestId('pagination-page-4').click();
    assert(title, await page.getByTestId('pagination-next').isDisabled(), 'Next should be disabled on last page');
    return;
  }

  if (title === 'Checking a row checkbox increments the selected count') {
    await page.getByTestId('row-checkbox').first().check();
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '1 selected', 'Selected count should increment to 1');
    return;
  }

  if (title === 'Unchecking a row checkbox decrements the selected count') {
    const cb = page.getByTestId('row-checkbox').first();
    await cb.check();
    await cb.uncheck();
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '0 selected', 'Selected count should decrement to 0');
    return;
  }

  if (title === 'Checking the select-all checkbox selects all 5 rows on the current page') {
    await page.getByTestId('select-all-checkbox').check();
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '5 selected', 'Select-all should select 5 rows');
    return;
  }

  if (title === 'Unchecking the select-all checkbox deselects all rows on the current page') {
    const all = page.getByTestId('select-all-checkbox');
    await all.check();
    await all.uncheck();
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '0 selected', 'Select-all uncheck should clear selection');
    return;
  }

  if (title === 'Select-all does not affect rows on other pages') {
    await page.getByTestId('select-all-checkbox').check();
    await page.getByTestId('pagination-page-2').click();
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '5 selected', 'Selection count should persist across pages');
    return;
  }

  if (title === 'Manually checking all rows on a page checks the select-all checkbox') {
    const cbs = page.getByTestId('row-checkbox');
    const n = await cbs.count();
    for (let i = 0; i < n; i++) await cbs.nth(i).check();
    assert(title, await page.getByTestId('select-all-checkbox').isChecked(), 'Select-all should become checked');
    return;
  }

  if (title === 'Unchecking one row unchecks the select-all checkbox') {
    await page.getByTestId('select-all-checkbox').check();
    await page.getByTestId('row-checkbox').first().uncheck();
    assert(title, !(await page.getByTestId('select-all-checkbox').isChecked()), 'Select-all should become unchecked');
    assert(title, (await textOf(page.getByTestId('selected-count'))) === '4 selected', 'Selected count should be 4');
    return;
  }

  fail(title, `Unhandled scenario: ${title}`);
}

async function executeScenario(page, feature, title) {
  if (feature === 'Home Page') return runHomeScenario(page, title);
  if (feature === 'Forms & Inputs — Registration Form') return runFormsScenario(page, title);
  if (feature === 'Async & Dynamic Content') return runAsyncScenario(page, title);
  if (feature === 'Modals & Overlays') return runModalsScenario(page, title);
  if (feature === 'Tables & Lists — Employee Data Table') return runTablesScenario(page, title);
  fail(title, `Unhandled feature: ${feature}`);
}

function buildReport({ timestamp, baseUrl, results }) {
  const byFeature = new Map();
  for (const result of results) {
    if (!byFeature.has(result.feature)) byFeature.set(result.feature, []);
    byFeature.get(result.feature).push(result);
  }

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  let md = '';
  md += '# Codeless Acceptance Test Results\n';
  md += `**Run Date:** ${timestamp}\n`;
  md += `**App URL:** ${baseUrl}\n\n`;
  md += '## Summary\n';
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total | ${total} |\n`;
  md += `| ✓ Passed | ${passed} |\n`;
  md += `| ✗ Failed | ${failed} |\n`;
  md += `| ⊘ Skipped | ${skipped} |\n\n`;

  md += '## Results by Feature\n\n';
  for (const [feature, featureResults] of byFeature) {
    md += `### ${feature}\n`;
    for (const result of featureResults) {
      const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⊘';
      md += `- ${statusIcon} **${result.title}**\n`;
      if (result.status === 'FAIL') {
        md += `  - **Failed at step:** ${result.step || 'Unknown step'}\n`;
        md += `  - **Error:** ${result.reason}\n`;
        if (result.screenshot) {
          const screenshotFilePath = result.screenshot.replace(/\\/g, '/');
          const screenshotFileName = path.basename(result.screenshot);
          md += `  - **Evidence:** <a href="${screenshotFilePath}" target="_blank">${screenshotFileName}</a>\n`;
        }
      }
    }
    md += '\n';
  }

  return md;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtmlReport({ timestamp, baseUrl, results }) {
  const byFeature = new Map();
  for (const result of results) {
    if (!byFeature.has(result.feature)) byFeature.set(result.feature, []);
    byFeature.get(result.feature).push(result);
  }

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  let html = '';
  html += '<!doctype html>';
  html += '<html lang="en"><head><meta charset="UTF-8" />';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  html += '<title>Codeless Acceptance Test Results</title>';
  html += '<style>';
  html += 'body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#111827;background:#f8fafc;}';
  html += '.wrap{max-width:1100px;margin:0 auto;}';
  html += '.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:16px;}';
  html += 'h1{font-size:1.6rem;margin:0 0 8px;} h2{font-size:1.2rem;margin:0 0 8px;} h3{font-size:1rem;margin:16px 0 8px;}';
  html += '.meta{color:#4b5563;font-size:.92rem;margin:3px 0;}';
  html += '.summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;}';
  html += '.metric{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:10px;}';
  html += '.metric .k{font-size:.75rem;color:#6b7280;} .metric .v{font-size:1.2rem;font-weight:700;}';
  html += '.scenario{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0;background:#fff;}';
  html += '.status{font-weight:700;} .pass{color:#166534;} .fail{color:#991b1b;} .skip{color:#374151;}';
  html += '.steps{margin:8px 0 0 18px;color:#374151;font-size:.92rem;}';
  html += '.error{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px;margin-top:8px;}';
  html += '.screenshot{margin-top:10px;} .screenshot img{max-width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;}';
  html += 'a{color:#1d4ed8;text-decoration:none;} a:hover{text-decoration:underline;}';
  html += '@media (max-width:720px){.summary{grid-template-columns:repeat(2,minmax(120px,1fr));}}';
  html += '</style></head><body><div class="wrap">';

  html += '<div class="card">';
  html += '<h1>Codeless Acceptance Test Results</h1>';
  html += `<div class="meta"><strong>Run Date:</strong> ${escapeHtml(timestamp)}</div>`;
  html += `<div class="meta"><strong>App URL:</strong> ${escapeHtml(baseUrl)}</div>`;
  html += '<div class="summary" style="margin-top:12px;">';
  html += `<div class="metric"><div class="k">Total</div><div class="v">${total}</div></div>`;
  html += `<div class="metric"><div class="k">Passed</div><div class="v">${passed}</div></div>`;
  html += `<div class="metric"><div class="k">Failed</div><div class="v">${failed}</div></div>`;
  html += `<div class="metric"><div class="k">Skipped</div><div class="v">${skipped}</div></div>`;
  html += '</div></div>';

  for (const [feature, featureResults] of byFeature) {
    html += '<div class="card">';
    html += `<h2>${escapeHtml(feature)}</h2>`;
    for (const result of featureResults) {
      const statusClass = result.status === 'PASS' ? 'pass' : result.status === 'FAIL' ? 'fail' : 'skip';
      const marker = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⊘';
      html += '<div class="scenario">';
      html += `<div class="status ${statusClass}">${marker} ${escapeHtml(result.title)}</div>`;

      if (Array.isArray(result.steps) && result.steps.length > 0) {
        html += '<ul class="steps">';
        for (const step of result.steps) {
          html += `<li>${escapeHtml(step)}</li>`;
        }
        html += '</ul>';
      }

      if (result.status === 'FAIL') {
        html += '<div class="error">';
        html += `<div><strong>Failed at step:</strong> ${escapeHtml(result.step || 'Unknown step')}</div>`;
        html += `<div><strong>Error:</strong> ${escapeHtml(result.reason || 'Unknown error')}</div>`;
        html += '</div>';
        if (result.screenshot) {
          const fileName = path.basename(result.screenshot);
          const imgPath = `./screenshots/${fileName}`;
          html += '<div class="screenshot">';
          html += `<div><a href="${imgPath}" target="_blank" rel="noopener noreferrer">Open screenshot</a></div>`;
          html += `<img src="${imgPath}" alt="Failure screenshot: ${escapeHtml(fileName)}" />`;
          html += '</div>';
        }
      }

      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div></body></html>';
  return html;
}

async function run() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.rm(SCREENSHOTS_DIR, { recursive: true, force: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const features = await loadAcceptanceModel();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  for (const featureModel of features) {
    for (const scenario of featureModel.scenarios) {
      const startUrl = parseStartUrlFromSteps(scenario.steps);
      const testLabel = `${featureModel.feature} › ${scenario.title}`;
      
      console.log(`\n▶ ${testLabel}`);
      scenario.steps.forEach(step => {
        console.log(`  ◇ ${step}`);
      });
      
      try {
        await resetScenario(page, startUrl);
        await executeScenario(page, featureModel.feature, scenario.title);
        results.push({ feature: featureModel.feature, title: scenario.title, status: 'PASS', steps: scenario.steps });
        console.log(`✓ PASS: ${testLabel}`);
      } catch (error) {
        const screenshotName = `${Date.now()}-${slugify(featureModel.feature)}-${slugify(scenario.title)}.png`;
        const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
        const screenshotArtifactPath = path.join('.github', '.results', 'screenshots', screenshotName);
        
        try {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          // No-op if screenshot fails.
        }
        
        results.push({
          feature: featureModel.feature,
          title: scenario.title,
          status: 'FAIL',
          steps: scenario.steps,
          step: error?.step || 'Unknown step',
          reason: error?.message || String(error),
          screenshot: screenshotArtifactPath,
        });
        
        console.log(`✗ FAIL: ${testLabel}`);
        console.log(`  Step: ${error?.step || 'Unknown step'}`);
        console.log(`  Reason: ${error?.message || String(error)}`);
        if (screenshotName) {
          console.log(`  Screenshot: ${screenshotArtifactPath}`);
        }
      }
    }
  }

  await context.close();
  await browser.close();

  const timestamp = new Date().toISOString();
  const report = buildReport({
    timestamp,
    baseUrl: BASE_URL,
    results,
  });

  await fs.writeFile(LATEST_REPORT, report, 'utf8');
  const htmlReport = buildHtmlReport({ timestamp, baseUrl: BASE_URL, results });
  await fs.writeFile(LATEST_HTML_REPORT, htmlReport, 'utf8');

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const summary = `Codeless run complete: total=${results.length}, passed=${results.length - failed}, failed=${failed}`;
  if (failed > 0) {
    console.error(summary);
    process.exitCode = 1;
  } else {
    console.log(summary);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
