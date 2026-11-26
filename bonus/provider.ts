import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, opendirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instructions } from './plan.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const maxOutputBytes = 64 * 1024;
const maxCleanupEntries = 1024;
const maxCleanupDepth = 16;
const tempKeys = new Set(['TEMP', 'TMP', 'TMPDIR']);

function checkDirectory(path: string): void {
  // lstat rejects symlinks and Windows junctions. Also reject resolved redirections.
  if (!lstatSync(path).isDirectory() || realpathSync.native(path) !== path) throw new Error();
}

function ensureDirectory(path: string): void {
  try {
    mkdirSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  checkDirectory(path);
}

function removeScratch(cwd: string): void {
  let remaining = maxCleanupEntries;
  function remove(path: string, depth: number): void {
    if (depth > maxCleanupDepth || --remaining < 0) throw new Error();
    if (!lstatSync(path).isDirectory()) {
      // Unlink files and links themselves; never recurse through a link.
      unlinkSync(path);
      return;
    }
    checkDirectory(path);
    const directory = opendirSync(path);
    try {
      for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
        remove(join(path, entry.name), depth + 1);
      }
    } finally {
      directory.closeSync();
    }
    rmdirSync(path);
  }
  // Reject a working directory replaced with a link instead of unlinking it.
  checkDirectory(cwd);
  remove(cwd, 0);
}

export function withProviderScratch<T>(
  repoRoot: string, use: (cwd: string, env: NodeJS.ProcessEnv) => T,
): T {
  let cwd: string;
  try {
    const runtime = join(realpathSync.native(repoRoot), '.runtime');
    const scratch = join(runtime, 'bonus-provider');
    ensureDirectory(runtime);
    ensureDirectory(scratch);
    cwd = mkdtempSync(join(scratch, 'run-'));
  } catch {
    throw new Error('Cannot use .runtime/bonus-provider; both directory components must be writable real directories.');
  }
  let outcome: { value: T } | { error: unknown };
  try {
    checkDirectory(cwd);
    // Windows passes just one value for case-insensitive duplicates in a child's environment.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !tempKeys.has(name.toUpperCase())));
    outcome = { value: use(cwd, { ...env, TEMP: cwd, TMP: cwd, TMPDIR: cwd }) };
  } catch (error) {
    outcome = { error };
  }
  try {
    removeScratch(cwd);
  } catch {
    throw new Error('Could not remove the isolated Droid working directory under .runtime/bonus-provider.');
  }
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

export function readModelResult(raw: string): string {
  const invalid = () => new Error('Droid did not return a successful single-turn JSON result.');
  if (Buffer.byteLength(raw) > maxOutputBytes) throw invalid();
  let packet: unknown;
  try {
    packet = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (typeof packet !== 'object' || packet === null
    || !('type' in packet) || packet.type !== 'result'
    || !('subtype' in packet) || packet.subtype !== 'success'
    || !('is_error' in packet) || packet.is_error !== false
    || !('num_turns' in packet) || packet.num_turns !== 1
    || !('result' in packet) || typeof packet.result !== 'string') {
    throw invalid();
  }
  return packet.result;
}

export function askModel(caseText: string): string {
  // This isolates app scratch, not Factory's session store or its config discovery.
  // The case is one data argument; do not enable a shell or inherit stdin.
  const child = withProviderScratch(root, (cwd, env): SpawnSyncReturns<string> => {
    // This child translates a case; it is not a coding session. Repository workflow
    // hooks can prompt for extra turns. Organization-managed hooks still apply.
    const settings = join(cwd, 'generator-settings.json');
    writeFileSync(settings, JSON.stringify({ hooks: { hooksDisabled: true } }), { flag: 'wx' });
    return spawnSync('droid', [
      'exec', '--settings', settings, '--only-tools', 'TodoWrite', '--disable-builtin-skills', '--output-format', 'json',
      '--model', 'gpt-5.4-mini', '--reasoning-effort', 'low',
      '--append-system-prompt', instructions,
      `Case data (JSON string):\n${JSON.stringify(caseText)}`,
    ], {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 45_000,
      killSignal: 'SIGKILL',
      maxBuffer: maxOutputBytes,
    });
  });
  switch ((child.error as NodeJS.ErrnoException | undefined)?.code) {
    case 'ENOENT':
      throw new Error('Droid CLI was not found on PATH.');
    case 'ETIMEDOUT':
      throw new Error('Droid timed out after 45 seconds.');
    case 'ENOBUFS':
      throw new Error('Droid exceeded the output limit.');
  }
  if (child.error || child.status !== 0) {
    throw new Error('Droid failed. Check CLI installation, authentication, and model access.');
  }
  return readModelResult(child.stdout);
}
