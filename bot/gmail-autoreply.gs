/**
 * Set UP — Gmail auto-reply bot (Google Apps Script). Free, no API key.
 * Runs inside the Set UP Gmail account every 5 minutes, answers common questions once per sender per day,
 * skips automated mail, and leaves every message UNREAD so a person still sees it.
 *
 * Setup: see bot/README.md. Run setup() once and approve the permissions.
 */
const SITE = 'https://eliasmechul.github.io/SetUp/';
const LABEL = 'setup-bot-replied';
const MAX_PER_RUN = 20;
// Optional: only answer mail sent to this address, e.g. 'yourname+setup@gmail.com' (a free "+" alias of an existing Gmail).
// Leave empty to answer all new mail in the inbox (use this for a dedicated Set UP mailbox).
const BOT_ADDRESS = 'ilyasgungor3+setup@gmail.com';

function setup() {
  GmailApp.createLabel(LABEL);
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('autoReply').timeBased().everyMinutes(5).create();
  Logger.log('Bot is on. It checks the inbox every 5 minutes.');
}

function stopBot() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  Logger.log('Bot is off.');
}

function autoReply() {
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const threads = GmailApp.search('in:inbox is:unread -label:' + LABEL + ' newer_than:2d' + (BOT_ADDRESS ? ' deliveredto:' + BOT_ADDRESS : ''), 0, MAX_PER_RUN);
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

  threads.forEach((thread) => {
    const msg = thread.getMessages()[0];
    const from = msg.getFrom();
    const addr = (from.match(/<([^>]+)>/) || [null, from])[1].toLowerCase();
    thread.addLabel(label); // never process the same thread twice

    const automated = /no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@|newsletter|support@(github|google|supabase)/i.test(addr);
    const raw = msg.getRawContent();
    const bulk = /^(List-Unsubscribe|Auto-Submitted: auto|Precedence: (bulk|junk|list))/im.test(raw);
    if (addr === me || automated || bulk) return;
    if (props.getProperty('last:' + addr) === today) return; // one reply per sender per day

    const text = (msg.getSubject() + ' ' + msg.getPlainBody()).toLowerCase();
    thread.reply(buildReply(msg.getFrom().replace(/<.*>/, '').trim(), answer(text)));
    props.setProperty('last:' + addr, today);
  });
}

function answer(t) {
  if (/(password|log ?in|sign ?in|can.?t get in|reset)/.test(t))
    return 'Use "Forgot password?" on the sign-in page (' + SITE + '#/login) and we will email you a reset link. If nothing arrives within a few minutes, check your spam folder.';
  if (/(confirm|verification|verify|never (got|received)|didn.?t (get|receive)).*(mail|email|link)|confirmation/.test(t))
    return 'After you sign up we send a confirmation link. Check your spam folder, and open the link in the same browser you signed up with. If it still does not arrive, reply to this email and a person will help.';
  if (/(delete|remove).*(account|profile|data)|gdpr|privacy/.test(t))
    return 'We can delete your account and data on request. A person on the team will confirm and handle this for you shortly.';
  if (/(casting|audition|job|role|apply|hiring|crew)/.test(t))
    return 'Jobs and castings live under "Castings" (' + SITE + '#/castings). Open a casting and tap Apply: your profile is sent with your message. To post a role, sign in and use "Start a post" then "Casting call".';
  if (/(map|city|location|near|nearby|find (cast|crew|talent|people))/.test(t))
    return 'The talent map (' + SITE + '#/map) shows people by city. Pick your city in "Edit profile" to appear on it, switch on "Open to work", and producers can filter by role and availability.';
  if (/(communit|group|meetup|event)/.test(t))
    return 'You can join or start communities under "Groups" and find events under "Meetups". Sign in and use the + button to create your own.';
  if (/(photo|image|logo|upload|picture)/.test(t))
    return 'You can add a profile photo under "Edit profile" and photos to posts with "Start a post". Images can be PNG, JPG, GIF or WebP up to 5 MB.';
  if (/(partner|press|sponsor|advertis|collab)/.test(t))
    return 'Thanks for reaching out about a partnership. A person on the team will read your message and reply personally.';
  return 'We have received your message and a person on the team will read it and reply personally.';
}

function buildReply(name, body) {
  const hello = name ? 'Hi ' + name.replace(/["']/g, '') + ',' : 'Hi,';
  return hello + '\n\nThanks for writing to Set UP.\n\n' + body +
    '\n\nThis is an automatic first reply. A person will follow up if your question needs more than the above.\n\n— Set UP\n' + SITE;
}
