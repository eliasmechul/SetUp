# Set UP — project notes (no secrets in this file)

## What it is
Social and jobs network for the film industry: feed and sharing, castings (jobs), communities, meetups, messages,
profiles with credits and "open to work", and a **talent map** where producers find cast and crew by city.

## Where things live
- Website (live): https://eliasmechul.github.io/SetUp/  — served by GitHub Pages from the `docs/` folder (branch `main`).
- Code: https://github.com/eliasmechul/SetUp  (public repo, so never commit keys or passwords).
- Backend: Supabase project `wyuyzqlbmjcxmagrdbru` (organisation "revert"): Postgres, Auth, Storage.
  All Set UP tables are prefixed `setup_` because the project is shared with another app. Do not touch tables without that prefix.
- Netlify site `setup-film-network` (team eliasmechul) is unused (free credits ran out). Delete it in the Netlify dashboard: Project configuration → General → Delete project.

## Structure
- `docs/index.html`, `app.js` (screens), `api.js` (data layer on Supabase), `style.css`, `cities.js` (~285 city centres for the map),
  `leaflet.*` (map library, vendored), `supabase.js` (client, vendored), `config.js` (public Supabase URL and publishable key).
- `brand/` logo and photos. `notes/` this file. `supabase/schema.sql` the complete database setup. (The first Python prototype was removed; it is in the git history before commit 064181e.)

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

## Email bot
`bot/gmail-autoreply.gs` is a free Gmail auto-reply bot (Google Apps Script). Setup steps in `bot/README.md`.
The mailbox itself must be created by the account owner. Status: script written, mailbox not created yet.

## v2 additions (Oct 2026)
- Community feed: post kinds (showcase, question, tip, job, collab, event, news, update) with filter chips; hashtags (#tag pages); reposts; report button (table `setup_reports`, readable only in the dashboard).
- Hourly rate limits by database triggers (posts 30, comments 60, messages 120, communities 5, castings 10, applications 30, connections 60, reports 30).
- Turkish interface: `docs/i18n.js` (dictionary + language button in the footer; auto-picks Turkish for Turkish browsers). Add phrases there.
- Legal pages (#/privacy, #/terms, #/imprint) are DRAFT templates with [brackets] to fill in and have reviewed.
- Share previews (Open Graph), robots.txt, sitemap.xml.
- After a database change run `notify pgrst, 'reload schema'` in the SQL editor.
- Uploaded photos are resized in the browser to max 1600 px (JPEG) before upload; GIFs are sent as they are.

Photos: img/*.jpg come from Unsplash (free license, no attribution required): see unsplash.com/license.

## Status (Oct 2026)
- Live: feed, groups, castings with pipeline, meetups with QR invite + ticket check-in, projects with crew requests, availability, showreel embed, Pro plan (castings + events), share page, PWA.
- Pro: `setup_settings.pro_open = 'true'` lets anyone self-activate Pro (early access, no payments). Set to 'false' to hand out Pro manually (update setup_profiles.plan). Real payments need a payment provider account (not set up).
- Sample people/castings/meetups still show (tagged Example) until real ones exist. Remove `SAMPLE.*` fallbacks in docs/api.js before a public launch.
- Still needed before launch: domain (setupfilm.com), real SMTP, legal pages, original logo, real photos.
Photos in img/ are from Unsplash (free license): see unsplash.com/license.

## Launch checklist (Oct 2026)
1. Domain: buy setupfilm.com, add it in GitHub Pages (Settings > Pages > Custom domain), set DNS, then update Supabase Auth Site URL and redirect URLs.
2. Email: connect a real SMTP service in Supabase (Authentication > SMTP) so sign-up emails are not rate limited.
3. Legal: fill `legal` in docs/config.js (name, street, city, country, email, phone). Impressum and privacy pages use it automatically. Have a lawyer review the texts.
4. Content: remove the sample people/castings/meetups (`SAMPLE.*` in docs/api.js) once real members exist. Replace Unsplash photos with your own set photos when available.
5. Pro: `setup_settings.pro_open = 'true'` lets anyone activate Pro for free (early access). Set to 'false' and update `setup_profiles.plan` by hand, or add a payment provider.
6. Supabase: enable leaked-password protection (Authentication > Policies).
7. Optional: store apps (Capacitor wrapper) need Apple and Google developer accounts.
