// arkadia_treningi v1.0.0 | 24-09-2026
// Kalkulator kosztow treningu umiejetnosci dla oficjalnego klienta arkadia.rpg.pl

(function () {
  'use strict';

  var EXT_VERSION = '1.0.0';
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

  // TODO fala C: UI okna kalkulatora; fala D: pomoc, tabela zawodow, update-check.

})();
