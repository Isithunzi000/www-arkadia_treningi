// Testy skryptow release'owych arkadia_treningi (node:test, zero deps).
// Fixture: tymczasowe drzewo <tmp>/{scripts,releases} — build.js i
// make_release_zip.py dzialaja wzgledem __dirname/pliku, wiec kopiujemy
// je do fixture i odpalamy tam. Zero skutkow ubocznych w repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG = 'arkadia_treningi';

// Prawdziwy zip zgodny z guardem wersji w build.js: nazwa zipa ==
// EXT_VERSION (treningi.js) == manifest.version. Zipy bez parsowalnej wersji
// w nazwie zostaja fake (build.js pomija je przed jakimkolwiek odczytem).
function makeGoodZip(root, name) {
  const ver = name.match(/_(\d+)_(\d+)_(\d+)\.zip$/);
  if (!ver) {
    fs.writeFileSync(path.join(root, 'releases', name), 'fake-zip');
    return;
  }
  const v = ver.slice(1).join('.');
  const calJs = `// ${PKG} v${v} | 01-01-2020\nvar EXT_VERSION = '${v}';\nvar EXT_DATE    = '01-01-2020';\n`;
  const man = JSON.stringify({ version: v });
  const r = spawnSync('python3', [
    '-c',
    'import sys, zipfile; zf = zipfile.ZipFile(sys.argv[1], "w"); ' +
      'zf.writestr(sys.argv[2] + "/treningi.js", sys.argv[3]); ' +
      'zf.writestr(sys.argv[2] + "/manifest.json", sys.argv[4]); zf.close()',
    path.join(root, 'releases', name), PKG, calJs, man,
  ]);
  assert.equal(r.status, 0, 'nie udalo sie zlozyc fixture-zipa');
}

function makeFixture(zipNames) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trng-build-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'build.js'), path.join(root, 'scripts', 'build.js'));
  fs.copyFileSync(
    path.join(REPO, 'scripts', 'make_release_zip.py'),
    path.join(root, 'scripts', 'make_release_zip.py')
  );
  for (const z of zipNames) makeGoodZip(root, z);
  return root;
}

function runBuild(root) {
  const r = spawnSync('node', [path.join(root, 'scripts', 'build.js')], { encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runMakeZip(root, version) {
  const src = path.join(root, 'src');
  fs.mkdirSync(path.join(src, PKG), { recursive: true });
  fs.writeFileSync(path.join(src, PKG, 'treningi.js'), '// cal');
  fs.writeFileSync(path.join(src, PKG, 'manifest.json'), '{}');
  const r = spawnSync(
    'python3',
    [path.join(root, 'scripts', 'make_release_zip.py'), src, version],
    { encoding: 'utf8' }
  );
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('D7: pusty releases/ konczy sie bledem (deploy pustego dist/ niedopuszczalny)', () => {
  const root = makeFixture([]);
  const r = runBuild(root);
  assert.notEqual(r.status, 0, 'pusty releases/ musi dac exit != 0, jest: ' + r.status);
});

test('D5: zip bez wersji w nazwie jest glosno POMINIETY, nie po cichu [0,0,0]', () => {
  const root = makeFixture([PKG + '.zip', PKG + '_1_0_9.zip']);
  const r = runBuild(root);
  const log = r.stdout + r.stderr;
  assert.ok(log.includes('POMINIETY'), 'oczekiwano logu POMINIETY, jest: ' + log);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'index.json'), 'utf8'));
  assert.equal(index.version, '1.0.9');
});

test('R2: make_release_zip odrzuca wersje nie-X.Y.Z (1.2.3.4, 1..2)', () => {
  for (const bad of ['1.2.3.4', '1..2']) {
    const root = makeFixture([]);
    const r = runMakeZip(root, bad);
    assert.notEqual(r.status, 0, 'wersja ' + bad + ' musi byc odrzucona, exit: ' + r.status);
  }
});

test('R2 kontrolnie: wersja 1.2.3 przechodzi i tworzy poprawnie nazwany zip', () => {
  const root = makeFixture([]);
  const r = runMakeZip(root, '1.2.3');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(root, 'releases', PKG + '_1_2_3.zip')));
});

test('happy path: najnowszy zip + kopia pod stala nazwa + index.json z wlasciwa wersja', () => {
  const root = makeFixture([PKG + '_1_0_0.zip', PKG + '_1_0_9.zip']);
  const r = runBuild(root);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(root, 'dist', PKG + '_1_0_9.zip')));
  assert.ok(fs.existsSync(path.join(root, 'dist', PKG + '.zip')));
  const index = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'index.json'), 'utf8'));
  assert.equal(index.version, '1.0.9');
  assert.equal(index.zip, PKG + '_1_0_9.zip');
});
