(() => {
'use strict';
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
let S = { me: null, roles: [], categories: [] };
let pollTimer = null;
let ui = { feedScope: 'all', castCat: '', castQ: '', castCity: '', meetTab: 'upcoming', profTab: 'posts',
           pq: '', prole: '', pcity: '', commTab: 'discover', commTopic: '', mapRole: '', mapOpen: false, mapQ: '', feedKind: '' };
const KINDS = [['', 'All'], ['showcase', 'Showcase'], ['question', 'Questions'], ['tip', 'Tips'], ['job', 'Jobs and calls'], ['collab', 'Collabs'], ['event', 'Events'], ['news', 'Film news'], ['update', 'Updates']];
const kindLabel = (k) => (KINDS.find((x) => x[0] === k) || ['', ''])[1];
let mapObj = null;

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
  repost: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
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
const who = (u) => `<a class="who" href="#/profile/${u.id}"><div class="name">${esc(u.name)}</div><div class="sub">${esc(u.headline || u.role)}${u.city ? ' · ' + esc(u.city) : ''}</div>${exPill(u)}${u.open_to_work ? `<div>${availBadge(u)}</div>` : ''}</a>`;
const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const geo = (txt) => { const t = String(txt || '').trim().toLowerCase(); if (!t || !window.CITIES) return null;
  return window.CITIES.find((c) => c.label.toLowerCase() === t || c.name.toLowerCase() === t) || null; };
const cityList = () => `<datalist id="cities">${(window.CITIES || []).map((c) => `<option value="${esc(c.name)}">${esc(c.country)}</option>`).join('')}</datalist>`;
const availText = (u) => !u.open_to_work ? '' : (u.available_from && u.available_from > new Date().toISOString().slice(0, 10) ? 'Available from ' + new Date(u.available_from + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open to work');
const availBadge = (u) => (u.open_to_work ? `<span class="avail">● ${esc(availText(u))}</span>` : '');
const kindPill = (p) => (p.kind && p.kind !== 'update' ? `<span class="pill kind">${esc(kindLabel(p.kind).replace(/s$/, ''))}</span>` : '');
const exPill = (x) => (x && x.sample ? '<span class="pill ex">Example</span>' : '');
const sampleNote = (list) => (list && list[0] && list[0].sample ? '<p class="sample-note"><b>Examples.</b> These show how Set UP looks. Real members, jobs and posts replace them as people join.</p>' : '');
const needLogin = () => { toast('Log in to do that'); location.hash = '#/login'; };

/* ---------- shell ---------- */
function active(href) {
  const h = location.hash || '#/';
  if (href === '#/') return h === '#/' || h === '';
  return h.startsWith(href.split('/').slice(0, 2).join('/')) && !(href.startsWith('#/profile') && h !== href);
}
let wide = false;
function shell(content) {
  const m = S.me;
  const badge = (n) => (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');
  const items = [['#/', 'home', 'Home'], ['#/map', 'pin', 'Map'], ['#/people', 'users', 'Network'], ['#/castings', 'brief', 'Castings'], ['#/communities', 'group', 'Groups'],
    ['#/meetups', 'cal', 'Meetups'], ['#/messages', 'chat', 'Messages', m && m.unread_messages, 1], ['#/notifications', 'bell', 'Alerts', m && m.unread_notifications, 1]];
  const top = items.map(([h, i, l, n, mob]) => `<a class="ni ${active(h) ? 'on' : ''} ${mob ? 'mob' : ''}" href="${h}">${ico(i)}<span>${l}</span>${badge(n)}</a>`).join('') +
    (m ? `<a class="ni ${active('#/profile/' + m.id) ? 'on' : ''}" href="#/profile/${m.id}">${av(m, 'xs')}<span>Me</span></a>` : '');
  const bar = [['#/', 'home', 'Home'], ['#/map', 'pin', 'Map'], null, ['#/castings', 'brief', 'Castings'], [m ? '#/profile/' + m.id : '#/login', 'user', m ? 'Me' : 'Log in']]
    .map((t) => t ? `<a class="tab ${active(t[0]) ? 'on' : ''}" href="${t[0]}">${ico(t[1])}${t[2]}</a>`
      : `<button class="plus" data-act="compose" aria-label="Create">${ico('plus')}</button>`).join('');
  $app.innerHTML = `
  <div class="shell">
    <header class="navbar"><div class="navin">
      <a class="wordmark" href="#/"><img src="logo.png" alt=""><span class="set">Set</span><span class="up">UP</span></a>
      <form class="gsearch" data-form="gsearch" role="search"><label class="sr" for="gs">Search people</label>${ico('search')}<input id="gs" name="q" placeholder="Search people, roles, skills" autocomplete="off"></form>
      <nav class="topnav" aria-label="Main">${top}</nav>
      ${m ? '' : '<div class="authbtns"><a class="btn ghost sm" href="#/login">Sign in</a><a class="btn sm" href="#/signup">Join now</a></div>'}
    </div></header>
    <main class="main ${wide ? 'wide' : ''}" id="view">${content}</main>
    <footer class="foot"><span>© Set UP</span><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/imprint">Impressum</a><button class="link" data-act="lang" aria-label="Language">${window.I18N && window.I18N.lang === 'tr' ? 'English' : 'Türkçe'}</button></footer>
    <nav class="tabbar" aria-label="Main">${bar}</nav>
  </div>`;
}
function view(html, isWide) { wide = !!isWide; shell(html); window.scrollTo(0, 0); }
function setView(html) { const v = document.getElementById('view'); if (v) v.innerHTML = html; }

/* ---------- components ---------- */
const richText = (t) => esc(t).replace(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu, (m, sp, tag) => `${sp}<a class="tag" href="#/tag/${encodeURIComponent(tag)}">#${tag}</a>`);
const quoteBlock = (p) => (p.original
  ? `<div class="quote"><div class="sub"><a href="#/profile/${p.original.user.id}"><b>${esc(p.original.user.name)}</b></a> · ${ago(p.original.created)}</div>${p.original.body ? `<div>${richText(p.original.body)}</div>` : ''}${p.original.image ? `<img class="post-img sm" src="${esc(p.original.image)}" alt="" loading="lazy">` : ''}</div>`
  : (p.repost_of ? '<div class="quote muted">The original post is no longer available.</div>' : ''));
function postCard(p) {
  const mine = S.me && S.me.id === p.user.id;
  return `<article class="card" data-post="${p.id}">
    <div class="post-head"><a href="#/profile/${p.user.id}">${av(p.user)}</a>${who(p.user)}<span class="sub">${ago(p.created)}</span>${exPill(p)}</div>
    ${p.community || (p.kind && p.kind !== 'update') ? `<p>${kindPill(p)}${p.community ? `<a class="pill" href="#/communities/${p.community.id}">in ${esc(p.community.name)}</a>` : ''}</p>` : ''}
    ${p.body ? `<p class="post-body">${richText(p.body)}</p>` : ''}
    ${quoteBlock(p)}
    ${p.image ? `<img class="post-img" src="${esc(p.image)}" alt="Photo shared by ${esc(p.user.name)}" loading="lazy">` : ''}
    <div class="actions">
      <button class="act ${p.liked ? 'liked' : ''}" data-act="like" data-id="${p.id}" aria-label="Like" aria-pressed="${p.liked}">${ico('heart')}<span>${p.likes}</span></button>
      <button class="act" data-act="comments" data-id="${p.id}" aria-label="Comments">${ico('chat')}<span>${p.comments}</span></button>
      ${S.me && !p.sample ? `<button class="act" data-act="repost" data-id="${p.id}" aria-label="Repost">${ico('repost')}<span>Repost</span></button>` : ''}
      ${mine ? `<button class="act" data-act="delpost" data-id="${p.id}">Delete</button>` : (S.me && !p.sample ? `<button class="act rep" data-act="report" data-type="post" data-id="${p.id}">Report</button>` : '')}
    </div>
    <div class="comments" hidden></div>
  </article>`;
}
const meetMini = (m) => { const w = when(m.starts); return `<div class="mini"><div class="date"><span>${esc(w.mon)}</span><b>${w.day}</b></div><div><div class="name">${esc(m.title)}</div><div class="sub">${esc(w.text)}${m.venue ? ' · ' + esc(m.venue) : ''}</div></div></div>`; };
const railPerson = (u) => `<div class="person rp"><a href="#/profile/${u.id}">${av(u)}</a>${who(u)}${connBtn(u.id, 'none', true)}</div>`;
const commCard = (c) => `<div class="card"><div class="event"><div class="date"><span>${esc(c.topic.slice(0, 5))}</span><b>${c.members}</b></div>
  <div class="info"><a href="#/communities/${c.id}"><h3>${esc(c.name)}</h3></a>${exPill(c)}<div class="sub">${esc(c.topic)}${c.city ? ' · ' + esc(c.city) : ''} · ${c.members} member${c.members === 1 ? '' : 's'}</div>
  ${c.description ? `<div class="sub">${esc(c.description)}</div>` : ''}</div>
  <button class="btn sm ${c.joined ? 'ghost' : ''}" data-act="joincomm" data-id="${c.id}">${c.joined ? 'Joined ✓' : 'Join'}</button></div></div>`;
function castCard(c) {
  const status = c.applied ? '<span class="pill ok">Applied</span>' : '';
  return `<a class="cast" href="#/castings/${c.id}"><div class="in">
    <span class="kicker">${esc(c.category)} casting ${exPill(c)}</span><h3>${esc(c.title)}</h3>
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
  const [feed, mt, cm, cs] = await Promise.all([api('/feed?scope=' + (m ? ui.feedScope : 'all') + (ui.feedKind ? '&kind=' + ui.feedKind : '')),
    api('/meetups').catch(() => ({ meetups: [] })), api('/communities').catch(() => ({ communities: [] })), api('/castings').catch(() => ({ castings: [] }))]);
  const roles = cs.castings.slice(0, 3);
  if (!m) {
    const pillars = [['pt1', 'SC. 01', 'Share your work', 'Post stills, reels and behind-the-scenes. Like, comment and share, like the networks you already know.', ''],
      ['pt2', 'SC. 02', 'Find jobs and castings', 'Post a role or apply with your profile. Every applicant in one list, ready to shortlist.', '<span class="hand">Lead role.<br>3 shooting days.<br><b>Apply →</b></span>'],
      ['pt3', 'SC. 03', 'Join communities', 'Groups for your craft and your city. Ask, answer and find your next collaborator.', '<span class="faces"><i class="av md c1">JW</i><i class="av md c0">KW</i><i class="av md c2">SR</i><i class="av md c3">TM</i></span>']];
    const eye = '<span class="vfb vf-b"></span><span class="vf-rec"><i class="recdot"></i>REC 00:01:24:12</span><span class="vf-sc">SC. 04 · TAKE 03</span><span class="vf-flare"></span>';
    return view(`<div class="landing">
      <section class="lhero"><div class="lhero-t"><p class="rec"><span class="recdot"></span>REC · THE NETWORK FOR FILM PEOPLE</p>
        <h1>Write your<br><i>next scene.</i></h1><p class="handline">…then find the crew to shoot it.</p>
        <p class="lead2">Share your work, find jobs and castings, join communities and find your crew on the map. One profile for the whole production.</p>
        <form class="card joinform" data-form="signup"><h2>Join Set UP. It's free.</h2>
          <div class="field"><label for="jn">Full name</label><input id="jn" name="name" required maxlength="80" autocomplete="name"></div>
          <div class="field"><label for="je">Email</label><input id="je" name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label for="jp">Password (8+ characters)</label><input id="jp" name="password" type="password" required minlength="8" autocomplete="new-password"></div>
          <div class="row"><div class="field"><label for="jr">I am a…</label><select id="jr" name="role">${S.roles.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
          <div class="field"><label for="jc">City</label><input id="jc" name="city" list="cities" maxlength="80" autocomplete="off"></div></div>${cityList()}
          <p class="err" role="alert"></p><button class="btn block lg" type="submit">Join Set UP</button>
          <p class="muted center">Already a member? <a class="link" href="#/login">Sign in</a></p></form></div>
        <div class="lhero-m" aria-hidden="true"><div class="photo-eye">${eye}</div>
          <div class="notebook"><span class="rings"><i></i><i></i><i></i><i></i><i></i><i></i></span><div class="hand big">cast &amp; crew<br>wanted —<br><b class="red">Berlin</b>, 3 days</div><div class="hand">→ apply on Set UP</div></div></div></section>
      <div class="strip"><span>Actors</span><span>Directors</span><span>Producers</span><span>Cinematographers</span><span>Editors</span><span>Sound</span><span>Writers</span></div>
      <section class="lband"><p class="section-title">The three things people do here</p><h2>Share. Get hired. <i>Belong.</i></h2>
        <div class="lgrid">${pillars.map(([c, k, t, d, x]) => `<div class="card pillar"><div class="ptop ${c}">${x}</div><div class="pbody2"><div class="kicker">${k}</div><h3>${t}</h3><p class="muted">${d}</p></div></div>`).join('')}</div></section>
      <section class="mapband"><div class="mb-t"><p class="section-title" style="margin-top:0">SC. 04</p><h2 class="lh">Find your crew <i>on the map.</i></h2>
        <p class="lead2">Producers and casting directors zoom to the city where they shoot, filter by role and availability, and connect in one click.</p><a class="btn ghost lg" href="#/map">Open the talent map</a></div>
        <div class="mb-m" aria-hidden="true"><div class="miniMap"><span class="mp p1">14</span><span class="mp p2">ML</span><span class="mp p3">38</span><span class="mp p4">JW</span><span class="mp p5">SR</span></div></div></section>
      <section class="lsec"><div class="lrow"><h2 class="lh">Open <i>roles</i></h2><a class="link" href="#/castings">All castings →</a></div>
        ${roles.length ? roles.map(castCard).join('') : '<div class="empty">No open roles yet. Join and post the first one.</div>'}</section>
      <section class="lsec"><h2 class="lh">Everyone who <i>makes a film</i></h2><div class="rolechips">${S.roles.map((r) => `<a class="chip" href="#/map" data-act="maprole" data-v="${esc(r)}">${esc(r)}</a>`).join('')}</div></section>
      <section class="cta"><h2>Roll <i>camera.</i></h2><p class="handline">your next set starts with a profile</p><a class="btn lg" href="#/signup">Join Set UP</a></section>
    </div>`, true);
  }
  const mc = `<div class="card pcard"><div class="pbanner"></div><div class="pc-b"><a href="#/profile/${m.id}">${av(m, 'lg')}</a><a class="name" href="#/profile/${m.id}">${esc(m.name)}</a>
    <div class="sub">${esc(m.headline || m.role)}${m.city ? ' · ' + esc(m.city) : ''}</div>${m.open_to_work ? `<div>${availBadge(m)}</div>` : ''}
    <a class="link" href="#/me/edit">Edit profile</a></div></div>
    <div class="card shortcuts"><a href="#/map">${ico('pin')} Talent map</a><a href="#/communities">${ico('group')} Communities</a><a href="#/meetups">${ico('cal')} Meetups</a><a href="#/applications">${ico('brief')} My applications</a></div>`;
  let sug = [];
  try { sug = (await api('/suggestions')).people; } catch (e) { /* ignore */ }
  const toJoin = cm.communities.filter((c) => !c.joined).slice(0, 3);
  const rail = `<aside class="rail" aria-label="Suggestions">
    <div class="card"><h2 class="rail-title">Casting near you</h2>${roles.map((c) => `<a class="mini" href="#/castings/${c.id}"><div class="who"><div class="name">${esc(c.title)}</div><div class="sub">${esc(c.city || 'Remote')}${c.pay ? ' · ' + esc(c.pay) : ''}</div></div></a>`).join('') || '<p class="muted">No castings yet.</p>'}<a class="link" href="#/castings">All castings →</a></div>
    ${sug.length ? `<div class="card"><h2 class="rail-title">People you may know</h2>${sug.slice(0, 4).map(railPerson).join('')}</div>` : ''}
    <div class="card"><h2 class="rail-title">Communities</h2>${toJoin.map((c) => `<div class="mini"><div class="who"><a href="#/communities/${c.id}" class="name">${esc(c.name)}</a><div class="sub">${c.members} member${c.members === 1 ? '' : 's'} · ${esc(c.topic)}</div></div><button class="btn ghost sm" data-act="joincomm" data-id="${c.id}">Join</button></div>`).join('') || '<p class="muted">No communities to join yet.</p>'}<a class="link" href="#/communities">All communities →</a></div>
    <div class="card"><h2 class="rail-title">Upcoming meetups</h2>${mt.meetups.slice(0, 3).map(meetMini).join('') || '<p class="muted">No meetups yet.</p>'}<a class="link" href="#/meetups">All meetups →</a></div></aside>`;
  view(`<div class="feedgrid"><aside class="lcol">${mc}</aside><div class="feedcol">
    <div class="card startpost"><div class="sp-top">${av(m)}<button class="sp-input" data-act="compose">Start a post</button></div>
      <div class="sp-btns"><button data-act="compose" data-v="post">${ico('img')} Photo</button><button data-act="compose" data-v="casting">${ico('brief')} Casting call</button><button data-act="compose" data-v="meetup">${ico('cal')} Meetup</button><button data-act="compose" data-v="community">${ico('group')} Community</button></div></div>
    ${sampleNote(feed.posts)}
    <div class="chips kindchips" role="group" aria-label="Topics">${KINDS.map(([k, l]) => `<button class="chip ${ui.feedKind === k ? 'on' : ''}" data-act="feedkind" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="seg"><button class="${ui.feedScope === 'all' ? 'on' : ''}" data-act="scope" data-v="all">Everyone</button><button class="${ui.feedScope === 'network' ? 'on' : ''}" data-act="scope" data-v="network">My network</button></div>
    ${feed.posts.length ? feed.posts.map(postCard).join('') : `<div class="empty">${ui.feedScope === 'network' ? 'Nothing from your network yet. Connect with people on the <a class="link" href="#/map">talent map</a>.' : 'No posts yet. Be the first!'}</div>`}
  </div>${rail}</div>`, true);
});

route(/^#\/map$/, async () => {
  const qs = new URLSearchParams({ role: ui.mapRole, q: ui.mapQ });
  if (ui.mapOpen) qs.set('open', '1');
  const { people } = await api('/mappeople?' + qs);
  view(`<div class="mappage"><div class="maphead"><div><h1 class="ptitle">Find talent on the map</h1><p class="muted" id="mapcount"> </p></div>
      ${S.me ? '<button class="btn" data-act="compose" data-v="casting">Post a casting call</button>' : '<a class="btn" href="#/signup">Join to connect</a>'}</div>
    ${sampleNote(people)}
    <form class="mapfilters" data-form="mapfilter"><div class="field"><label class="sr" for="mq">Search</label><input id="mq" name="q" placeholder="Name, craft, skill or city" value="${esc(ui.mapQ)}"></div>
      <div class="field"><label class="sr" for="mr">Role</label><select id="mr" name="role"><option value="">All roles</option>${S.roles.map((r) => `<option ${ui.mapRole === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
      <label class="chk"><input type="checkbox" name="open" ${ui.mapOpen ? 'checked' : ''}> <span>Available now</span></label><button class="btn" type="submit">Search</button></form>
    <div class="mapgrid"><section class="maplist" id="maplist" aria-label="People in this area"></section>
      <section class="mapwrap"><div id="map" role="application" aria-label="Talent map"></div><div id="mapcard" class="mapcard" hidden></div></section></div></div>`, true);
  initMap(people);
});

function initMap(people) {
  const el = document.getElementById('map');
  if (!window.L) { el.innerHTML = '<div class="empty">The map could not load.</div>'; return; }
  mapObj = L.map(el, { worldCopyJump: true, minZoom: 2 });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(mapObj);
  const groups = new Map();
  for (const p of people) { const k = p.lat.toFixed(2) + ',' + p.lng.toFixed(2); if (!groups.has(k)) groups.set(k, { lat: p.lat, lng: p.lng, list: [] }); groups.get(k).list.push(p); }
  const pts = [];
  groups.forEach((g) => {
    const n = g.list.length; const label = n > 1 ? String(n) : initials(g.list[0].name);
    const icon = L.divIcon({ className: 'pinwrap', html: `<span class="pin ${n > 1 ? 'multi' : ''}">${esc(label)}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
    const mk = L.marker([g.lat, g.lng], { icon, keyboard: true, title: n > 1 ? `${n} people in ${g.list[0].city}` : g.list[0].name }).addTo(mapObj);
    mk.on('click', () => showMapCard(g));
    pts.push([g.lat, g.lng]);
  });
  if (pts.length > 1) mapObj.fitBounds(pts, { padding: [60, 60], maxZoom: 8 }); else if (pts.length === 1) mapObj.setView(pts[0], 8); else mapObj.setView([30, 10], 2);
  const renderList = () => {
    const b = mapObj.getBounds(); const vis = people.filter((p) => b.contains([p.lat, p.lng]));
    const list = document.getElementById('maplist'); const cnt = document.getElementById('mapcount');
    if (!list) return;
    list.innerHTML = vis.slice(0, 60).map((p) => `<div class="card person mp-item"><a href="#/profile/${p.id}">${av(p)}</a>${who(p)}<div class="mp-act">${connBtn(p.id, p.state, true)}<button class="link" data-act="mapfocus" data-lat="${p.lat}" data-lng="${p.lng}">Show</button></div></div>`).join('')
      || `<div class="empty">${people.length ? 'No people in this area. Zoom out or move the map.' : 'No one has put themselves on the map yet. Add your city in your profile.'}</div>`;
    if (cnt) cnt.textContent = `${vis.length} of ${people.length} people in this area`;
  };
  mapObj.on('moveend', renderList); renderList();
  setTimeout(() => mapObj && mapObj.invalidateSize(), 100);
}
function showMapCard(g) {
  const c = document.getElementById('mapcard'); if (!c) return;
  c.hidden = false;
  c.innerHTML = `<button class="iconbtn cclose" data-act="mapclose" aria-label="Close">${ico('x')}</button><div class="sub">${esc(g.list[0].city)} · ${g.list.length} ${g.list.length === 1 ? 'person' : 'people'}</div>` +
    g.list.slice(0, 6).map((p) => `<div class="person rp"><a href="#/profile/${p.id}">${av(p)}</a>${who(p)}${connBtn(p.id, p.state, true)}</div>`).join('') + (g.list.length > 6 ? `<p class="muted">+ ${g.list.length - 6} more. Zoom in to see them.</p>` : '');
}

route(/^#\/communities$/, async () => {
  const qs = new URLSearchParams({ topic: ui.commTopic });
  if (ui.commTab === 'mine' && S.me) qs.set('mine', '1');
  const { communities } = await api('/communities?' + qs);
  const topics = ['', 'General', 'Acting', 'Directing', 'Producing', 'Cinematography', 'Editing', 'Sound', 'Writing', 'Crew', 'Students', 'Local'];
  view(`<h1 class="page-title">Communities</h1>
    <div class="seg"><button class="${ui.commTab === 'discover' ? 'on' : ''}" data-act="commtab" data-v="discover">Discover</button>${S.me ? `<button class="${ui.commTab === 'mine' ? 'on' : ''}" data-act="commtab" data-v="mine">My communities</button>` : ''}</div>
    <div class="chips">${topics.map((t) => `<button class="chip ${ui.commTopic === t ? 'on' : ''}" data-act="commtopic" data-v="${t}">${t || 'All'}</button>`).join('')}</div>
    ${sampleNote(communities)}
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
    ${sampleNote(castings)}
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
    ${sampleNote(meetups)}
    ${S.me ? '<p><button class="link" data-act="compose" data-v="meetup">+ Host a meetup</button></p>' : ''}
    ${meetups.length ? meetups.map((m) => { const w = when(m.starts); const mine = S.me && S.me.id === m.host_id; return `<div class="card"><div class="event">
      <div class="date"><span>${esc(w.mon)}</span><b>${w.day}</b></div>
      <div class="info"><h3>${esc(m.title)}</h3>${exPill(m)}<div class="sub">${esc(w.text)}${m.venue ? ' · ' + esc(m.venue) : ''}${m.city ? ', ' + esc(m.city) : ''}</div>
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
  const skills = (u.skills || '').split(',').map((x) => x.trim()).filter(Boolean);
  const buttons = self ? '<a class="btn" href="#/me/edit">Edit profile</a><button class="btn ghost" data-act="logout">Log out</button>'
    : `${connBtn(u.id, u.state)}${u.state === 'connected' ? '' : `<a class="btn ghost" href="#/messages/${u.id}">Message</a>`}<button class="btn ghost" data-act="follow" data-id="${u.id}">${u.following ? 'Following' : 'Follow'}</button>${S.me && !u.sample ? `<button class="btn ghost sm" data-act="report" data-type="profile" data-id="${u.id}">Report</button>` : ''}${u.state === 'connected' ? `<button class="btn danger sm" data-act="disconnect" data-id="${u.id}">Remove</button>` : ''}`;
  view(`<div class="pgrid"><div class="pmain">
    <section class="card p0"><div class="banner"></div><div class="pbody"><div class="pav">${av(u, 'xl')}</div>
      <div class="phead"><div><h1 class="pname">${esc(u.name)}</h1><div class="pline">${esc(u.headline || u.role)}</div>
        <div class="muted">${esc(u.city || 'Location not set')} · <b class="blue">${u.connections} connection${u.connections === 1 ? '' : 's'}</b> · ${u.followers} follower${u.followers === 1 ? '' : 's'}</div>${u.open_to_work ? `<div class="avail-big">${availBadge(u)}</div>` : ''}</div>
        <div class="pbtns">${buttons}</div></div></div></section>
    ${u.bio ? `<section class="card"><h2 class="sec">About</h2><p class="post-body">${esc(u.bio)}</p></section>` : ''}
    ${u.reel_url ? `<section class="card"><h2 class="sec">Showreel</h2><a class="btn ghost" href="${esc(u.reel_url)}" target="_blank" rel="noopener noreferrer">Watch showreel ↗</a></section>` : ''}
    <section class="card"><h2 class="sec">Experience</h2>${u.credits.length ? u.credits.map((c) => `<div class="credit"><span class="fico sm">${ico('brief')}</span><div><div class="name">${esc(c.title)}${c.role ? ' · ' + esc(c.role) : ''}</div><div class="sub">${esc([c.kind, c.year].filter(Boolean).join(' · '))}</div>${c.description ? `<p class="post-body">${esc(c.description)}</p>` : ''}</div></div>`).join('') : `<p class="muted">${self ? 'Add your credits so producers can see your experience.' : 'No credits added yet.'}</p>`}${self ? '<a class="link" href="#/me/edit">+ Add credits</a>' : ''}</section>
    ${skills.length ? `<section class="card"><h2 class="sec">Skills</h2><div class="skills">${skills.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div></section>` : ''}
    <h2 class="sec2">Posts</h2>${u.posts.map(postCard).join('') || '<div class="empty">No posts yet.</div>'}
  </div><aside class="prail"><div class="card"><h2 class="rail-title">Location</h2><p>${esc(u.city || 'Not set')}</p>${u.lat != null ? '<a class="link" href="#/map">See the talent map →</a>' : (self ? '<a class="link" href="#/me/edit">Add your city to appear on the map</a>' : '')}</div>
    ${u.castings.length ? `<div class="card"><h2 class="rail-title">Open castings</h2>${u.castings.map((c) => `<a class="mini" href="#/castings/${c.id}"><div class="who"><div class="name">${esc(c.title)}</div><div class="sub">${esc(c.city || 'Remote')}${c.pay ? ' · ' + esc(c.pay) : ''}</div></div></a>`).join('')}</div>` : ''}</aside></div>`, true);
});

route(/^#\/me\/edit$/, async () => {
  if (!S.me) return needLogin();
  const m = S.me;
  const u = await api('/users/' + m.id);
  view(`<h1 class="ptitle">Edit profile</h1><form class="card" data-form="profile">
    <div class="person" style="margin-bottom:14px">${av(m, 'md')}<label class="btn ghost sm">Change photo<input class="sr" type="file" accept="image/*" data-file="avatar"></label><input type="hidden" name="avatar" value="${esc(m.avatar)}"></div>
    <div class="field"><label for="n">Name</label><input id="n" name="name" required maxlength="80" value="${esc(m.name)}"></div>
    <div class="row"><div class="field"><label for="r">Role</label><select id="r" name="role">${S.roles.map((r) => `<option ${m.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    <div class="field"><label for="c">City (shown on the map)</label><input id="c" name="city" list="cities" maxlength="80" autocomplete="off" value="${esc(m.city)}"></div></div>${cityList()}
    <div class="field"><label for="h">Headline</label><input id="h" name="headline" maxlength="120" value="${esc(m.headline)}" placeholder="e.g. Cinematographer · documentary"></div>
    <div class="field"><label for="b">About</label><textarea id="b" name="bio" maxlength="1500">${esc(m.bio)}</textarea></div>
    <div class="field"><label for="s">Skills (comma separated)</label><input id="s" name="skills" maxlength="300" value="${esc(m.skills)}"></div>
    <div class="field"><label for="rl">Showreel link (https://…)</label><input id="rl" name="reel_url" type="url" maxlength="300" value="${esc(m.reel_url)}" placeholder="https://vimeo.com/…"></div>
    <div class="row"><label class="chk"><input type="checkbox" name="open_to_work" ${m.open_to_work ? 'checked' : ''}> <span>Open to work</span></label>
    <div class="field"><label for="af">Available from</label><input id="af" name="available_from" type="date" value="${esc(m.available_from)}"></div></div>
    <p class="muted">Pick a city from the list to appear on the talent map. Only the city centre is shown, never your address.</p>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Save profile</button></form>
    <h2 class="sec2">Experience</h2>
    ${u.credits.map((c) => `<div class="card credit"><span class="fico sm">${ico('brief')}</span><div style="flex:1"><div class="name">${esc(c.title)}${c.role ? ' · ' + esc(c.role) : ''}</div><div class="sub">${esc([c.kind, c.year].filter(Boolean).join(' · '))}</div></div><button class="btn danger sm" data-act="delcredit" data-id="${c.id}">Remove</button></div>`).join('')}
    <form class="card" data-form="credit"><h3 class="sec">Add a credit</h3>
      <div class="field"><label for="ct1">Project title</label><input id="ct1" name="title" required maxlength="120" placeholder="e.g. Night Ferry"></div>
      <div class="row"><div class="field"><label for="cr">Your role</label><input id="cr" name="role" maxlength="80" placeholder="e.g. Director of Photography"></div>
      <div class="field"><label for="ck">Type</label><input id="ck" name="kind" maxlength="40" placeholder="Short film, feature, music video…"></div>
      <div class="field"><label for="cy">Year</label><input id="cy" name="year" maxlength="4" inputmode="numeric" placeholder="2026"></div></div>
      <div class="field"><label for="cd2">Description (optional)</label><textarea id="cd2" name="description" maxlength="600"></textarea></div>
      <p class="err" role="alert"></p><button class="btn" type="submit">Add credit</button></form>`);
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
      <div class="thread" id="thread">${t.messages.map((m) => `<div class="msg ${m.mine ? 'mine' : ''}">${esc(m.body)}</div>`).join('') || '<div class="empty">Say hello</div>'}</div>
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

route(/^#\/tag\/(.+)$/, async (raw) => {
  const tag = decodeURIComponent(raw);
  const { posts } = await api('/feed?tag=' + encodeURIComponent(tag));
  view(`<p><a class="link" href="#/">${ico('back')} Home</a></p><h1 class="page-title">#${esc(tag)}</h1>
    ${posts.length ? posts.map(postCard).join('') : '<div class="empty">No posts with this tag yet.</div>'}`);
});

const LEGAL_NOTE = '<p class="sample-note"><b>Draft.</b> This is a template. Fill in the [brackets] and have it reviewed by a lawyer before you rely on it.</p>';
route(/^#\/privacy$/, async () => view(`<h1 class="page-title">Privacy policy</h1>${LEGAL_NOTE}<div class="legal">
  <p><b>Who is responsible:</b> [Your name or company], [address], [contact email].</p>
  <h2>What we collect</h2><p>Account data you give us (name, email, role, city, profile text, photos, credits), the content you post (posts, comments, messages, castings, communities, meetups, applications), and the connections you make. Your email and password are handled by our login provider; we never see your password.</p>
  <h2>How we use it</h2><p>To run Set UP: show your profile and posts, place you on the talent map by city (only the city centre, never your address), let people connect, message and apply, send account emails (confirmation, password reset) and keep the service safe.</p>
  <h2>Who processes it</h2><p>Supabase (database, login, file storage; project region: [Singapore / update if you move it]); GitHub Pages (website hosting); OpenStreetMap (map tiles: your IP address is sent to them when you open the map); Google Fonts (fonts: your IP address is sent to Google). [Consider hosting the fonts yourself to avoid the Google request.]</p>
  <h2>Cookies and storage</h2><p>We only use browser storage that is needed to keep you logged in. There is no advertising or tracking.</p>
  <h2>Your rights</h2><p>You can access, correct, export or delete your data, object to processing and complain to your data protection authority. To delete your account or ask a question, email [contact email].</p>
  <h2>Retention</h2><p>We keep your data while your account exists. When you delete your account your profile, posts, messages and files are removed.</p>
  <h2>Age</h2><p>Set UP is for people aged 16 and over.</p></div>`));
route(/^#\/terms$/, async () => view(`<h1 class="page-title">Terms of use</h1>${LEGAL_NOTE}<div class="legal">
  <h2>Using Set UP</h2><p>You must be at least 16, give true information and keep your login private. One person, one account.</p>
  <h2>Your content</h2><p>You own what you post. You allow Set UP to show it to other users for the purpose of running the service. Only post things you have the right to share. Do not post anyone else's private information.</p>
  <h2>Not allowed</h2><p>Spam, scams, fake castings or jobs, requests for money to apply, harassment, hate, nudity or sexual content involving minors, illegal content, impersonation, scraping or abusing the service.</p>
  <h2>Castings and jobs</h2><p>Set UP only connects people. We do not employ anyone, we are not a party to any agreement between users, and we do not check castings. Use your own judgement and never pay to get a role.</p>
  <h2>Reports and removal</h2><p>Use the Report button. We may remove content or suspend accounts that break these rules.</p>
  <h2>Liability</h2><p>Set UP is provided as is. To the extent the law allows, we are not liable for losses arising from use of the service. [Have this clause reviewed.]</p>
  <h2>Contact</h2><p>[contact email]. Governing law: [country / court].</p></div>`));
route(/^#\/imprint$/, async () => view(`<h1 class="page-title">Impressum</h1>${LEGAL_NOTE}<div class="legal">
  <p><b>Provider:</b><br>[Full name or company name]<br>[Street and number]<br>[Postcode and city], [Country]</p>
  <p><b>Contact:</b><br>Email: [contact email]<br>[Phone, optional]</p>
  <p><b>Responsible for content:</b> [Name and address]</p>
  <p>[If you are a company add: register court and number, VAT ID.]</p></div>`));

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
    <div class="field"><label for="pk">What are you sharing?</label><select id="pk" name="kind">${KINDS.filter((k) => k[0]).map(([k, l]) => `<option value="${k}" ${k === 'update' ? 'selected' : ''}>${l.replace(/s$/, '')}</option>`).join('')}</select></div>
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
function openReport(type, id) {
  if (!S.me) return needLogin();
  $modal.hidden = false;
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Report"><div class="sheet-head"><h2>Report</h2><button class="iconbtn" data-act="close" aria-label="Close">${ico('x')}</button></div>
    <form data-form="report"><input type="hidden" name="target_type" value="${esc(type)}"><input type="hidden" name="target_id" value="${esc(id)}">
    <div class="field"><label for="rr">Why are you reporting this?</label><select id="rr" name="reason"><option value="spam">Spam or scam</option><option value="harassment">Harassment or hate</option><option value="misleading">Misleading or fake</option><option value="inappropriate">Inappropriate content</option><option value="other">Something else</option></select></div>
    <div class="field"><label for="rn">Details (optional)</label><textarea id="rn" name="note" maxlength="500"></textarea></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Send report</button></form></div>`;
}
function openRepost(id) {
  if (!S.me) return needLogin();
  $modal.hidden = false;
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Repost"><div class="sheet-head"><h2>Repost</h2><button class="iconbtn" data-act="close" aria-label="Close">${ico('x')}</button></div>
    <form data-form="repost"><input type="hidden" name="repost_of" value="${esc(id)}"><input type="hidden" name="kind" value="update">
    <div class="field"><label for="rb">Add your thoughts (optional)</label><textarea id="rb" name="body" maxlength="3000" placeholder="Say something about this post…"></textarea></div>
    <p class="err" role="alert"></p><button class="btn block" type="submit">Repost</button></form></div>`;
  const t = $modal.querySelector('textarea'); if (t) t.focus();
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
      case 'report': return openReport(el.dataset.type, id);
      case 'repost': return openRepost(id);
      case 'lang': return window.I18N && window.I18N.toggle();
      case 'logout': await api('/logout', {}); S.me = null; location.hash = '#/'; return router();
      case 'scope': ui.feedScope = v; return rerender();
      case 'feedkind': ui.feedKind = v; return rerender();
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
      case 'maprole': ui.mapRole = v; return;
      case 'mapclose': { const c = document.getElementById('mapcard'); if (c) c.hidden = true; return; }
      case 'mapfocus': if (mapObj) { mapObj.setView([+el.dataset.lat, +el.dataset.lng], 11); } return;
      case 'delcredit': if (confirm('Remove this credit?')) { await api(`/credits/${id}/delete`, {}); rerender(); } return;
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
    if (file.size > 30 * 1024 * 1024) return rej(new Error('Image too large (max 30 MB)'));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('Could not read file'));
    fr.onload = () => {
      // GIFs are sent as they are; other images are resized to max 1600 px unless they are already small
      if (file.type === 'image/gif') return file.size > 5 * 1024 * 1024 ? rej(new Error('Image too large (max 5 MB)')) : res(fr.result);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        if (k === 1 && file.size <= 1024 * 1024) return res(fr.result);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => rej(new Error('Could not read this image'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
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
      if ((kind === 'signup' || kind === 'profile') && data.city) { const g = geo(data.city); if (g) { data.city = g.name; data.lat = g.lat; data.lng = g.lng; } }
      if (kind === 'profile') data.open_to_work = f.elements.open_to_work.checked;
      switch (kind) {
        case 'gsearch': ui.pq = data.q; ui.prole = ''; ui.pcity = ''; location.hash = '#/people'; return router();
        case 'mapfilter': ui.mapQ = data.q; ui.mapRole = data.role; ui.mapOpen = !!data.open; return rerender();
        case 'credit': await api('/credits', data); toast('Credit added'); return rerender();
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
        case 'report': await api('/report', data); closeModal(); toast('Thank you. We will review this.'); return;
        case 'repost': await api('/posts', data); closeModal(); toast('Reposted'); return rerender();
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
  if (mapObj) { mapObj.remove(); mapObj = null; }
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
