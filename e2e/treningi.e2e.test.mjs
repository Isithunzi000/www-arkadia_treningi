// Testy e2e pluginu arkadia_treningi na prawdziwym kliencie www
// (e2e/client/) z zaladowanym rozszerzeniem w Chromium.
// Uruchomienie: npm run test:e2e  (Node 20+, npx playwright install chromium)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { uruchomKlienta, zamknijKlienta, routeUpdateCheck } from './harness.mjs';

let env;
let page;

before(async () => {
  env = await uruchomKlienta();
  page = env.page;
});

after(async () => {
  if (env) await zamknijKlienta(env);
});

// Wysyla komende tak, jak robi to klient: przez globalne Input.send,
// ktore plugin monkey-patchuje.
function wyslijKomende(cmd) {
  return page.evaluate((c) => { window.Input.send(c); }, cmd);
}

// Okno pluginu rozrozniane po tytule w naglowku (nie po tekscie calego okna,
// bo np. glowne okno ma przycisk "Pomoc").
function oknoTytul(tytul) {
  return page.locator('.trng-okno', {
    has: page.locator('.trng-okno-tytul', { hasText: tytul })
  }).first();
}

// Izolacja stanu: kazdy test dostaje okno glowne w znanym stanie.
async function otworzGlowne() {
  const okno = oknoTytul('Treningi — kalkulator kosztów');
  if (!(await okno.isVisible().catch(() => false))) await wyslijKomende('/treningi');
  await okno.waitFor({ state: 'visible' });
  return okno;
}

async function zamknijGlowne() {
  const okno = oknoTytul('Treningi — kalkulator kosztów');
  if (await okno.isVisible().catch(() => false)) await wyslijKomende('/treningi');
}

test('rozszerzenie laduje sie na stronie klienta (guard + Input/Output/Text)', async () => {
  const stan = await page.evaluate(() => ({
    guard: window.__arkadia_treningi_loaded__ === true,
    input: typeof window.Input?.send === 'function',
    output: typeof window.Output === 'object' && window.Output !== null,
    text: typeof window.Text === 'object' && window.Text !== null
  }));
  assert.equal(stan.guard, true, 'flaga __arkadia_treningi_loaded__');
  assert.equal(stan.input, true, 'Input.send z klienta');
  assert.equal(stan.output, true, 'Output z klienta');
  assert.equal(stan.text, true, 'Text z klienta');
});

test('komenda /treningi otwiera okno glowne, drugie wywolanie zamyka', async () => {
  await zamknijGlowne();
  await wyslijKomende('/treningi');
  const okno = oknoTytul('Treningi — kalkulator kosztów');
  await okno.waitFor({ state: 'visible' });
  await wyslijKomende('/treningi');
  await okno.waitFor({ state: 'hidden' });
});

test('komendy /treningi pomoc i /treningi help otwieraja i zamykaja okno pomocy', async () => {
  const pomoc = oknoTytul('Treningi — pomoc');
  if (await pomoc.isVisible().catch(() => false)) await wyslijKomende('/treningi pomoc');
  await wyslijKomende('/treningi pomoc');
  await pomoc.waitFor({ state: 'visible' });
  await wyslijKomende('/treningi help');
  await pomoc.waitFor({ state: 'hidden' });
});

test('komenda /treningi nie wycieka do klienta, nieznana komenda przechodzi dalej', async () => {
  await page.evaluate(() => {
    window.__clientSent = [];
    var orig = window.Client.send;
    window.Client.send = function () {
      window.__clientSent.push(Array.prototype.slice.call(arguments));
      return orig.apply(window.Client, arguments);
    };
  });
  await zamknijGlowne();
  await wyslijKomende('/treningi');
  await wyslijKomende('/treningi');
  let wyslane = await page.evaluate(() => window.__clientSent.length);
  assert.equal(wyslane, 0, 'komenda pluginu nie moze trafic do Client.send');
  await wyslijKomende('/cosnienaszego test');
  wyslane = await page.evaluate(() => window.__clientSent.length);
  assert.equal(wyslane, 1, 'nieznana komenda musi przejsc do klienta');
});

test('lista umiejetnosci pokazuje wszystkie pozycje (38 + cios specjalny + inna)', async () => {
  await otworzGlowne();
  const n = await page.locator('.trng-lista button').count();
  assert.equal(n, 40, 'lista umiejetnosci: 38 + cios specjalny + inna umiejetnosc');
  await zamknijGlowne();
});

test('spinner przy polu zloto podnosi wartosc o 1', async () => {
  await otworzGlowne();
  const input = page.locator('input[aria-label="złoto"]');
  await input.waitFor({ state: 'visible' });
  const pole = page.locator('.trng-pole', { has: input });
  await pole.locator('.trng-spin-guziki button').first().click();
  assert.equal(await input.inputValue(), '1');
  await zamknijGlowne();
});

test('po wybraniu umiejetnosci i wpisaniu kosztu wynik przelicza sie w oknie', async () => {
  await otworzGlowne();
  await page.locator('.trng-lista button').first().click();
  const input = page.locator('input[aria-label="złoto"]');
  await input.fill('5');
  await input.blur();
  await page.locator('input[aria-label="od poziomu %"]').fill('1');
  await page.locator('input[aria-label="do poziomu %"]').fill('2');
  await page.locator('input[aria-label="do poziomu %"]').blur();
  const razem = page.locator('.trng-razem').first();
  await razem.waitFor({ state: 'visible' });
  const tekst = await razem.textContent();
  assert.match(tekst, /razem: .*mdz/, 'wynik musi pokazywac razem w mdz');
  assert.ok(!/razem: 0 mdz/.test(tekst), 'wynik nie moze byc zerowy dla 1% -> 2%');
  await zamknijGlowne();
});

test('tabela zawodow ma 30 wierszy po 14 kolumn', async () => {
  const okno = await otworzGlowne();
  await okno.locator('button', { hasText: 'Tabela zawodów' }).click();
  const oknoZawody = oknoTytul('Poziomy maksymalne wg zawodu');
  const tabela = oknoZawody.locator('table.trng-tab');
  await tabela.waitFor({ state: 'visible' });
  const wiersze = await tabela.locator('tbody tr').count();
  assert.equal(wiersze, 30, '30 zawodow');
  const komorki = await tabela.locator('tbody tr').first().locator('th, td').count();
  assert.equal(komorki, 14, 'nazwa umiejetnosci (th) + 13 zawodow (td) = 14 komorek');
  await oknoZawody.locator('.trng-okno-zamknij').click();
  await zamknijGlowne();
});

test('przeciecie naglowka okna zapisuje pozycje w localStorage', async () => {
  const okno = await otworzGlowne();
  const nag = okno.locator('.trng-okno-nag');
  const box = await nag.boundingBox();
  await page.mouse.move(box.x + 120, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 60, { steps: 5 });
  await page.mouse.up();
  const poz = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('arkadia_treningi_www_poz_treningi') || '{}')
  );
  assert.ok(typeof poz.x === 'number' && typeof poz.y === 'number',
    'pozycja okna treningi zapisana w LS (klucz arkadia_treningi_www_poz_treningi)');
  await zamknijGlowne();
});

test('update-check: ta sama wersja nie pokazuje powiadomienia', async () => {
  await page.waitForTimeout(500);
  const overlay = page.locator('#arkadia-treningi-update');
  assert.equal(await overlay.count(), 0, 'brak overlayu aktualizacji przy wersji 1.0.0');
});

test('update-check: nowsza wersja pokazuje powiadomienie (osobny kontekst)', async () => {
  const env2 = await uruchomKlienta();
  try {
    await routeUpdateCheck(env2.context, '9.9.9');
    await env2.page.goto('https://arkadia.rpg.pl/', { waitUntil: 'load' });
    const overlay = env2.page.locator('#arkadia-treningi-update');
    await overlay.waitFor({ state: 'visible', timeout: 5000 });
    const tekst = await overlay.textContent();
    assert.match(tekst, /9\.9\.9/, 'powiadomienie pokazuje nowa wersje');
  } finally {
    await zamknijKlienta(env2);
  }
});
