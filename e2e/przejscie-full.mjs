// Pelne przejscie e2e pluginu na prawdziwym kliencie www: przeklikuje
// wszystko interaktywne, laduje bledy konsoli, robi screeny do katalogu
// podanego w argv[2]. Skrypt eksploracyjny (nie jest czescia suite'u testow).
import path from 'node:path';
import fs from 'node:fs';
import { uruchomKlienta, zamknijKlienta } from './harness.mjs';

const SHOT_DIR = process.argv[2] || '/tmp/screeny';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const wyniki = [];
const bledyKonsoli = [];
let env, page;
let nr = 0;

function raport(nazwa, ok, info = '') {
  wyniki.push({ nazwa, ok, info });
  console.log((ok ? 'OK  ' : 'FAIL') + ' | ' + nazwa + (info ? ' | ' + info : ''));
}

async function shot(nazwa) {
  nr++;
  const f = path.join(SHOT_DIR, String(nr).padStart(2, '0') + '-' + nazwa + '.png');
  await page.screenshot({ path: f });
  return f;
}

function okno(tytul) {
  return page.locator('.trng-okno', {
    has: page.locator('.trng-okno-tytul', { hasText: tytul })
  }).first();
}

async function otworzone(tytul) {
  return okno(tytul).isVisible().catch(() => false);
}

async function komenda(c) {
  await page.evaluate((x) => window.Input.send(x), c);
}

try {
  env = await uruchomKlienta();
  page = env.page;
  page.on('console', (m) => { if (m.type() === 'error') bledyKonsoli.push(m.text()); });
  page.on('pageerror', (e) => bledyKonsoli.push('PAGEERROR: ' + e.message));
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. strona klienta zaladowana, plugin aktywny
  const guard = await page.evaluate(() => window.__arkadia_treningi_loaded__ === true);
  raport('strona klienta + guard pluginu', guard);
  await shot('01-klient-start');

  // 2. otwarcie okna glownego
  await komenda('/treningi');
  raport('okno glowne otwarte', await okno('Treningi — kalkulator kosztów').isVisible());
  await shot('02-okno-glowne');

  // 3. wybor umiejetnosci z listy (klik)
  const listaBtns = page.locator('.trng-lista button');
  const liczbaUm = await listaBtns.count();
  await listaBtns.nth(7).click(); // miecze
  const wybrana = await page.locator('.trng-wybrana').textContent();
  raport('klik wyboru umiejetnosci z listy (' + liczbaUm + ' pozycji)', /miecze/.test(wybrana), wybrana.trim());

  // 4. filtr listy
  const filtr = page.locator('.trng-lista').locator('..').locator('input').first();
  await filtr.fill('top');
  const poFiltrze = await listaBtns.count();
  const nazwyPoFiltrze = await listaBtns.allTextContents();
  raport('filtr listy "top"', poFiltrze === 1 && /topory/.test(nazwyPoFiltrze[0]), 'widoczne: ' + poFiltrze);
  await filtr.fill('');

  // 5. pola kwot: wpisywanie + spinnery
  const zl = page.locator('input[aria-label="złoto"]');
  const sr = page.locator('input[aria-label="srebro"]');
  const mz = page.locator('input[aria-label="miedź"]');
  await zl.fill('2'); await zl.blur();
  await sr.fill('3'); await sr.blur();
  const poleMz = page.locator('.trng-pole', { has: mz });
  await poleMz.locator('.trng-spin-guziki button').first().click(); // ▲
  await poleMz.locator('.trng-spin-guziki button').first().click();
  raport('pola zl/sr/mz + spinner ▲▲',
    (await zl.inputValue()) === '2' && (await sr.inputValue()) === '3' && (await mz.inputValue()) === '2',
    'zl=' + await zl.inputValue() + ' sr=' + await sr.inputValue() + ' mz=' + await mz.inputValue());

  // spinner ▼ ponizej zera
  await poleMz.locator('.trng-spin-guziki button').nth(1).click();
  await poleMz.locator('.trng-spin-guziki button').nth(1).click();
  await poleMz.locator('.trng-spin-guziki button').nth(1).click();
  raport('spinner ▼ nie schodzi ponizej 0', (await mz.inputValue()) === '0', 'mz=' + await mz.inputValue());

  // 6. tryb ostatni/nastepny trening
  const bNastepny = page.locator('.trng-radio button', { hasText: 'następny trening' });
  await bNastepny.click();
  raport('tryb "nastepny trening" aktywny', await bNastepny.evaluate((b) => b.classList.contains('trng-aktywne')));
  const poziomTekst = await page.locator('.trng-wartosc').textContent();
  raport('obecny poziom przeliczony z kosztu', /%$/.test(poziomTekst.trim()), poziomTekst.trim());

  // 7. przedzial od-do + auto-porzadkowanie (od > do)
  const od = page.locator('input[aria-label="od poziomu %"]');
  const do_ = page.locator('input[aria-label="do poziomu %"]');
  await od.fill('10'); await od.blur();
  await do_.fill('5'); await do_.blur();
  await page.waitForTimeout(200);
  const notka = await page.locator('.trng-notka').allTextContents();
  const razem = await page.locator('.trng-razem').first().textContent();
  raport('przedzial odwrocony auto-porzadkowany', notka.some((t) => /policzono 5%/.test(t)), JSON.stringify(notka));
  raport('wynik przedzialu liczony', /razem: /.test(razem) && !/razem: 0 mdz/.test(razem), razem.trim());
  await shot('03-wynik-przedzial');

  // 8. cios specjalny: przelacznik polecenia stowarzyszenia 75/100
  // (polecenie zmienia MAKS poziom, wiec zakres musi wykraczac ponad 75%)
  await do_.fill('90'); await do_.blur();
  await listaBtns.nth(38).click(); // cios specjalny
  const sekcjaCios = page.locator('.trng-sekcja', {
    has: page.locator('.trng-tytul', { hasText: 'Polecenie stowarzyszenia' })
  });
  const bPolecenie = sekcjaCios.locator('button', { hasText: 'z poleceniem' });
  const bBezPolecenia = sekcjaCios.locator('button', { hasText: 'bez polecenia' });
  await bPolecenie.waitFor({ state: 'visible' });
  await bPolecenie.click();
  const wPolecenie = await page.locator('.trng-razem').first().textContent();
  const notkiPolecenie = await page.locator('.trng-notka').allTextContents();
  await bBezPolecenia.click();
  const wBez = await page.locator('.trng-razem').first().textContent();
  const notkiBez = await page.locator('.trng-notka').allTextContents();
  raport('cios specjalny: polecenie 100% vs bez 75% (zakres do 90%)',
    wPolecenie !== wBez &&
      notkiBez.some((t) => /poziom maksymalny to 75%/.test(t)) &&
      !notkiPolecenie.some((t) => /poziom maksymalny to 75%/.test(t)),
    'z poleceniem: ' + wPolecenie.trim() + ' | bez: ' + wBez.trim());
  raport('cios specjalny: guzik "bez polecenia" aktywny po kliku',
    await bBezPolecenia.evaluate((b) => b.classList.contains('trng-aktywne')));
  await shot('04-cios-specjalny');

  // 9. inna umiejetnosc: guziki 50/75/100 + wlasny procent
  await listaBtns.nth(39).click(); // inna umiejetnosc
  const sekcjaInna = page.locator('.trng-sekcja', {
    has: page.locator('.trng-tytul', { hasText: 'Jaki procent standardowej ceny?' })
  });
  await sekcjaInna.locator('button', { hasText: /^75%$/ }).waitFor({ state: 'visible' });
  await sekcjaInna.locator('button', { hasText: /^75%$/ }).click();
  const wybrana75 = await page.locator('.trng-okno:visible').first().textContent();
  const innaInput = sekcjaInna.locator('input[aria-label="Własny procent ceny"]');
  await innaInput.fill('60');
  await innaInput.blur();
  const wybrana60 = await page.locator('.trng-okno:visible').first().textContent();
  raport('inna umiejetnosc: guzik 75% i wlasny procent 60%',
    /75% ceny bazowej/.test(wybrana75) && /60% ceny bazowej/.test(wybrana60),
    '75%: ' + /75% ceny bazowej/.test(wybrana75) + ', 60%: ' + /60% ceny bazowej/.test(wybrana60));
  await shot('05-inna-umiejetnosc');

  // 10. guzik Pomoc w naglowku (klik myszka - fix pointer capture)
  await okno('Treningi — kalkulator kosztów').locator('button', { hasText: 'Pomoc' }).click();
  const pomocWidoczna = await okno('Treningi — pomoc').isVisible();
  raport('guzik "Pomoc" w naglowku otwiera okno (klik myszka)', pomocWidoczna);
  await shot('06-pomoc');
  await okno('Treningi — pomoc').locator('.trng-okno-zamknij').click();
  raport('guzik ✕ zamyka okno pomocy', !(await okno('Treningi — pomoc').isVisible()));

  // 11. guzik Tabela zawodow w naglowku (klik myszka - fix pointer capture)
  await okno('Treningi — kalkulator kosztów').locator('button', { hasText: 'Tabela zawodów' }).click();
  const zawodyWidoczne = await okno('Poziomy maksymalne wg zawodu').isVisible();
  raport('guzik "Tabela zawodow" w naglowku otwiera okno (klik myszka)', zawodyWidoczne);

  // 12. tabela zawodow: przelacznik trybu
  const oknoZaw = okno('Poziomy maksymalne wg zawodu');
  const wierszy = await oknoZaw.locator('tbody tr').count();
  const bBez = oknoZaw.locator('button', { hasText: 'bez polecenia' });
  const bZ = oknoZaw.locator('button', { hasText: 'z poleceniem' });
  // przygaszenie = "zawod nie oferuje, limit jak w GP" — nie zalezy od trybu;
  // tryb zmienia WARTOSCI (bez polecenia = przyblizone 0.75 drogi do GP)
  await bZ.click();
  const wierszBron = oknoZaw.locator('tbody tr', { hasText: 'broń' }).first();
  const wartosciZ = await wierszBron.locator('td').allTextContents();
  await bBez.click();
  const wartosciBez = await wierszBron.locator('td').allTextContents();
  const rozne = wartosciZ.some((v, i) => v !== wartosciBez[i]);
  raport('tabela zawodow: 30 wierszy, przelacznik trybu zmienia wartosci',
    wierszy === 30 && rozne,
    'bron z poleceniem: ' + wartosciZ.slice(0, 5).join('/') + ' | bez: ' + wartosciBez.slice(0, 5).join('/'));
  await shot('07-tabela-zawodow');
  await oknoZaw.locator('.trng-okno-zamknij').click();

  // 13. drag okna glownego + zapis pozycji
  const nag = okno('Treningi — kalkulator kosztów').locator('.trng-okno-nag');
  const box = await nag.boundingBox();
  await page.mouse.move(box.x + 200, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 300, box.y + 150, { steps: 8 });
  await page.mouse.up();
  const poz = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('arkadia_treningi_www_poz_treningi') || '{}'));
  raport('drag okna + zapis pozycji w LS', typeof poz.x === 'number', JSON.stringify(poz));
  await shot('08-po-drag');

  // 14. stan przezywa reload strony (localStorage)
  const stanPrzed = await page.evaluate(() => localStorage.getItem('arkadia_treningi_www_stan_v1'));
  await page.reload({ waitUntil: 'load' });
  const stanPo = await page.evaluate(() => localStorage.getItem('arkadia_treningi_www_stan_v1'));
  raport('stan przezywa reload (localStorage)', stanPrzed === stanPo && stanPo.includes('"zloto"'),
    (stanPo || '').slice(0, 90));
  await komenda('/treningi');
  const zlPo = await page.locator('input[aria-label="złoto"]').inputValue();
  raport('pole zloto odzyskane po reload', zlPo === '2', 'zl=' + zlPo);
  await shot('09-po-reload');

  // 15. stopka wersji
  const stopka = await page.locator('.trng-wersja').textContent();
  raport('stopka wersji 1.0.1', /1\.0\.1/.test(stopka), stopka.trim());

  // 16. zamkniecie glownego przez ✕
  await okno('Treningi — kalkulator kosztów').locator('.trng-okno-zamknij').click();
  raport('guzik ✕ zamyka okno glowne', !(await okno('Treningi — kalkulator kosztów').isVisible()));

  // "Manifest: Syntax error" pochodzi z samego arkadia.rpg.pl (serwer zwraca
  // manifest.json z naglowkami HTTP w body + przecinek na koncu JSON) —
  // blad wystepuje na zywej stronie, nie jest wina pluginu ani harnessu.
  const bledyNasze = bledyKonsoli.filter((b) => !/Manifest: /.test(b));
  raport('zero bledow konsoli/pageerror (poza znanym bledem manifestu arkadia.rpg.pl)',
    bledyNasze.length === 0, bledyNasze.slice(0, 3).join(' ;; '));
} catch (e) {
  raport('WYJATEK w przejsciu', false, e.message);
  try { await shot('99-wyjatek'); } catch {}
} finally {
  if (env) await zamknijKlienta(env);
}

const fail = wyniki.filter((w) => !w.ok);
console.log('---');
console.log('PODSUMOWANIE: ' + (wyniki.length - fail.length) + '/' + wyniki.length + ' OK');
if (fail.length) { console.log('FAIL:'); fail.forEach((f) => console.log(' - ' + f.nazwa + ' | ' + f.info)); }
process.exit(fail.length ? 1 : 0);
