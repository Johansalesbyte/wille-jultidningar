# Willes jultidningar

Enkel PWA för att hålla koll på försäljning av jultidningar: kunder, rader, summa, nivå.

- Ren HTML/JS, inget byggsteg. Publiceras på GitHub Pages.
- Data i Supabase-projektet "Wille jultidningar". All åtkomst via RPC-funktioner som kräver en hemlig nyckel (`#nyckel=...` i länken).
- Nivåtrösklar ändras i tabellen `nivaer` i Supabase, slår igenom direkt.

## Lokalt
```
python3 -m http.server 4610
```
Öppna `http://localhost:4610/#nyckel=<nyckel>`.
