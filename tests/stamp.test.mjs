// Test rozszerzonego stempla: stamp_build_date.py ma aktualizowac nie tylko
// EXT_DATE, ale tez linie naglowka "// arkadia_treningi vX.Y.Z | DD-MM-YYYY"
// (wersje bierze z EXT_VERSION w tym samym pliku). Fixture w /tmp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG = 'arkadia_treningi';

const TODAY = new Date().toLocaleDateString('pl-PL', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).replace(/\./g, '-');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trng-stamp-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(
    path.join(REPO, 'scripts', 'stamp_build_date.py'),
    path.join(root, 'scripts', 'stamp_build_date.py')
  );
  fs.mkdirSync(path.join(root, PKG), { recursive: true });
  return root;
}

function runStamp(root) {
  const r = spawnSync('python3', [path.join(root, 'scripts', 'stamp_build_date.py'), root],
    { encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const CAL_JS = [
  `// ${PKG} v9.9.9 | 01-01-2020`,
  '// stary opis',
  '',
  "var EXT_VERSION = '1.2.3';",
  "var EXT_DATE    = '01-01-2020';",
  '',
].join('\n');

test('stamp: naglowek dostaje wersje z EXT_VERSION i dzisiejsza date', () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, PKG, 'treningi.js'), CAL_JS);
  const r = runStamp(root);
  assert.equal(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(root, PKG, 'treningi.js'), 'utf8');
  const headers = out.split('\n').filter((l) => l.startsWith(`// ${PKG} v`));
  assert.equal(headers.length, 1, `linii naglowka: ${headers.length}`);
  assert.equal(headers[0], `// ${PKG} v1.2.3 | ${TODAY}`);
  assert.ok(out.includes(`var EXT_DATE    = '${TODAY}'`), 'EXT_DATE nie ostemplowane');
});

test('stamp: re-run tego samego dnia = no-op (idempotentnosc)', () => {
  const root = makeFixture();
  const good = CAL_JS
    .replace(`// ${PKG} v9.9.9 | 01-01-2020`, `// ${PKG} v1.2.3 | ${TODAY}`)
    .replace("var EXT_DATE    = '01-01-2020';", `var EXT_DATE    = '${TODAY}';`);
  fs.writeFileSync(path.join(root, PKG, 'treningi.js'), good);
  const r = runStamp(root);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(root, PKG, 'treningi.js'), 'utf8'), good,
    'no-op run zmienil plik');
});
