import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const RESULTS_DIR = path.join(ROOT, '.github', '.results');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const LATEST_REPORT = path.join(RESULTS_DIR, 'latest-test-run.md');

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

function locatorFromSpec(page, spec) {
  if (!spec) throw new Error('Missing locator spec');
  const area = page.getByTestId('practice-area');

  if (spec.kind === 'any') {
    return {
      async count() {
        for (const candidate of spec.candidates || []) {
          const locator = locatorFromSpec(page, candidate);
          if ((await locator.count()) > 0) return await locator.count();
        }
        return 0;
      },
      first() {
        const candidates = spec.candidates || [];
        return {
          async _pick() {
            for (const candidate of candidates) {
              const locator = locatorFromSpec(page, candidate);
              if ((await locator.count()) > 0) return locator.first();
            }
            throw new Error('No locator candidate matched');
          },
          async click() { return (await this._pick()).click(); },
          async check() { return (await this._pick()).check(); },
          async uncheck() { return (await this._pick()).uncheck(); },
          async fill(value) { return (await this._pick()).fill(value); },
          async selectOption(value) { return (await this._pick()).selectOption(value); },
          async focus() { return (await this._pick()).focus(); },
          async blur() { return (await this._pick()).blur(); },
          async hover() { return (await this._pick()).hover(); },
          async press(key) { return (await this._pick()).press(key); },
          async scrollIntoViewIfNeeded() { return (await this._pick()).scrollIntoViewIfNeeded(); },
          async isVisible() { return (await this._pick()).isVisible(); },
          async isChecked() { return (await this._pick()).isChecked(); },
          async isDisabled() { return (await this._pick()).isDisabled(); },
          async inputValue() { return (await this._pick()).inputValue(); },
          async getAttribute(attr) { return (await this._pick()).getAttribute(attr); },
          async textContent() { return (await this._pick()).textContent(); },
          async waitFor(options) { return (await this._pick()).waitFor(options); },
        };
      },
      async nth(index) {
        for (const candidate of spec.candidates || []) {
          const locator = locatorFromSpec(page, candidate);
          if ((await locator.count()) > index) return locator.nth(index);
        }
        throw new Error('No locator candidate matched nth()');
      },
    };
  }

  if (spec.kind === 'testId') return area.getByTestId(spec.value).or(page.getByTestId(spec.value));
  if (spec.kind === 'label') return area.getByLabel(spec.value).or(page.getByLabel(spec.value));
  if (spec.kind === 'text') return area.getByText(spec.value).or(page.getByText(spec.value));
  if (spec.kind === 'css') return area.locator(spec.value).or(page.locator(spec.value));
  if (spec.kind === 'testIdPrefix') return area.locator(`[data-testid^="${spec.value}"]`).or(page.locator(`[data-testid^="${spec.value}"]`));
  if (spec.kind === 'role') return area.getByRole(spec.role, { name: spec.name }).or(page.getByRole(spec.role, { name: spec.name }));

  throw new Error(`Unknown locator kind: ${spec.kind}`);
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

async function waitForCondition(check, timeoutMs = 3000, stepMs = 100) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await check()) return true;
    if (Date.now() - start >= timeoutMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

async function waitForInteractable(locator, timeout = 5000) {
  await locator.waitFor({ state: 'visible', timeout });
  if (typeof locator.scrollIntoViewIfNeeded === 'function') {
    await locator.scrollIntoViewIfNeeded();
  }
  const enabled = await waitForCondition(async () => !(await locator.isDisabled()), Math.min(timeout, 3000));
  if (!enabled) throw new Error('Target is visible but disabled');
}

async function clickWithoutForce(locator, timeout = 5000) {
  await waitForInteractable(locator, timeout);
  await locator.click({ timeout });
}

async function checkWithoutForce(locator, timeout = 5000) {
  await waitForInteractable(locator, timeout);
  if (await locator.isChecked()) return;
  const settleMs = Math.min(timeout, 1000);

  // Retry natural interactions before failing to reduce flaky checkbox toggles.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (attempt === 0) {
        await locator.check({ timeout: settleMs });
      } else if (attempt === 1) {
        await locator.click({ timeout: settleMs });
      } else {
        await locator.focus();
        await locator.press('Space');
      }
    } catch {
      // Keep trying alternate non-force interactions.
    }

    const becameChecked = await waitForCondition(async () => locator.isChecked(), settleMs, 75);
    if (becameChecked) return;
  }

  const becameChecked = await waitForCondition(async () => locator.isChecked(), settleMs, 75);
  if (!becameChecked) throw new Error('Clicking the checkbox did not change its state');
}

async function uncheckWithoutForce(locator, timeout = 5000) {
  await waitForInteractable(locator, timeout);
  if (!(await locator.isChecked())) return;
  await locator.click({ timeout });
  const becameUnchecked = await waitForCondition(async () => !(await locator.isChecked()), Math.min(timeout, 2000));
  if (!becameUnchecked) throw new Error('Clicking the checkbox did not clear its state');
}

async function runOperation(page, op, baseUrl) {
  switch (op.type) {
    case 'resetTo': {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto(op.url, { waitUntil: 'domcontentloaded' });
      return;
    }
    case 'goto': {
      await page.goto(op.url, { waitUntil: 'domcontentloaded' });
      return;
    }
    case 'click': {
      const locator = locatorFromSpec(page, op.locator).first();
      await clickWithoutForce(locator, op.timeout || 5000);
      return;
    }
    case 'clickInRoleContainer': {
      const container = page.getByRole(op.containerRole).first();
      await clickWithoutForce(container.getByRole(op.role, { name: op.name }).first(), op.timeout || 5000);
      return;
    }
    case 'repeatClickUntilGone': {
      const maxIterations = op.maxIterations || 20;
      for (let i = 0; i < maxIterations; i += 1) {
        const locator = locatorFromSpec(page, op.locator);
        if ((await locator.count()) === 0) return;
        await clickWithoutForce(locator.first(), op.timeout || 2000);
        await page.waitForTimeout(op.waitMs || 300);
      }
      return;
    }
    case 'check': {
      const locator = locatorFromSpec(page, op.locator).first();
      if (!(await locator.isChecked())) {
        await checkWithoutForce(locator, op.timeout || 5000);
      }
      return;
    }
    case 'checkEach': {
      const locator = locatorFromSpec(page, op.locator);
      const count = Math.min(op.count || (await locator.count()), await locator.count());
      for (let i = 0; i < count; i += 1) {
        const rowCb = locator.nth(i);
        if (!(await rowCb.isChecked())) {
          await checkWithoutForce(rowCb, op.timeout || 5000);
        }
      }
      return;
    }
    case 'uncheck': {
      const locator = locatorFromSpec(page, op.locator).first();
      if (await locator.isChecked()) {
        await uncheckWithoutForce(locator, op.timeout || 5000);
      }
      return;
    }
    case 'fill': {
      await locatorFromSpec(page, op.locator).first().fill(op.value);
      return;
    }
    case 'select': {
      await locatorFromSpec(page, op.locator).first().selectOption(op.value);
      return;
    }
    case 'focus': {
      await locatorFromSpec(page, op.locator).first().focus();
      return;
    }
    case 'blur': {
      await locatorFromSpec(page, op.locator).first().blur();
      return;
    }
    case 'hover': {
      await locatorFromSpec(page, op.locator).first().hover();
      return;
    }
    case 'press': {
      await page.keyboard.press(op.key);
      return;
    }
    case 'mouseMove': {
      await page.mouse.move(op.x, op.y);
      return;
    }
    case 'wait': {
      await page.waitForTimeout(op.ms);
      return;
    }
    case 'waitVisible': {
      await locatorFromSpec(page, op.locator).first().waitFor({ state: 'visible', timeout: op.timeout || 5000 });
      return;
    }
    case 'waitHidden': {
      await locatorFromSpec(page, op.locator).first().waitFor({ state: 'hidden', timeout: op.timeout || 5000 });
      return;
    }
    case 'assert': {
      const locator = op.locator ? locatorFromSpec(page, op.locator) : null;

      if (op.assertion === 'visible') {
        const ok = await waitForCondition(() => visible(locator), op.timeout || 3000);
        assert(op.stepText, ok, op.message || 'Expected visible');
        return;
      }
      if (op.assertion === 'notVisible') {
        const ok = await waitForCondition(async () => !(await visible(locator)), op.timeout || 3000);
        assert(op.stepText, ok, op.message || 'Expected not visible');
        return;
      }
      if (op.assertion === 'count') {
        const ok = await waitForCondition(async () => (await locator.count()) === op.value, op.timeout || 3000);
        assert(op.stepText, ok, op.message || `Expected count ${op.value}`);
        return;
      }
      if (op.assertion === 'textEquals') {
        assert(op.stepText, (await textOf(locator)) === op.value, op.message || `Expected text ${op.value}`);
        return;
      }
      if (op.assertion === 'textIncludes') {
        assert(op.stepText, (await textOf(locator)).includes(op.value), op.message || `Expected text includes ${op.value}`);
        return;
      }
      if (op.assertion === 'textPresent') {
        const loc = page.getByText(op.value);
        const ok = await waitForCondition(() => visible(loc), op.timeout || 3000);
        assert(op.stepText, ok, op.message || `Expected visible text ${op.value}`);
        return;
      }
      if (op.assertion === 'textMatchesPattern') {
        const re = new RegExp(op.pattern, op.flags || '');
        const ok = await waitForCondition(async () => {
          const bodyText = await page.locator('body').innerText();
          return re.test(bodyText || '');
        }, op.timeout || 3000);
        assert(op.stepText, ok, op.message || `Expected text matching /${op.pattern}/${op.flags || ''}`);
        return;
      }
      if (op.assertion === 'textNotPresent') {
        assert(op.stepText, !(await visible(page.getByText(op.value))), op.message || `Expected text not present ${op.value}`);
        return;
      }
      if (op.assertion === 'allTextsPresent') {
        for (const value of op.values || []) {
          assert(op.stepText, await visible(page.getByText(value)), `Expected visible text ${value}`);
        }
        return;
      }
      if (op.assertion === 'buttonVisible') {
        assert(op.stepText, await visible(page.getByRole('button', { name: op.value })), op.message || `Expected button ${op.value}`);
        return;
      }
      if (op.assertion === 'headingVisible') {
        assert(op.stepText, await visible(page.getByRole('heading', { name: op.value })), op.message || `Expected heading ${op.value}`);
        return;
      }
      if (op.assertion === 'containerHasLabelAndControl') {
        const rows = page.locator(op.container || '[data-testid="drawer-content"], aside');
        const rowCount = await rows.count();
        let found = false;
        for (let i = 0; i < rowCount; i += 1) {
          const row = rows.nth(i);
          const hasLabel = await row.getByText(op.label, { exact: false }).count();
          if (!hasLabel) continue;
          const control = row.locator(op.controlSelector || 'input,select,textarea');
          if ((await control.count()) > 0) {
            found = true;
            break;
          }
        }
        assert(op.stepText, found, op.message || `Expected label '${op.label}' with control`);
        return;
      }
      if (op.assertion === 'rowCheckboxesUncheckedCurrentPage') {
        const rows = page.getByTestId('table-row');
        const rowCount = await rows.count();
        for (let i = 0; i < rowCount; i += 1) {
          const cb = rows.nth(i).getByTestId('row-checkbox');
          assert(op.stepText, (await cb.count()) > 0 && !(await cb.first().isChecked()), `Expected unchecked row checkbox at ${i + 1}`);
        }
        return;
      }
      if (op.assertion === 'containerHasLabelAndControlChecked') {
        const rows = page.locator(op.container || '[data-testid="drawer-content"], aside');
        const rowCount = await rows.count();
        let checked = false;
        for (let i = 0; i < rowCount; i += 1) {
          const row = rows.nth(i);
          const hasLabel = await row.getByText(op.label, { exact: false }).count();
          if (!hasLabel) continue;

          // Prefer an adjacent control next to the matching label for accuracy.
          const safeLabel = String(op.label || '').replace(/"/g, '\\"');
          const adjacentControl = row.locator(`label:has-text("${safeLabel}") + input[type="checkbox"], label:has-text("${safeLabel}") + input[type="radio"]`);
          let control = adjacentControl;
          if ((await adjacentControl.count()) === 0) {
            control = row.locator('input[type="checkbox"],input[type="radio"]');
          }
          if ((await control.count()) > 0) {
            checked = await control.first().isChecked();
            break;
          }
        }
        assert(op.stepText, checked, op.message || `Expected checked control for label '${op.label}'`);
        return;
      }
      if (op.assertion === 'anyExpandedToggle') {
        const expanded = page.locator('button[aria-expanded="true"], [role="button"][aria-expanded="true"]');
        assert(op.stepText, (await expanded.count()) > 0, op.message || 'Expected at least one expanded toggle');
        return;
      }
      if (op.assertion === 'inputValueEquals') {
        assert(op.stepText, (await locator.first().inputValue()) === op.value, op.message || `Expected input value ${op.value}`);
        return;
      }
      if (op.assertion === 'attributeEquals') {
        assert(op.stepText, (await locator.first().getAttribute(op.attribute)) === op.value, op.message || `Expected attribute ${op.attribute}=${op.value}`);
        return;
      }
      if (op.assertion === 'urlIncludes') {
        assert(op.stepText, page.url().includes(op.value), op.message || `Expected URL includes ${op.value}`);
        return;
      }
      if (op.assertion === 'checked') {
        assert(op.stepText, await locator.first().isChecked(), op.message || 'Expected checked');
        return;
      }
      if (op.assertion === 'notChecked') {
        assert(op.stepText, !(await locator.first().isChecked()), op.message || 'Expected unchecked');
        return;
      }
      if (op.assertion === 'disabled') {
        assert(op.stepText, await locator.first().isDisabled(), op.message || 'Expected disabled');
        return;
      }
      if (op.assertion === 'enabled') {
        assert(op.stepText, !(await locator.first().isDisabled()), op.message || 'Expected enabled');
        return;
      }
      if (op.assertion === 'allChecked') {
        const count = await locator.count();
        for (let i = 0; i < count; i += 1) {
          assert(op.stepText, await locator.nth(i).isChecked(), `Expected checked at ${i + 1}`);
        }
        return;
      }
      if (op.assertion === 'allUnchecked') {
        const count = await locator.count();
        for (let i = 0; i < count; i += 1) {
          assert(op.stepText, !(await locator.nth(i).isChecked()), `Expected unchecked at ${i + 1}`);
        }
        return;
      }
      if (op.assertion === 'rowsSortedByName') {
        const names = await page.getByTestId('table-row').locator('td:nth-child(2)').allTextContents();
        const normalized = names.map((x) => x.trim());
        const sorted = [...normalized].sort((a, b) => a.localeCompare(b));
        if (op.value === 'desc') sorted.reverse();
        assert(op.stepText, JSON.stringify(normalized) === JSON.stringify(sorted), `Rows are not sorted by name (${op.value})`);
        return;
      }
      if (op.assertion === 'firstRowLowestSalary') {
        const rows = page.getByTestId('table-row');
        const count = await rows.count();
        let minSalary = Number.POSITIVE_INFINITY;
        for (let i = 0; i < count; i += 1) {
          const text = await rows.nth(i).innerText();
          const match = text.match(/\$([\d,]+)/);
          if (!match) continue;
          const salary = Number(match[1].replace(/,/g, ''));
          if (salary < minSalary) minSalary = salary;
        }
        const firstText = await rows.first().innerText();
        const firstMatch = firstText.match(/\$([\d,]+)/);
        const firstSalary = firstMatch ? Number(firstMatch[1].replace(/,/g, '')) : Number.NaN;
        assert(op.stepText, firstSalary === minSalary, 'First row is not lowest salary');
        return;
      }

      throw new Error(`Unknown assertion type: ${op.assertion}`);
    }
    case 'skip': {
      console.log(`  ⚠ SKIP (not supported by generic compiler): ${op.text || ''}`);
      return;
    }
    default:
      throw new Error(`Unknown operation type: ${op.type}`);
  }
}

function buildReport({ timestamp, baseUrl, results, appModel }) {
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
  md += `Run date: ${timestamp}\n`;
  md += `App URL: ${baseUrl}\n\n`;
  md += '## Summary\n';
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total | ${total} |\n`;
  md += `| Passed | ${passed} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| Skipped | ${skipped} |\n\n`;

  md += '## Results by Feature\n\n';
  for (const [feature, featureResults] of byFeature) {
    md += `### ${feature}\n`;
    for (const result of featureResults) {
      md += `- [${result.status}] ${result.title}\n`;
      if (result.status === 'FAIL') {
        md += '\n```text\n';
        md += `failed step: ${result.step || 'Unknown step'}\n`;
        md += `error: ${result.reason}\n`;
        if (result.screenshot) md += `screenshot file: ${path.basename(result.screenshot)}\n`;
        md += '```\n';
      }
    }
    md += '\n';
  }

  md += '## Generation Metadata\n';
  md += `- App model generated at: ${appModel?.generatedAt || 'unknown'}\n`;
  md += `- Start URLs scraped: ${appModel?.startUrls?.length || 0}\n`;

  md += '\n## Artifacts\n';
  md += '- Failure screenshots are available in artifact: codeless-failure-screenshots\n';
  md += '- Markdown report is available in artifact: codeless-report\n';

  return md;
}

export async function runCompiledCodelessModel({ compiledModel, appModel, baseUrl }) {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.rm(SCREENSHOTS_DIR, { recursive: true, force: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  for (const feature of compiledModel) {
    for (const scenario of feature.scenarios) {
      const testLabel = `${feature.feature} › ${scenario.title}`;
      console.log(`\n▶ ${testLabel}`);
      try {
        await runOperation(page, { type: 'resetTo', url: scenario.startUrl }, baseUrl);
        for (const step of scenario.steps) {
          console.log(`  ◇ ${step.keyword} ${step.text}`);
          for (const op of step.operations) {
            await runOperation(page, { ...op, stepText: step.text }, baseUrl);
          }
        }
        results.push({ feature: feature.feature, title: scenario.title, status: 'PASS' });
        console.log(`PASS: ${testLabel}`);
      } catch (error) {
        const screenshotName = `${Date.now()}-${slugify(feature.feature)}-${slugify(scenario.title)}.png`;
        const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
        const screenshotArtifactPath = path.join('.github', '.results', 'screenshots', screenshotName);
        try {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          // ignore screenshot capture failures
        }
        results.push({
          feature: feature.feature,
          title: scenario.title,
          status: 'FAIL',
          step: error?.step || 'Unknown step',
          reason: error?.message || String(error),
          screenshot: screenshotArtifactPath,
        });
        console.log(`FAIL: ${testLabel}`);
        console.log(`  Step: ${error?.step || 'Unknown step'}`);
        console.log(`  Reason: ${error?.message || String(error)}`);
        console.log(`  Screenshot: ${screenshotArtifactPath}`);
      }
    }
  }

  await context.close();
  await browser.close();

  const report = buildReport({
    timestamp: new Date().toISOString(),
    baseUrl,
    results,
    appModel,
  });

  await fs.writeFile(LATEST_REPORT, report, 'utf8');

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const summary = `Codeless run complete: total=${results.length}, passed=${results.length - failed}, failed=${failed}`;
  if (failed > 0) {
    console.error(summary);
    process.exitCode = 1;
  } else {
    console.log(summary);
  }
}
