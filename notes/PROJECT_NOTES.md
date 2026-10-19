# Set UP — project notes (no secrets in this file)

## What it is
Social and jobs network for the film industry: feed and sharing, castings (jobs), communities, meetups, messages,
profiles with credits and "open to work", and a **talent map** where producers find cast and crew by city.

## Where things live
- Website (live): https://eliasmechul.github.io/SetUp/  — served by GitHub Pages from the `docs/` folder (branch `main`).
- Code: https://github.com/eliasmechul/SetUp  (public repo, so never commit keys or passwords).
- Backend: Supabase project `wyuyzqlbmjcxmagrdbru` (organisation "revert"): Postgres, Auth, Storage.
  All Set UP tables are prefixed `setup_` because the project is shared with another app. Do not touch tables without that prefix.
- Netlify site `setup-film-network` exists but is unused (free credits ran out). Safe to delete.

## Structure
- `docs/index.html`, `app.js` (screens), `api.js` (data layer on Supabase), `style.css`, `cities.js` (~285 city centres for the map),
  `leaflet.*` (map library, vendored), `supabase.js` (client, vendored), `config.js` (public Supabase URL and publishable key).
- `legacy-python/` first local prototype, kept for reference. `brand/` logo and photos. `notes/` this file.

## Design decisions
- Look: "Cinematic Night" — near-black, amber accents, Instrument Serif headlines, IBM Plex Mono labels, Caveat handwriting, film grain, viewfinder brackets.
- Concept: LinkedIn-style sharing, jobs (castings), communities. Not LinkedIn colours.
- Example content (people, posts, castings, communities, meetups) is built into `api.js` and only appears while the real tables are empty. It is never saved.

## Security model
Row level security on every `setup_` table. Messages only between connected people. Only owners edit or delete their own rows.
Notifications are created by database triggers. Images only from the `setup-uploads` bucket (5 MB, png/jpg/gif/webp).

## To do / open items
1. Supabase → Authentication → URL Configuration: add `https://eliasmechul.github.io/SetUp/` to Redirect URLs (needs the account that owns the project).
2. Real email sending (custom SMTP) before a public launch; the built-in sender is rate limited.
3. Better logo file (original, high resolution, transparent background).
4. Real photos for the landing page hero and cards (put them in the Supabase bucket `setup-brand`, then reference the public URL).
5. Optional: more cities or free-text place search for the map; phone app wrapper (Capacitor).

## How to run locally
    python3 -m http.server 8000 --directory docs
then open http://127.0.0.1:8000

## Releasing
After changing files in docs/, bump the `?v=` number on the script and style links in docs/index.html so browsers fetch the new files immediately (GitHub Pages caches for 10 minutes).
