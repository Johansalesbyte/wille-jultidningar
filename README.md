# Willes jultidningar

Enkel PWA för att hålla koll på försäljning av jultidningar: kunder, rader, summa, nivå.

- Ren HTML/JS, inget byggsteg. Workflowen pushar filerna till grenen `gh-pages`; GitHub Pages ska ha den grenen som källa (Settings → Pages).
- Prislistan ligger i tabellen `artiklar` i Supabase (nummer, namn, pris). Skriv numret i en rad så fylls namn och pris i.
- Data i Supabase-projektet "Wille jultidningar". All åtkomst via RPC-funktioner som kräver en hemlig nyckel (`#nyckel=...` i länken).
- Nivåtrösklar ändras i tabellen `nivaer` i Supabase, slår igenom direkt.

## Lokalt
```
python3 -m http.server 4610
```
Öppna `http://localhost:4610/#nyckel=<nyckel>`.

Vid ändringar: bumpa `?v=N` på app.js/style.css i index.html och `CACHE` i sw.js.
