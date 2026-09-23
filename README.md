# arkadia_treningi

Rozszerzenie Chrome: **kalkulator kosztów treningu umiejętności** dla oficjalnego klienta [arkadia.rpg.pl](https://arkadia.rpg.pl).

## Instalacja

1. Pobierz [arkadia_treningi.zip](https://isithunzi000.github.io/www-arkadia_treningi/arkadia_treningi.zip)
2. Rozpakuj ZIP — powstanie folder `arkadia_treningi`
3. Chrome: `chrome://extensions/` → włącz **Tryb deweloperski** → **Wczytaj rozpakowany** → wskaż folder `arkadia_treningi`

## Aktualizacja

Rozszerzenie samo sprawdza dostępność nowej wersji i wyświetla powiadomienie.

1. Pobierz nowy [arkadia_treningi.zip](https://isithunzi000.github.io/www-arkadia_treningi/arkadia_treningi.zip)
2. Rozpakuj do **tego samego folderu** `arkadia_treningi` (nadpisz pliki)
3. Chrome: `chrome://extensions/` → kliknij **↺** na rozszerzeniu arkadia_treningi

## Użycie

| Komenda | Opis |
|---|---|
| `/treningi` | Otwiera/zamyka okno kalkulatora |
| `/treningi pomoc` | Okno pomocy |
| `/treningi help` | Okno pomocy (alias) |

## Dla maintainera

Źródła leżą w `src/arkadia_treningi/` (`treningi.js` + `manifest.json`) — są bajtowo identyczne z zawartością najnowszego zipa w `releases/`.

Nowa wersja: edytuj źródła w `src/arkadia_treningi/`, potem `python3 scripts/make_release_zip.py src X.Y.Z` → **jeden commit** ze zmianą w `src/` i nowym zipem w `releases/` → push. Workflow Pages sam buduje `dist/` i `index.json` — odpala się wyłącznie przy zmianie `releases/*.zip`. Build jest deterministyczny: te same źródła = identyczny SHA-256 zipa.

Testy: `node --test tests/*.test.mjs` (node:test, zero zależności).
