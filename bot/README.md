# Set UP email auto-reply bot

A free bot that lives inside a Gmail account (Google Apps Script). It answers common questions once per sender per day,
skips automated mail, and leaves every message unread so a person still sees it. No API key, no paid service.

## Setup (about 5 minutes, done by the account owner)
1. Create the Set UP mailbox yourself, for example `setupfilmnetwork@gmail.com`, and sign in to it.
2. Open https://script.google.com , click **New project**, delete the sample code, paste the contents of `gmail-autoreply.gs`, click **Save**.
3. In the function dropdown choose **setup**, click **Run**, and approve the permissions (it needs to read and reply to mail in this account only).
4. Done: it now checks the inbox every 5 minutes. To switch it off run **stopBot**.

## No new account? Use a free "+" address
If you already have a Gmail, `yourname+setup@gmail.com` is delivered to `yourname@gmail.com` and works as a separate address you can publish.
Set `BOT_ADDRESS = 'yourname+setup@gmail.com'` at the top of the script and the bot will only answer mail sent to that address; the rest of your inbox is untouched.

## Test
Send an email to the mailbox from another address with the words "how do I find a casting". You should get a reply within about 5 minutes.

## Optional next steps
- Gmail → Settings → **Accounts** → "Send mail as" to show a nicer name.
- Use this same mailbox as the sender for Supabase sign-up emails (Supabase → Authentication → SMTP) to remove the built-in email limit.
  That needs a Gmail **app password** (Google Account → Security → 2-step verification → App passwords). Keep it out of the repo.
- Edit the answers in the `answer()` function to change what the bot says.
