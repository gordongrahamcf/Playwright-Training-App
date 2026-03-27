import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { generateCodelessRunner } from './codeless-generate.mjs';

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const GENERATED_DIR = path.join(ROOT, '.github', '.results', 'generated');
const GENERATED_PATH = path.join(GENERATED_DIR, `codeless-runner.${Date.now()}.generated.mjs`);

function runCommand(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function waitForApp() {
  console.log(`[runner] Waiting for app at ${BASE_URL} …`);
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const code = await runCommand(npxBin, ['wait-on', BASE_URL]);
  if (code !== 0) {
    throw new Error(`wait-on failed while waiting for ${BASE_URL} (exit ${code})`);
  }
  console.log(`[runner] App is ready.`);
}

async function generateRunner() {
  console.log(`[runner] Generating codeless runner → ${path.relative(ROOT, GENERATED_PATH)}`);
  const details = await generateCodelessRunner({
    outputPath: GENERATED_PATH,
    baseUrl: BASE_URL,
  });
  console.log(
    `[runner] Generated from ${details.featureCount} feature files, ${details.scenarioCount} scenarios, ${details.startUrlCount} scraped URL(s).`,
  );
}

async function cleanupGeneratedRunner() {
  if (process.env.KEEP_GENERATED_CODELESS_RUNNER === '1') {
    console.log(`[runner] Keeping generated runner at ${path.relative(ROOT, GENERATED_PATH)}`);
    return;
  }
  await fs.rm(GENERATED_PATH, { force: true });
  console.log(`[runner] Cleaned up generated runner.`);
}

async function main() {
  console.log(`[runner] Starting codeless acceptance run (BASE_URL=${BASE_URL})`);
  await waitForApp();
  await generateRunner();

  console.log(`[runner] Executing generated runner …`);
  const code = await runCommand('node', [GENERATED_PATH], process.env);
  process.exitCode = code;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupGeneratedRunner();
  });
