// Data layer: the same "api(path, body)" the UI always used, now backed by Supabase
// (Postgres + Auth + Storage). Security is enforced by row level security in the database.
(() => {
'use strict';
const C = window.SETUP_CONFIG;
const sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
window.sb = sb;

const ROLES = ['Actor', 'Director', 'Producer', 'Cinematographer', 'Editor', 'Writer', 'Sound', 'Production Designer',
  'Costume & Makeup', 'VFX & Animation', 'Crew', 'Student', 'Other'];
const CATEGORIES = ['Acting', 'Crew', 'Voice', 'Extras', 'Other'];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PCOLS = 'id,name,role,headline,city,avatar,open_to_work,available_from,plan';

const fail = (status, message) => { const e = new Error(message); e.status = status; return e; };
const ok = ({ data, error }) => {
  if (error) {
    if (error.code === '23505') throw fail(409, 'Already done');
    if (error.code === '42501') throw fail(403, 'Not allowed');
    throw fail(400, error.message || 'Something went wrong');
  }
  return data;
};
async function session() { const { data } = await sb.auth.getSession(); return data.session; }
async function uid() { const s = await session(); if (!s) throw fail(401, 'Please log in'); return s.user.id; }
const clean = (v, max, required, label) => {
  v = typeof v === 'string' ? v.trim() : '';
  if (required && !v) throw fail(400, `${label} is required`);
  if (v.length > max) throw fail(400, `${label} is too long (max ${max})`);
  return v;
};
// strip characters that have meaning inside PostgREST filter strings
const safe = (s) => s.replace(/[,()*%\\:"']/g, ' ').trim();
const userJson = (r) => ({ pro: r.plan === 'pro', id: r.id, name: r.name, role: r.role, headline: r.headline, city: r.city, avatar: r.avatar,
  open_to_work: !!r.open_to_work, available_from: r.available_from || '' });
const iso = (r) => r.created_at;
const projectJson = (r, me) => ({ id: r.id, title: r.title, logline: r.logline, genre: r.genre, status: r.status, city: r.city, owner_id: r.user_id, owner: r.owner.name, mine: !!me && me === r.user_id, team: r.team[0].count, created: r.created_at });
const roomJson = (r, me) => ({ id: r.id, title: r.title, kind: r.kind, description: r.description, starts_at: r.starts_at, location: r.location,
  link: r.link, owner_id: r.user_id, mine: r.user_id === me, members: r.members[0].count, created: r.created_at });

async function requirePro(me, what) {
  const p = ok(await sb.from('setup_profiles').select('plan').eq('id', me).maybeSingle());
  if (!p || p.plan !== 'pro') throw fail(403, `Posting ${what} is part of Set UP Pro. Upgrade on the Pro page.`);
}

async function ensureProfile(user) {
  const { data } = await sb.from('setup_profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) return data;
  const m = user.user_metadata || {};
  const role = ROLES.includes(m.role) ? m.role : 'Other';
  const row = { id: user.id, name: clean(m.name, 80) || (user.email || 'Member').split('@')[0], role, headline: role, city: clean(m.city, 80),
    lat: typeof m.lat === 'number' ? m.lat : null, lng: typeof m.lng === 'number' ? m.lng : null };
  return ok(await sb.from('setup_profiles').insert(row).select('*').single());
}

async function myConnections(me) {
  const rows = ok(await sb.from('setup_connections').select('from_id,to_id,status').or(`from_id.eq.${me},to_id.eq.${me}`));
  const map = new Map();
  for (const r of rows) {
    const other = r.from_id === me ? r.to_id : r.from_id;
    map.set(other, r.status === 'accepted' ? 'connected' : r.from_id === me ? 'sent' : 'received');
  }
  return map;
}

const KINDS = ['update', 'showcase', 'question', 'tip', 'job', 'collab', 'event', 'news'];
const POST_SEL = `id,body,image,kind,created_at,user_id,user:setup_profiles!setup_posts_user_id_fkey(${PCOLS}),likes:setup_likes(count),comments:setup_comments(count),community:setup_communities(id,name),repost_of,original:repost_of(id,body,image,created_at,user:setup_profiles!setup_posts_user_id_fkey(${PCOLS}))`;
async function shapePosts(rows, me) {
  let liked = new Set();
  if (me && rows.length) {
    const l = ok(await sb.from('setup_likes').select('post_id').eq('user_id', me).in('post_id', rows.map((r) => r.id)));
    liked = new Set(l.map((x) => x.post_id));
  }
  return rows.map((r) => ({ id: r.id, body: r.body, image: r.image, kind: r.kind, repost_of: r.repost_of || null,
    original: r.original ? { id: r.original.id, body: r.original.body, image: r.original.image, created: iso(r.original), user: userJson(r.original.user) } : null, created: iso(r), likes: r.likes[0].count,
    comments: r.comments[0].count, liked: liked.has(r.id), user: userJson(r.user),
    community: r.community ? { id: r.community.id, name: r.community.name } : null }));
}
async function myId() { const s = await session(); return s ? s.user.id : null; }

const castingShape = (r) => ({ id: r.id, title: r.title, category: r.category, production: r.production, city: r.city, pay: r.pay,
  deadline: r.deadline, description: r.description, created: iso(r), user_id: r.user_id, poster: r.poster ? r.poster.name : '' });

/* ---------- example content (shown only while the real site is empty; never stored) ---------- */
const SID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const isSample = (v) => (typeof v === 'number' && v >= 9000000) || (typeof v === 'string' && v.startsWith('00000000-0000-4000-8000-'));
const SAMPLE_MSG = 'This is an example. Join Set UP to connect with real people.';
const dAhead = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const SP = [
  [1, 'Mara Linden', 'Cinematographer', 'Director of Photography', 'Berlin', 52.52, 13.405, true, 'DoP for shorts, music videos and documentaries. Natural light, small crews.', 'ARRI, Anamorphic, Documentary'],
  [2, 'Jacob Washington', 'Director', 'Director and writer', 'Berlin', 52.52, 13.405, false, 'Making my second short film this winter.', 'Directing, Writing, Casting'],
  [3, 'Sofia Reyes', 'Sound', 'Location sound and design', 'Berlin', 52.52, 13.405, true, 'Boom op by day, mixer by night.', 'Location sound, Foley, Mixing'],
  [4, 'Kat Williams', 'Actor', 'Actor, stage and screen', 'London', 51.507, -0.128, true, 'Trained in London. English and German.', 'Drama, Comedy, Voice'],
  [5, 'Nina Kovacs', 'Producer', 'Indie producer', 'Paris', 48.857, 2.352, false, 'I host a monthly short film night.', 'Producing, Budgeting, Festivals'],
  [6, 'Tony Monta', 'Editor', 'Editor and colourist', 'Los Angeles', 34.052, -118.244, true, 'Cutting narrative and commercial work.', 'Premiere, DaVinci Resolve'],
  [7, 'Amara Okafor', 'Actor', 'Screen actor', 'Lagos', 6.524, 3.379, true, 'Open to features and series.', 'Drama, Accents'],
  [8, 'Ravi Menon', 'Director', 'Documentary director', 'Mumbai', 19.076, 72.878, false, 'Long-form documentary and branded content.', 'Directing, Documentary'],
  [9, 'Chloe Tremblay', 'Production Designer', 'Production designer', 'Toronto', 43.653, -79.383, true, 'Sets and props for indie features.', 'Set design, Props'],
  [10, 'Leo Nakamura', 'Cinematographer', 'Cinematographer', 'Tokyo', 35.689, 139.692, false, 'Commercials and music videos.', 'Anamorphic, Steadicam'],
  [11, 'Elif Demir', 'Writer', 'Screenwriter', 'Istanbul', 41.008, 28.978, false, 'Drama and limited series.', 'Screenwriting, Story'],
  [12, 'Sam Carter', 'Sound', 'Sound designer', 'Sydney', -33.869, 151.209, true, 'Post sound and ADR.', 'Mixing, ADR'],
];
const sPeople = SP.map(([n, name, role, headline, city, lat, lng, open, bio, skills]) => ({ id: SID(n), name, role, headline, city, avatar: '', open_to_work: open,
  available_from: '', lat, lng, bio, skills, sample: true }));
const sUser = (n) => { const u = sPeople[n - 1]; return userJson(u) && { ...userJson(u), sample: true }; };
const SAMPLE = {
  people(q) {
    const text = (q.get('q') || '').toLowerCase();
    return sPeople.filter((p) => (!q.get('role') || p.role === q.get('role')) && (q.get('open') !== '1' || p.open_to_work) &&
      (!text || [p.name, p.headline, p.skills, p.city].join(' ').toLowerCase().includes(text))).map((p) => ({ ...p, state: 'none' }));
  },
  posts() {
    const t = [[1, 'Wrapped the last day on Night Ferry. Thank you to the whole camera crew.', 20, 24, 6, 'showcase'], [4, 'Open to new work from December. DM me if your shoot needs an actor in London.', 90, 41, 9, 'collab'],
      [3, 'Tip: record 60 seconds of room tone on every location. Your editor will thank you.', 300, 112, 18, 'tip'], [2, 'Casting a lead for my short film. Shoot dates in November. Details in Castings.', 600, 33, 5, 'job'],
      [6, 'Question: what is your go-to workflow for syncing dual-system sound on a tiny crew?', 800, 18, 12, 'question'], [5, 'Short Film Night is back next month. Come and meet other filmmakers.', 1000, 52, 7, 'event']];
    return t.map(([n, body, m, likes, comments, kind], i) => ({ id: 9000001 + i, body, image: '', kind, created: minsAgo(m), likes, comments, liked: false, user: sUser(n), community: null, sample: true }));
  },
  castings() {
    return [[9000001, 'Junior actor, lead role', 'Acting', 'Berlin', 'Paid', 6, 2, 'Looking for an actor in their twenties for the lead of a 15-minute drama. Three shooting days in November.'],
      [9000002, 'Gaffer, feature documentary', 'Crew', 'Hamburg', 'Day rate', 12, 2, 'Experienced gaffer for a ten-day documentary shoot. Own kit is a plus.'],
      [9000003, 'Voice actor, animated series', 'Voice', 'Remote', 'Paid', 3, 5, 'Warm, expressive voice for a children\'s animated series. Remote recording.'],
      [9000004, 'Street scene extras, one day', 'Extras', 'Munich', 'Unpaid, meals', 9, 1, 'Background performers for a busy street scene.']]
      .map(([id, title, category, city, pay, days, owner, description]) => ({ id, title, category, production: '[Example production]', city, pay, deadline: dAhead(days), description,
        created: minsAgo(120), user_id: SID(owner), poster: sPeople[owner - 1].name, applied: false, sample: true }));
  },
  communities() {
    return [[9000001, 'Berlin Indie Filmmakers', 'Directing', 'Berlin', 'Monthly chats, shared resources and crew calls for independent directors.', 128, 2],
      [9000002, 'Editors Room', 'Editing', '', 'Workflow tips, feedback on cuts and freelance leads for editors and colourists.', 86, 6],
      [9000003, 'Location Sound Collective', 'Sound', '', 'Boom ops, mixers and sound designers swapping gear advice and day-rate gigs.', 39, 3]]
      .map(([id, name, topic, city, description, members, owner]) => ({ id, name, topic, city, description, owner_id: SID(owner), created: minsAgo(5000), members, joined: false, sample: true }));
  },
  meetups() {
    return [[9000001, 'Short Film Night', 'Berlin', 'Kino Rex', dAhead(8) + 'T19:00', 42, 5], [9000002, 'Cinematographers Coffee', 'Berlin', 'Cafe Lumen', dAhead(15) + 'T10:00', 18, 1],
      [9000003, 'Script Table Read', 'London', 'Studio 9', dAhead(22) + 'T18:30', 12, 4]]
      .map(([id, title, city, venue, starts, going, host]) => ({ id, title, city, venue, starts, description: 'Open to everyone in film.', host: sPeople[host - 1].name, host_id: SID(host),
        going, joined: false, sample: true }));
  },
  profile(id) {
    const p = sPeople.find((x) => x.id === id); if (!p) return null;
    return { ...userJson(p), sample: true, bio: p.bio, skills: p.skills, created: minsAgo(9000), reel_url: '', lat: p.lat, lng: p.lng, credits: [{ id: 1, title: 'Night Ferry', role: p.role, kind: 'Short film', year: '2026', description: '' }],
      followers: 120, connections: 340, state: 'none', following: false, posts: SAMPLE.posts().filter((x) => x.user.id === id), castings: SAMPLE.castings().filter((c) => c.user_id === id) };
  },
};

/* ---------- handlers ---------- */
const H = {
  async me() {
    const s = await session();
    const base = { roles: ROLES, categories: CATEGORIES };
    if (!s) return { user: null, ...base };
    const p = await ensureProfile(s.user);
    const [n, m] = await Promise.all([
      sb.from('setup_notifications').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('read', false),
      sb.from('setup_messages').select('id', { count: 'exact', head: true }).eq('to_id', p.id).eq('read', false),
    ]);
    return { user: { ...p, unread_notifications: n.count || 0, unread_messages: m.count || 0 }, ...base };
  },
  async signup(_, b) {
    const name = clean(b.name, 80, true, 'Name');
    const email = clean(b.email, 160, true, 'Email').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail(400, 'Enter a valid email');
    if (typeof b.password !== 'string' || b.password.length < 8) throw fail(400, 'Password must be at least 8 characters');
    const role = ROLES.includes(b.role) ? b.role : 'Other';
    const { data, error } = await sb.auth.signUp({ email, password: b.password,
      options: { data: { name, role, city: clean(b.city, 80), lat: Number.isFinite(+b.lat) && b.lat !== undefined ? +b.lat : null, lng: Number.isFinite(+b.lng) && b.lng !== undefined ? +b.lng : null }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw fail(400, error.message);
    if (data.session) { await ensureProfile(data.session.user); return { ok: true }; }
    return { ok: true, confirm: true };
  },
  async login(_, b) {
    const { error } = await sb.auth.signInWithPassword({ email: clean(b.email, 160).toLowerCase(), password: b.password || '' });
    if (error) throw fail(401, /confirm/i.test(error.message) ? 'Please confirm your email first (check your inbox)' : 'Wrong email or password');
    return { ok: true };
  },
  async logout() { await sb.auth.signOut(); return { ok: true }; },
  async reset(_, b) {
    const email = clean(b.email, 160, true, 'Email').toLowerCase();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/new-password' });
    if (error) throw fail(400, error.message);
    return { ok: true };
  },
  async newpassword(_, b) {
    if (typeof b.password !== 'string' || b.password.length < 8) throw fail(400, 'Password must be at least 8 characters');
    const { error } = await sb.auth.updateUser({ password: b.password });
    if (error) throw fail(400, error.message);
    return { ok: true };
  },
  async update_me(_, b) {
    const me = await uid();
    const role = ROLES.includes(b.role) ? b.role : 'Other';
    ok(await sb.from('setup_profiles').update({ name: clean(b.name, 80, true, 'Name'), role, headline: clean(b.headline, 120),
      city: clean(b.city, 80), bio: clean(b.bio, 1500), skills: clean(b.skills, 300), avatar: b.avatar || '',
      lat: Number.isFinite(+b.lat) && b.lat !== '' && b.lat !== null ? +b.lat : null, lng: Number.isFinite(+b.lng) && b.lng !== '' && b.lng !== null ? +b.lng : null,
      open_to_work: b.open_to_work === true || b.open_to_work === 'on' || b.open_to_work === 'true',
      available_from: /^\d{4}-\d{2}-\d{2}$/.test(b.available_from || '') ? b.available_from : '',
      reel_url: /^https:\/\/[^\s]{3,280}$/.test(b.reel_url || '') ? b.reel_url : '' }).eq('id', me));
    return { ok: true };
  },
  async add_credit(_, b) {
    const me = await uid();
    const year = clean(b.year, 4);
    if (year && !/^\d{4}$/.test(year)) throw fail(400, 'Year must be 4 digits');
    ok(await sb.from('setup_credits').insert({ user_id: me, title: clean(b.title, 120, true, 'Title'), role: clean(b.role, 80), kind: clean(b.kind, 40), year,
      description: clean(b.description, 600) }));
    return { ok: true };
  },
  async delete_credit(id) { ok(await sb.from('setup_credits').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async map_people(q) {
    const me = await myId();
    let query = sb.from('setup_profiles').select(PCOLS + ',lat,lng,skills').not('lat', 'is', null).order('created_at', { ascending: false }).limit(800);
    if (ROLES.includes(q.get('role'))) query = query.eq('role', q.get('role'));
    if (q.get('open') === '1') query = query.eq('open_to_work', true);
    const text = safe(q.get('q') || ''); if (text) query = query.or(`name.ilike.%${text}%,headline.ilike.%${text}%,skills.ilike.%${text}%,city.ilike.%${text}%`);
    const [rows, conns] = await Promise.all([query, me ? myConnections(me) : new Map()]);
    const rrows = ok(rows);
    if (!rrows.length) { const tot = await sb.from('setup_profiles').select('id', { count: 'exact', head: true }).not('lat', 'is', null); if (!tot.count) return { people: SAMPLE.people(q) }; }
    return { people: rrows.map((r) => ({ ...userJson(r), lat: r.lat, lng: r.lng, skills: r.skills, state: r.id === me ? 'self' : (conns.get(r.id) || 'none') })) };
  },
  async upload(_, b) {
    const me = await uid();
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/s.exec(b.data || '');
    if (!m) throw fail(400, 'Only PNG, JPG, GIF or WebP images');
    const bin = atob(m[3]); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length > 5 * 1024 * 1024) throw fail(400, 'Image too large (max 5 MB)');
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
    const name = `${me}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(C.bucket).upload(name, new Blob([bytes], { type: m[1] }), { contentType: m[1] });
    if (error) throw fail(400, error.message);
    return { url: sb.storage.from(C.bucket).getPublicUrl(name).data.publicUrl };
  },

  /* posts */
  async feed(q) {
    const me = await myId();
    let query = sb.from('setup_posts').select(POST_SEL).order('created_at', { ascending: false }).limit(50);
    if (KINDS.includes(q.get('kind'))) query = query.eq('kind', q.get('kind'));
    if (/^[\p{L}\p{N}_]{2,40}$/u.test(q.get('tag') || '')) query = query.ilike('body', '%#' + q.get('tag') + '%');
    if (q.get('scope') === 'network' && me) {
      const [f, c] = await Promise.all([
        sb.from('setup_follows').select('followee_id').eq('follower_id', me),
        sb.from('setup_connections').select('from_id,to_id').eq('status', 'accepted').or(`from_id.eq.${me},to_id.eq.${me}`)]);
      const ids = new Set([me, ...ok(f).map((x) => x.followee_id), ...ok(c).map((x) => (x.from_id === me ? x.to_id : x.from_id))]);
      query = query.in('user_id', [...ids]);
    }
    const posts = await shapePosts(ok(await query), me);
    if (!posts.length && q.get('scope') !== 'network') {
      const tot = await sb.from('setup_posts').select('id', { count: 'exact', head: true });
      if (!tot.count) return { posts: SAMPLE.posts().filter((x) => !q.get('kind') || x.kind === q.get('kind')) };
    }
    return { posts };
  },
  async create_post(_, b) {
    const me = await uid();
    const body = clean(b.body, 3000), image = b.image || '';
    const repostOf = /^\d+$/.test(String(b.repost_of || '')) ? Number(b.repost_of) : null;
    if (repostOf && isSample(repostOf)) throw fail(400, SAMPLE_MSG);
    if (!body && !image && !repostOf) throw fail(400, 'Write something or add an image');
    const cid = /^\d+$/.test(String(b.community_id || '')) ? Number(b.community_id) : null;
    const kind = KINDS.includes(b.kind) ? b.kind : 'update';
    const r = ok(await sb.from('setup_posts').insert({ user_id: me, body, image, community_id: cid, kind, repost_of: repostOf }).select('id').single());
    return { id: r.id };
  },
  async delete_post(id) { ok(await sb.from('setup_posts').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async like(id) {
    const me = await uid();
    const del = ok(await sb.from('setup_likes').delete().eq('post_id', id).eq('user_id', me).select('post_id'));
    if (!del.length) ok(await sb.from('setup_likes').insert({ post_id: id, user_id: me }));
    const n = await sb.from('setup_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', id);
    return { likes: n.count || 0, liked: !del.length };
  },
  async get_comments(id) {
    if (isSample(id)) return { comments: [] };
    const rows = ok(await sb.from('setup_comments').select(`id,body,created_at,user:setup_profiles!setup_comments_user_id_fkey(${PCOLS})`).eq('post_id', id).order('id'));
    return { comments: rows.map((r) => ({ id: r.id, body: r.body, created: iso(r), user: userJson(r.user) })) };
  },
  async add_comment(id, b) {
    ok(await sb.from('setup_comments').insert({ post_id: id, user_id: await uid(), body: clean(b.body, 1000, true, 'Comment') }));
    return H.get_comments(id);
  },

  async report(_, b) {
    const me = await uid();
    const types = ['post', 'comment', 'profile', 'casting', 'community'];
    const reasons = ['spam', 'harassment', 'misleading', 'inappropriate', 'other'];
    const type = types.includes(b.target_type) ? b.target_type : null;
    const tid = String(b.target_id || '').slice(0, 60);
    if (!type || !tid) throw fail(400, 'Nothing to report');
    if (isSample(Number(tid)) || isSample(tid)) throw fail(400, SAMPLE_MSG);
    const { error } = await sb.from('setup_reports').insert({ reporter_id: me, target_type: type, target_id: tid,
      reason: reasons.includes(b.reason) ? b.reason : 'other', note: clean(b.note, 500) });
    if (error) throw fail(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'You already reported this. Thank you.' : error.message);
    return { ok: true };
  },

  /* communities */
  async communities(q) {
    const me = await myId();
    let joined = new Set();
    if (me) joined = new Set(ok(await sb.from('setup_community_members').select('community_id').eq('user_id', me)).map((x) => x.community_id));
    let query = sb.from('setup_communities').select('*, members:setup_community_members(count)').order('created_at', { ascending: false }).limit(100);
    if (q.get('mine')) { if (!joined.size) return { communities: [] }; query = query.in('id', [...joined]); }
    const topic = q.get('topic'); if (topic) query = query.eq('topic', topic);
    const text = safe(q.get('q') || ''); if (text) query = query.or(`name.ilike.%${text}%,description.ilike.%${text}%`);
    const crows = ok(await query);
    if (!crows.length && !q.get('mine') && !q.get('topic') && !q.get('q')) return { communities: SAMPLE.communities() };
    return { communities: crows.map((r) => ({ id: r.id, name: r.name, topic: r.topic, city: r.city, description: r.description,
      owner_id: r.user_id, created: iso(r), members: r.members[0].count, joined: joined.has(r.id) })) };
  },
  async community(id) {
    const sc = SAMPLE.communities().find((c) => c.id === id); if (sc) return { ...sc, posts: [], people: sPeople.slice(0, 6).map((p) => ({ ...userJson(p), sample: true })) };
    const me = await myId();
    const r = ok(await sb.from('setup_communities').select('*, members:setup_community_members(count)').eq('id', id).maybeSingle());
    if (!r) throw fail(404, 'Community not found');
    const [posts, people, mine] = await Promise.all([
      sb.from('setup_posts').select(POST_SEL).eq('community_id', id).order('created_at', { ascending: false }).limit(50),
      sb.from('setup_community_members').select(`user:setup_profiles!setup_community_members_user_id_fkey(${PCOLS})`).eq('community_id', id).order('joined_at').limit(12),
      me ? sb.from('setup_community_members').select('user_id').eq('community_id', id).eq('user_id', me) : { data: [] }]);
    return { id: r.id, name: r.name, topic: r.topic, city: r.city, description: r.description, owner_id: r.user_id, created: iso(r),
      members: r.members[0].count, joined: ok(mine).length > 0, posts: await shapePosts(ok(posts), me), people: ok(people).map((x) => userJson(x.user)) };
  },
  async create_community(_, b) {
    const me = await uid();
    const topics = ['General', 'Acting', 'Directing', 'Producing', 'Cinematography', 'Editing', 'Sound', 'Writing', 'Crew', 'Students', 'Local'];
    const r = ok(await sb.from('setup_communities').insert({ user_id: me, name: clean(b.name, 80, true, 'Name'),
      topic: topics.includes(b.topic) ? b.topic : 'General', city: clean(b.city, 80), description: clean(b.description, 1000) }).select('id').single());
    ok(await sb.from('setup_community_members').insert({ community_id: r.id, user_id: me }));
    return { id: r.id };
  },
  async join_community(id) {
    const me = await uid();
    const c = ok(await sb.from('setup_communities').select('user_id').eq('id', id).maybeSingle());
    if (!c) throw fail(404, 'Community not found');
    const del = c.user_id === me ? null : ok(await sb.from('setup_community_members').delete().eq('community_id', id).eq('user_id', me).select('user_id'));
    if (del === null) throw fail(400, 'Owners cannot leave. Delete the community instead.');
    if (!del.length) ok(await sb.from('setup_community_members').insert({ community_id: id, user_id: me }));
    return { joined: !del.length };
  },
  async delete_community(id) { ok(await sb.from('setup_communities').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },

  /* private rooms: invite-only spaces with QR invites and check-in */
  async rooms() {
    const me = await uid();
    const rows = ok(await sb.from('setup_rooms').select('*, members:setup_room_members(count)').order('created_at', { ascending: false }).limit(100));
    return { rooms: rows.map((r) => roomJson(r, me)) };
  },
  async room(id) {
    const me = await uid();
    const r = ok(await sb.from('setup_rooms').select('*, members:setup_room_members(count)').eq('id', id).maybeSingle());
    if (!r) throw fail(404, 'Room not found');
    const mem = ok(await sb.from('setup_room_members').select(`checked_in_at,joined_at,user:setup_profiles!setup_room_members_user_id_fkey(${PCOLS})`).eq('room_id', id).order('joined_at').limit(500));
    const out = roomJson(r, me);
    if (out.mine) { out.invite_code = r.invite_code; out.invite_open = r.invite_open; }
    out.people = mem.map((x) => ({ ...userJson(x.user), checked_in: !!x.checked_in_at }));
    return out;
  },
  async create_room(_, b) {
    const me = await uid();
    const kinds = ['presentation', 'program', 'screening', 'casting_day', 'other'];
    let link = clean(b.link, 500); if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
    const startsAt = b.starts_at ? new Date(b.starts_at) : null;
    const r = ok(await sb.from('setup_rooms').insert({ user_id: me, title: clean(b.title, 120, true, 'Title'), kind: kinds.includes(b.kind) ? b.kind : 'presentation',
      description: clean(b.description, 4000), location: clean(b.location, 160), link, starts_at: startsAt && !isNaN(startsAt) ? startsAt.toISOString() : null }).select('id').single());
    ok(await sb.from('setup_room_members').insert({ room_id: r.id, user_id: me }));
    return { id: r.id };
  },
  async room_invite(id, b) {
    const me = await uid();
    const patch = {};
    if (b.action === 'close') patch.invite_open = false;
    else if (b.action === 'open') patch.invite_open = true;
    else if (b.action === 'new') patch.invite_code = 'k' + [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
    else throw fail(400, 'Unknown action');
    const r = ok(await sb.from('setup_rooms').update(patch).eq('id', id).eq('user_id', me).select('invite_code,invite_open').maybeSingle());
    if (!r) throw fail(403, 'Not allowed');
    return r;
  },
  async room_checkin(id, b) {
    await uid();
    const r = ok(await sb.from('setup_room_members').update({ checked_in_at: b.undo ? null : new Date().toISOString() }).eq('room_id', id).eq('user_id', clean(b.user_id, 40, true, 'User')).select('user_id').maybeSingle());
    if (!r) throw fail(403, 'Not allowed');
    return { ok: true };
  },
  async leave_room(id) {
    const me = await uid();
    const r = ok(await sb.from('setup_rooms').select('user_id').eq('id', id).maybeSingle());
    if (r && r.user_id === me) throw fail(400, 'Hosts cannot leave. Delete the room instead.');
    ok(await sb.from('setup_room_members').delete().eq('room_id', id).eq('user_id', me));
    return { ok: true };
  },
  async delete_room(id) { ok(await sb.from('setup_rooms').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async room_preview(code) {
    const rows = ok(await sb.rpc('setup_room_preview', { code: String(code).toLowerCase() }));
    if (!rows || !rows.length) throw fail(404, 'This invite is not valid or has been closed');
    return rows[0];
  },
  async join_room(code) {
    await uid();
    const id = ok(await sb.rpc('setup_join_room', { code: String(code).toLowerCase() }));
    return { id };
  },


  /* projects and crew requests */
  async projects(q) {
    const me = await myId();
    let query = sb.from('setup_projects').select('*, owner:setup_profiles!setup_projects_user_id_fkey(name), team:setup_project_members(count)').order('created_at', { ascending: false }).limit(100);
    if (q.get('mine') && me) {
      const ids = ok(await sb.from('setup_project_members').select('project_id').eq('user_id', me).eq('status', 'accepted')).map((x) => x.project_id);
      query = query.or(ids.length ? `user_id.eq.${me},id.in.(${ids.join(',')})` : `user_id.eq.${me}`);
    }
    const rows = ok(await query);
    return { projects: rows.map((r) => projectJson(r, me)) };
  },
  async project(id) {
    const me = await myId();
    const r = ok(await sb.from('setup_projects').select('*, owner:setup_profiles!setup_projects_user_id_fkey(name), team:setup_project_members(count)').eq('id', id).maybeSingle());
    if (!r) throw fail(404, 'Project not found');
    const mem = ok(await sb.from('setup_project_members').select(`user_id,role,days,note,status,user:setup_profiles!setup_project_members_user_id_fkey(${PCOLS})`).eq('project_id', id).order('created_at').limit(200));
    const out = projectJson(r, me);
    out.description = r.description;
    out.team = mem.filter((x) => x.status === 'accepted').map((x) => ({ ...userJson(x.user), crew_role: x.role, days: x.days }));
    out.pending = out.mine ? mem.filter((x) => x.status !== 'accepted').map((x) => ({ ...userJson(x.user), crew_role: x.role, days: x.days, status: x.status })) : [];
    const mine = mem.find((x) => x.user_id === me);
    out.invite = mine && mine.status === 'invited' ? { role: mine.role, days: mine.days, note: mine.note } : null;
    out.member = !!mine && mine.status === 'accepted';
    return out;
  },
  async create_project(_, b) {
    const me = await uid();
    const stat = ['development', 'pre_production', 'shooting', 'post_production', 'released'];
    const r = ok(await sb.from('setup_projects').insert({ user_id: me, title: clean(b.title, 120, true, 'Title'), logline: clean(b.logline, 300), genre: clean(b.genre, 60),
      status: stat.includes(b.status) ? b.status : 'development', city: clean(b.city, 80), description: clean(b.description, 3000) }).select('id').single());
    return { id: r.id };
  },
  async project_status(id, b) {
    const stat = ['development', 'pre_production', 'shooting', 'post_production', 'released'];
    if (!stat.includes(b.status)) throw fail(400, 'Unknown status');
    ok(await sb.from('setup_projects').update({ status: b.status }).eq('id', id).eq('user_id', await uid()));
    return { ok: true };
  },
  async set_stage(id, b) {
    const stages = ['new', 'shortlist', 'callback', 'cast', 'declined'];
    if (!stages.includes(b.stage)) throw fail(400, 'Unknown stage');
    await uid();
    const r = ok(await sb.from('setup_applications').update({ stage: b.stage }).eq('id', id).select('id').maybeSingle());
    if (!r) throw fail(403, 'Only the person who posted this casting can change an application stage');
    return { ok: true };
  },
  async add_availability(_, b) {
    const me = await uid();
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(b.from_date || '') || !re.test(b.to_date || '')) throw fail(400, 'Choose a start and an end date');
    if (b.to_date < b.from_date) throw fail(400, 'The end date is before the start date');
    ok(await sb.from('setup_availability').insert({ user_id: me, from_date: b.from_date, to_date: b.to_date, kind: b.kind === 'busy' ? 'busy' : 'available', note: clean(b.note, 120) }));
    return { ok: true };
  },
  async delete_availability(id) { ok(await sb.from('setup_availability').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async pro_status() {
    const rows = ok(await sb.from('setup_settings').select('key,value').eq('key', 'pro_open'));
    const me = await myId();
    let pro = false;
    if (me) { const p = ok(await sb.from('setup_profiles').select('plan').eq('id', me).maybeSingle()); pro = !!p && p.plan === 'pro'; }
    return { pro_open: !!rows[0] && rows[0].value === 'true', pro };
  },
  async activate_pro() {
    await uid();
    const { error } = await sb.rpc('setup_activate_pro');
    if (error) throw fail(400, error.message);
    return { ok: true };
  },
  async delete_project(id) { ok(await sb.from('setup_projects').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async crew_invite(id, b) {
    await uid();
    ok(await sb.from('setup_project_members').insert({ project_id: id, user_id: clean(b.user_id, 40, true, 'Person'), role: clean(b.role, 80, true, 'Role'), days: clean(b.days, 120), note: clean(b.note, 500), status: 'invited' }));
    return { ok: true };
  },
  async crew_respond(id, b) {
    const me = await uid();
    if (!['accepted', 'declined'].includes(b.status)) throw fail(400, 'Unknown answer');
    const r = ok(await sb.from('setup_project_members').update({ status: b.status }).eq('project_id', id).eq('user_id', me).select('id').maybeSingle());
    if (!r) throw fail(404, 'No invitation found');
    return { ok: true };
  },
  async crew_remove(id, b) {
    const me = await uid();
    ok(await sb.from('setup_project_members').delete().eq('project_id', id).eq('user_id', b.user_id || me));
    return { ok: true };
  },
  async my_invitations() {
    const me = await uid();
    const rows = ok(await sb.from('setup_project_members').select('role,days,note,project:setup_projects(id,title,user_id,owner:setup_profiles!setup_projects_user_id_fkey(name))').eq('user_id', me).eq('status', 'invited'));
    return { invitations: rows.map((x) => ({ project_id: x.project.id, title: x.project.title, owner: x.project.owner.name, role: x.role, days: x.days, note: x.note })) };
  },

  /* people & network */
  async people(q) {
    const me = await myId();
    let query = sb.from('setup_profiles').select(PCOLS).order('created_at', { ascending: false }).limit(60);
    if (me) query = query.neq('id', me);
    const text = safe(q.get('q') || '');
    if (text) query = query.or(`name.ilike.%${text}%,headline.ilike.%${text}%,skills.ilike.%${text}%`);
    if (ROLES.includes(q.get('role'))) query = query.eq('role', q.get('role'));
    const city = safe(q.get('city') || '');
    if (city) query = query.ilike('city', `%${city}%`);
    const [rows, conns] = await Promise.all([query, me ? myConnections(me) : new Map()]);
    const prow = ok(rows);
    if (!prow.some((r) => r.id !== '99999999-9999-4999-8999-999999999999') && !me) { const tot = await sb.from('setup_profiles').select('id', { count: 'exact', head: true }); if (tot.count <= 1) return { people: SAMPLE.people(new URLSearchParams({ q: q.get('q') || '', role: q.get('role') || '' })) }; }
    return { people: prow.map((r) => ({ ...userJson(r), state: conns.get(r.id) || 'none' })) };
  },
  async profile(id) {
    const sp = SAMPLE.profile(id); if (sp) return sp;
    const me = await myId();
    const p = ok(await sb.from('setup_profiles').select('*').eq('id', id).maybeSingle());
    if (!p) throw fail(404, 'Person not found');
    const [stats, posts, castings, conns, fol] = await Promise.all([
      sb.rpc('setup_stats', { uid: id }),
      sb.from('setup_posts').select(POST_SEL).eq('user_id', id).order('created_at', { ascending: false }).limit(50),
      sb.from('setup_castings').select('*, poster:setup_profiles!setup_castings_user_id_fkey(name)').eq('user_id', id).order('id', { ascending: false }),
      me ? myConnections(me) : new Map(),
      me ? sb.from('setup_follows').select('followee_id').eq('follower_id', me).eq('followee_id', id) : { data: [] },
    ]);
    const s = ok(stats);
    const credits = ok(await sb.from('setup_credits').select('*').eq('user_id', id).order('year', { ascending: false }).order('id', { ascending: false }));
    const today = new Date().toISOString().slice(0, 10);
    const availability = ok(await sb.from('setup_availability').select('id,from_date,to_date,kind,note').eq('user_id', id).gte('to_date', today).order('from_date').limit(30));
    return { ...userJson(p), bio: p.bio, skills: p.skills, created: iso(p), reel_url: p.reel_url, lat: p.lat, lng: p.lng, credits, availability, followers: s.followers, connections: s.connections,
      state: me === id ? 'self' : (conns.get(id) || 'none'), following: ok(fol).length > 0,
      posts: await shapePosts(ok(posts), me), castings: ok(castings).map(castingShape) };
  },
  async follow(id) {
    const me = await uid();
    const del = ok(await sb.from('setup_follows').delete().eq('follower_id', me).eq('followee_id', id).select('followee_id'));
    if (!del.length) ok(await sb.from('setup_follows').insert({ follower_id: me, followee_id: id }));
    return { following: !del.length };
  },
  async connect_to(id) {
    const me = await uid();
    if (id === me) throw fail(400, "You can't connect with yourself");
    const state = (await myConnections(me)).get(id) || 'none';
    if (state === 'received') return H.accept(id);
    if (state !== 'none') return { state };
    ok(await sb.from('setup_connections').insert({ from_id: me, to_id: id }));
    await sb.from('setup_follows').insert({ follower_id: me, followee_id: id }); // like Instagram; ignore if already following
    return { state: 'sent' };
  },
  async accept(id) {
    const me = await uid();
    const r = ok(await sb.from('setup_connections').update({ status: 'accepted' }).eq('from_id', id).eq('to_id', me).eq('status', 'pending').select('id'));
    if (!r.length) throw fail(404, 'No pending request');
    return { state: 'connected' };
  },
  async decline(id) { ok(await sb.from('setup_connections').delete().eq('from_id', id).eq('to_id', await uid()).eq('status', 'pending')); return { state: 'none' }; },
  async disconnect(id) {
    const me = await uid();
    ok(await sb.from('setup_connections').delete().or(`and(from_id.eq.${me},to_id.eq.${id}),and(from_id.eq.${id},to_id.eq.${me})`));
    return { state: 'none' };
  },
  async requests() {
    const me = await uid();
    const rows = ok(await sb.from('setup_connections').select(`id,from:setup_profiles!setup_connections_from_id_fkey(${PCOLS})`)
      .eq('to_id', me).eq('status', 'pending').order('id', { ascending: false }));
    return { requests: rows.map((r) => userJson(r.from)) };
  },
  async my_network() {
    const me = await uid();
    const rows = ok(await sb.from('setup_connections').select(
      `a:setup_profiles!setup_connections_from_id_fkey(${PCOLS}),b:setup_profiles!setup_connections_to_id_fkey(${PCOLS})`)
      .eq('status', 'accepted').or(`from_id.eq.${me},to_id.eq.${me}`));
    return { connections: rows.map((r) => userJson(r.a.id === me ? r.b : r.a)).sort((x, y) => x.name.localeCompare(y.name)) };
  },
  async suggestions() {
    const me = await uid();
    const [mine, rows, conns] = await Promise.all([
      sb.from('setup_profiles').select('city,role').eq('id', me).single(),
      sb.from('setup_profiles').select(PCOLS).neq('id', me).order('created_at', { ascending: false }).limit(60), myConnections(me)]);
    const m = ok(mine);
    const score = (r) => (m.city && r.city.toLowerCase() === m.city.toLowerCase() ? 2 : 0) + (r.role === m.role ? 1 : 0);
    return { people: ok(rows).filter((r) => !conns.has(r.id)).sort((a, b) => score(b) - score(a)).slice(0, 8).map(userJson) };
  },

  /* castings */
  async castings(q) {
    const me = await myId();
    let query = sb.from('setup_castings').select('*, poster:setup_profiles!setup_castings_user_id_fkey(name)' + (me ? ', applicants:setup_applications(count)' : ''))
      .order('id', { ascending: false }).limit(100);
    if (CATEGORIES.includes(q.get('category'))) query = query.eq('category', q.get('category'));
    const city = safe(q.get('city') || ''); if (city) query = query.ilike('city', `%${city}%`);
    const text = safe(q.get('q') || ''); if (text) query = query.or(`title.ilike.%${text}%,production.ilike.%${text}%,description.ilike.%${text}%`);
    const rows = ok(await query);
    if (!rows.length && !q.get('category') && !q.get('city') && !q.get('q')) return { castings: SAMPLE.castings() };
    let applied = new Set();
    if (me && rows.length) applied = new Set(ok(await sb.from('setup_applications').select('casting_id').eq('user_id', me)).map((x) => x.casting_id));
    return { castings: rows.map((r) => ({ ...castingShape(r), applied: applied.has(r.id), ...(me && r.user_id === me ? { applicants: r.applicants[0].count } : {}) })) };
  },
  async casting(id) {
    const sc = SAMPLE.castings().find((c) => c.id === id); if (sc) return sc;
    const me = await myId();
    const r = ok(await sb.from('setup_castings').select('*, poster:setup_profiles!setup_castings_user_id_fkey(name)').eq('id', id).maybeSingle());
    if (!r) throw fail(404, 'Casting not found');
    const j = castingShape(r);
    if (me === r.user_id) {
      const apps = ok(await sb.from('setup_applications').select(`id,stage,message,created_at,user:setup_profiles!setup_applications_user_id_fkey(${PCOLS})`).eq('casting_id', id).order('id', { ascending: false }));
      j.applications = apps.map((a) => ({ ...userJson(a.user), app_id: a.id, stage: a.stage, message: a.message, applied_at: iso(a) }));
      j.applied = false;
    } else {
      const mine = me ? ok(await sb.from('setup_applications').select('id,stage').eq('casting_id', id).eq('user_id', me)) : [];
      j.applied = mine.length > 0; j.my_stage = mine[0] ? mine[0].stage : '';
    }
    return j;
  },
  async create_casting(_, b) {
    const me = await uid();
    await requirePro(me, 'castings');
    const dl = clean(b.deadline, 10);
    const r = ok(await sb.from('setup_castings').insert({ user_id: me, title: clean(b.title, 120, true, 'Title'),
      category: CATEGORIES.includes(b.category) ? b.category : 'Other', production: clean(b.production, 120), city: clean(b.city, 80),
      pay: clean(b.pay, 80), deadline: /^\d{4}-\d{2}-\d{2}$/.test(dl) ? dl : '', description: clean(b.description, 4000) }).select('id').single());
    return { id: r.id };
  },
  async apply(id, b) {
    const { error } = await sb.from('setup_applications').insert({ casting_id: id, user_id: await uid(), message: clean(b.message, 1500) });
    if (error) throw fail(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'You already applied' : error.code === '42501' ? "That's your own casting" : error.message);
    return { ok: true };
  },
  async delete_casting(id) { ok(await sb.from('setup_castings').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },
  async my_applications() {
    const me = await uid();
    const rows = ok(await sb.from('setup_applications').select('created_at, stage, casting:setup_castings(*, poster:setup_profiles!setup_castings_user_id_fkey(name))').eq('user_id', me).order('id', { ascending: false }));
    return { castings: rows.filter((r) => r.casting).map((r) => ({ ...castingShape(r.casting), applied: true, stage: r.stage, applied_at: iso(r) })) };
  },

  /* meetups */
  async meetups(q) {
    const me = await myId();
    let query = sb.from('setup_meetups').select('*, host:setup_profiles!setup_meetups_user_id_fkey(name), going:setup_rsvps(count)').order('starts').limit(100);
    let joined = new Set();
    if (me) joined = new Set(ok(await sb.from('setup_rsvps').select('meetup_id').eq('user_id', me)).map((x) => x.meetup_id));
    if (q.get('mine') && me) {
      const ids = [...joined];
      query = query.or(ids.length ? `user_id.eq.${me},id.in.(${ids.join(',')})` : `user_id.eq.${me}`);
    } else {
      query = query.gte('starts', new Date().toISOString().slice(0, 10));
    }
    const mrows = ok(await query);
    if (!mrows.length && !q.get('mine') && !(me && joined.size)) return { meetups: SAMPLE.meetups() };
    return { meetups: mrows.map((r) => ({ id: r.id, title: r.title, city: r.city, venue: r.venue, starts: r.starts, description: r.description,
      host: r.host.name, host_id: r.user_id, going: r.going[0].count, joined: joined.has(r.id) })) };
  },
  async create_meetup(_, b) {
    const me = await uid();
    await requirePro(me, 'events');
    const starts = clean(b.starts, 16, true, 'Date and time');
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(starts)) throw fail(400, 'Enter a valid date');
    const r = ok(await sb.from('setup_meetups').insert({ user_id: me, title: clean(b.title, 120, true, 'Title'), city: clean(b.city, 80),
      venue: clean(b.venue, 120), starts, description: clean(b.description, 2000) }).select('id').single());
    ok(await sb.from('setup_rsvps').insert({ meetup_id: r.id, user_id: me }));
    return { id: r.id };
  },
  async rsvp(id) {
    const me = await uid();
    const del = ok(await sb.from('setup_rsvps').delete().eq('meetup_id', id).eq('user_id', me).select('meetup_id'));
    if (!del.length) ok(await sb.from('setup_rsvps').insert({ meetup_id: id, user_id: me }));
    return { joined: !del.length };
  },
  async meetup(id) {
    const me = await myId();
    const sm = SAMPLE.meetups().find((m) => m.id === id);
    if (sm) return { ...sm, people: [], joined: false, mine: false, going: sm.going || 0, checked_in: 0 };
    const r = ok(await sb.from('setup_meetups').select('*, host:setup_profiles!setup_meetups_user_id_fkey(name)').eq('id', id).maybeSingle());
    if (!r) throw fail(404, 'Event not found');
    const rs = ok(await sb.from('setup_rsvps').select(`user_id,checked_in_at,user:setup_profiles!setup_rsvps_user_id_fkey(${PCOLS})`).eq('meetup_id', id).limit(500));
    return { id: r.id, title: r.title, city: r.city, venue: r.venue, starts: r.starts, description: r.description, host: r.host.name, host_id: r.user_id,
      mine: !!me && me === r.user_id, joined: rs.some((x) => x.user_id === me), going: rs.length, checked_in: rs.filter((x) => x.checked_in_at).length,
      people: rs.map((x) => ({ ...userJson(x.user), checked_in: !!x.checked_in_at })) };
  },
  async meetup_checkin(id, b) {
    await uid();
    const r = ok(await sb.from('setup_rsvps').update({ checked_in_at: b.undo ? null : new Date().toISOString() }).eq('meetup_id', id).eq('user_id', clean(b.user_id, 40, true, 'User')).select('user_id').maybeSingle());
    if (!r) throw fail(403, 'Only the host can check in guests who have joined this event');
    return { ok: true };
  },
  async delete_meetup(id) { ok(await sb.from('setup_meetups').delete().eq('id', id).eq('user_id', await uid())); return { ok: true }; },

  /* notifications & messages */
  async notifications() {
    const me = await uid();
    const rows = ok(await sb.from('setup_notifications').select(`id,kind,ref,label,created_at,read,actor:setup_profiles!setup_notifications_actor_id_fkey(${PCOLS})`)
      .eq('user_id', me).order('id', { ascending: false }).limit(60));
    return { notifications: rows.map((r) => ({ id: r.id, kind: r.kind, ref: r.ref, label: r.label, created: iso(r), read: r.read, actor: userJson(r.actor) })) };
  },
  async read_notifications() { ok(await sb.from('setup_notifications').update({ read: true }).eq('user_id', await uid()).eq('read', false)); return { ok: true }; },
  async conversations() {
    const me = await uid();
    const rows = ok(await sb.from('setup_messages').select('from_id,to_id,body,created_at,read').or(`from_id.eq.${me},to_id.eq.${me}`)
      .order('id', { ascending: false }).limit(400));
    const last = new Map(), unread = new Map();
    for (const r of rows) {
      const other = r.from_id === me ? r.to_id : r.from_id;
      if (!last.has(other)) last.set(other, r);
      if (r.to_id === me && !r.read) unread.set(other, (unread.get(other) || 0) + 1);
    }
    if (!last.size) return { conversations: [] };
    const profs = ok(await sb.from('setup_profiles').select(PCOLS).in('id', [...last.keys()]));
    return { conversations: profs.map((p) => { const r = last.get(p.id); return { user: userJson(p), last: r.body, created: iso(r),
      mine: r.from_id === me, unread: unread.get(p.id) || 0 }; }).sort((a, b) => (a.created < b.created ? 1 : -1)) };
  },
  async thread(other) {
    const me = await uid();
    const u = ok(await sb.from('setup_profiles').select(PCOLS).eq('id', other).maybeSingle());
    if (!u) throw fail(404, 'Person not found');
    await sb.from('setup_messages').update({ read: true }).eq('from_id', other).eq('to_id', me).eq('read', false);
    const [rows, conns] = await Promise.all([
      sb.from('setup_messages').select('id,from_id,body,created_at')
        .or(`and(from_id.eq.${me},to_id.eq.${other}),and(from_id.eq.${other},to_id.eq.${me})`).order('id', { ascending: false }).limit(200),
      myConnections(me)]);
    return { user: userJson(u), can_message: conns.get(other) === 'connected',
      messages: ok(rows).reverse().map((r) => ({ id: r.id, mine: r.from_id === me, body: r.body, created: iso(r) })) };
  },
  async send_message(other, b) {
    const me = await uid();
    if (other === me) throw fail(400, "You can't message yourself");
    const { error } = await sb.from('setup_messages').insert({ from_id: me, to_id: other, body: clean(b.body, 2000, true, 'Message') });
    if (error) throw fail(403, 'Connect with this person first to send messages');
    return H.thread(other);
  },
};

// Example content is switched off: the network shows real members and official Set UP content only.
// Posts and groups are real (official Set UP content). Sample people, castings and meetups stay, clearly tagged, until real ones exist.
SAMPLE.posts = () => []; SAMPLE.communities = () => [];

const R = [
  ['GET', '/me', 'me'], ['POST', '/me', 'update_me'], ['POST', '/signup', 'signup'], ['POST', '/report', 'report'], ['POST', '/login', 'login'],
  ['POST', '/logout', 'logout'], ['POST', '/reset', 'reset'], ['POST', '/newpassword', 'newpassword'], ['POST', '/upload', 'upload'],
  ['GET', '/feed', 'feed'], ['POST', '/posts', 'create_post'], ['POST', '/posts/(\\d+)/delete', 'delete_post'],
  ['POST', '/posts/(\\d+)/like', 'like'], ['GET', '/posts/(\\d+)/comments', 'get_comments'], ['POST', '/posts/(\\d+)/comments', 'add_comment'],
  ['GET', '/people', 'people'], ['GET', '/mappeople', 'map_people'], ['POST', '/credits', 'add_credit'], ['POST', '/credits/(\\d+)/delete', 'delete_credit'], ['GET', `/users/(${UUID})`, 'profile'], ['POST', `/users/(${UUID})/follow`, 'follow'],
  ['POST', `/users/(${UUID})/connect`, 'connect_to'], ['POST', `/users/(${UUID})/accept`, 'accept'],
  ['POST', `/users/(${UUID})/decline`, 'decline'], ['POST', `/users/(${UUID})/disconnect`, 'disconnect'],
  ['GET', '/requests', 'requests'], ['GET', '/network', 'my_network'], ['GET', '/suggestions', 'suggestions'],
  ['GET', '/communities', 'communities'], ['POST', '/communities', 'create_community'], ['GET', '/communities/(\\d+)', 'community'],
  ['POST', '/communities/(\\d+)/join', 'join_community'], ['POST', '/communities/(\\d+)/delete', 'delete_community'],
  ['GET', '/rooms', 'rooms'], ['POST', '/rooms', 'create_room'], ['GET', '/rooms/(\\d+)', 'room'], ['POST', '/rooms/(\\d+)/invite', 'room_invite'],
  ['POST', '/rooms/(\\d+)/checkin', 'room_checkin'], ['POST', '/rooms/(\\d+)/leave', 'leave_room'], ['POST', '/rooms/(\\d+)/delete', 'delete_room'],
  ['GET', '/join/([0-9a-fA-F]{8,64})', 'room_preview'], ['POST', '/join/([0-9a-fA-F]{8,64})', 'join_room'],
  ['GET', '/projects', 'projects'], ['POST', '/projects', 'create_project'], ['GET', '/projects/(\\d+)', 'project'], ['POST', '/projects/(\\d+)/delete', 'delete_project'],
  ['POST', '/projects/(\\d+)/status', 'project_status'], ['POST', '/projects/(\\d+)/invite', 'crew_invite'], ['POST', '/projects/(\\d+)/respond', 'crew_respond'],
  ['POST', '/projects/(\\d+)/remove', 'crew_remove'], ['GET', '/invitations', 'my_invitations'],
  ['POST', '/applications/(\\d+)/stage', 'set_stage'], ['POST', '/availability', 'add_availability'], ['POST', '/availability/(\\d+)/delete', 'delete_availability'],
  ['GET', '/pro', 'pro_status'], ['POST', '/pro/activate', 'activate_pro'],
  ['GET', '/castings', 'castings'], ['POST', '/castings', 'create_casting'], ['GET', '/castings/(\\d+)', 'casting'],
  ['POST', '/castings/(\\d+)/apply', 'apply'], ['POST', '/castings/(\\d+)/delete', 'delete_casting'], ['GET', '/applications', 'my_applications'],
  ['GET', '/meetups', 'meetups'], ['POST', '/meetups', 'create_meetup'], ['POST', '/meetups/(\\d+)/rsvp', 'rsvp'], ['GET', '/meetups/(\\d+)', 'meetup'], ['POST', '/meetups/(\\d+)/checkin', 'meetup_checkin'],
  ['POST', '/meetups/(\\d+)/delete', 'delete_meetup'], ['GET', '/notifications', 'notifications'],
  ['POST', '/notifications/read', 'read_notifications'], ['GET', '/messages', 'conversations'],
  ['GET', `/messages/(${UUID})`, 'thread'], ['POST', `/messages/(${UUID})`, 'send_message'],
].map(([m, p, h]) => [m, new RegExp(`^${p}$`), h]);

window.api = async (path, body) => {
  const method = body === undefined ? 'GET' : 'POST';
  const [p, qs] = path.split('?');
  for (const [m, re, h] of R) {
    const match = re.exec(p);
    if (m === method && match) {
      const args = match.slice(1).map((g) => (/^\d+$/.test(g) && !/^(join_room|room_preview)$/.test(h) ? Number(g) : g));
      if (args.some(isSample) && (method === 'POST' || h === 'thread')) throw fail(400, SAMPLE_MSG);
      if (['feed', 'people', 'castings', 'meetups', 'communities', 'map_people', 'rooms', 'projects'].includes(h)) return H[h](new URLSearchParams(qs || ''));
      return args.length ? H[h](...args, body || {}) : H[h](undefined, body || {});
    }
  }
  throw fail(404, 'Not found');
};
// Password-recovery links land here: send the person to the "new password" form.
sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') location.hash = '#/new-password'; });
})();
