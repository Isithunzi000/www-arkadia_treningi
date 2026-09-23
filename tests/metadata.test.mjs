// Straznik metadanych arkadia_treningi (node:test, zero deps).
// Czyta PRAWDZIWY najnowszy zip z releases/: naglowek komentarza musi byc
// spojny z EXT_VERSION/EXT_DATE w tym samym pliku, a manifest.version i
// nazwa zipa z EXT_VERSION. Regresja: naglowek nie byl stemplowany i
// zostawal ze stara wersja/data po release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RELEASES = path.join(REPO, 'releases');
const PKG = 'arkadia_treningi';

function parseVersion(filename) {
  const m = filename.match(/_(\d+)_(\d+)_(\d+)\.zip$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function latestZip() {
  const zips = fs.readdirSync(RELEASES).filter((f) => parseVersion(f));
  assert.ok(zips.length, 'brak zipow z parsowalna wersja w releases/');
  zips.sort((a, b) => {
    const pa = parseVersion(a), pb = parseVersion(b);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
    return 0;
  });
  return zips[0];
}
function unzipText(zip, entry) {
  return execSync(`unzip -p "${path.join(RELEASES, zip)}" "${entry}"`, { encoding: 'utf8' });
}

test('metadata: naglowek i wersje spojne w najnowszym zipie', () => {
  const zip = latestZip();
  const zipVer = parseVersion(zip).join('.');

  const src = unzipText(zip, `${PKG}/treningi.js`);
  const man = JSON.parse(unzipText(zip, `${PKG}/manifest.json`));

  const mVer = src.match(/var EXT_VERSION\s*=\s*'([^']+)'/);
  const mDate = src.match(/var EXT_DATE\s*=\s*'([^']+)'/);
  assert.ok(mVer && mDate, 'brak EXT_VERSION/EXT_DATE w treningi.js');
  const [extVer, extDate] = [mVer[1], mDate[1]];

  // spojnosc wersji: nazwa zipa == EXT_VERSION == manifest.version
  assert.equal(extVer, zipVer, 'EXT_VERSION != nazwa zipa');
  assert.equal(man.version, zipVer, 'manifest.version != nazwa zipa');

  // naglowek: dokladnie 1 linia // PKG vX.Y.Z | DD-MM-YYYY i spojna ze stale
  const headers = src.split('\n').filter((l) => l.startsWith(`// ${PKG} v`));
  assert.equal(headers.length, 1, `linii naglowka: ${headers.length}`);
  assert.equal(headers[0], `// ${PKG} v${extVer} | ${extDate}`,
    'naglowek rozjezdza sie z EXT_VERSION/EXT_DATE');
});
