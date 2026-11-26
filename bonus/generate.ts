import { constants, lstatSync, mkdirSync, openSync, closeSync, fstatSync, readSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { askModel } from './provider.ts';
import { maxCaseBytes, parsePlan, renderTest, validateCase } from './plan.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, '.runtime');
const directory = join(runtime, 'bonus-generated');
const unsafeDirectories = 'Cannot use .runtime/bonus-generated; both directory components must be real directories.';
const fileExists = 'Generated file already exists; pick a different name.';

function readCaseFile(path: string): string {
  try {
    if (extname(path).toLowerCase() !== '.txt' || !lstatSync(path).isFile()) throw new Error();
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | constants.O_NONBLOCK);
    try {
      const type = fstatSync(fd);
      if (!type.isFile() || type.size > maxCaseBytes) throw new Error();
      const buffer = Buffer.alloc(maxCaseBytes + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const count = readSync(fd, buffer, bytes, buffer.length - bytes, null);
        if (!count) break;
        bytes += count;
      }
      if (bytes > maxCaseBytes) throw new Error();
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes));
    } finally {
      closeSync(fd);
    }
  } catch {
    throw new Error(`Input must be a readable regular UTF-8 .txt file of at most ${maxCaseBytes} bytes.`);
  }
}

function ensureDirectory(path: string): void {
  try {
    mkdirSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  // lstat avoids following symlinks/junctions used as the output directories.
  if (!lstatSync(path).isDirectory()) throw new Error();
}

function outputPath(name: string): string {
  const relative = `.runtime/bonus-generated/generated-${name}.spec.ts`;
  for (const folder of [runtime, directory]) {
    const entry = lstatSync(folder, { throwIfNoEntry: false });
    if (!entry) return relative;
    if (!entry.isDirectory()) throw new Error(unsafeDirectories);
  }
  if (lstatSync(join(root, relative), { throwIfNoEntry: false })) throw new Error(fileExists);
  return relative;
}

function saveTest(relative: string, source: string): void {
  try {
    ensureDirectory(runtime);
    ensureDirectory(directory);
  } catch (cause) {
    throw new Error(unsafeDirectories, { cause });
  }
  try {
    writeFileSync(join(root, relative), source, { encoding: 'utf8', flag: 'wx' });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(fileExists, { cause });
    }
    throw new Error('Could not create the generated test file.', { cause });
  }
}

const usage = `Usage: node bonus/generate.ts <case.txt> [name]
Input: plain UTF-8 with nonempty Steps: and Expected result: sections (optional Title: first).
Use only synthetic SauceDemo cases; input is sent to the configured Droid model.
Without name, prints TypeScript to stdout. With name (lowercase letters, digits and hyphens;
1-40 characters), creates .runtime/bonus-generated/generated-<name>.spec.ts without overwriting.
Provider scratch is under .runtime/bonus-provider. Droid still uses its configured
Factory home for native session data and may discover repository configuration.
The generated test is not run. Review it before running it with bonus/playwright.config.ts.`;

function main(args: string[]): void {
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage);
    return;
  }
  const [input, name] = args;
  if (!input || args.length > 2 || (name !== undefined && !/^[a-z0-9][a-z0-9-]{0,39}$/u.test(name))) {
    throw new Error(usage);
  }
  const caseText = validateCase(readCaseFile(input));
  const output = name === undefined ? undefined : outputPath(name);
  const source = renderTest(parsePlan(askModel(caseText)));
  if (output === undefined) {
    process.stdout.write(source);
  } else {
    saveTest(output, source);
    console.log(`Created ${output} (not run).`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`Generator: ${error instanceof Error ? error.message : 'Unexpected failure.'}`);
  process.exitCode = 1;
}
