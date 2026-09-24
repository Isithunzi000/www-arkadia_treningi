// arkadia_treningi v1.0.2 | 24-09-2026
// Kalkulator kosztow treningu umiejetnosci dla oficjalnego klienta arkadia.rpg.pl

(function () {
  'use strict';

  var EXT_VERSION = '1.0.2';
  var EXT_DATE    = '24-09-2026';
  var UPDATE_URL  = 'https://isithunzi000.github.io/www-arkadia_treningi/index.json';

  // =========================================================================
  // SILNIK (czysta matematyka + dane; port 1:1 z pluginu Dargoth 1.6.7)
  // =========================================================================

  var MIEDZ_NA_SREBRO = 12;
  var MIEDZ_NA_ZLOTO = 240;
  var ZLOTE_NA_MITHRYL = 100;

  /** Gra pobiera minimum 1 mdz nawet tam, gdzie wzor daje 0 (poziomy 0-1). */
  var MIN_CENA_TRENINGU = 1;

  /**
   * Bazowy koszt treningu z poziomu i na i+1, w miedzi, dla procentu ceny 100%.
   * Indeks 0 = 0 (wartownik). Wzor zweryfikowany z gra: 3*i*i - 3*i + 1.
   */
  var KOSZT_BAZOWY = [0];
  for (var _j = 1; _j <= 100; _j++) {
    KOSZT_BAZOWY.push(3 * _j * _j - 3 * _j + 1);
  }

  /**
   * Umiejetnosci i ich procenty ceny (%). Procenty zmierzone z logow gry
   * 2026-08-26, poza: szacowanie (z oryginalnego kalkulatora, niezmierzone).
   */
  var UMIEJETNOSCI = [
    { nazwa: 'akrobatyka', procentCeny: 70 },
    { nazwa: 'alchemia', procentCeny: 70 },
    { nazwa: 'blokowanie wyjscia', procentCeny: 100 },
    { nazwa: 'bronie drzewcowe', procentCeny: 80 },
    { nazwa: 'kieszonkostwo', procentCeny: 70 },
    { nazwa: 'lowiectwo', procentCeny: 50 },
    { nazwa: 'maczugi', procentCeny: 50 },
    { nazwa: 'miecze', procentCeny: 100 },
    { nazwa: 'mierzony cios', procentCeny: 100 },
    { nazwa: 'mloty', procentCeny: 80 },
    { nazwa: 'ocena obiektu', procentCeny: 50 },
    { nazwa: 'ocena przeciwnika', procentCeny: 50 },
    { nazwa: 'opieka nad zwierzetami', procentCeny: 50 },
    { nazwa: 'otwieranie zamkow', procentCeny: 70 },
    { nazwa: 'parowanie', procentCeny: 80 },
    { nazwa: 'plywanie', procentCeny: 50 },
    { nazwa: 'rozkazy', procentCeny: 100 },
    { nazwa: 'skradanie sie', procentCeny: 70 },
    { nazwa: 'spostrzegawczosc', procentCeny: 50 },
    { nazwa: 'szacowanie', procentCeny: 50 },
    { nazwa: 'sztylety', procentCeny: 46 },
    { nazwa: 'tarczownictwo', procentCeny: 80 },
    { nazwa: 'targowanie sie', procentCeny: 50 },
    { nazwa: 'topory', procentCeny: 70 },
    { nazwa: 'tropienie', procentCeny: 50 },
    { nazwa: 'ukrywanie sie', procentCeny: 70 },
    { nazwa: 'uniki', procentCeny: 80 },
    { nazwa: 'walka bez broni', procentCeny: 90 },
    { nazwa: 'walka dwiema bronmi', procentCeny: 100 },
    { nazwa: 'walka pokazowa', procentCeny: 100 },
    { nazwa: 'walka w ciemnosci', procentCeny: 95 },
    { nazwa: 'walka w szyku', procentCeny: 100 },
    { nazwa: 'wspinaczka', procentCeny: 50 },
    { nazwa: 'wyczucie kierunku', procentCeny: 50 },
    { nazwa: 'wykrywanie pulapek', procentCeny: 70 },
    { nazwa: 'zaslanianie', procentCeny: 100 },
    { nazwa: 'zielarstwo', procentCeny: 70 },
    { nazwa: 'znajomosc jezykow', procentCeny: 50 },
  ];

  /**
   * Cios specjalny (umiejetnosc specjalna z zawodu). Cena zawsze 100% tabeli
   * (zmierzone: mierzony cios, walka pokazowa - czyste wartosci tabeli).
   * Poziom maksymalny: 75 bez polecenia stowarzyszenia, 100 z poleceniem —
   * jako jedyna kategoria treningowa moze przekroczyc limity zawodowe.
   */
  var CIOS_SPECJALNY = {
    procentCeny: 100,
    poziomMaksymalnyBezPolecenia: 75,
    poziomMaksymalnyZPoleceniem: 100,
  };

  /** Zamiana na miedz: zl*240 + sr*12 + mdz. */
  function naMiedz(k) {
    return k.zloto * MIEDZ_NA_ZLOTO + k.srebro * MIEDZ_NA_SREBRO + k.miedz;
  }

  /** Rozbicie kwoty w miedzi na mithryl/zloto/srebro/miedz. */
  function zMiedzi(miedzi) {
    var zloteRazem = Math.trunc(miedzi / MIEDZ_NA_ZLOTO);
    var reszta = miedzi % MIEDZ_NA_ZLOTO;
    return {
      miedziRazem: miedzi,
      mithryl: Math.trunc(zloteRazem / ZLOTE_NA_MITHRYL),
      zloto: zloteRazem % ZLOTE_NA_MITHRYL,
      srebro: Math.trunc(reszta / MIEDZ_NA_SREBRO),
      miedz: reszta % MIEDZ_NA_SREBRO,
    };
  }

  /**
   * Cena treningu z poziomu i na i+1 przy procencie ceny k (%).
   * Dokladnie tak liczy gra: max(1, trunc(KOSZT_BAZOWY[i] * k / 100)).
   */
  function cenaTreningu(poziom, procentCeny) {
    return Math.max(
      MIN_CENA_TRENINGU,
      Math.trunc(KOSZT_BAZOWY[poziom] * procentCeny / 100)
    );
  }

  /**
   * Obecny poziom umiejetnosci na podstawie kosztu treningu.
   * Szuka pierwszego poziomu i, dla ktorego cenaTreningu(i, k) >= podany koszt;
   * poziom = i+1 dla 'ostatni', i dla 'nastepny', obciety do 100.
   * Koszt powyzej maksymalnej ceny -> 100.
   */
  function obecnyPoziom(koszt, procentCeny, tryb) {
    var miedzi = naMiedz(koszt);
    for (var i = 0; i < KOSZT_BAZOWY.length; i++) {
      if (cenaTreningu(i, procentCeny) >= miedzi) {
        var p = tryb === 'ostatni' ? i + 1 : i;
        return Math.min(p, 100);
      }
    }
    return 100;
  }

  /**
   * Laczny koszt treningow w przedziale [od, do] WLACZNIE, dla danego
   * procentu ceny. Kazdy trening liczony osobno: max(1, trunc(...)).
   * poziomMaksymalny (opcjonalny): koniec przedzialu powyzej poziomu
   * maksymalnego jest obcinany (wynik.obcietyDo); przedzial w calosci
   * powyzej -> null. Zwraca null tez, gdy 'do' < 'od'.
   */
  function kosztPrzedzialu(od, do_, procentCeny, poziomMaksymalny) {
    if (do_ - od < 0) return null;
    if (poziomMaksymalny !== undefined && od > poziomMaksymalny) return null;
    var doRzeczywiste =
      poziomMaksymalny !== undefined ? Math.min(do_, poziomMaksymalny) : do_;
    var suma = 0;
    for (var i = od; i <= doRzeczywiste; i++) {
      suma += cenaTreningu(i, procentCeny);
    }
    var wynik = zMiedzi(suma);
    if (doRzeczywiste !== do_) wynik.obcietyDo = doRzeczywiste;
    return wynik;
  }

  // =========================================================================
  // LOGIKA UI (sanityzacja, clamp, przedzial, formatowanie)
  // =========================================================================

  /** Maksymalna kwota w polu pieniedzy (realny koszt treningu to ~65 tys. mdz; limit z zapasem, daleko od 32-bitowego przelania oryginalu). */
  var MAKS_KWOTA = 999999;
  /** Poziom umiejetnosci: 0-100 (tabela kosztow ma 101 wpisow). */
  var MAKS_POZIOM = 100;

  /**
   * Zamienia dowolny wpis uzytkownika na liczbe calkowita z zakresu [0, maks].
   * - biale znaki obcinane; pusty wpis -> 0
   * - przecinek/kropka obcina reszte ("12,5" -> 12)
   * - z nie-separatorowych smieci zostaja same cyfry ("1 234 mdz" -> 1234)
   * - zera wiodace normalizowane, wynik clampowany do [0, maks]
   */
  function sanitizujLiczbe(wpis, maks) {
    var czysty = wpis.trim();
    if (!czysty) return 0;
    var sep = czysty.search(/[.,]/);
    var czescCalkowita = sep >= 0 ? czysty.slice(0, sep) : czysty;
    var cyfry = czescCalkowita.replace(/\D+/g, '');
    if (!cyfry) return 0;
    var n = Number(cyfry);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(Math.trunc(n), 0), maks);
  }

  /** Przedzial [od, do] porzadkowany rosnaco - kolejnosc wpisow nie ma znaczenia. */
  function porzadkujPrzedzial(od, do_) {
    return od <= do_ ? [od, do_] : [do_, od];
  }

  /**
   * Zamienia wpis w polu "poziom maksymalny" na limit albo undefined (bez
   * limitu). Pusty wpis, smieci lub wartosc >= 100 = brak limitu (i tak nie da
   * sie wytrenowac powyzej 100). Wartosci 1-99 zwracane jako limit.
   */
  function limitZWpisu(wpis) {
    var czysty = wpis.trim();
    if (!czysty) return undefined;
    var sep = czysty.search(/[.,]/);
    var czesc = sep >= 0 ? czysty.slice(0, sep) : czysty;
    var cyfry = czesc.replace(/\D+/g, '');
    if (!cyfry) return undefined;
    var n = Number(cyfry);
    if (!Number.isFinite(n)) return undefined;
    if (n >= MAKS_POZIOM) return undefined;
    return Math.max(1, Math.trunc(n));
  }

  /** Grupowanie tysiecy wg pl-PL (1234567 -> "1 234 567"). */
  function formatujLiczbe(n) {
    return n.toLocaleString('pl-PL');
  }

  // =========================================================================
  // POZIOMY MAKSYMALNE WG ZAWODU (dane + limitDla)
  // =========================================================================

  var ZAWODY = ["Partyzant", "Fanatyk", "Legionista", "Gladiator", "Korsarz", "Strażnik", "Lancknecht", "Nożownik", "Barbarzyńca", "Myśliwy", "Kupiec", "Odkrywca", "Gildia Podróżników"];

  var TABELA_POZIOMOW = [
    { umiejetnosc: "broń", limity: [70, 74, 71, 75, 73, 74, 71, 72, 71, 65, null, 60, 30] },
    { umiejetnosc: "uniki", limity: [60, 45, 30, 42, 40, 50, 51, 70, 45, 55, null, 34, 25] },
    { umiejetnosc: "walka dwiema brońmi", limity: [50, 65, null, null, null, null, null, 55, null, null, null, null, 19] },
    { umiejetnosc: "tarczownictwo", limity: [null, null, 75, 60, 71, null, null, null, null, null, null, null, 25] },
    { umiejetnosc: "parowanie", limity: [40, 45, 50, 41, null, 71, 71, null, 55, null, null, 45, 25] },
    { umiejetnosc: "zasłanianie", limity: [45, 46, 41, 40, 60, 60, 40, 40, 41, null, null, null, 20] },
    { umiejetnosc: "blokowanie wyjścia", limity: [38, 44, null, null, 41, 55, null, 51, 45, null, null, null, 20] },
    { umiejetnosc: "rozkazy", limity: [30, null, 55, 30, 40, 50, 55, null, null, null, null, null, 15] },
    { umiejetnosc: "walka w szyku", limity: [null, 35, 75, 35, 45, 55, 50, null, 31, null, null, null, 15] },
    { umiejetnosc: "walka bez broni", limity: [null, null, 60, 55, 55, null, null, null, 60, null, null, null, 17] },
    { umiejetnosc: "walka w ciemności", limity: [null, null, 60, 55, 55, null, null, null, null, null, null, null, 15] },
    { umiejetnosc: "ukrywanie", limity: [80, null, null, null, null, null, null, 70, null, 80, null, null, 30] },
    { umiejetnosc: "skradanie", limity: [80, null, null, null, null, null, null, 70, null, 80, null, null, 24] },
    { umiejetnosc: "tropienie", limity: [60, 50, null, null, null, null, null, null, null, 75, null, null, 30] },
    { umiejetnosc: "zielarstwo", limity: [null, null, null, null, null, null, null, null, null, 59, 55, 41, 18] },
    { umiejetnosc: "spostrzegawczość", limity: [70, null, null, null, null, 65, null, 70, null, 75, 60, 71, 50] },
    { umiejetnosc: "wyczucie kierunku", limity: [60, null, null, null, 45, null, null, null, null, 60, null, 84, 30] },
    { umiejetnosc: "pływanie", limity: [55, null, null, null, 85, null, null, null, null, 55, null, 71, 42] },
    { umiejetnosc: "wspinaczka", limity: [60, null, null, null, 60, null, null, null, null, 60, null, 71, 50] },
    { umiejetnosc: "ocena przeciwnika", limity: [null, 50, 65, 85, 60, 65, 65, 85, 55, 54, 50, 50, 21] },
    { umiejetnosc: "ocena obiektu", limity: [null, null, 50, 50, 45, 55, 50, 50, 35, 40, 85, 41, 21] },
    { umiejetnosc: "łowiectwo", limity: [40, null, null, null, null, null, null, null, null, 77, null, 41, 25] },
    { umiejetnosc: "opieka nad zwierzetami", limity: [null, null, null, null, null, null, null, null, null, 74, null, 44, 24] },
    { umiejetnosc: "wykrywanie pulapek", limity: [null, null, null, null, null, null, null, null, null, 55, null, 55, 22] },
    { umiejetnosc: "otwieranie zamkow", limity: [null, null, null, null, null, null, null, 50, null, null, null, null, 15] },
    { umiejetnosc: "znajomosc jezykow", limity: [null, null, null, null, null, null, null, null, null, null, 70, 85, 40] },
    { umiejetnosc: "targowanie sie", limity: [null, null, null, null, null, null, null, null, null, null, 55, 42, 30] },
    { umiejetnosc: "szacowanie", limity: [null, null, null, null, null, null, null, null, null, null, 80, 50, 30] },
    { umiejetnosc: "alchemia", limity: [null, null, null, null, null, null, null, null, null, null, null, null, 20] },
    { umiejetnosc: "akrobatyka", limity: [null, null, null, null, null, null, null, null, null, null, null, null, 13] },
  ];

  /**
   * Poziom maksymalny umiejetnosci dla danej sytuacji postaci.
   * zawod = null -> czyste GP (kolumna GP).
   * zawod oferuje umiejetnosc: z poleceniem = wartosc zawodu,
   *   bez = GP + 75% roznicy (zaokraglone).
   * zawod nie oferuje: limit taki sam jak GP.
   * Nieznana umiejetnosc -> undefined.
   */
  function limitDla(umiejetnosc, zawod, polecenie) {
    var w = null;
    for (var i = 0; i < TABELA_POZIOMOW.length; i++) {
      if (TABELA_POZIOMOW[i].umiejetnosc === umiejetnosc) { w = TABELA_POZIOMOW[i]; break; }
    }
    if (!w) return undefined;
    var gp = w.limity[ZAWODY.length - 1];
    if (gp === null || gp === undefined) return undefined;
    if (zawod === null) return gp;
    var idx = ZAWODY.indexOf(zawod);
    if (idx < 0) return undefined;
    var z = w.limity[idx];
    if (z === null || z === undefined) {
      return gp;
    }
    return polecenie ? z : Math.round(gp + 0.75 * (z - gp));
  }

  /**
   * Limit do wyswietlenia w tabeli zawodow w danym trybie.
   * Z poleceniem: wartosc zawodu (dokladna). Bez: kolumna GP i kreski
   * dokladne, reszta przyblizona (GP + 75% roznicy, zaokraglone).
   * undefined = brak danych.
   */
  function limitWyswietlany(umiejetnosc, zawod, polecenie) {
    var w = null;
    for (var i = 0; i < TABELA_POZIOMOW.length; i++) {
      if (TABELA_POZIOMOW[i].umiejetnosc === umiejetnosc) { w = TABELA_POZIOMOW[i]; break; }
    }
    if (!w) return undefined;
    var idx = ZAWODY.indexOf(zawod);
    if (idx < 0) return undefined;
    var gp = w.limity[ZAWODY.length - 1];
    if (gp === null || gp === undefined) return undefined;
    var z = w.limity[idx];
    var czyGP = idx === ZAWODY.length - 1;
    if (polecenie) {
      var v = (z === null || z === undefined) ? gp : z;
      return { wartosc: v, przyblizona: false };
    }
    if (czyGP || z === null || z === undefined) {
      return { wartosc: gp, przyblizona: false };
    }
    return { wartosc: Math.round(gp + 0.75 * (z - gp)), przyblizona: true };
  }

  // =========================================================================
  // EKSPORT SILNIKA (testy node:test; w przegladarce module nie istnieje)
  // =========================================================================

  if (typeof module !== 'undefined' && module.exports) {
    // nazwane przypisania (wykrywalne przez cjs-module-lexer dla importow ESM)
    module.exports.MIEDZ_NA_SREBRO = MIEDZ_NA_SREBRO;
    module.exports.MIEDZ_NA_ZLOTO = MIEDZ_NA_ZLOTO;
    module.exports.ZLOTE_NA_MITHRYL = ZLOTE_NA_MITHRYL;
    module.exports.MIN_CENA_TRENINGU = MIN_CENA_TRENINGU;
    module.exports.KOSZT_BAZOWY = KOSZT_BAZOWY;
    module.exports.UMIEJETNOSCI = UMIEJETNOSCI;
    module.exports.CIOS_SPECJALNY = CIOS_SPECJALNY;
    module.exports.MAKS_KWOTA = MAKS_KWOTA;
    module.exports.MAKS_POZIOM = MAKS_POZIOM;
    module.exports.ZAWODY = ZAWODY;
    module.exports.TABELA_POZIOMOW = TABELA_POZIOMOW;
    module.exports.naMiedz = naMiedz;
    module.exports.zMiedzi = zMiedzi;
    module.exports.cenaTreningu = cenaTreningu;
    module.exports.obecnyPoziom = obecnyPoziom;
    module.exports.kosztPrzedzialu = kosztPrzedzialu;
    module.exports.sanitizujLiczbe = sanitizujLiczbe;
    module.exports.porzadkujPrzedzial = porzadkujPrzedzial;
    module.exports.limitZWpisu = limitZWpisu;
    module.exports.formatujLiczbe = formatujLiczbe;
    module.exports.limitDla = limitDla;
    module.exports.limitWyswietlany = limitWyswietlany;
  }

  // =========================================================================
  // GUARD SRODOWISKA (klient www eksponuje Input/Output/Text)
  // =========================================================================

  if (typeof window !== 'undefined') {
    if (window.__arkadia_treningi_loaded__) return;
    window.__arkadia_treningi_loaded__ = true;
  }
  if (typeof Input === 'undefined' || typeof Output === 'undefined' ||
      typeof Text === 'undefined') {
    return;
  }

  // =========================================================================
  // STAN (localStorage; klucz osobny dla wariantu www)
  // =========================================================================

  var LS_KEY = 'arkadia_treningi_www_stan_v1';
  var LS_POZ_PREFIX = 'arkadia_treningi_www_poz_';

  var CIOS_IDX = UMIEJETNOSCI.length;
  var INNA_IDX = UMIEJETNOSCI.length + 1;

  var STAN_DOMYSLNY = {
    umiejetnosc: -1,
    tryb: 'ostatni',
    zloto: '',
    srebro: '',
    miedz: '',
    od: '',
    do_: '',
    filtr: '',
    innaProcent: '100',
    innaMaxPoziom: '',
    polecenie: false,
  };

  var stan = {};
  for (var _k in STAN_DOMYSLNY) stan[_k] = STAN_DOMYSLNY[_k];

  function wczytajStan() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      for (var k in STAN_DOMYSLNY) {
        if (s[k] !== undefined) stan[k] = s[k];
      }
      stan.umiejetnosc =
        typeof s.umiejetnosc === 'number' &&
        s.umiejetnosc >= 0 &&
        s.umiejetnosc <= UMIEJETNOSCI.length + 1
          ? s.umiejetnosc
          : -1;
      stan.tryb = s.tryb === 'nastepny' ? 'nastepny' : 'ostatni';
      stan.polecenie = s.polecenie === true;
      stan.innaMaxPoziom =
        typeof s.innaMaxPoziom === 'string' &&
        limitZWpisu(s.innaMaxPoziom) !== undefined
          ? String(limitZWpisu(s.innaMaxPoziom))
          : '';
      stan.innaProcent =
        typeof s.innaProcent === 'string' &&
        sanitizujLiczbe(s.innaProcent, 100) >= 1
          ? String(sanitizujLiczbe(s.innaProcent, 100))
          : '100';
      stan.filtr = '';
    } catch (e) {
      for (var k2 in STAN_DOMYSLNY) stan[k2] = STAN_DOMYSLNY[k2];
    }
  }

  var zapisTimer = null;
  function zapiszStan() {
    if (zapisTimer !== null) window.clearTimeout(zapisTimer);
    zapisTimer = window.setTimeout(function () {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(stan));
      } catch (e) {
        /* brak miejsca / tryb prywatny - ignorujemy */
      }
    }, 300);
  }

  // =========================================================================
  // STYLE
  // =========================================================================

  var CSS = `
.trng { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px; color: #e6e6f0; font-size: 13px; min-width: 300px; }
.trng * { box-sizing: border-box; }
.trng .trng-sekcja { display: flex; flex-direction: column; gap: 8px; }
.trng .trng-tytul { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #9a9ab5; }
.trng input[type="text"] { background: #23233a; border: 1px solid #3d3d5c; border-radius: 8px; color: #e6e6f0; padding: 7px 10px; font-size: 14px; outline: none; font-variant-numeric: tabular-nums; transition: border-color .15s; }
.trng input[type="text"]:focus { border-color: #7aa2f7; }
.trng input::placeholder { color: #8c8ca8; }
.trng-lista { max-height: 168px; overflow-y: auto; border: 1px solid #3d3d5c; border-radius: 8px; background: #1d1d30; }
.trng-lista button { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 7px 10px; background: none; border: none; border-bottom: 1px solid #26263e; color: #d8d8e8; font-size: 13px; cursor: pointer; text-align: left; }
.trng-lista button:last-child { border-bottom: none; }
.trng-lista button:hover { background: #2a2a44; }
.trng-lista button.trng-wybrana { background: #31437a; color: #fff; }
.trng-chip { display: inline-flex; flex-direction: column; align-items: center; padding: 2px 7px; border-radius: 7px; background: #34345a; color: #b9b9d6; font-variant-numeric: tabular-nums; line-height: 1.1; }
.trng-chip b { font-size: 11px; font-weight: 600; }
.trng-chip small { font-size: 8px; opacity: .75; }
.trng-wybrana .trng-chip { background: #4660a8; color: #fff; }
.trng-kwoty { display: flex; gap: 8px; }
.trng-pole { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.trng-pole label { font-size: 11px; color: #9a9ab5; display: flex; align-items: center; gap: 5px; }
.trng-kropka { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.trng-kropka.zl { background: #d4af37; }
.trng-kropka.sr { background: #b8b8c0; }
.trng-kropka.mz { background: #b5724a; }
.trng-pole input { width: 100%; text-align: right; }
.trng-radio { display: flex; gap: 8px; }
.trng-radio button { flex: 1; padding: 7px 6px; border-radius: 8px; border: 1px solid #3d3d5c; background: #23233a; color: #b9b9d6; font-size: 12px; cursor: pointer; transition: all .15s; }
.trng-radio button.trng-aktywne { background: #31437a; border-color: #7aa2f7; color: #fff; }
.trng-poziom { display: flex; align-items: baseline; justify-content: space-between; background: #1d1d30; border: 1px solid #3d3d5c; border-radius: 8px; padding: 10px 12px; }
.trng-poziom .trng-wartosc { font-size: 26px; font-weight: 700; color: #7aa2f7; font-variant-numeric: tabular-nums; }
.trng-poziom .trng-opis { font-size: 11px; color: #9a9ab5; }
.trng-zakres { display: flex; gap: 8px; }
.trng-spin { position: relative; display: flex; align-items: stretch; }
.trng .trng-spin input { padding-right: 26px; }
.trng-spin-guziki { position: absolute; right: 3px; top: 3px; bottom: 3px; display: flex; flex-direction: column; }
.trng-spin-guziki button { width: 18px; flex: 1; border: none; background: #34345a; color: #b9b9d6; font-size: 9px; line-height: 1; cursor: pointer; padding: 0; }
.trng-spin-guziki button:first-child { border-radius: 5px 5px 0 0; margin-bottom: 1px; }
.trng-spin-guziki button:last-child { border-radius: 0 0 5px 5px; }
.trng-spin-guziki button:hover { background: #4660a8; color: #fff; }
.trng-wynik { background: #1d1d30; border: 1px solid #3d3d5c; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.trng-nominaly { display: flex; flex-wrap: wrap; gap: 6px; }
.trng-nominal { font-size: 12px; padding: 3px 9px; border-radius: 999px; font-variant-numeric: tabular-nums; }
.trng-nominal.mth { background: #2c3d66; color: #9fc0ff; }
.trng-nominal.zl { background: #4d4020; color: #ffd766; }
.trng-nominal.sr { background: #3c3c46; color: #d5d5e0; }
.trng-nominal.mz { background: #4a3128; color: #e8a87c; }
.trng-razem { font-size: 11px; color: #9a9ab5; }
.trng-notka { font-size: 11px; color: #8c8ca8; font-style: italic; }
.trng-podpowiedz { font-size: 12px; color: #8c8ca8; text-align: center; padding: 6px 0; }
.trng-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #2c2c44; padding-top: 8px; margin-top: 2px; }
.trng-ghost { background: none; border: 1px solid #3d3d5c; border-radius: 7px; color: #9a9ab5; font-size: 11px; padding: 4px 10px; cursor: pointer; transition: all .15s; display: inline-flex; align-items: center; gap: 5px; }
.trng-ghost:hover { border-color: #7aa2f7; color: #cdd6f4; }
.trng-hdr-btns { display: inline-flex; gap: 5px; }
.trng-ghost.trng-hdr { font-size: 10px; padding: 2px 8px; border-color: transparent; }
.trng-ghost.trng-hdr:hover { border-color: #7aa2f7; }
.trng-wybrana-teraz { font-size: 12px; color: #9fc0ff; background: #23233a; border: 1px solid #3d3d5c; border-radius: 7px; padding: 5px 10px; }
.trng-wybrana-teraz b { color: #cdd6f4; }
.trng-tab-tryb { display: flex; gap: 6px; margin-bottom: 8px; }
.trng-tab-tryb button { flex: 0 0 auto; padding: 5px 12px; border-radius: 7px; border: 1px solid #3d3d5c; background: #23233a; color: #b9b9d6; font-size: 11px; cursor: pointer; transition: all .15s; }
.trng-tab-tryb button.trng-aktywne { background: #31437a; border-color: #7aa2f7; color: #fff; }
.trng-tab td.trng-przygas { color: #8c8ca8; font-style: italic; }
.trng-wersja { font-size: 10px; color: #8c8ca8; font-variant-numeric: tabular-nums; white-space: nowrap; }
.trng-pomoc { background: #1d1d30; border: 1px solid #3d3d5c; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.55; color: #c9c9dc; display: flex; flex-direction: column; gap: 6px; }
.trng-pomoc code { background: #31437a; color: #fff; border-radius: 5px; padding: 1px 7px; font-family: ui-monospace, monospace; font-size: 12px; }
.trng-pomoc b { color: #e6e6f0; }
.trng-tab-wrap { overflow: auto; border: 1px solid #3d3d5c; border-radius: 8px; position: relative; }
.trng-tab-wrap::after { content: ""; display: block; position: sticky; bottom: 0; height: 16px; margin-top: -16px; background: linear-gradient(transparent, rgba(12,12,24,.85)); pointer-events: none; }
.trng-tab-wrap.trng-na-dole::after { display: none; }
.trng-tab { border-collapse: collapse; font-size: 10px; font-variant-numeric: tabular-nums; }
.trng-tab th, .trng-tab td { padding: 2px 6px; border-bottom: 1px solid #26263e; white-space: nowrap; }
.trng-tab thead th { position: sticky; top: 0; background: #23233a; color: #b9b9d6; font-size: 10px; text-align: center; z-index: 2; }
.trng-tab tbody th { position: sticky; left: 0; background: #1d1d30; text-align: left; font-weight: 400; color: #d8d8e8; z-index: 1; }
.trng-tab tbody tr:nth-child(odd) td { background: #20203a; }
.trng-tab tbody tr:nth-child(even) td { background: #1b1b2e; }
.trng-tab td { text-align: center; color: #c9c9dc; }
.trng-tab td.trng-brak { color: #4c4c66; }
.trng-tab td.trng-gp, .trng-tab thead th.trng-gp { background: #31437a; color: #fff; }
.trng-tab-intro { font-size: 12px; color: #c9c9dc; margin-bottom: 8px; }
.trng-tab-legenda { font-size: 11px; color: #9a9ab5; margin-top: 8px; line-height: 1.5; }
.trng-okno { position: fixed; z-index: 90000; background: #16162a; border: 1px solid #3d3d5c; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.55); display: flex; flex-direction: column; max-width: 96vw; max-height: 90vh; font-family: inherit; }
.trng-okno-nag { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #2c2c44; cursor: move; user-select: none; touch-action: none; }
.trng-okno-tytul { flex: 1; font-size: 13px; font-weight: 600; color: #cdd6f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trng-okno-zamknij { background: none; border: none; color: #9a9ab5; font-size: 16px; cursor: pointer; padding: 0 4px; line-height: 1; }
.trng-okno-zamknij:hover { color: #fff; }
.trng-okno-tresc { padding: 10px 12px; overflow: auto; }
`;

  var stylWstrzykniety = false;
  function wstrzyknijStyle() {
    if (stylWstrzykniety) return;
    stylWstrzykniety = true;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // =========================================================================
  // MANAGER OKIEN (klient www nie ma popupow - wlasne plywajace overlay)
  // =========================================================================

  var _zLiczniki = 90000;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /**
   * Plywajace okno overlay: przeciagane za naglowek, pozycja zapamietywana
   * w localStorage, zamykane krzyzykiem. createContent buduje sie leniwie
   * przy pierwszym otwarciu.
   */
  function utworzOkno(id, tytul, createContent, opcje) {
    opcje = opcje || {};
    var oknoEl = null;
    var otwarte = false;

    function wczytajPozycje() {
      try {
        var raw = localStorage.getItem(LS_POZ_PREFIX + id);
        if (!raw) return null;
        var p = JSON.parse(raw);
        if (typeof p.x === 'number' && typeof p.y === 'number') return p;
      } catch (e) { /* ignoruj */ }
      return null;
    }

    function zapiszPozycje(x, y) {
      try {
        localStorage.setItem(LS_POZ_PREFIX + id, JSON.stringify({ x: x, y: y }));
      } catch (e) { /* ignoruj */ }
    }

    function domknijDoWidoku(x, y) {
      var w = oknoEl.offsetWidth, h = oknoEl.offsetHeight;
      var maxX = Math.max(0, window.innerWidth - w);
      var maxY = Math.max(0, window.innerHeight - h);
      return [Math.min(Math.max(x, 0), maxX), Math.min(Math.max(y, 0), maxY)];
    }

    function ustawPozycje(x, y) {
      var p = domknijDoWidoku(x, y);
      oknoEl.style.left = p[0] + 'px';
      oknoEl.style.top = p[1] + 'px';
    }

    function zbuduj() {
      oknoEl = el('div', 'trng-okno');
      oknoEl.style.width = (opcje.width || 400) + 'px';
      oknoEl.style.display = 'none';

      var nag = el('div', 'trng-okno-nag');
      nag.appendChild(el('span', 'trng-okno-tytul', tytul));
      if (opcje.headerActions) nag.appendChild(opcje.headerActions);
      var zamknij = el('button', 'trng-okno-zamknij', '✕');
      zamknij.type = 'button';
      zamknij.title = 'Zamknij';
      zamknij.addEventListener('click', function () { api.close(); });
      nag.appendChild(zamknij);
      oknoEl.appendChild(nag);

      var tresc = el('div', 'trng-okno-tresc');
      tresc.appendChild(createContent());
      oknoEl.appendChild(tresc);

      // przeciaganie za naglowek
      var drag = null;
      nag.addEventListener('pointerdown', function (ev) {
        // przyciski w naglowku (Pomoc, Tabela zawodow, zamknij) musza dostac
        // swoj click — pointer capture na naglowku pochlaniably pointerup
        if (ev.target.closest('button')) return;
        ev.preventDefault();
        oknoEl.style.zIndex = String(++_zLiczniki);
        drag = { dx: ev.clientX - oknoEl.offsetLeft, dy: ev.clientY - oknoEl.offsetTop };
        nag.setPointerCapture(ev.pointerId);
      });
      nag.addEventListener('pointermove', function (ev) {
        if (!drag) return;
        ustawPozycje(ev.clientX - drag.dx, ev.clientY - drag.dy);
      });
      var koniecDrag = function () {
        if (!drag) return;
        drag = null;
        zapiszPozycje(oknoEl.offsetLeft, oknoEl.offsetTop);
      };
      nag.addEventListener('pointerup', koniecDrag);
      nag.addEventListener('pointercancel', koniecDrag);

      oknoEl.addEventListener('pointerdown', function () {
        oknoEl.style.zIndex = String(++_zLiczniki);
      });

      document.body.appendChild(oknoEl);
    }

    var api = {
      isOpen: function () { return otwarte; },
      open: function () {
        if (!oknoEl) zbuduj();
        oknoEl.style.display = 'flex';
        otwarte = true;
        oknoEl.style.zIndex = String(++_zLiczniki);
        var poz = wczytajPozycje();
        if (poz) {
          ustawPozycje(poz.x, poz.y);
        } else {
          // domyslna pozycja: prawy gorny obszar, kaskadowo wg id
          var offset = id === 'treningi' ? 20 : id === 'treningi-pomoc' ? 60 : 100;
          ustawPozycje(Math.max(20, window.innerWidth - oknoEl.offsetWidth - offset), offset);
        }
      },
      close: function () {
        if (!oknoEl) return;
        oknoEl.style.display = 'none';
        otwarte = false;
      },
      toggle: function () {
        if (otwarte) api.close(); else api.open();
      },
    };
    return api;
  }

  // =========================================================================
  // BUDOWA UI KALKULATORA
  // =========================================================================

  var listaEl = null;
  var poziomWartoscEl = null;
  var wynikEl = null;
  var podpowiedzEl = null;
  var innaRowEl = null;
  var ciosRowEl = null;
  var wybranaEl = null;

  function aktualnyProcentCeny() {
    if (stan.umiejetnosc === INNA_IDX) {
      return Math.max(1, sanitizujLiczbe(stan.innaProcent, 100));
    }
    if (stan.umiejetnosc === CIOS_IDX) {
      return CIOS_SPECJALNY.procentCeny;
    }
    var u = UMIEJETNOSCI[stan.umiejetnosc];
    return u ? u.procentCeny : 100;
  }

  /** Poziom maksymalny dla wybranej pozycji; undefined = bez limitu. */
  function aktualnyPoziomMaksymalny() {
    if (stan.umiejetnosc === INNA_IDX) return limitZWpisu(stan.innaMaxPoziom);
    if (stan.umiejetnosc !== CIOS_IDX) return undefined;
    return stan.polecenie
      ? CIOS_SPECJALNY.poziomMaksymalnyZPoleceniem
      : CIOS_SPECJALNY.poziomMaksymalnyBezPolecenia;
  }

  function aktualizuj() {
    if (!poziomWartoscEl || !wynikEl || !podpowiedzEl) return;

    if (innaRowEl) {
      innaRowEl.style.display = stan.umiejetnosc === INNA_IDX ? '' : 'none';
    }
    if (ciosRowEl) {
      ciosRowEl.style.display = stan.umiejetnosc === CIOS_IDX ? '' : 'none';
    }

    if (stan.umiejetnosc < 0) {
      poziomWartoscEl.textContent = '–';
      wynikEl.style.display = 'none';
      podpowiedzEl.style.display = '';
      podpowiedzEl.textContent = 'Wybierz umiejętność z listy powyżej.';
      if (wybranaEl) wybranaEl.style.display = 'none';
      return;
    }
    podpowiedzEl.style.display = 'none';
    var k = aktualnyProcentCeny();
    if (wybranaEl) {
      wybranaEl.style.display = '';
      var nazwaWybranej =
        stan.umiejetnosc === CIOS_IDX
          ? 'cios specjalny'
          : stan.umiejetnosc === INNA_IDX
            ? 'inna umiejętność'
            : UMIEJETNOSCI[stan.umiejetnosc].nazwa;
      wybranaEl.replaceChildren();
      wybranaEl.appendChild(document.createTextNode('Wybrana: '));
      wybranaEl.appendChild(el('b', '', nazwaWybranej));
      wybranaEl.appendChild(
        document.createTextNode(' · ' + k + '% ceny bazowej')
      );
    }

    var koszt = {
      zloto: sanitizujLiczbe(stan.zloto, MAKS_KWOTA),
      srebro: sanitizujLiczbe(stan.srebro, MAKS_KWOTA),
      miedz: sanitizujLiczbe(stan.miedz, MAKS_KWOTA),
    };
    var poziom = obecnyPoziom(koszt, k, stan.tryb);
    poziomWartoscEl.textContent = poziom + '%';

    var od = sanitizujLiczbe(stan.od, MAKS_POZIOM);
    var do_ = sanitizujLiczbe(stan.do_, MAKS_POZIOM);
    var przedzial = porzadkujPrzedzial(od, do_);
    var odP = przedzial[0], doP = przedzial[1];
    var maks = aktualnyPoziomMaksymalny();
    var wynik = kosztPrzedzialu(odP, doP, k, maks);

    wynikEl.style.display = '';
    wynikEl.replaceChildren();
    if (!wynik) {
      if (maks !== undefined && odP > maks) {
        wynikEl.appendChild(
          el(
            'div',
            'trng-notka',
            'Ten zakres jest poza zasięgiem — poziom maksymalny to ' +
              maks +
              '%.'
          )
        );
      }
      return;
    }

    var nominaly = el('div', 'trng-nominaly');
    var czesci = [
      ['mth', wynik.mithryl, 'mithryl'],
      ['zl', wynik.zloto, 'złoto'],
      ['sr', wynik.srebro, 'srebro'],
      ['mdz', wynik.miedz, 'miedź'],
    ];
    for (var ci = 0; ci < czesci.length; ci++) {
      var klasa = czesci[ci][0], ile = czesci[ci][1], nazwa = czesci[ci][2];
      if (ile <= 0) continue;
      var chip = el('span', 'trng-nominal ' + klasa, ile + ' ' + klasa);
      chip.title = nazwa;
      nominaly.appendChild(chip);
    }
    if (!nominaly.hasChildNodes()) {
      nominaly.appendChild(el('span', 'trng-nominal mz', '0 mdz'));
    }
    wynikEl.appendChild(nominaly);

    wynikEl.appendChild(el(
      'div',
      'trng-razem',
      'razem: ' + formatujLiczbe(wynik.miedziRazem) + ' mdz'
    ));

    if (wynik.obcietyDo !== undefined) {
      wynikEl.appendChild(
        el(
          'div',
          'trng-notka',
          'poziom maksymalny to ' +
            wynik.obcietyDo +
            '% — policzono ' +
            odP +
            '% → ' +
            wynik.obcietyDo +
            '%'
        )
      );
    }

    if (od !== odP || do_ !== doP) {
      wynikEl.appendChild(
        el('div', 'trng-notka', 'policzono ' + odP + '% → ' + doP + '%')
      );
    }
  }

  function zmiana(czesc) {
    for (var k in czesc) stan[k] = czesc[k];
    zapiszStan();
    aktualizuj();
  }

  function poleSpin(label, kropkaCls, pobierz, ustaw, maks, tooltip) {
    var pole = el('div', 'trng-pole');
    var lab = el('label', '', label);
    if (kropkaCls) {
      lab.prepend(el('span', 'trng-kropka ' + kropkaCls));
    }
    pole.appendChild(lab);

    var spin = el('div', 'trng-spin');
    var input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = '0';
    input.title = tooltip;
    input.setAttribute('aria-label', label);
    input.value = pobierz();
    input.style.width = '100%';

    var zastosuj = function (v) {
      var n = Math.min(Math.max(v, 0), maks);
      input.value = n === 0 && pobierz() === '' ? '' : String(n);
      ustaw(input.value);
    };

    input.addEventListener('input', function () {
      ustaw(input.value);
    });
    input.addEventListener('blur', function () {
      var n = sanitizujLiczbe(input.value, maks);
      input.value = input.value.trim() === '' ? '' : String(n);
      ustaw(input.value);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        zastosuj(sanitizujLiczbe(input.value, maks) + 1);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        zastosuj(sanitizujLiczbe(input.value, maks) - 1);
      }
    });

    var guziki = el('div', 'trng-spin-guziki');
    var mkGuzik = function (tekst, delta) {
      var b = el('button', '', tekst);
      b.type = 'button';
      b.tabIndex = -1;
      b.title = tooltip;
      var timer = null;
      var opoznienie = null;
      var krok = function () { zastosuj(sanitizujLiczbe(input.value, maks) + delta); };
      var stop = function () {
        if (timer !== null) window.clearInterval(timer);
        if (opoznienie !== null) window.clearTimeout(opoznienie);
        timer = null;
        opoznienie = null;
      };
      b.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        krok();
        opoznienie = window.setTimeout(function () {
          timer = window.setInterval(krok, 120);
        }, 400);
      });
      b.addEventListener('pointerup', stop);
      b.addEventListener('pointerleave', stop);
      b.addEventListener('pointercancel', stop);
      return b;
    };
    guziki.appendChild(mkGuzik('▲', 1));
    guziki.appendChild(mkGuzik('▼', -1));
    spin.appendChild(input);
    spin.appendChild(guziki);
    pole.appendChild(spin);
    return pole;
  }

  function budujListe() {
    if (!listaEl) return;
    listaEl.replaceChildren();
    var filtr = stan.filtr.trim().toLowerCase();
    var pokazane = 0;
    UMIEJETNOSCI.forEach(function (u, idx) {
      if (filtr && !u.nazwa.toLowerCase().includes(filtr)) return;
      var b = el('button', idx === stan.umiejetnosc ? 'trng-wybrana' : '');
      b.type = 'button';
      b.appendChild(el('span', '', u.nazwa));
      var chip = el('span', 'trng-chip');
      chip.appendChild(el('b', '', u.procentCeny + '%'));
      chip.appendChild(el('small', '', 'ceny baz.'));
      chip.title =
        'Trening tej umiejętności kosztuje ' +
        u.procentCeny +
        '% ceny bazowej (standardowej).';
      b.appendChild(chip);
      b.addEventListener('click', function () {
        zmiana({ umiejetnosc: idx });
        budujListe();
        var sel = listaEl.querySelector('.trng-wybrana');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      });
      listaEl.appendChild(b);
      pokazane++;
    });
    if (!pokazane) {
      listaEl.appendChild(
        el('div', 'trng-podpowiedz', 'Brak umiejętności pasujących do filtra.')
      );
    }
    // pozycja "cios specjalny" - umiejetnosc specjalna z zawodu
    var pokazCios = !filtr || 'cios specjalny'.includes(filtr);
    if (pokazCios) {
      var bc = el('button', stan.umiejetnosc === CIOS_IDX ? 'trng-wybrana' : '');
      bc.type = 'button';
      bc.appendChild(el('span', '', 'cios specjalny…'));
      var chipC = el('span', 'trng-chip');
      chipC.appendChild(el('b', '', '100%'));
      chipC.appendChild(el('small', '', 'ceny baz.'));
      chipC.title =
        'Cios specjalny z zawodu: cena zawsze standardowa (100%). Poziom maksymalny zależy od polecenia — wybierzesz poniżej.';
      bc.appendChild(chipC);
      bc.addEventListener('click', function () {
        zmiana({ umiejetnosc: CIOS_IDX });
        budujListe();
        var sel = listaEl.querySelector('.trng-wybrana');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      });
      listaEl.appendChild(bc);
    }

    // pozycja "inna umiejetnosc" - dla umiejetnosci spoza listy (reczny procent)
    var pokazInna = !filtr || 'inna umiejętność'.includes(filtr);
    if (pokazInna) {
      var bi = el('button', stan.umiejetnosc === INNA_IDX ? 'trng-wybrana' : '');
      bi.type = 'button';
      bi.appendChild(el('span', '', 'inna umiejętność…'));
      var chipI = el('span', 'trng-chip');
      chipI.appendChild(el('b', '', Math.max(1, sanitizujLiczbe(stan.innaProcent, 100)) + '%'));
      chipI.appendChild(el('small', '', 'ceny baz.'));
      chipI.title = 'Umiejętność spoza listy — sam wybierasz procent ceny poniżej.';
      bi.appendChild(chipI);
      bi.addEventListener('click', function () {
        zmiana({ umiejetnosc: INNA_IDX });
        budujListe();
        var sel = listaEl.querySelector('.trng-wybrana');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      });
      listaEl.appendChild(bi);
    }
  }

  function budujPomoc() {
    var p = el('div', 'trng-pomoc');
    var t1 = el('div');
    t1.appendChild(document.createTextNode(
      'Kalkulator liczy koszty treningów umiejętności. Wybierz umiejętność, '
    ));
    t1.appendChild(el('b', '', 'podaj cenę treningu'));
    t1.appendChild(document.createTextNode(' — dostaniesz obecny poziom. Wybierz '));
    t1.appendChild(el('b', '', 'przedział poziomów'));
    t1.appendChild(document.createTextNode(' — dostaniesz łączny koszt.'));
    p.appendChild(t1);
    var t2 = el('div');
    t2.appendChild(document.createTextNode('Okienko otwierasz komendą '));
    var kod = document.createElement('code');
    kod.textContent = '/treningi';
    t2.appendChild(kod);
    t2.appendChild(document.createTextNode(', a to okno — komendą '));
    var kod2 = document.createElement('code');
    kod2.textContent = '/treningi pomoc';
    t2.appendChild(kod2);
    t2.appendChild(document.createTextNode('.'));
    p.appendChild(t2);
    p.appendChild(
      el(
        'div',
        '',
        'Wszystko przelicza się na żywo. Pola wpisujesz z klawiatury albo klikasz strzałkami.'
      )
    );
    return p;
  }

  function budujTabeleZawodow() {
    var SKROTY = {
      'Partyzant': 'Part', 'Fanatyk': 'Fan', 'Legionista': 'Leg',
      'Gladiator': 'Glad', 'Korsarz': 'Kors', 'Strażnik': 'Straż',
      'Lancknecht': 'Lanc', 'Nożownik': 'Noż', 'Barbarzyńca': 'Barb',
      'Myśliwy': 'Myśl', 'Kupiec': 'Kup', 'Odkrywca': 'Odkr',
      'Gildia Podróżników': 'GP',
    };
    var bezPolecenia = false;

    var root = el('div', 'trng');
    root.appendChild(
      el(
        'div',
        'trng-tab-intro',
        'Poziom maksymalny umiejętności w danym zawodzie. 1 trening = 1%.'
      )
    );

    // przelacznik trybu: z poleceniem (dokladne wartosci) / bez (przyblizone)
    var trybRow = el('div', 'trng-tab-tryb');
    var tab = document.createElement('table');
    tab.className = 'trng-tab';
    var tbody = document.createElement('tbody');

    var przeliczTabele = function () {
      tbody.replaceChildren();
      for (var wi = 0; wi < TABELA_POZIOMOW.length; wi++) {
        var w = TABELA_POZIOMOW[wi];
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.scope = 'row';
        th.textContent = w.umiejetnosc;
        tr.appendChild(th);
        ZAWODY.forEach(function (z, idx) {
          var td = document.createElement('td');
          var wyn = limitWyswietlany(w.umiejetnosc, z, !bezPolecenia);
          if (!wyn) {
            td.textContent = '—';
            td.className = 'trng-brak';
          } else if (w.limity[idx] === null) {
            // kreska w tabeli zrodlowej: zawod nie oferuje -> limit jak w GP,
            // pokazujemy wartosc GP przygaszona
            td.textContent = String(wyn.wartosc);
            td.className = 'trng-przygas';
            td.title = 'Zawód nie oferuje tej umiejętności — limit taki sam jak w GP.';
          } else {
            td.textContent = String(wyn.wartosc);
          }
          if (idx === ZAWODY.length - 1) td.classList.add('trng-gp');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    };

    var legPrzybl = el(
      'div',
      '',
      'Wartości w tym trybie są przybliżone (GP + 75% różnicy między zawodem a GP).'
    );

    var mkTryb = function (bez, tekst, tooltip) {
      var b = el('button', bez === bezPolecenia ? 'trng-aktywne' : '', tekst);
      b.type = 'button';
      b.title = tooltip;
      b.addEventListener('click', function () {
        bezPolecenia = bez;
        trybRow.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('trng-aktywne', x === b);
        });
        przeliczTabele();
        legPrzybl.style.display = bez ? '' : 'none';
      });
      return b;
    };
    trybRow.appendChild(
      mkTryb(false, 'z poleceniem', 'Dokładne wartości — limit dla członka stowarzyszenia z poleceniem.')
    );
    trybRow.appendChild(
      mkTryb(true, 'bez polecenia', 'Przybliżone: GP + 75% różnicy między zawodem a GP.')
    );
    root.appendChild(trybRow);

    var wrap = el('div', 'trng-tab-wrap');
    var thead = document.createElement('thead');
    var htr = document.createElement('tr');
    var th0 = document.createElement('th');
    th0.textContent = 'Umiejętność';
    th0.style.textAlign = 'left';
    htr.appendChild(th0);
    for (var zi = 0; zi < ZAWODY.length; zi++) {
      var z = ZAWODY[zi];
      var thz = document.createElement('th');
      thz.textContent = SKROTY[z] || z;
      thz.title = z;
      if (z === 'Gildia Podróżników') {
        thz.className = 'trng-gp';
        thz.title = 'Gildia Podróżników — tyle treningów zrobisz bez zawodu';
      }
      htr.appendChild(thz);
    }
    thead.appendChild(htr);
    tab.appendChild(thead);
    przeliczTabele();
    tab.appendChild(tbody);
    wrap.appendChild(tab);
    // cien na dole znika, gdy doscrollowano do konca
    var cienCheck = function () {
      wrap.classList.toggle(
        'trng-na-dole',
        wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2
      );
    };
    wrap.addEventListener('scroll', cienCheck);
    window.requestAnimationFrame(cienCheck);
    root.appendChild(wrap);

    var leg = el('div', 'trng-tab-legenda');
    leg.appendChild(
      el(
        'div',
        '',
        'Przygaszone = limit jak w GP · ciosy specjalne: 75% bez polecenia, 100% z poleceniem.'
      )
    );
    legPrzybl.style.display = bezPolecenia ? '' : 'none';
    leg.appendChild(legPrzybl);
    root.appendChild(leg);
    return root;
  }

  function budujZawartosc() {
    var root = el('div', 'trng');

    // Sekcja 1: umiejetnosc
    var sekcjaUm = el('div', 'trng-sekcja');
    var tytulUm = el('div', 'trng-tytul', 'Umiejętność');
    tytulUm.title =
      'Treningi różnych umiejętności mają różne ceny — procent mówi, jak droga jest ta umiejętność.';
    sekcjaUm.appendChild(tytulUm);
    var filtr = document.createElement('input');
    filtr.type = 'text';
    filtr.placeholder = 'wpisz nazwę, np. miecze';
    filtr.title = 'Filtruje listę umiejętności.';
    filtr.setAttribute('aria-label', 'Szukaj umiejętności');
    filtr.addEventListener('input', function () {
      stan.filtr = filtr.value;
      budujListe();
    });
    sekcjaUm.appendChild(filtr);
    listaEl = el('div', 'trng-lista');
    sekcjaUm.appendChild(listaEl);

    // przelacznik polecenia dla "ciosu specjalnego" (widoczny gdy wybrany)
    ciosRowEl = el('div', 'trng-sekcja');
    ciosRowEl.style.display = 'none';
    var ciosTytul = el('div', 'trng-tytul', 'Polecenie stowarzyszenia');
    ciosTytul.title =
      'Z poleceniem stowarzyszenia cios specjalny trenujesz do 100%, bez polecenia — do 75%.';
    ciosRowEl.appendChild(ciosTytul);
    var ciosGuziki = el('div', 'trng-radio');
    var odswiezCios = function () {
      ciosGuziki.querySelectorAll('button').forEach(function (x) {
        x.classList.toggle(
          'trng-aktywne',
          (x.dataset.polecenie === 'tak') === stan.polecenie
        );
      });
    };
    var mkPolecenie = function (jest, tekst, tooltip) {
      var b = el('button', '', tekst);
      b.type = 'button';
      b.dataset.polecenie = jest ? 'tak' : 'nie';
      b.title = tooltip;
      b.addEventListener('click', function () {
        zmiana({ polecenie: jest });
        odswiezCios();
      });
      return b;
    };
    ciosGuziki.appendChild(
      mkPolecenie(
        false,
        'bez polecenia · maks. 75%',
        'Bez polecenia stowarzyszenia cios specjalny trenujesz maksymalnie do poziomu 75%.'
      )
    );
    ciosGuziki.appendChild(
      mkPolecenie(
        true,
        'z poleceniem · maks. 100%',
        'Z poleceniem stowarzyszenia cios specjalny trenujesz do poziomu 100%.'
      )
    );
    ciosRowEl.appendChild(ciosGuziki);
    sekcjaUm.appendChild(ciosRowEl);

    // wybor procenta dla "innej umiejetnosci" (widoczny tylko gdy wybrana)
    innaRowEl = el('div', 'trng-sekcja');
    innaRowEl.style.display = 'none';
    var innaTytul = el('div', 'trng-tytul', 'Jaki procent standardowej ceny?');
    innaTytul.title =
      "Sprawdzisz to w grze: wpisz 'trenuj' u trenera i porównaj cenę z listą. Standard to 100%.";
    innaRowEl.appendChild(innaTytul);
    var innaGuziki = el('div', 'trng-radio');
    var odswiezInne = function () {
      innaGuziki.querySelectorAll('button').forEach(function (x) {
        x.classList.toggle(
          'trng-aktywne',
          x.dataset.procent === String(sanitizujLiczbe(stan.innaProcent, 100))
        );
      });
    };
    [50, 75, 100].forEach(function (pv) {
      var b = el('button', '', pv + '%');
      b.type = 'button';
      b.dataset.procent = String(pv);
      b.title = 'Trening tej umiejętności kosztuje ' + pv + '% ceny standardowej.';
      b.addEventListener('click', function () {
        zmiana({ innaProcent: String(pv) });
        innaInput.value = '';
        odswiezInne();
        budujListe();
      });
      innaGuziki.appendChild(b);
    });
    var innaInput = document.createElement('input');
    innaInput.type = 'text';
    innaInput.inputMode = 'numeric';
    innaInput.placeholder = 'własny %';
    innaInput.title = 'Własny procent ceny standardowej (1-100).';
    innaInput.setAttribute('aria-label', 'Własny procent ceny');
    innaInput.style.width = '90px';
    innaInput.addEventListener('input', function () {
      zmiana({ innaProcent: innaInput.value });
      odswiezInne();
    });
    innaInput.addEventListener('blur', function () {
      var n = Math.max(1, sanitizujLiczbe(innaInput.value, 100));
      innaInput.value = innaInput.value.trim() === '' ? '' : String(n);
      zmiana({ innaProcent: innaInput.value === '' ? '100' : String(n) });
      odswiezInne();
      budujListe();
    });
    innaGuziki.appendChild(innaInput);
    innaRowEl.appendChild(innaGuziki);

    // opcjonalny poziom maksymalny dla "innej umiejetnosci"
    var innaMaxPole = el('div', 'trng-pole');
    innaMaxPole.appendChild(el('label', '', 'poziom maksymalny'));
    var innaMaxInput = document.createElement('input');
    innaMaxInput.type = 'text';
    innaMaxInput.inputMode = 'numeric';
    innaMaxInput.placeholder = '100';
    innaMaxInput.title =
      'Najwyższy poziom, do którego możesz wytrenować tę umiejętność. Jeśli nie znasz limitu, zostaw puste — kalkulator policzy cały zakres.';
    innaMaxInput.setAttribute('aria-label', 'Poziom maksymalny (opcjonalnie)');
    innaMaxInput.value = stan.innaMaxPoziom;
    innaMaxInput.style.width = '90px';
    innaMaxInput.addEventListener('input', function () {
      zmiana({ innaMaxPoziom: innaMaxInput.value });
    });
    innaMaxInput.addEventListener('blur', function () {
      var lim = limitZWpisu(innaMaxInput.value);
      innaMaxInput.value = lim === undefined ? '' : String(lim);
      zmiana({ innaMaxPoziom: innaMaxInput.value });
    });
    innaMaxPole.appendChild(innaMaxInput);
    innaRowEl.appendChild(innaMaxPole);
    sekcjaUm.appendChild(innaRowEl);
    root.appendChild(sekcjaUm);
    odswiezInne();
    odswiezCios();

    // linijka stanu: co jest wybrane
    wybranaEl = el('div', 'trng-wybrana-teraz');
    wybranaEl.style.display = 'none';
    root.appendChild(wybranaEl);

    // Sekcja 2: koszt treningu -> obecny poziom
    var sekcjaKoszt = el('div', 'trng-sekcja');
    sekcjaKoszt.appendChild(el('div', 'trng-tytul', 'Koszt treningu'));
    var kwoty = el('div', 'trng-kwoty');
    kwoty.appendChild(
      poleSpin(
        'złoto', 'zl',
        function () { return stan.zloto; },
        function (v) { zmiana({ zloto: v }); },
        MAKS_KWOTA,
        'Ile złotych monet zapłaciłeś za trening.'
      )
    );
    kwoty.appendChild(
      poleSpin(
        'srebro', 'sr',
        function () { return stan.srebro; },
        function (v) { zmiana({ srebro: v }); },
        MAKS_KWOTA,
        'Ile srebrnych monet zapłaciłeś za trening.'
      )
    );
    kwoty.appendChild(
      poleSpin(
        'miedź', 'mz',
        function () { return stan.miedz; },
        function (v) { zmiana({ miedz: v }); },
        MAKS_KWOTA,
        'Ile miedzianych monet zapłaciłeś za trening.'
      )
    );
    sekcjaKoszt.appendChild(kwoty);

    var radio = el('div', 'trng-radio');
    var mkTrybKoszt = function (tryb, tekst, tooltip) {
      var b = el('button', stan.tryb === tryb ? 'trng-aktywne' : '', tekst);
      b.type = 'button';
      b.title = tooltip;
      b.addEventListener('click', function () {
        zmiana({ tryb: tryb });
        radio.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('trng-aktywne', x === b);
        });
      });
      return b;
    };
    radio.appendChild(
      mkTrybKoszt('ostatni', 'ostatni trening', 'Podajesz koszt treningu, który już zrobiłeś.')
    );
    radio.appendChild(
      mkTrybKoszt('nastepny', 'następny trening', 'Podajesz koszt treningu, który dopiero zrobisz.')
    );
    sekcjaKoszt.appendChild(radio);

    var poziom = el('div', 'trng-poziom');
    poziom.appendChild(el('span', 'trng-opis', 'Obecny poziom'));
    poziomWartoscEl = el('span', 'trng-wartosc', '–');
    poziom.appendChild(poziomWartoscEl);
    sekcjaKoszt.appendChild(poziom);
    root.appendChild(sekcjaKoszt);

    // Sekcja 3: przedzial
    var sekcjaPrzedzial = el('div', 'trng-sekcja');
    var tytulPrz = el('div', 'trng-tytul', 'Koszt przedziału treningów');
    tytulPrz.title =
      'Ile razem zapłacisz za treningi od jednego poziomu do drugiego (włącznie).';
    sekcjaPrzedzial.appendChild(tytulPrz);
    var zakres = el('div', 'trng-zakres');
    zakres.appendChild(
      poleSpin(
        'od poziomu %', null,
        function () { return stan.od; },
        function (v) { zmiana({ od: v }); },
        MAKS_POZIOM,
        'Poziom, od którego liczymy koszt.'
      )
    );
    zakres.appendChild(
      poleSpin(
        'do poziomu %', null,
        function () { return stan.do_; },
        function (v) { zmiana({ do_: v }); },
        MAKS_POZIOM,
        'Poziom, do którego liczymy koszt (włącznie).'
      )
    );
    sekcjaPrzedzial.appendChild(zakres);
    wynikEl = el('div', 'trng-wynik');
    sekcjaPrzedzial.appendChild(wynikEl);
    root.appendChild(sekcjaPrzedzial);

    podpowiedzEl = el('div', 'trng-podpowiedz');
    root.appendChild(podpowiedzEl);

    var footer = el('div', 'trng-footer');
    footer.style.justifyContent = 'flex-end';
    footer.appendChild(
      el('span', 'trng-wersja', 'v' + EXT_VERSION + ' | ' + EXT_DATE)
    );
    root.appendChild(footer);

    budujListe();
    aktualizuj();
    return root;
  }

  // =========================================================================
  // OKNA + HOOKI
  // =========================================================================

  wczytajStan();
  wstrzyknijStyle();

  var oknoPomoc = utworzOkno('treningi-pomoc', 'Treningi — pomoc', budujPomoc, { width: 440 });
  var oknoZawody = utworzOkno('treningi-zawody', 'Poziomy maksymalne wg zawodu', budujTabeleZawodow, { width: 600 });

  var klawiszeNaglowka = function () {
    var wrap = el('span', 'trng-hdr-btns');
    var bPomoc = el('button', 'trng-ghost trng-hdr', 'Pomoc');
    bPomoc.type = 'button';
    bPomoc.title = 'Krótka instrukcja obsługi.';
    bPomoc.addEventListener('click', function () { oknoPomoc.toggle(); });
    var bZawody = el('button', 'trng-ghost trng-hdr', 'Tabela zawodów');
    bZawody.type = 'button';
    bZawody.title = 'Tabela poziomów maksymalnych umiejętności wg zawodu.';
    bZawody.addEventListener('click', function () { oknoZawody.toggle(); });
    wrap.appendChild(bPomoc);
    wrap.appendChild(bZawody);
    return wrap;
  };

  var oknoGlowne = utworzOkno(
    'treningi',
    'Treningi — kalkulator kosztów',
    budujZawartosc,
    { width: 400, headerActions: klawiszeNaglowka() }
  );

  var _origInput = Input.send;
  Input.send = function (cmd) {
    var t = (cmd || '').trim();
    var m = t.match(/^\/treningi(\s+(help|pomoc))?$/i);
    if (m) {
      if (m[2]) oknoPomoc.toggle(); else oknoGlowne.toggle();
      return;
    }
    _origInput(cmd);
  };

  // =========================================================================
  // UPDATE CHECK
  // =========================================================================

  function versionNewer(remote, local) {
    var r = String(remote).split('.').map(Number);
    var l = String(local).split('.').map(Number);
    for (var i = 0; i < Math.max(r.length, l.length); i++) {
      var rv = r[i] || 0, lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  function showUpdateNotification(version, zipUrl) {
    if (window.__arkadia_update_active__) {
      document.addEventListener('arkadia_update_dismissed', function handler() {
        document.removeEventListener('arkadia_update_dismissed', handler);
        showUpdateNotification(version, zipUrl);
      }, { once: true });
      return;
    }
    if (document.getElementById('arkadia-treningi-update')) return;
    window.__arkadia_update_active__ = true;

    function dismiss() {
      overlay.remove();
      window.__arkadia_update_active__ = false;
      document.dispatchEvent(new CustomEvent('arkadia_update_dismissed'));
    }

    var overlay = document.createElement('div');
    overlay.id = 'arkadia-treningi-update';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1a1a2e;border:2px solid #4a4a6a;border-radius:8px;' +
      'padding:20px 30px;text-align:center;font-family:monospace;max-width:420px;';

    var title = document.createElement('div');
    title.textContent = 'arkadia_treningi';
    title.style.cssText = 'font-size:18px;color:#7aa2f7;margin-bottom:10px;font-weight:bold;';

    var msg = document.createElement('div');
    msg.textContent = 'Dostepna nowa wersja ' + version;
    msg.style.cssText = 'font-size:16px;color:#bbb;margin-bottom:6px;';

    var sub = document.createElement('div');
    sub.textContent = 'Pobierz ZIP, rozpakuj do tego samego folderu, odswiez rozszerzenie.';
    sub.style.cssText = 'font-size:13px;color:#888;margin-bottom:14px;';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    var link = document.createElement('button');
    link.textContent = 'Pobierz';
    link.style.cssText = 'background:#31437a;border:1px solid #7aa2f7;color:#fff;' +
      'padding:10px 20px;border-radius:4px;font-size:15px;cursor:pointer;font-family:monospace;';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      fetch(zipUrl)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'arkadia_treningi.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
          setTimeout(function () { dismiss(); }, 300);
        })
        .catch(function () {
          window.open(zipUrl);
          setTimeout(function () { dismiss(); }, 300);
        });
    });

    var btn = document.createElement('button');
    btn.textContent = 'Pozniej';
    btn.style.cssText = 'background:#333;border:1px solid #555;color:#aaa;' +
      'padding:10px 20px;border-radius:4px;font-size:15px;cursor:pointer;font-family:monospace;';
    btn.onclick = function () { dismiss(); };

    row.appendChild(link);
    row.appendChild(btn);
    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(sub);
    box.appendChild(row);
    overlay.appendChild(box);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismiss();
    });

    document.body.appendChild(overlay);
  }

  setTimeout(function () {
    fetch(UPDATE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.version && versionNewer(data.version, EXT_VERSION)) {
          var zipFile = data.zip || ('arkadia_treningi_' + String(data.version).replace(/\./g, '_') + '.zip');
          showUpdateNotification(data.version, 'https://isithunzi000.github.io/www-arkadia_treningi/' + zipFile);
        }
      })
      .catch(function () { });
  }, 1000);

})();
