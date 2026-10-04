# Set UP

Social platform for the film industry: profiles, a feed, casting calls, meetups, connections and messages.

## Run it
Needs only Python 3 (no installs).

    python3 server.py --seed      # first time: adds demo people
    python3 server.py             # afterwards

Open http://127.0.0.1:8000. Demo login: `mara@demo.setup` / `setup1234`.
Set `PORT=9000` or `HOST=0.0.0.0` (to test from your phone on the same Wi-Fi) as environment variables.

## What's inside
- `server.py`  API + static server, SQLite database (`setup.db`), sessions, password hashing (PBKDF2)
- `seed.py`    demo data
- `static/`    the web app (plain HTML/CSS/JS, mobile-first, sidebar layout on desktop)
- `uploads/`   user images

## Next steps
Email verification and password reset, image resizing, real search, hosting (Postgres + a managed host),
then wrap the web app as an iOS/Android app (Capacitor) or rebuild screens in React Native.
