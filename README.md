# Set UP

Social platform for the film industry: profiles, feed, casting calls, meetups, connections and messages.

- **Frontend:** plain HTML/CSS/JS in `docs/` (no build step), hosted on Netlify (`netlify.toml`).
- **Backend:** Supabase (Postgres + Auth + Storage). All Set UP tables are prefixed `setup_` and protected by row level security.
  Notifications are created by database triggers. Photos live in the `setup-uploads` bucket.
- `legacy-python/` is the first local prototype (Python + SQLite), kept for reference.

## Run locally
    python3 -m http.server 8000 --directory docs
then open http://127.0.0.1:8000. The public Supabase URL and publishable key are in `docs/config.js`.

## Supabase Auth settings to check (dashboard → Authentication → URL Configuration)
Add your site URL (e.g. https://setup-film-network.netlify.app) to **Redirect URLs** so confirmation and
password-reset emails link back to the site.
