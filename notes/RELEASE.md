# Set UP — release checklist (12 Nov 2026)

## Tested and working
- Public pages (landing, feed, map, people, castings, projects, communities, meetups, Pro, share, login, signup, legal): render at ~600, ~920 and 1000 px wide, no horizontal overflow, no console errors.
- Database rules, tested with two temporary members inside a rolled-back transaction: profile, post, like, comment, connection request and accept, message (blocked before connecting), casting (blocked without Pro, allowed with Pro), application, project, notifications, account deletion (profile and posts gone).
- Blocked as intended: creating someone else's profile, editing or deleting someone else's post, accepting your own connection request, upgrading yourself to Pro by hand.

## Not tested
- Everything behind the login in a real browser (compose, edit profile, messages, data export, account deletion buttons, QR check-in). Needs one real test account.
- Real phones (only narrow desktop windows), Safari, Firefox.
- Sign-up email delivery.

## Blocking for a public release (owner)
1. Domain: buy it, then `scripts/set-domain.sh <domain>`, DNS records, GitHub Pages custom domain, HTTPS.
2. Supabase Auth: Site URL and redirect URLs set to the new domain.
3. Email: custom SMTP in Supabase (the built-in sender is limited to a few mails per hour, so sign-ups will fail under load).
4. Legal: fill `legal` in `docs/config.js`; have privacy, terms and Impressum reviewed. The privacy text still names "[contact email]" placeholders until this is filled.
5. Supabase: switch on leaked-password protection.

## Decide before release
- Sample people, castings and meetups (tagged "Example") are still shown. Switch off in `docs/api.js` (`SAMPLE.*`) when real content exists.
- Pro is free for everyone (`setup_settings.pro_open = 'true'`). Payments are not built.
- Moderation: reports land in `setup_reports` and are only readable in the Supabase dashboard. There is no admin screen.

## Nice to have
- Own photos and a high-resolution logo; app-store wrappers; uptime monitoring; backups (Supabase plan dependent).
