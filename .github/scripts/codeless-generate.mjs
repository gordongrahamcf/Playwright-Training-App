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

  for (const raw of startUrls) {
    const url = normalizeUrl(raw, baseUrl);
    try {
      console.log(`[generate] Scraping ${url} …`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      pages[url] = await page.evaluate(() => {
        const uniq = (arr) => [...new Set(arr.filter(Boolean))];
        const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          testIds: uniq([...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'))),
          buttons: uniq([...document.querySelectorAll('button,[role="button"]')].map(txt)),
          labels: uniq([...document.querySelectorAll('label')].map(txt)),
          headings: uniq([...document.querySelectorAll('h1,h2,h3,h4')].map(txt)),
        };
      });
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

  if (page.testIds?.includes(s)) return { kind: 'testId', value: s };
  const tid = page.testIds?.find((id) => id.includes(s) || s.includes(id));
  if (tid) return { kind: 'testId', value: tid };
  const lbl = page.labels?.find((l) => l.toLowerCase().includes(lower));
  if (lbl) return { kind: 'label', value: lbl };
  const btn = page.buttons?.find((b) => b.toLowerCase().includes(lower));
  if (btn) return { kind: 'role', role: 'button', name: btn };

  return {
    kind: 'any',
    candidates: [
      { kind: 'testId', value: s },
      { kind: 'role', role: 'button', name: phrase },
      { kind: 'label', value: phrase },
      { kind: 'text', value: phrase },
    ],
  };
}

// ── Generic step extraction helpers ──────────────────────────────────────────

function extractQuoted(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
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
  // 1. Action: starts with "I <known-verb>"
  const verb = extractActionVerb(text);
  if (verb) return compileAction(text, verb, appModel, pageUrl);

  // 2. Assertion: contains "should" (also handles "I should see …")
  if (/\bshould\b/i.test(text)) {
    const ops = compileAssertion(text, appModel, pageUrl);
    if (ops) return ops;
  }

  // 3. Background / context waiting steps
  const waitOp = compileWaitPattern(text, appModel, pageUrl);
  if (waitOp) return waitOp;

  // 4. Unrecognised — emit a skip so the run still proceeds
  console.warn(`  [SKIP] Step not recognised by generic compiler: ${text}`);
  return [{ type: 'skip', text }];
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
  return acceptanceModel.map((feature) => ({
    feature: feature.feature,
    scenarios: feature.scenarios.map((scenario) => {
      const pageUrl = getScenarioStartUrl(scenario, baseUrl);
      return {
        title: scenario.title,
        startUrl: pageUrl,
        steps: scenario.steps.map((step) => ({
          keyword: step.keyword,
          text: step.text,
          operations: compileStep(step.text, appModel, pageUrl),
        })),
      };
    }),
  }));
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
  const compiledModel = compileModel(acceptanceModel, appModel, baseUrl);
  const totalSteps = compiledModel.reduce((n, f) => n + f.scenarios.reduce((s, sc) => s + sc.steps.length, 0), 0);
  console.log(`[generate] Compiled ${totalSteps} step(s) across ${compiledModel.reduce((n, f) => n + f.scenarios.length, 0)} scenario(s).`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buildGeneratedRunner({ compiledModel, appModel, baseUrl }), 'utf8');
  console.log(`[generate] Runner written to ${outputPath}`);

  return {
    outputPath,
    featureCount: acceptanceModel.length,
    scenarioCount: acceptanceModel.reduce((n, f) => n + f.scenarios.length, 0),
    startUrlCount: startUrls.length,
  };
}
