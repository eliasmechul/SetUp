(() => {
'use strict';
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
let S = { me: null, roles: [], categories: [] };
let pollTimer = null;
let ui = { feedScope: 'all', castCat: '', castQ: '', castCity: '', meetTab: 'upcoming', profTab: 'posts',
           pq: '', prole: '', pcity: '', commTab: 'discover', commTopic: '' };

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.4.6 4 2.2 4 5.2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  group: '<circle cx="12" cy="8" r="3"/><circle cx="5.5" cy="10" r="2.3"/><circle cx="18.5" cy="10" r="2.3"/><path d="M6.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M1.5 18c0-2 1.5-3.5 3.5-3.7M22.5 18c0-2-1.5-3.5-3.5-3.7"/>',
};
const ico = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString();
}
function when(str) {
  const d = new Date(str.length > 10 ? str : str + 'T12:00');
  return { mon: d.toLocaleString(undefined, { month: 'short' }), day: d.getDate(),
           text: str.length > 10 ? d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { weekday: 'long' }) };
}
function toast(msg) {
  $toast.textContent = msg; $toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => ($toast.hidden = true), 3200);
}
async function api(path, body) {
  try { return await window.api(path, body); } catch (e) {
    if (e.status === 401 && S.me) S.me = null;
    if (!e.status) { console.error(e); e.message = 'Something went wrong'; }
    throw e;
  }
}
const hue = (id) => [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
function av(u, cls = '') {
  if (u.avatar) return `<img class="av ${cls}" src="${esc(u.avatar)}" alt="">`;
  const ini = (u.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `<div class="av ${cls} c${hue(u.id)}" aria-hidden="true">${esc(ini)}</div>`;
}
const who = (u) => `<a class="who" href="#/profile/${u.id}"><div class="name">${esc(u.name)}</div><div class="sub">${esc(u.headline || u.role)}${u.city ? ' · ' + esc(u.city) : ''}</div></a>`;
const needLogin = () => { toast('Log in to do that'); location.hash = '#/login'; };

/* ---------- shell ---------- */
function navItems() {
  const m = S.me;
  return [
    ['#/', 'home', 'Feed'], ['#/people', 'users', 'People'], ['#/castings', 'brief', 'Castings'],
    ['#/communities', 'group', 'Communities'], ['#/meetups', 'cal', 'Meetups'], ['#/messages', 'chat', 'Messages', m && m.unread_messages],
    ['#/notifications', 'bell', 'Alerts', m && m.unread_notifications], [m ? '#/profile/' + m.id : '#/login', 'user', m ? 'Profile' : 'Log in'],
  ];
}
function active(href) {
  const h = location.hash || '#/';
  if (href === '#/') return h === '#/' || h === '';
  return h.startsWith(href.split('/').slice(0, 2).join('/')) && !(href.startsWith('#/profile') && h !== href);
}
let wide = false;
function shell(content) {
  const m = S.me;
  const badge = (n) => (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');
  const side = navItems().map(([h, i, l, n]) => `<a class="nav ${active(h) ? 'on' : ''}" href="${h}">${ico(i)}${l}${badge(n)}</a>`).join('');
  const bar = [['#/', 'home', 'Feed'], ['#/castings', 'brief', 'Castings'], null, ['#/meetups', 'cal', 'Meetups'], [m ? '#/profile/' + m.id : '#/login', 'user', m ? 'Profile' : 'Log in']]
    .map((t) => t ? `<a class="tab ${active(t[0]) ? 'on' : ''}" href="${t[0]}">${ico(t[1])}${t[2]}</a>`
      : `<button class="plus" data-act="compose" aria-label="Create">${ico('plus')}</button>`).join('');
  $app.innerHTML = `
  <div class="shell">
    <aside class="side" aria-label="Main">
      <a class="wordmark" href="#/"><img src="logo.png" alt=""><span class="set">Set</span><span class="up">UP</span></a>
      ${side}
      <button class="btn create" data-act="compose">${ico('plus')} Create</button>
      ${m ? `<button class="btn ghost logout" data-act="logout">Log out</button>` : ''}
    </aside>
    <div class="col">
      <header class="topbar">
        <a class="wordmark" href="#/"><img src="logo.png" alt=""><span class="set">Set</span><span class="up">UP</span></a>
        <div class="mobile-only">
          <a class="iconbtn" href="#/communities" aria-label="Communities">${ico('group')}</a>
          <a class="iconbtn" href="#/people" aria-label="Find people">${ico('search')}</a>
          <a class="iconbtn" href="#/notifications" aria-label="Notifications">${ico('bell')}${badge(m && m.unread_notifications)}</a>
          <a class="iconbtn" href="#/messages" aria-label="Messages">${ico('chat')}${badge(m && m.unread_messages)}</a>
        </div>
      </header>
      <main class="main ${wide ? 'wide' : ''}" id="view">${content}</main>
    </div>
    <nav class="tabbar" aria-label="Main">${bar}</nav>
  </div>`;
}
function view(html, isWide) { wide = !!isWide; shell(html); window.scrollTo(0, 0); }
function setView(html) { const v = document.getElementById('view'); if (v) v.innerHTML = html; }

/* ---------- components ---------- */
function postCard(p) {
  const mine = S.me && S.me.id === p.user.id;
  return `<article class="card" data-post="${p.id}">
    <div class="post-head"><a href="#/profile/${p.user.id}">${av(p.user)}</a>${who(p.user)}<span class="sub">${ago(p.created)}</span></div>
    ${p.community ? `<p><a class="pill" href="#/communities/${p.community.id}">in ${esc(p.community.name)}</a></p>` : ''}
    ${p.body ? `<p class="post-body">${esc(p.body)}</p>` : ''}
    ${p.image ? `<img class="post-img" src="${esc(p.image)}" alt="Photo shared by ${esc(p.user.name)}" loading="lazy">` : ''}
    <div class="actions">
      <button class="act ${p.liked ? 'liked' : ''}" data-act="like" data-id="${p.id}" aria-label="Like" aria-pressed="${p.liked}">${ico('heart')}<span>${p.likes}</span></button>
      <button class="act" data-act="comments" data-id="${p.id}" aria-label="Comments">${ico('chat')}<span>${p.comments}</span></button>
      ${mine ? `<button class="act" data-act="delpost" data-id="${p.id}">Delete</button>` : ''}
    </div>
    <div class="comments" hidden></div>
  </article>`;
}
const meetMini = (m) => { const w = when(m.starts); return `<div class="mini"><div class="date"><span>${esc(w.mon)}</span><b>${w.day}</b></div><div><div class="name">${esc(m.title)}</div><div class="sub">${esc(w.text)}${m.venue ? ' · ' + esc(m.venue) : ''}</div></div></div>`; };
const railPerson = (u) => `<div class="person rp"><a href="#/profile/${u.id}">${av(u)}</a>${who(u)}${connBtn(u.id, 'none', true)}</div>`;
const commCard = (c) => `<div class="card"><div class="event"><div class="date"><span>${esc(c.topic.slice(0, 5))}</span><b>${c.members}</b></div>
  <div class="info"><a href="#/communities/${c.id}"><h3>${esc(c.name)}</h3></a><div class="sub">${esc(c.topic)}${c.city ? ' · ' + esc(c.city) : ''} · ${c.members} member${c.members === 1 ? '' : 's'}</div>
  ${c.description ? `<div class="sub">${esc(c.description)}</div>` : ''}</div>
  <button class="btn sm ${c.joined ? 'ghost' : ''}" data-act="joincomm" data-id="${c.id}">${c.joined ? 'Joined ✓' : 'Join'}</button></div></div>`;
function castCard(c) {
  const status = c.applied ? '<span class="pill ok">Applied</span>' : '';
  return `<a class="cast" href="#/castings/${c.id}"><div class="in">
    <span class="kicker">${esc(c.category)} casting</span><h3>${esc(c.title)}</h3>
    <div class="meta">${c.production ? `<span>${esc(c.production)}</span>` : ''}${c.city ? `<span>${esc(c.city)}</span>` : ''}${c.pay ? `<span>${esc(c.pay)}</span>` : ''}${c.deadline ? `<span>Closes ${esc(when(c.deadline).text)}</span>` : ''}</div>
    <div class="meta"><span>Posted ${ago(c.created)} by ${esc(c.poster)}</span>${c.applicants !== undefined ? `<span>${c.applicants} applied</span>` : ''}${status}</div>
  </div></a>`;
}
function personCard(u, state) {
  return `<div class="card person">${`<a href="#/profile/${u.id}">${av(u)}</a>`}${who(u)}${connBtn(u.id, state || u.state, true)}</div>`;
}
function connBtn(id, state, small) {
  const sm = small ? 'sm' : '';
  if (state === 'self') return '';
  if (state === 'connected') return `<a class="btn ghost ${sm}" href="#/messages/${id}">Message</a>`;
  if (state === 'sent') return `<button class="btn ghost ${sm}" disabled>Requested</button>`;
  if (state === 'received') return `<button class="btn ${sm}" data-act="connect" data-id="${id}">Accept</button>`;
  return `<button class="btn ${sm}" data-act="connect" data-id="${id}">Connect</button>`;
}

/* ---------- views ---------- */
const routes = [];
const route = (re, fn) => routes.push([re, fn]);

route(/^#?\/?$/, async () => {
  const m = S.me;
  const [feed, mt, cm] = await Promise.all([api('/feed?scope=' + (m ? ui.feedScope : 'all')),
    api('/meetups').catch(() => ({ meetups: [] })), api('/communities').catch(() => ({ communities: [] }))]);
  let sug = [];
  if (m) { try { sug = (await api('/suggestions')).people; } catch (e) { /* ignore */ } }
  const toJoin = cm.communities.filter((c) => !c.joined).slice(0, 3);
  const rail = `<aside class="rail" aria-label="Suggestions">
    ${sug.length ? `<div class="card"><h2 class="rail-title">People you may know</h2>${sug.slice(0, 4).map(railPerson).join('')}</div>` : ''}
    <div class="card"><h2 class="rail-title">Communities</h2>${toJoin.map((c) => `<div class="mini"><div class="who"><a href="#/communities/${c.id}" class="name">${esc(c.name)}</a><div class="sub">${c.members} member${c.members === 1 ? '' : 's'} · ${esc(c.topic)}</div></div><button class="btn ghost sm" data-act="joincomm" data-id="${c.id}">Join</button></div>`).join('') || '<p class="muted">No communities to join yet.</p>'}<a class="link" href="#/communities">All communities →</a></div>
    <div class="card"><h2 class="rail-title">Upcoming meetups</h2>${mt.meetups.slice(0, 3).map(meetMini).join('') || '<p class="muted">No meetups yet.</p>'}<a class="link" href="#/meetups">All meetups →</a></div></aside>`;
  view(`<div class="feedgrid"><div class="feedcol">
    ${m ? '' : `<section class="hero2"><p class="rec"><span class="recdot"></span>REC · THE NETWORK FOR FILM PEOPLE</p>
      <h1>Frame your<br><i>next set.</i></h1><div class="rule"></div>
      <p class="lead">Show your work, answer castings, host meetups and connect with the people who make films.</p>
      <div class="btns"><a class="btn" href="#/signup">Create your profile</a><a class="btn ghost" href="#/castings">Browse castings</a></div></section>`}
    ${m ? `<div class="seg"><button class="${ui.feedScope === 'all' ? 'on' : ''}" data-act="scope" data-v="all">Everyone</button><button class="${ui.feedScope === 'network' ? 'on' : ''}" data-act="scope" data-v="network">My network</button></div>
      <button class="card flat person" data-act="compose">${av(m)}<span class="muted">What's on your set today?</span></button>` : ''}
    ${sug.length ? `<div class="inline-sug"><h2 class="section-title">People you may know</h2>${sug.slice(0, 3).map((u) => personCard(u, 'none')).join('')}<h2 class="section-title">Latest</h2></div>` : ''}
    ${feed.posts.length ? feed.posts.map(postCard).join('') : `<div class="empty">${ui.feedScope === 'network' ? 'Nothing from your network yet. Connect with people in <a class="link" href="#/people">People</a>.' : 'No posts yet. Be the first!'}</div>`}
  </div>${rail}</div>`, true);
});

route(/^#\/communities$/, async () => {
  const qs = new URLSearchParams({ topic: ui.commTopic });
  if (ui.commTab === 'mine' && S.me) qs.set('mine', '1');
  const { communities } = await api('/communities?' + qs);
  const topics = ['', 'General', 'Acting', 'Directing', 'Producing', 'Cinematography', 'Editing', 'Sound', 'Writing', 'Crew', 'Students', 'Local'];
  view(`<h1 class="page-title">Communities</h1>
    <div class="seg"><button class="${ui.commTab === 'discover' ? 'on' : ''}" data-act="commtab" data-v="discover">Discover</button>${S.me ? `<button class="${ui.commTab === 'mine' ? 'on' : ''}" data-act="commtab" data-v="mine">My communities</button>` : ''}</div>
    <div class="chips">${topics.map((t) => `<button class="chip ${ui.commTopic === t ? 'on' : ''}" data-act="commtopic" data-v="${t}">${t || 'All'}</button>`).join('')}</div>
    ${S.me ? '<p><button class="link" data-act="compose" data-v="community">+ Start a community</button></p>' : ''}
    ${communities.length ? communities.map(commCard).join('') : '<div class="empty">No communities here yet. Start the first one!</div>'}`);
});

route(/^#\/communities\/(\d+)$/, async (id) => {
  const c = await api('/communities/' + id);
  const mine = S.me && S.me.id === c.owner_id;
  view(`<p><a class="link" href="#/communities">${ico('back')} Communities</a></p>
    <div class="card"><span class="kicker">${esc(c.topic)}${c.city ? ' · ' + esc(c.city) : ''}</span>
      <h1 class="page-title">${esc(c.name)}</h1>
      ${c.description ? `<p class="post-body">${esc(c.description)}</p>` : ''}
      <div class="meta"><span>${c.members} member${c.members === 1 ? '' : 's'}</span></div>
      <div class="skills" style="margin:12px 0">${c.people.map((u) => `<a href="#/profile/${u.id}" title="${esc(u.name)}">${av(u)}</a>`).join('')}</div>
      <div class="pro-actions">${mine ? `<button class="btn danger sm" data-act="delcomm" data-id="${c.id}">Delete community</button>` : `<button class="btn ${c.joined ? 'ghost' : ''}" data-act="joincomm" data-id="${c.id}">${c.joined ? 'Joined ✓ (tap to leave)' : 'Join community'}</button>`}
      ${c.joined || mine ? `<button class="btn" data-act="compose" data-v="post" data-cid="${c.id}">Post in community</button>` : ''}</div></div>
    <h2 class="section-title">Discussion</h2>
    ${c.posts.length ? c.posts.map(postCard).join('') : `<div class="empty">No posts yet.${c.joined ? ' Start the conversation!' : ' Join to start the conversation.'}</div>`}`);
});

route(/^#\/castings$/, async () => {
  const qs = new URLSearchParams({ category: ui.castCat, q: ui.castQ, city: ui.castCity });
  const { castings } = await api('/castings?' + qs);
  const cats = ['', ...S.categories];
  view(`<h1 class="page-title">Castings</h1>
    <form data-form="castfilter" class="row"><div class="field"><label class="sr" for="cq">Search</label><input id="cq" name="q" placeholder="Search roles, crew, productions" value="${esc(ui.castQ)}"></div>
    <div class="field"><label class="sr" for="cc">City</label><input id="cc" name="city" placeholder="City" value="${esc(ui.castCity)}"></div><button class="sr" type="submit">Search</button></form>
    <div class="chips">${cats.map((c) => `<button class="chip ${ui.castCat === c ? 'on' : ''}" data-act="castcat" data-v="${esc(c)}">${c || 'All'}</button>`).join('')}</div>
    ${S.me ? `<div class="row" style="margin-bottom:12px"></div>` : ''}
    ${S.me ? `<p><button class="link" data-act="compose" data-v="casting">+ Post a casting call</button> · <a class="link" href="#/applications">My applications</a></p>` : ''}
    ${castings.length ? castings.map(castCard).join('') : '<div class="empty">No castings match. Try another filter.</div>'}`);
});

route(/^#\/applications$/, async () => {
  if (!S.me) return needLogin();
  const { castings } = await api('/applications');
  view(`<h1 class="page-title">My applications</h1>${castings.length ? castings.map(castCard).join('') : '<div class="empty">You haven\'t applied to anything yet.</div>'}`);
});

route(/^#\/castings\/(\d+)$/, async (id) => {
  const c = await api('/castings/' + id);
  const mine = S.me && S.me.id === c.user_id;
  let body = '';
  if (mine) {
    const apps = c.applications || [];
    body = `<h2 class="section-title">${apps.length} applicant${apps.length === 1 ? '' : 's'}</h2>` +
      (apps.map((a) => `<div class="card"><div class="person"><a href="#/profile/${a.id}">${av(a)}</a>${who(a)}<a class="btn ghost sm" href="#/messages/${a.id}">Message</a></div>${a.message ? `<p class="post-body" style="margin-top:10px">${esc(a.message)}</p>` : ''}<div class="sub">Applied ${ago(a.applied_at)}</div></div>`).join('') || '<div class="empty">No applications yet.</div>') +
      `<button class="btn danger block" data-act="delcast" data-id="${c.id}">Delete this casting</button>`;
  } else if (c.applied) {
    body = '<div class="card"><span class="pill ok">Applied</span> <span class="muted">The poster has your profile and message.</span></div>';
  } else if (S.me) {
    body = `<form class="card" data-form="apply" data-id="${c.id}"><h2 class="section-title" style="margin-top:0">Apply</h2>` +
      `<p class="muted">Your Set UP profile is sent with your application.</p>
      <div class="field"><label for="am">Message (optional)</label><textarea id="am" name="message" maxlength="1500" placeholder="Why you're a fit, links to your reel…"></textarea></div>
      <p class="err" role="alert"></p><button class="btn block" type="submit">Send application</button></form>`;
  } else {
    body = '<div class="card"><a class="btn block" href="#/login">Log in to apply</a></div>';
  }
  view(`<p><a class="link" href="#/castings">${ico('back')} Castings</a></p>
    <div class="card"><span class="kicker">${esc(c.category)} casting</span><h1 class="page-title" style="margin:6px 0 8px;font-size:24px">${esc(c.title)}</h1>` +
    `<div class="meta">${c.production ? `<span>${esc(c.production)}</span>` : ''}${c.city ? `<span>${esc(c.city)}</span>` : ''}${c.pay ? `<span>${esc(c.pay)}</span>` : ''}${c.deadline ? `<span>Closes ${esc(when(c.deadline).text)}</span>` : ''}</div>
    ${c.description ? `<p class="post-body" style="margin-top:14px">${esc(c.description)}</p>` : ''}
    <div class="sub">Posted ${ago(c.created)} by <a class="link" href="#/profile/${c.user_id}">${esc(c.poster)}</a></div></div>${body}`);
});

route(/^#\/meetups$/, async () => {
  const { meetups } = await api('/meetups' + (ui.meetTab === 'mine' ? '?mine=1' : ''));
  view(`<h1 class="page-title">Meetups</h1>
    <div class="seg"><button class="${ui.meetTab === 'upcoming' ? 'on' : ''}" data-act="meettab" data-v="upcoming">Upcoming</button><button class="${ui.meetTab === 'mine' ? 'on' : ''}" data-act="meettab" data-v="mine">Going / Hosting</button></div>
    ${S.me ? '<p><button class="link" data-act="compose" data-v="meetup">+ Host a meetup</button></p>' : ''}
    ${meetups.length ? meetups.map((m) => { const w = when(m.starts); const mine = S.me && S.me.id === m.host_id; return `<div class="card"><div class="event">
      <div class="date"><span>${esc(w.mon)}</span><b>${w.day}</b></div>
      <div class="info"><h3>${esc(m.title)}</h3><div class="sub">${esc(w.text)}${m.venue ? ' · ' + esc(m.venue) : ''}${m.city ? ', ' + esc(m.city) : ''}</div>
      <div class="sub">${m.going} going · Hosted by <a class="link" href="#/profile/${m.host_id}">${esc(m.host)}</a></div></div>
      <button class="btn sm ${m.joined ? 'ghost' : ''}" data-act="rsvp" data-id="${m.id}">${m.joined ? 'Going ✓' : 'Join'}</button></div>
      ${m.description ? `<p class="post-body" style="margin:10px 0 0">${esc(m.description)}</p>` : ''}
      ${mine ? `<button class="link" data-act="delmeet" data-id="${m.id}">Delete meetup</button>` : ''}</div>`; }).join('')
      : '<div class="empty">No meetups yet. Host the first one!</div>'}`);
});

route(/^#\/people$/, async () => {
  const qs = new URLSearchParams({ q: ui.pq, role: ui.prole, city: ui.pcity });
  const { people } = await api('/people?' + qs);
  view(`<h1 class="page-title">People</h1>
    <form data-form="pfilter"><div class="field"><label class="sr" for="pq">Search</label><input id="pq" name="q" placeholder="Search name, craft, skill" value="${esc(ui.pq)}"></div>
    <div class="row"><div class="field"><label class="sr" for="pr">Role</label><select id="pr" name="role"><option value="">Any role</option>${S.roles.map((r) => `<option ${ui.prole === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    <div class="field"><label class="sr" for="pc">City</label><input id="pc" name="city" placeholder="Any city" value="${esc(ui.pcity)}"></div></div>
    <button class="btn block" type="submit">Search</button></form>
    <h2 class="section-title">${people.length} found</h2>
    ${people.map((u) => personCard(u)).join('') || '<div class="empty">No one matches yet.</div>'}`);
});

route(/^#\/profile\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, async (id) => {
  const u = await api('/users/' + id);
  const self = S.me && S.me.id === u.id;
  let tab = '';
  if (ui.profTab === 'posts') tab = u.posts.map(postCard).join('') || '<div class="empty">No posts yet.</div>';
  else if (ui.profTab === 'castings') tab = u.castings.map(castCard).join('') || '<div class="empty">No castings posted.</div>';
  else tab = `<div class="card"><p class="post-body">${esc(u.bio) || '<span class="muted">No bio yet.</span>'}</p>
    ${u.skills ? `<h2 class="section-title">Skills</h2><div class="skills">${u.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => `<span class="pill">${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="sub" style="margin-top:14px">Member since ${new Date(u.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div></div>`;
  view(`<div class="cover"></div><div class="pro-top"><span class="ring">${av(u, 'lg')}</span>
    <h1 style="font-size:22px;margin-top:8px">${esc(u.name)}</h1><div>${esc(u.headline || u.role)}</div><div class="muted">${esc(u.role)}${u.city ? ' · ' + esc(u.city) : ''}</div></div>
    <div class="stats"><div><b>${u.connections}</b><span>Connections</span></div><div><b>${u.followers}</b><span>Followers</span></div></div>
    <div class="pro-actions">${self ? '<a class="btn ghost" href="#/me/edit">Edit profile</a><button class="btn ghost" data-act="logout">Log out</button>' :
      `${connBtn(u.id, u.state)}<button class="btn ghost" data-act="follow" data-id="${u.id}">${u.following ? 'Following' : 'Follow'}</button>${u.state === 'connected' ? `<button class="btn danger sm" data-act="disconnect" data-id="${u.id}">Remove</button>` : ''}`}</div>
    <div class="tabs"><button class="${ui.profTab === 'posts' ? 'on' : ''}" data-act="proftab" data-v="posts">Posts</button><button class="${ui.profTab === 'castings' ? 'on' : ''}" data-act="proftab" data-v="castings">Castings</button><button class="${ui.profTab === 'about' ? 'on' : ''}" data-act="proftab" data-v="about">About</button></div>${tab}`
    );
});

route(/^#\/me\/edit$/, async () => {
  if (!S.me) return needLogin();
  const m = S.me;
  view(`<h1 class="page-title">Edit profile</h1><form class="card" data-form="profile">
    <div class="person" style="margin-bottom:14px">${av(m, 'md')}<label class="btn ghost sm">Change photo<input class="sr" type="file" accept="image/*" data-file="avatar"></label><input type="hidden" name="avatar" value="${esc(m.avatar)}"></div>
    <div class="field"><label for="n">Name</label><input id="n" name="name" required maxlength="80" value="${esc(m.name)}"></div>
    <div class="field"><label for="r">Role</label><select id="r" name="role">${S.roles.map((r) => `<option ${m.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    <div class="field"><label for="h">Headline</label><input id="h" name="headline" maxlength="120" value="${esc(m.headline)}" placeholder="e.g. Cinematographer · documentary"></div>
    <div class="field"><label for="c">City</label><input id="c" name="city" maxlength="80" value="${esc(m.city)}"></div>
    <div class="field"><label for="b">Bio</label><textarea id="b" name="bio" maxlength="1500">${esc(m.bio)}</textarea></div>
    <div class="field"><label for="s">Skills (comma separated)</label><input id="s" name="skills" maxlength="300" value="${esc(m.skills)}"></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Save</button></form>`);
});

route(/^#\/notifications$/, async () => {
  if (!S.me) return needLogin();
  const [{ notifications }, { requests }] = await Promise.all([api('/notifications'), api('/requests')]);
  const text = (n) => ({
    like: 'liked your post', comment: 'commented on your post', follow: 'started following you',
    connect_request: 'wants to connect', connect_accept: 'accepted your connection',
    application: `applied to “${esc(n.label)}”`, rsvp: `is going to “${esc(n.label)}”`,
  }[n.kind] || 'did something');
  const link = (n) => (n.kind === 'application' ? `#/castings/${n.ref}` : n.kind === 'rsvp' ? '#/meetups' : `#/profile/${n.actor.id}`);
  view(`<h1 class="page-title">Alerts</h1>
    ${requests.length ? `<h2 class="section-title">Connection requests</h2>${requests.map((u) => `<div class="card person"><a href="#/profile/${u.id}">${av(u)}</a>${who(u)}<button class="btn sm" data-act="accept" data-id="${u.id}">Accept</button><button class="btn ghost sm" data-act="decline" data-id="${u.id}">Ignore</button></div>`).join('')}<h2 class="section-title">Activity</h2>` : ''}
    ${notifications.length ? notifications.map((n) => `<a class="card person" href="${link(n)}">${av(n.actor)}<div class="who"><div><b>${esc(n.actor.name)}</b> ${text(n)}</div><div class="sub">${ago(n.created)}</div></div>${n.read ? '' : '<span class="dot" aria-label="New"></span>'}</a>`).join('') : '<div class="empty">Nothing yet. Post something or apply to a casting.</div>'}`);
  api('/notifications/read', {}).then(refreshMe);
});

route(/^#\/messages$/, async () => {
  if (!S.me) return needLogin();
  const [{ conversations }, { connections }] = await Promise.all([api('/messages'), api('/network')]);
  const talking = new Set(conversations.map((c) => c.user.id));
  const fresh = connections.filter((u) => !talking.has(u.id));
  view(`<h1 class="page-title">Messages</h1>
    ${conversations.map((c) => `<a class="card person" href="#/messages/${c.user.id}">${av(c.user)}<div class="who"><div class="name">${esc(c.user.name)}</div><div class="sub">${c.mine ? 'You: ' : ''}${esc(c.last)}</div></div><span class="sub">${ago(c.created)}</span>${c.unread ? `<span class="badge" style="position:static">${c.unread}</span>` : ''}</a>`).join('') || '<div class="empty">No conversations yet.</div>'}
    ${fresh.length ? `<h2 class="section-title">Start a chat</h2>${fresh.map((u) => `<a class="card person" href="#/messages/${u.id}">${av(u)}${who(u)}</a>`).join('')}` : ''}
    <p class="muted">You can message anyone you're connected with. Find people in <a class="link" href="#/people">People</a>.</p>`);
});

route(/^#\/messages\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, async (id) => {
  if (!S.me) return needLogin();
  const draw = async (first) => {
    const t = await api('/messages/' + id);
    const html = `<p><a class="link" href="#/messages">${ico('back')} Messages</a></p>
      <div class="person card">${av(t.user)}${who(t.user)}</div>
      <div class="thread" id="thread">${t.messages.map((m) => `<div class="msg ${m.mine ? 'mine' : ''}">${esc(m.body)}</div>`).join('') || '<div class="empty">Say hi 👋</div>'}</div>
      ${t.can_message ? `<form class="msgform" data-form="msg" data-id="${id}"><label class="sr" for="mb">Message</label><input id="mb" name="body" autocomplete="off" maxlength="2000" placeholder="Write a message…" required><button class="btn" type="submit">Send</button></form>`
        : `<div class="card"><p class="muted">Connect with ${esc(t.user.name)} to send messages.</p>${connBtn(t.user.id, 'none')}</div>`}`;
    if (first) view(html);
    else if (document.getElementById('thread') && document.getElementById('thread').children.length !== t.messages.length) {
      const input = document.getElementById('mb'); const val = input ? input.value : '';
      setView(html); const i2 = document.getElementById('mb'); if (i2) { i2.value = val; i2.focus(); }
    }
    window.scrollTo(0, document.body.scrollHeight);
  };
  await draw(true);
  pollTimer = setInterval(() => { if (location.hash === '#/messages/' + id) draw(false).catch(() => {}); }, 5000);
});

route(/^#\/reset$/, async () => {
  view(`<div class="auth"><div class="hero"><img src="logo.png" alt="Set UP logo"><p>Reset your password</p></div>
    <form data-form="reset"><div class="field"><label for="e">Email</label><input id="e" name="email" type="email" required autocomplete="email"></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Send reset link</button></form>
    <p style="text-align:center"><a class="link" href="#/login">Back to log in</a></p></div>`);
});

route(/^#\/new-password$/, async () => {
  view(`<div class="auth"><div class="hero"><img src="logo.png" alt="Set UP logo"><p>Choose a new password</p></div>
    <form data-form="newpassword"><div class="field"><label for="p">New password (8+ characters)</label><input id="p" name="password" type="password" required minlength="8" autocomplete="new-password"></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Save password</button></form></div>`);
});

route(/^#\/(login|signup)$/, async (mode) => {
  if (S.me) { location.hash = '#/'; return; }
  const signup = mode === 'signup';
  view(`<div class="auth"><div class="hero"><img src="logo.png" alt="Set UP logo"><div><span class="big">Set<span class="up">UP</span></span></div><p>${signup ? 'Create your free profile' : 'Welcome back'}</p></div>
    <form data-form="${mode}">
    ${signup ? `<div class="field"><label for="n">Full name</label><input id="n" name="name" required maxlength="80" autocomplete="name"></div>` : ''}
    <div class="field"><label for="e">Email</label><input id="e" name="email" type="email" required autocomplete="email"></div>
    <div class="field"><label for="p">Password${signup ? ' (8+ characters)' : ''}</label><input id="p" name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}"></div>
    ${signup ? `<div class="row"><div class="field"><label for="r">I am a…</label><select id="r" name="role">${S.roles.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
    <div class="field"><label for="c">City</label><input id="c" name="city" maxlength="80" autocomplete="address-level2"></div></div>` : ''}
    <p class="err" role="alert"></p><button class="btn block" type="submit">${signup ? 'Create account' : 'Log in'}</button></form>
    ${signup ? '' : '<p style="text-align:center"><a class="link" href="#/reset">Forgot password?</a></p>'}<p class="muted" style="text-align:center">${signup ? 'Already on Set UP? <a class="link" href="#/login">Log in</a>' : 'New here? <a class="link" href="#/signup">Join Set UP</a>'}</p></div>`);
});

/* ---------- composer ---------- */
function composer(kind = 'post', cid = '') {
  if (!S.me) return needLogin();
  const t = (k, label, icon) => `<button type="button" class="${kind === k ? 'on' : ''}" data-act="compose" data-v="${k}" data-cid="${cid}">${ico(icon)}${label}</button>`;
  let form = '';
  if (kind === 'post') form = `<form data-form="post"><div class="field"><label class="sr" for="pb">Post</label><textarea id="pb" name="body" maxlength="3000" placeholder="Share an update, a still, a question…"></textarea></div>
    <img class="preview" id="pv" alt="" hidden><input type="hidden" name="image"><input type="hidden" name="community_id" value="${esc(cid)}">${cid ? '<p class="muted">Posting inside this community.</p>' : ''}
    <label class="btn ghost sm">${ico('img')} Add photo<input class="sr" type="file" accept="image/*" data-file="post"></label>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Publish</button></form>`;
  if (kind === 'casting') form = `<form data-form="casting">
    <div class="field"><label for="t">Role or position</label><input id="t" name="title" required maxlength="120" placeholder="e.g. Junior actor · Lead role"></div>
    <div class="row"><div class="field"><label for="k">Category</label><select id="k" name="category">${S.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="field"><label for="pay">Pay</label><input id="pay" name="pay" maxlength="80" placeholder="Paid, unpaid, day rate…"></div></div>
    <div class="field"><label for="pr">Production</label><input id="pr" name="production" maxlength="120" placeholder="Film or project name"></div>
    <div class="row"><div class="field"><label for="lc">Location</label><input id="lc" name="city" maxlength="80"></div>
    <div class="field"><label for="dl">Deadline</label><input id="dl" name="deadline" type="date"></div></div>
    <div class="field"><label for="ds">Description</label><textarea id="ds" name="description" maxlength="4000"></textarea></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Publish casting</button></form>`;
  if (kind === 'meetup') form = `<form data-form="meetup">
    <div class="field"><label for="t">Title</label><input id="t" name="title" required maxlength="120" placeholder="e.g. Short Film Night"></div>
    <div class="row"><div class="field"><label for="d">Date & time</label><input id="d" name="starts" type="datetime-local" required></div>
    <div class="field"><label for="c">City</label><input id="c" name="city" maxlength="80"></div></div>
    <div class="field"><label for="v">Venue</label><input id="v" name="venue" maxlength="120"></div>
    <div class="field"><label for="ds">Description</label><textarea id="ds" name="description" maxlength="2000"></textarea></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Create meetup</button></form>`;
  if (kind === 'community') form = `<form data-form="community">
    <div class="field"><label for="cn">Community name</label><input id="cn" name="name" required maxlength="80" placeholder="e.g. Berlin Indie Filmmakers"></div>
    <div class="row"><div class="field"><label for="ct">Topic</label><select id="ct" name="topic">${['General', 'Acting', 'Directing', 'Producing', 'Cinematography', 'Editing', 'Sound', 'Writing', 'Crew', 'Students', 'Local'].map((c) => `<option>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="cc2">City (optional)</label><input id="cc2" name="city" maxlength="80"></div></div>
    <div class="field"><label for="cd">What is it about?</label><textarea id="cd" name="description" maxlength="1000"></textarea></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Create community</button></form>`;
  $modal.hidden = false;
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Create"><div class="sheet-head"><h2>Create</h2><button class="iconbtn" data-act="close" aria-label="Close">${ico('x')}</button></div>
    <div class="types">${t('post', 'Post', 'img')}${t('casting', 'Casting', 'brief')}${t('meetup', 'Meetup', 'cal')}${t('community', 'Community', 'group')}</div>${form}</div>`;
  const first = $modal.querySelector('textarea, input'); if (first) first.focus();
}
const closeModal = () => { $modal.hidden = true; $modal.innerHTML = ''; };

/* ---------- events ---------- */
async function guard(fn) {
  try { await fn(); } catch (e) { if (e.status === 401) needLogin(); else toast(e.message); }
}
const rerender = () => router();

document.addEventListener('click', (ev) => {
  if (ev.target === $modal) return closeModal();
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
  guard(async () => {
    switch (act) {
      case 'compose': return composer(v || 'post', el.dataset.cid || '');
      case 'close': return closeModal();
      case 'logout': await api('/logout', {}); S.me = null; location.hash = '#/'; return router();
      case 'scope': ui.feedScope = v; return rerender();
      case 'castcat': ui.castCat = v; return rerender();
      case 'meettab': ui.meetTab = v; return rerender();
      case 'proftab': ui.profTab = v; return rerender();
      case 'like': {
        const r = await api(`/posts/${id}/like`, {});
        el.classList.toggle('liked', r.liked); el.setAttribute('aria-pressed', r.liked); el.querySelector('span').textContent = r.likes; return;
      }
      case 'comments': {
        const box = el.closest('article').querySelector('.comments');
        if (!box.hidden) { box.hidden = true; return; }
        const { comments } = await api(`/posts/${id}/comments`); drawComments(box, id, comments); box.hidden = false; return;
      }
      case 'delpost': if (confirm('Delete this post?')) { await api(`/posts/${id}/delete`, {}); rerender(); } return;
      case 'connect': { await api(`/users/${id}/connect`, {}); toast('Done'); await refreshMe(); return rerender(); }
      case 'accept': await api(`/users/${id}/accept`, {}); toast('Connected'); return rerender();
      case 'decline': await api(`/users/${id}/decline`, {}); return rerender();
      case 'disconnect': if (confirm('Remove this connection?')) { await api(`/users/${id}/disconnect`, {}); rerender(); } return;
      case 'follow': await api(`/users/${id}/follow`, {}); return rerender();
      case 'rsvp': await api(`/meetups/${id}/rsvp`, {}); return rerender();
      case 'delmeet': if (confirm('Delete this meetup?')) { await api(`/meetups/${id}/delete`, {}); rerender(); } return;
      case 'joincomm': await api(`/communities/${id}/join`, {}); return rerender();
      case 'commtab': ui.commTab = v; return rerender();
      case 'commtopic': ui.commTopic = v; return rerender();
      case 'delcomm': if (confirm('Delete this community and its posts?')) { await api(`/communities/${id}/delete`, {}); location.hash = '#/communities'; } return;
      case 'delcast': if (confirm('Delete this casting?')) { await api(`/castings/${id}/delete`, {}); location.hash = '#/castings'; } return;
    }
  });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$modal.hidden) closeModal(); });

function drawComments(box, id, comments) {
  box.innerHTML = comments.map((c) => `<div class="comment">${av(c.user)}<div class="bubble"><b>${esc(c.user.name)}</b> ${esc(c.body)}</div></div>`).join('') +
    (S.me ? `<form class="cform" data-form="comment" data-id="${id}"><label class="sr" for="cm${id}">Comment</label><input id="cm${id}" name="body" maxlength="1000" placeholder="Add a comment…" required><button class="btn sm" type="submit">Post</button></form>` : '<p class="muted"><a class="link" href="#/login">Log in</a> to comment.</p>');
}

function readImage(file) {
  return new Promise((res, rej) => {
    if (!file || !file.type.startsWith('image/')) return rej(new Error('Choose an image'));
    if (file.size > 5 * 1024 * 1024) return rej(new Error('Image too large (max 5 MB)'));
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read file')); r.readAsDataURL(file);
  });
}
document.addEventListener('change', (ev) => {
  const inp = ev.target.closest('[data-file]'); if (!inp) return;
  guard(async () => {
    const { url } = await api('/upload', { data: await readImage(inp.files[0]) });
    const form = inp.closest('form'); form.elements.image ? (form.elements.image.value = url) : (form.elements.avatar.value = url);
    const pv = document.getElementById('pv'); if (pv) { pv.src = url; pv.hidden = false; }
    toast('Photo added');
  });
});

document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  const kind = f.dataset.form, id = f.dataset.id;
  const data = Object.fromEntries(new FormData(f).entries());
  const err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]');
  if (err) err.textContent = '';
  if (btn) btn.disabled = true;
  (async () => {
    try {
      switch (kind) {
        case 'login': case 'signup': {
          const r = await api('/' + kind, data);
          if (r.confirm) { f.innerHTML = '<p class="card">Almost there! We sent a confirmation link to your email. Open it, then come back and log in.</p>'; return; }
          await refreshMe(); location.hash = '#/'; return router();
        }
        case 'reset': await api('/reset', data); f.innerHTML = '<p class="card">If that email has an account, a reset link is on its way.</p>'; return;
        case 'newpassword': await api('/newpassword', data); await refreshMe(); toast('Password updated'); location.hash = '#/'; return;
        case 'post': await api('/posts', data); closeModal(); toast('Posted'); if (data.community_id) return router(); location.hash = '#/'; return router();
        case 'community': { const r = await api('/communities', data); closeModal(); location.hash = '#/communities/' + r.id; return; }
        case 'casting': { const r = await api('/castings', data); closeModal(); location.hash = '#/castings/' + r.id; return; }
        case 'meetup': await api('/meetups', data); closeModal(); location.hash = '#/meetups'; ui.meetTab = 'mine'; return router();
        case 'apply': await api(`/castings/${id}/apply`, data); toast('Application sent'); return rerender();
        case 'profile': await api('/me', data); await refreshMe(); toast('Saved'); location.hash = '#/profile/' + S.me.id; return;
        case 'comment': { const r = await api(`/posts/${id}/comments`, data); const box = f.closest('.comments'); drawComments(box, id, r.comments); const art = box.closest('article'); art.querySelector('[data-act=comments] span').textContent = r.comments.length; return; }
        case 'msg': await api('/messages/' + id, data); f.reset(); return rerender();
        case 'castfilter': ui.castQ = data.q; ui.castCity = data.city; return rerender();
        case 'pfilter': ui.pq = data.q; ui.prole = data.role; ui.pcity = data.city; return rerender();
      }
    } catch (e) {
      if (err) err.textContent = e.message; else toast(e.message);
    } finally { if (btn) btn.disabled = false; }
  })();
});

/* ---------- boot ---------- */
async function refreshMe() {
  const before = S.me ? S.me.unread_notifications + ':' + S.me.unread_messages : '';
  try { const r = await api('/me'); S.me = r.user; S.roles = r.roles; S.categories = r.categories; } catch (e) { /* offline */ }
  const after = S.me ? S.me.unread_notifications + ':' + S.me.unread_messages : '';
  const a = document.activeElement;
  const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  const v = document.getElementById('view');
  if (before !== after && v && !typing && $modal.hidden) { const y = window.scrollY; shell(v.innerHTML); window.scrollTo(0, y); }
}
async function router() {
  clearInterval(pollTimer);
  const hash = location.hash || '#/';
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) {
      try { await fn(...m.slice(1)); } catch (e) {
        view(`<div class="empty">${esc(e.status === 404 ? 'Not found' : e.message)}<p><a class="link" href="#/">Back to feed</a></p></div>`);
      }
      return;
    }
  }
  view('<div class="empty">Page not found<p><a class="link" href="#/">Back to feed</a></p></div>');
}
window.addEventListener('hashchange', () => { closeModal(); router(); });
(async () => {
  const r = await api('/me').catch(() => ({ user: null, roles: [], categories: [] }));
  S.me = r.user; S.roles = r.roles; S.categories = r.categories;
  router();
  setInterval(() => { if (S.me && !document.hidden && !document.getElementById('thread')) refreshMe(); }, 30000);
})();
})();
