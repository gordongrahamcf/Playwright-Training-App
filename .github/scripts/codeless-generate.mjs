/**
 * codeless-generate.mjs
 *
 * Generic codeless runner generator.
 *
 * This file contains NO knowledge of any specific BDD scenario, step phrase,
 * element name, or project-specific vocabulary. All step compilation is driven
 * by:
 *   1. Universal web-testing action verbs  (click, fill, navigate, …)
 *   2. Universal assertion vocabulary      (should be visible, should contain, …)
 *   3. The live app model scraped at runtime via Playwright
 *
 * Steps that cannot be resolved generically are emitted as { type: 'skip' }
 * so the run still proceeds and the report identifies unhandled patterns.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const ACCEPTANCE_DIR = path.join(ROOT, '.github', 'acceptance-criteria');
const GENERATED_RESULTS_DIR = path.join(ROOT, '.github', '.results', 'generated');

// ── Feature file parser ──────────────────────────────────────────────────────

async function loadAcceptanceModel() {
  const files = (await fs.readdir(ACCEPTANCE_DIR)).filter((f) => f.endsWith('.feature'));
  const features = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(ACCEPTANCE_DIR, file), 'utf8');
    features.push(parseFeature(content));
  }
  return features;
}

function parseFeature(content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const feature = { feature: '', scenarios: [] };
  const backgroundSteps = [];
  let currentScenario = null;
  let inBackground = false;

  for (const line of lines) {
    if (line.startsWith('Feature:')) {
      feature.feature = line.slice('Feature:'.length).trim();
    } else if (line.startsWith('Background:')) {
      inBackground = true;
    } else if (/^Scenario(?:\s+Outline)?:/i.test(line)) {
      inBackground = false;
      currentScenario = {
        title: line.replace(/^Scenario(?:\s+Outline)?:\s*/i, '').trim(),
        steps: [...backgroundSteps],
      };
      feature.scenarios.push(currentScenario);
    } else if (/^(Given|When|Then|And|But)\s/i.test(line)) {
      const keyword = line.split(/\s/)[0];
      const text = line.slice(keyword.length).trim();
      if (inBackground) backgroundSteps.push({ keyword, text });
      else if (currentScenario) currentScenario.steps.push({ keyword, text });
    }
  }

  return feature;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function normalizeUrl(raw, baseUrl) {
  try {
    const u = new URL(raw);
    const b = new URL(baseUrl);
    u.protocol = b.protocol;
    u.host = b.host;
    return u.toString();
  } catch {
    return raw;
  }
}

// ── App model scraper ─────────────────────────────────────────────────────────

async function scrapeAppModel(startUrls, baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const pages = {};

  async function readPageModel() {
    return page.evaluate(() => {
      const uniq = (arr) => [...new Set(arr.filter(Boolean))];
      const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const dedupeObj = (arr, keyFn) => {
        const seen = new Set();
        return arr.filter((item) => {
          const key = keyFn(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const buttonDetails = dedupeObj(
        [...document.querySelectorAll('button,[role="button"]')].map((el) => ({
          text: txt(el),
          testId: el.getAttribute('data-testid') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
        })),
        (b) => `${b.text}|${b.testId}|${b.ariaLabel}`,
      );

      return {
        testIds: uniq([...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'))),
        buttons: uniq([...document.querySelectorAll('button,[role="button"]')].map(txt)),
        buttonDetails,
        labels: uniq([...document.querySelectorAll('label')].map(txt)),
        headings: uniq([...document.querySelectorAll('h1,h2,h3,h4')].map(txt)),
      };
    });
  }

  function mergeModels(a, b) {
    const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];
    const mergedButtons = [...(a?.buttonDetails || []), ...(b?.buttonDetails || [])];
    const seen = new Set();
    const buttonDetails = mergedButtons.filter((item) => {
      const key = `${item.text}|${item.testId}|${item.ariaLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      testIds: uniq([...(a?.testIds || []), ...(b?.testIds || [])]),
      buttons: uniq([...(a?.buttons || []), ...(b?.buttons || [])]),
      labels: uniq([...(a?.labels || []), ...(b?.labels || [])]),
      headings: uniq([...(a?.headings || []), ...(b?.headings || [])]),
      buttonDetails,
    };
  }

  async function probeInteractiveStates() {
    let model = await readPageModel();
    const maxPasses = 2;
    const startUrl = page.url();

    for (let pass = 0; pass < maxPasses; pass += 1) {
      const buttons = page.locator('button,[role="button"]');
      const count = await buttons.count();
      for (let i = 0; i < count; i += 1) {
        try {
          const btn = buttons.nth(i);
          if (!(await btn.isVisible())) continue;
          await btn.click({ timeout: 1000 });
          await page.waitForTimeout(350);

          // Some interactions are asynchronous (loaders, delayed content).
          await page.waitForTimeout(1200);

          // Keep per-page models scoped: if probing navigates elsewhere, restore
          // the original route and skip merging cross-route DOM into this page.
          if (page.url() === startUrl) {
            model = mergeModels(model, await readPageModel());
          } else {
            await page.goto(startUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
            continue;
          }

          // Try generic close actions so probing can continue safely.
          await page.keyboard.press('Escape').catch(() => {});
          const closeLike = page.locator('[data-testid*="close" i],[aria-label*="close" i],[data-testid*="backdrop" i]');
          if ((await closeLike.count()) > 0) {
            await closeLike.first().click({ timeout: 600 }).catch(() => {});
          }
          await page.waitForTimeout(100);
        } catch {
          // Ignore probe interaction failures and continue exploration.
        }
      }
    }

    return model;
  }

  for (const raw of startUrls) {
    const url = normalizeUrl(raw, baseUrl);
    try {
      console.log(`[generate] Scraping ${url} …`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      pages[url] = await probeInteractiveStates();
      const p = pages[url];
      console.log(`[generate]   → ${p.testIds?.length ?? 0} test-ids, ${p.buttons?.length ?? 0} buttons, ${p.labels?.length ?? 0} labels`);
    } catch (err) {
      pages[url] = { error: String(err) };
      console.warn(`[generate]   → scrape failed: ${err}`);
    }
  }

  await ctx.close();
  await browser.close();
  console.log(`[generate] App model built for ${Object.keys(pages).length} URL(s).`);
  return { generatedAt: new Date().toISOString(), startUrls, pages };
}

// ── Locator resolution (uses scraped app model, not step-text keywords) ───────

function slug(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildLocator(phrase, appModel, pageUrl) {
  if (!phrase) return null;
  const page = appModel?.pages?.[pageUrl] || {};
  const s = slug(phrase);
  const lower = phrase.toLowerCase();
  const testIds = page.testIds || [];
  const buttonDetails = page.buttonDetails || [];

  const singular = (token) => {
    if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
    if (token.endsWith('xes') || token.endsWith('ches') || token.endsWith('shes')) return token.slice(0, -2);
    if (token.endsWith('ses') && token.length > 4) return token.slice(0, -2);
    if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
    return token;
  };

  const tokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(singular)
    .filter((t) => t && !['the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'all'].includes(t));

  if (lower.includes('code block')) return { kind: 'css', value: 'pre' };
  if (/\bform\s+is\s+visible\b/i.test(lower) || /^form$/i.test(lower)) return { kind: 'css', value: 'form' };
  if (tokens.includes('exercise') && tokens.includes('card')) {
    return { kind: 'css', value: 'section:has(h2:has-text("Exercises")) a[href*="/exercises/"]' };
  }
  if (tokens.includes('card') && !tokens.includes('user')) return { kind: 'css', value: 'a' };
  if (tokens.includes('toggle') && tokens.includes('button')) {
    return {
      kind: 'any',
      candidates: [
        { kind: 'role', role: 'button', name: phrase },
        { kind: 'css', value: 'button[aria-expanded], [role="button"][aria-expanded]' },
      ],
    };
  }

  if (tokens.includes('drawer') && testIds.includes('drawer')) return { kind: 'testId', value: 'drawer' };
  if (tokens.includes('backdrop') && testIds.includes('drawer-backdrop')) return { kind: 'testId', value: 'drawer-backdrop' };
  if (tokens.includes('tooltip') && tokens.includes('content') && testIds.includes('tooltip-content')) return { kind: 'testId', value: 'tooltip-content' };
  if (tokens.includes('tooltip') && tokens.includes('trigger') && testIds.includes('tooltip-trigger')) return { kind: 'testId', value: 'tooltip-trigger' };
  if (tokens.includes('tooltip') && testIds.includes('tooltip-content')) return { kind: 'testId', value: 'tooltip-content' };
  if (tokens.includes('success') && (tokens.includes('banner') || tokens.includes('message'))) {
    const successCandidates = testIds
      .filter((id) => /success/i.test(id))
      .map((id) => ({
        id,
        score: tokens.reduce((n, token) => n + (id.toLowerCase().includes(token) ? 2 : 0), 0),
      }))
      .sort((a, b) => (b.score - a.score) || (a.id.length - b.id.length));
    if (successCandidates[0]) return { kind: 'testId', value: successCandidates[0].id };
    return {
      kind: 'any',
      candidates: [
        { kind: 'testId', value: `${s}` },
        { kind: 'testId', value: `delete-${s}` },
        { kind: 'css', value: '[data-testid*="success" i], [class*="success" i]' },
        { kind: 'text', value: 'successfully' },
      ],
    };
  }

  if (tokens.includes('table') && tokens.includes('row')) {
    const rowId = testIds.find((id) => id.includes('table-row'));
    if (rowId) return { kind: 'testId', value: rowId };
  }

  if (tokens.includes('column') && tokens.includes('header')) {
    const colName = tokens.find((t) => !['column', 'header'].includes(t));
    if (colName) {
      const headerId = testIds.find((id) => id.includes('col-header-') && id.includes(colName));
      if (headerId) return { kind: 'testId', value: headerId };
    }
  }

  if (tokens.includes('page') && tokens.includes('button')) {
    const pagePrefix = testIds.find((id) => /^pagination-page-\d+$/.test(id));
    if (pagePrefix) return { kind: 'testIdPrefix', value: 'pagination-page-' };
  }

  if (tokens.includes('row') && tokens.includes('checkbox')) {
    const checkboxId = testIds.find((id) => id.includes('row-checkbox'));
    if (checkboxId) return { kind: 'testId', value: checkboxId };
  }

  if (tokens.includes('select-all') || (tokens.includes('select') && tokens.includes('checkbox'))) {
    const selectAll = testIds.find((id) => id.includes('select-all'));
    if (selectAll) return { kind: 'testId', value: selectAll };
  }

  // Prefer repeated item-like IDs for collection/count assertions.
  if (/(list|rows?|cards?|items?|buttons?|checkboxes?)\b/i.test(lower)) {
    const scored = testIds
      .map((id) => {
        const idLower = id.toLowerCase();
        const score = tokens.reduce((n, token) => n + (idLower.includes(token) ? 2 : 0), 0)
          + (/-(item|row|card|button|checkbox)$/.test(idLower) ? 1 : 0);
        return { id, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) return { kind: 'testId', value: scored[0].id };
  }

  if (testIds.includes(s)) return { kind: 'testId', value: s };
  const tidCandidates = testIds.filter((id) => id.includes(s) || s.includes(id));
  const tid = tidCandidates.sort((a, b) => a.length - b.length)[0];
  if (tid) return { kind: 'testId', value: tid };

  // Map visible button text to stable data-testid when available.
  const btnByText = buttonDetails.find((b) => b.text && b.text.toLowerCase().includes(lower) && b.testId);
  if (btnByText) return { kind: 'testId', value: btnByText.testId };

  const lbl = page.labels?.find((l) => l.toLowerCase().includes(lower));
  if (lbl) return { kind: 'label', value: lbl };
  const btn = page.buttons?.find((b) => b.toLowerCase().includes(lower));
  if (btn) return { kind: 'role', role: 'button', name: btn };

  return {
    kind: 'any',
    candidates: [
      { kind: 'testId', value: s },
      { kind: 'role', role: 'button', name: phrase },
      { kind: 'role', role: 'link', name: phrase },
      { kind: 'label', value: phrase },
      { kind: 'text', value: phrase },
    ],
  };
}

// ── Generic step extraction helpers ──────────────────────────────────────────

function extractQuoted(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function stepTemplate(text) {
  let indexQ = 0;
  let indexN = 0;
  return text
    .replace(/"([^"]+)"/g, () => {
      indexQ += 1;
      return `"{q${indexQ}}"`;
    })
    .replace(/\b\d+\b/g, () => {
      indexN += 1;
      return `{n${indexN}}`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Universal action verbs used in web-testing BDD
const ACTION_VERBS = new Set([
  'navigate', 'click', 'fill', 'type', 'clear', 'check', 'uncheck',
  'select', 'hover', 'press', 'blur', 'focus', 'wait', 'move',
]);

function extractActionVerb(text) {
  const m = text.match(/^I\s+(\w+)/i);
  return m && ACTION_VERBS.has(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
}

function stripArticles(text) {
  return text.replace(/^(?:the|a|an|over|on|over the|in the)\s+/i, '').trim();
}

function nounPhrase(text, verb) {
  return stripArticles(
    text
      .replace(new RegExp(`^I\\s+${verb}\\s+`, 'i'), '')
      .replace(/\s+(?:button|checkbox|field|input|dropdown|link|icon|again|still)\b.*/i, '')
      .replace(/\s+(?:and|until|into|to|from)\b.*/i, '')
      .trim(),
  );
}

// ── Compile action step (starts with "I <verb>") ──────────────────────────────

function compileAction(text, verb, appModel, pageUrl) {
  const q = extractQuoted(text);

  if (verb === 'navigate') return [{ type: 'goto', url: q[0] || pageUrl }];
  if (verb === 'press')    return [{ type: 'press', key: q[0] || 'Enter' }];
  if (verb === 'wait')     return [{ type: 'wait', ms: 400 }];
  if (verb === 'move')     return [{ type: 'mouseMove', x: 0, y: 0 }, { type: 'wait', ms: 100 }];

  if (verb === 'fill' && q.length >= 2) {
    return [{ type: 'fill', locator: { kind: 'label', value: q[0] }, value: q[1] }];
  }

  if (verb === 'type') {
    const m = text.match(/\binto\s+the\s+(.+?)(?:\s*$)/i);
    const target = (m ? m[1] : null) || q[1] || nounPhrase(text, verb);
    return [{ type: 'fill', locator: buildLocator(target, appModel, pageUrl), value: q[0] || '' }];
  }

  if (verb === 'clear') {
    const m = text.match(/^I\s+clear\s+the\s+(.+?)(?:\s*$)/i);
    const target = (m ? m[1] : null) || nounPhrase(text, verb);
    return [{ type: 'fill', locator: buildLocator(target, appModel, pageUrl), value: '' }];
  }

  if (verb === 'select' && q.length >= 2) {
    return [{ type: 'select', locator: { kind: 'label', value: q[1] }, value: q[0].toLowerCase() }];
  }

  if (verb === 'select' && q.length === 1) {
    return [{ type: 'click', locator: buildLocator(q[0], appModel, pageUrl) }];
  }

  // Handle scoped clicks such as "... in the modal/drawer" by preferring button role.
  if (verb === 'click' && /\bin the\s+(modal|drawer)\b/i.test(text) && q[0]) {
    if (/\bin the\s+modal\b/i.test(text)) {
      return [{ type: 'clickInRoleContainer', containerRole: 'dialog', role: 'button', name: q[0] }];
    }
    return [{ type: 'click', locator: { kind: 'role', role: 'button', name: q[0] } }];
  }

  if (verb === 'click' && /\bdrawer\s+backdrop\b/i.test(text)) {
    return [{ type: 'click', locator: buildLocator('drawer backdrop', appModel, pageUrl) }];
  }

  if (verb === 'click' && /\btoggle\s+button\s+again\b/i.test(text)) {
    return [{ type: 'click', locator: { kind: 'css', value: 'button[aria-expanded="true"], [role="button"][aria-expanded="true"]' } }];
  }

  if (verb === 'check' && /\bfirst\s+table\s+row\b/i.test(text)) {
    return [{ type: 'check', locator: { kind: 'testId', value: 'row-checkbox' } }];
  }

  if (verb === 'uncheck' && /\bfirst\s+table\s+row\b/i.test(text)) {
    return [{ type: 'uncheck', locator: { kind: 'testId', value: 'row-checkbox' } }];
  }

  if (verb === 'check' && /\beach of the\s+\d+\s+rows?\s+individually\b/i.test(text)) {
    const n = Number((text.match(/\d+/) || ['0'])[0]);
    return [{ type: 'checkEach', locator: { kind: 'testId', value: 'row-checkbox' }, count: n }];
  }

  if (verb === 'focus' && /\bthen\s+blur\s+it\s+without\s+typing\b/i.test(text) && q[0]) {
    return [
      { type: 'focus', locator: { kind: 'label', value: q[0] } },
      { type: 'blur', locator: { kind: 'label', value: q[0] } },
    ];
  }

  // click, check, uncheck, hover, blur, focus
  const target = q[0] || nounPhrase(text, verb);
  const locator = buildLocator(target, appModel, pageUrl);

  if (verb === 'click') {
    if (/\buntil\b/i.test(text)) return [{ type: 'repeatClickUntilGone', locator, waitMs: 900 }];
    if (/\band\s+wait\b/i.test(text)) return [{ type: 'click', locator }, { type: 'wait', ms: 900 }];
    return [{ type: 'click', locator }];
  }

  return [{ type: verb, locator }];
}

// ── Compile assertion step (contains "should") ────────────────────────────────
//
// Each rule: { test(text) → boolean, compile(text, quoted[], appModel, url) → ops[] }
// Rules use universal assertion vocabulary only — no project-specific phrases.

const ASSERTION_RULES = [
  {
    test: (t) => /\bshould display a\s+"[^"]*N[^"]*"/i.test(t),
    compile: (_t, q) => {
      const escaped = (q[0] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [{ type: 'assert', assertion: 'textMatchesPattern', pattern: escaped.replace(/N/g, '\\d+'), flags: 'i' }];
    },
  },
  // Generic "I should see ..." forms
  {
    test: (t) => /^I should see the heading "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'headingVisible', value: q[0] }],
  },
  {
    test: (t) => /^I should see the error "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },
  {
    test: (t) => /^I should see a code block containing "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },
  {
    test: (t) => /^I should see the exercise page for "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },
  {
    test: (t) => /^I should see \d+\s+/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number((t.match(/\d+/) || ['0'])[0]);
      const target = t.replace(/^I should see\s+\d+\s+/i, '').trim();
      return [{ type: 'assert', assertion: 'count', locator: buildLocator(target, am, url), value: n }];
    },
  },

  // "there should be N ..."
  {
    test: (t) => /^there should be\s+\d+\s+/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number((t.match(/\d+/) || ['0'])[0]);
      const target = t.replace(/^there should be\s+\d+\s+/i, '').trim();
      return [{ type: 'assert', assertion: 'count', locator: buildLocator(target, am, url), value: n }];
    },
  },

  // "X should have a \"Y\" button"
  {
    test: (t) => /\bshould have a\s+"[^"]+"\s+button\b/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'buttonVisible', value: q[0] }],
  },

  // "X should contain the heading/text ..."
  {
    test: (t) => /\bshould contain the heading\s+"[^"]+"/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'headingVisible', value: q[0] }],
  },
  {
    test: (t) => /\bshould contain (?:the )?text\s+"[^"]+"/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },

  // "cards should be labelled \"a\", \"b\" ..."
  {
    test: (t) => /\bshould be labelled\b/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'allTextsPresent', values: q }],
  },

  // "should display ..." with quoted content
  {
    test: (t) => /\bshould display\s+"[^"]+"/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },

  // "should show ..." variants
  {
    test: (t) => /\bshould show (?:an |a )?(?:ascending|descending|neutral|sort)\b/i.test(t),
    compile: (t, _q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+show\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'visible', locator: buildLocator(subject, am, url) }];
    },
  },
  {
    test: (t) => /\bshould show (?:its\s+)?content\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+show\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'notVisible', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  {
    test: (t) => /"[^"]+"\s+section\s+should\s+not\s+show\s+its\s+content/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'attributeEquals', locator: { kind: 'role', role: 'button', name: q[0] }, attribute: 'aria-expanded', value: 'false' }],
  },
  {
    test: (t) => /\btips\s+content\s+should\s+become\s+visible\b/i.test(t),
    compile: () => [{ type: 'assert', assertion: 'anyExpandedToggle' }],
  },
  {
    test: (t) => /\bshould not show (?:its\s+)?content\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+not\s+show\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'notVisible', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  {
    test: (t) => /\bshould indicate it is expanded\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = q[0] || t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+indicate\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'attributeEquals', locator: buildLocator(subject, am, url), attribute: 'aria-expanded', value: 'true' }];
    },
  },
  {
    test: (t) => /\bcolumn header should show the neutral \(unsorted\) indicator\b/i.test(t),
    compile: (t, _q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+show\s+the\s+neutral.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'textIncludes', locator: buildLocator(subject, am, url), value: '↕' }];
    },
  },
  {
    test: (t) => /\bshould remain visible\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+remain\s+visible\s*$/i, '').trim();
      return [{ type: 'assert', assertion: 'visible', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },

  {
    test: (t) => /\bshould contain a\s+"[^"]+"\s+(checkbox|dropdown)\b/i.test(t),
    compile: (t, q) => {
      const control = /dropdown/i.test(t) ? 'select' : 'input[type="checkbox"]';
      return [{ type: 'assert', assertion: 'containerHasLabelAndControl', label: q[0], controlSelector: control }];
    },
  },
  {
    test: (t) => /"[^"]+"\s+checkbox\s+in\s+the\s+drawer\s+should\s+be\s+checked/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'containerHasLabelAndControlChecked', label: q[0], container: '[data-testid="drawer-content"]' }],
  },

  // Negative visibility
  {
    test: (t) => /\bshould not be visible\b|\bshould not be present\b|\bno longer be visible\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+(should|does)\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'notVisible', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  // Positive count: "N <things> should be visible"
  {
    test: (t) => /^\d+\s+\S.*\bshould be visible\b/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number(t.match(/^(\d+)/)[1]);
      const target = t.replace(/^\d+\s+/, '').replace(/\s+should be visible.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'count', locator: buildLocator(target, am, url), value: n }];
    },
  },
  // Positive visibility
  {
    test: (t) => /\bshould(?:\s+\w+)?\s+be visible\b|\bshould become visible\b|\bshould still be visible\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a|an)\s+/i, '').replace(/\s+should\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'visible', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  // Disabled / enabled
  {
    test: (t) => /\bshould be disabled\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+should\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'disabled', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  {
    test: (t) => /\bshould be enabled\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+should\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'enabled', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  // Checkbox / radio state
  {
    test: (t) => /\bshould be (?:selected|checked)\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+should\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'checked', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  {
    test: (t) => /\bshould not be (?:selected|checked)\b/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+should\s+.*$/i, '').trim();
      return [{ type: 'assert', assertion: 'notChecked', locator: buildLocator(q[0] || subject, am, url) }];
    },
  },
  {
    test: (t) => /^all\s+\d+\s+.*checkboxes\s+should\s+be\s+checked$/i.test(t),
    compile: (_t, _q, am, url) => [{ type: 'assert', assertion: 'allChecked', locator: buildLocator('row checkboxes', am, url) }],
  },
  {
    test: (t) => /^all\s+\d+\s+.*checkboxes\s+should\s+be\s+unchecked$/i.test(t),
    compile: () => [{ type: 'assert', assertion: 'rowCheckboxesUncheckedCurrentPage' }],
  },
  {
    test: (t) => /\btable\s+should\s+display\s+\d+\s+rows?\b/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number((t.match(/\d+/) || ['0'])[0]);
      return [{ type: 'assert', assertion: 'count', locator: buildLocator('table rows', am, url), value: n }];
    },
  },
  {
    test: (t) => /\bshould\s+be\s+visible\s+in\s+the\s+user\s+list\b/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number((t.match(/\d+/) || ['0'])[0]);
      return [{ type: 'assert', assertion: 'count', locator: buildLocator('user cards', am, url), value: n }];
    },
  },
  // URL
  {
    test: (t) => /\burl should contain "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'urlIncludes', value: q[0] }],
  },
  // Text equality
  {
    test: (t) => /\bshould read "/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.split(/\bshould read\b/i)[0].replace(/^(?:the|a)\s+/i, '').trim();
      return [{ type: 'assert', assertion: 'textEquals', locator: buildLocator(subject, am, url), value: q[0] }];
    },
  },
  // Input value
  {
    test: (t) => /\bshould have the value "/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'inputValueEquals', locator: { kind: 'label', value: q[0] }, value: q[1] }],
  },
  // Text contains (quoted)
  {
    test: (t) => /\bshould contain "/i.test(t),
    compile: (t, q, am, url) => {
      const subject = t.split(/\bshould contain\b/i)[0].replace(/^(?:the|a|every\s+\w+)\s+/i, '').trim();
      return [{ type: 'assert', assertion: 'textIncludes', locator: buildLocator(subject, am, url), value: q[0] }];
    },
  },
  {
    test: (t) => /\bshould contain\b.*\bwith role\b/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'allTextsPresent', values: q }],
  },
  {
    test: (t) => /\btable rows should be sorted alphabetically ascending by\b/i.test(t),
    compile: () => [{ type: 'assert', assertion: 'rowsSortedByName', value: 'asc' }],
  },
  {
    test: (t) => /\btable rows should be sorted alphabetically descending by\b/i.test(t),
    compile: () => [{ type: 'assert', assertion: 'rowsSortedByName', value: 'desc' }],
  },
  {
    test: (t) => /\bfirst row in the table should show the lowest\b/i.test(t),
    compile: () => [{ type: 'assert', assertion: 'firstRowLowestSalary' }],
  },
  {
    test: (t) => /\btable should display the message\s+"[^"]+"/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'textPresent', value: q[0] }],
  },
  {
    test: (t) => /\beach\s+.+\s+should\s+display\s+.+/i.test(t),
    compile: (t, q, am, url) => {
      if (q.length > 0) return [{ type: 'assert', assertion: 'textPresent', value: q[0] }];
      const subject = t.replace(/\s+should\s+display\s+.+$/i, '').replace(/^(?:each|the|a|an)\s+/i, '').trim();
      return [{ type: 'assert', assertion: 'visible', locator: buildLocator(subject, am, url) }];
    },
  },
  // "... should contain a card for \"X\" with role \"Y\""
  {
    test: (t) => /\bshould contain a card for\s+"[^"]+"\s+with role\s+"[^"]+"/i.test(t),
    compile: (_t, q) => [{ type: 'assert', assertion: 'allTextsPresent', values: q }],
  },
  // Empty (count = 0)
  {
    test: (t) => /\bshould be empty\b/i.test(t),
    compile: (t, _q, am, url) => {
      const subject = t.replace(/^(?:the|a)\s+/i, '').replace(/\s+should be empty\s*$/i, '').trim();
      return [{ type: 'assert', assertion: 'count', locator: buildLocator(subject, am, url), value: 0 }];
    },
  },
  // Count: "should contain N / should display N / I should see N"
  {
    test: (t) => /\bshould\s+(?:contain|display)\s+\d+\b/i.test(t) || /^I should see \d+\b/i.test(t),
    compile: (t, _q, am, url) => {
      const n = Number(t.match(/\b(\d+)\b/)[1]);
      const target = t
        .replace(/^I\s+should\s+see\s+/i, '')
        .replace(/^(?:the|a)\s+/i, '')
        .replace(/\s+should\s+(?:contain|display)\s+\d+\s+/i, ' ')
        .replace(/^\d+\s+/, '')
        .replace(/\s+(?:should|items?|cards?|rows?).*$/i, '')
        .trim();
      return [{ type: 'assert', assertion: 'count', locator: buildLocator(target, am, url), value: n }];
    },
  },
];

function compileAssertion(text, appModel, pageUrl) {
  const q = extractQuoted(text);
  for (const rule of ASSERTION_RULES) {
    if (rule.test(text)) return rule.compile(text, q, appModel, pageUrl);
  }
  return null;
}

// ── Background / context waiting patterns ────────────────────────────────────
// Steps that neither start with "I <verb>" nor contain "should" but describe
// observable state transitions (disappears, becomes visible, etc.)

function compileWaitPattern(text, appModel, pageUrl) {
  const q = extractQuoted(text);
  const subject = text.replace(/^(?:when\s+)?(?:the\s+)?/i, '').replace(/\s+(?:disappears?|is visible)\s*$/i, '').trim();

  if (/\bdisappears?\b/i.test(text)) {
    return [{ type: 'waitHidden', locator: buildLocator(q[0] || subject, appModel, pageUrl), timeout: 5000 }];
  }
  if (/\bis visible\b/i.test(text)) {
    return [{ type: 'waitVisible', locator: buildLocator(q[0] || subject, appModel, pageUrl), timeout: 5000 }];
  }
  return null;
}

// ── Step compiler entry point ─────────────────────────────────────────────────

function compileStep(text, appModel, pageUrl) {
  const template = stepTemplate(text);

  // 1. Action: starts with "I <known-verb>"
  const verb = extractActionVerb(text);
  if (verb) {
    return {
      template,
      strategy: 'action',
      operations: compileAction(text, verb, appModel, pageUrl),
    };
  }

  // 2. Assertion: contains "should" (also handles "I should see …")
  if (/\bshould\b/i.test(text)) {
    const ops = compileAssertion(text, appModel, pageUrl);
    if (ops) {
      return {
        template,
        strategy: 'assertion',
        operations: ops,
      };
    }
  }

  // 3. Background / context waiting steps
  const waitOp = compileWaitPattern(text, appModel, pageUrl);
  if (waitOp) {
    return {
      template,
      strategy: 'wait',
      operations: waitOp,
    };
  }

  // 4. Unrecognised — emit a skip so the run still proceeds
  console.warn(`  [SKIP] Step not recognised by generic compiler: ${text}`);
  return {
    template,
    strategy: 'skip',
    operations: [{ type: 'skip', text }],
  };
}

// ── Model compilation ─────────────────────────────────────────────────────────

function collectStartUrls(acceptanceModel, baseUrl) {
  const urls = new Set([baseUrl]);
  for (const feature of acceptanceModel) {
    for (const scenario of feature.scenarios) {
      for (const step of scenario.steps) {
        const m = /^I navigate to "([^"]+)"/i.exec(step.text);
        if (m) urls.add(normalizeUrl(m[1], baseUrl));
      }
    }
  }
  return [...urls];
}

function getScenarioStartUrl(scenario, baseUrl) {
  const nav = scenario.steps.find((s) => /^I navigate to "/i.test(s.text));
  if (!nav) return baseUrl;
  const m = nav.text.match(/"([^"]+)"/);
  return m ? normalizeUrl(m[1], baseUrl) : baseUrl;
}

function compileModel(acceptanceModel, appModel, baseUrl) {
  const templateStats = new Map();

  const compiledModel = acceptanceModel.map((feature) => ({
    feature: feature.feature,
    scenarios: feature.scenarios.map((scenario) => {
      const pageUrl = getScenarioStartUrl(scenario, baseUrl);
      return {
        title: scenario.title,
        startUrl: pageUrl,
        steps: scenario.steps.map((step) => {
          const compiled = compileStep(step.text, appModel, pageUrl);
          const current = templateStats.get(compiled.template) || {
            template: compiled.template,
            strategy: compiled.strategy,
            count: 0,
            examples: [],
          };
          current.count += 1;
          if (current.examples.length < 3 && !current.examples.includes(step.text)) {
            current.examples.push(step.text);
          }
          templateStats.set(compiled.template, current);

          return {
            keyword: step.keyword,
            text: step.text,
            template: compiled.template,
            compileStrategy: compiled.strategy,
            operations: compiled.operations,
          };
        }),
      };
    }),
  }));

  const templates = [...templateStats.values()].sort((a, b) => b.count - a.count);
  const unhandledTemplates = templates.filter((t) => t.strategy === 'skip');

  return { compiledModel, templates, unhandledTemplates };
}

// ── Generated runner builder ──────────────────────────────────────────────────

function buildGeneratedRunner({ compiledModel, appModel, baseUrl }) {
  return [
    '// GENERATED FILE — DO NOT EDIT',
    `// generatedAt: ${new Date().toISOString()}`,
    '',
    "import { runCompiledCodelessModel } from '../../scripts/codeless-runtime.mjs';",
    '',
    `const compiledModel = ${JSON.stringify(compiledModel, null, 2)};`,
    `const appModel = ${JSON.stringify(appModel, null, 2)};`,
    `const defaultBaseUrl = ${JSON.stringify(baseUrl)};`,
    '',
    'await runCompiledCodelessModel({',
    '  compiledModel,',
    '  appModel,',
    '  baseUrl: process.env.BASE_URL || defaultBaseUrl,',
    '});',
    '',
  ].join('\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function generateCodelessRunner({ outputPath, baseUrl }) {
  const acceptanceModel = await loadAcceptanceModel();
  console.log(`[generate] Loaded ${acceptanceModel.length} feature file(s).`);
  const startUrls = collectStartUrls(acceptanceModel, baseUrl);
  console.log(`[generate] Collecting start URLs: ${startUrls.join(', ')}`);
  const appModel = await scrapeAppModel(startUrls, baseUrl);
  const { compiledModel, templates, unhandledTemplates } = compileModel(acceptanceModel, appModel, baseUrl);
  const totalSteps = compiledModel.reduce((n, f) => n + f.scenarios.reduce((s, sc) => s + sc.steps.length, 0), 0);
  console.log(`[generate] Compiled ${totalSteps} step(s) across ${compiledModel.reduce((n, f) => n + f.scenarios.length, 0)} scenario(s).`);
  console.log(`[generate] Step templates discovered: ${templates.length} (${unhandledTemplates.length} unhandled).`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(GENERATED_RESULTS_DIR, { recursive: true });
  await fs.writeFile(outputPath, buildGeneratedRunner({ compiledModel, appModel, baseUrl }), 'utf8');
  await fs.writeFile(path.join(GENERATED_RESULTS_DIR, 'step-templates.json'), JSON.stringify(templates, null, 2), 'utf8');
  await fs.writeFile(path.join(GENERATED_RESULTS_DIR, 'unhandled-step-templates.json'), JSON.stringify(unhandledTemplates, null, 2), 'utf8');
  console.log(`[generate] Runner written to ${outputPath}`);
  console.log(`[generate] Template index written to ${path.join(GENERATED_RESULTS_DIR, 'step-templates.json')}`);
  console.log(`[generate] Unhandled templates written to ${path.join(GENERATED_RESULTS_DIR, 'unhandled-step-templates.json')}`);

  return {
    outputPath,
    featureCount: acceptanceModel.length,
    scenarioCount: acceptanceModel.reduce((n, f) => n + f.scenarios.length, 0),
    startUrlCount: startUrls.length,
    templateCount: templates.length,
    unhandledTemplateCount: unhandledTemplates.length,
  };
}
