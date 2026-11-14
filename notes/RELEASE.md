# Set UP — release checklist (12 Nov 2026)

## Tested and working
- Public pages (landing, feed, map, people, castings, projects, communities, meetups, Pro, share, login, signup, legal): render at ~600, ~920 and 1000 px wide, no horizontal overflow, no console errors.
- Database rules, tested with two temporary members inside a rolled-back transaction: profile, post, like, comment, connection request and accept, message (blocked before connecting), casting (blocked without Pro, allowed with Pro), application, project, notifications, account deletion (profile and posts gone).
- Blocked as intended: creating someone else's profile, editing or deleting someone else's post, accepting your own connection request, upgrading yourself to Pro by hand.

## Signed-in screens (14 Nov)
- Rendered with a simulated member in a local test copy (real public data, fixture data for private endpoints, writes swallowed): feed, people, map, castings + detail, applications, projects, communities + detail, meetups + detail, rooms, Pro, messages + thread, alerts, edit profile, own and other profile, reports. No script errors, no broken values, no overflow at 1000 px; automatic contrast check clean.
- Found and fixed this way: profile page squeezed into a third of the width, avatar hidden behind the banner, group/meetup detail pages at half width, event header with pale text on white.
- Moderation SQL applied and tested (non-admins refused, admin can read and remove). No admin is assigned yet: no real member account exists.

- Phone width (390 px, simulated in a frame): all 19 signed-in screens fit without sideways scrolling. Found and fixed: the third menu icon (alerts) stuck out of the top bar.
- Button flows in the test copy (requests captured, nothing sent): new post, save profile (redirects to profile), add credit, send message, report resolve/remove, data export (file is created), delete account (cancel sends nothing; confirm sends the request and returns to the start page).
- Accessibility basics on 15 pages: every image has alt text, every button/link/field has a name, one h1 per page, no duplicate ids.

## Not tested
- Real writes against the live database from the browser as a member (the buttons and the database rules are tested separately, not together), and QR check-in. Needs one real test account.
- Real phones (only a simulated 390 px frame in desktop Chrome), Safari, Firefox.
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
- Moderation: the page `#/admin` (Reports) is built. The database part is in `supabase/moderation.sql` and must be applied once; then add an admin with the insert at the end of that file.

## Nice to have
- Own photos and a high-resolution logo; app-store wrappers; uptime monitoring; backups (Supabase plan dependent).
