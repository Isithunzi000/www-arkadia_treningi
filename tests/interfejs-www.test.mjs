// Strazniki zrodel arkadia_treningi (www) - node:test, zero deps.
// Odpowiednik interfejs.test.ts z repo dargoth, ale dla wariantu www:
// klient www nie ma popupow ani menu wtyczek, wiec plugin ma wlasny
// manager okien overlay i pomoc jest osiagalna komenda /treningi pomoc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(process.cwd(), 'src/arkadia_treningi/treningi.js'), 'utf-8'
);
const MANIFEST = JSON.parse(readFileSync(
  join(process.cwd(), 'src/arkadia_treningi/manifest.json'), 'utf-8'
));

test('wersja: naglowek, EXT_VERSION i manifest spojne', () => {
  const mVer = SRC.match(/var EXT_VERSION\s*=\s*'([^']+)'/);
  const mDate = SRC.match(/var EXT_DATE\s*=\s*'([^']+)'/);
  assert.ok(mVer && mDate, 'brak EXT_VERSION/EXT_DATE');
  assert.equal(MANIFEST.version, mVer[1], 'manifest.version != EXT_VERSION');
  const headers = SRC.split('\n').filter((l) => l.startsWith('// arkadia_treningi v'));
  assert.equal(headers.length, 1, `linii naglowka: ${headers.length}`);
  assert.equal(headers[0], `// arkadia_treningi v${mVer[1]} | ${mDate[1]}`,
    'naglowek rozjezdza sie z EXT_VERSION/EXT_DATE');
});

test('komenda /treningi z aliasem pomoc/help (www nie ma menu)', () => {
  assert.ok(SRC.includes('/^\\/treningi(\\s+(help|pomoc))?$/i'), 'brak regexa komendy z aliasem pomoc/help');
  assert.match(SRC, /Input\.send\s*=\s*function/, 'brak haka na Input.send');
  assert.match(SRC, /_origInput\(cmd\)/, 'nieprzechwycone komendy musza isc do klienta');
});

test('pomoc www: bez odniesien do menu wtyczek, jest /treningi pomoc', () => {
  assert.ok(!SRC.includes('menu wtyczek'), 'tekst pomocy mowi o menu wtyczek (nie istnieje w www)');
  assert.ok(SRC.includes('/treningi pomoc'), 'pomoc nie wspomina komendy /treningi pomoc');
});

test('wlasny manager okien overlay (brak API popupow Dargotha)', () => {
  assert.ok(!SRC.includes('registerPersistentPopup'), 'resztka API Dargotha');
  assert.ok(!SRC.includes('addPopupMenuEntry'), 'resztka menu Dargotha');
  assert.ok(!SRC.includes('api.aliases'), 'resztka aliasow Dargotha');
  assert.match(SRC, /position:\s*fixed/, 'okno musi byc overlay fixed');
  assert.match(SRC, /pointerdown/, 'przeciaganie okien za naglowek');
});

test('stan trzyma sie w osobnym kluczu localStorage wariantu www', () => {
  assert.ok(SRC.includes("arkadia_treningi_www_stan_v1"), 'brak klucza LS wariantu www');
  assert.ok(!SRC.includes("'arkadia_treningi_stan_v1'"), 'kolizja klucza z wariantem Dargoth');
});

test('update-check: URL Pages i singleton powiadomienia', () => {
  assert.ok(SRC.includes("https://isithunzi000.github.io/www-arkadia_treningi/index.json"));
  assert.ok(SRC.includes('__arkadia_update_active__'), 'brak singletona powiadomienia (wspoldzielony z innymi www-*)');
});

test('swiadome ograniczenia przeniesione: bez mithryla w polu kosztu, bez magicznych zwojow', () => {
  assert.ok(!SRC.includes('magiczne zwoje'), 'magiczne zwoje bez zmierzonego k - nie dodawac');
  // definicja + 5 wywolan (zl/sr/mz + od/do), bez pola mithryla
  assert.equal((SRC.match(/poleSpin\(/g) || []).length, 6, 'poleSpin: definicja + 5 pol (bez mithryla)');
});

test('stopka wersji w oknie glownym', () => {
  assert.ok(SRC.includes("'v' + EXT_VERSION + ' | ' + EXT_DATE"), 'brak stopki v X.Y.Z | data');
});
