/* KidAppetite prototype app.
   Plain JavaScript single page app with hash routing, so it runs on GitHub Pages
   with no build step. Data is kept in localStorage for the demo. */
'use strict';

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const money = (n) => `$${Number(n).toFixed(2)}`;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROLE_LABEL = { parent: 'Parent', mother: 'Mother', consultant: 'Consultant', admin: 'Admin' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AVATAR_COLORS = ['var(--banana)', 'var(--leaf)', 'var(--sky)', 'var(--tomato-soft)', 'var(--carrot-soft)'];

function ageLabel(m) {
  m = Math.max(0, Math.round(Number(m)));
  if (m < 24) return `${m} month${m === 1 ? '' : 's'}`;
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y} yr ${r} mo` : `${y} years`;
}
function monthsSince(iso) {
  if (!iso) return 0;
  const a = new Date(iso + 'T00:00:00'), b = new Date();
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}
const ageAdj = (m) => (m < 24 ? `${Math.round(m)} month old` : `${Math.floor(m / 12)} year old`);
const childAge = (c) => Number(c.ageMonths || 0) + monthsSince(c.ageRecordedOn);
const dateLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
function timeLabel(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
const firstName = (u) => (u.name || '').replace(/^Dr\.?\s+/, '').split(' ')[0];
const initials = (name) => name.replace(/^Dr\.?\s+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function avatarColor(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const avatar = (u, size = '') => `<span class="avatar ${size}" style="background:${avatarColor(u.id)}" aria-hidden="true">${esc(initials(u.name))}</span>`;
const allergenText = (list) => list.length ? list.join(', ') : 'none of the common allergens';

/* ---------- store ---------- */
const STORE_KEY = 'kidappetite-demo-v1';
const Store = {
  state: null,
  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { saved = null; }
    this.state = saved && saved.version === 1 ? saved : buildSeed();
    this.refreshDemoMenu();
    this.save();
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (e) { /* storage blocked: keep working in memory */ }
  },
  reset() { this.state = buildSeed(); this.save(); },
  /* Demo meals roll forward to today so the menu is never empty. */
  refreshDemoMenu() {
    const today = todayISO();
    this.state.meals.forEach((m) => { if (m.demo && m.date !== today) { m.date = today; m.portionsLeft = m.portions; } });
  }
};
const S = () => Store.state;
const me = () => S().users.find((u) => u.id === S().sessionUserId) || null;
const byId = (id) => S().users.find((u) => u.id === id);
const consultants = () => S().users.filter((u) => u.role === 'consultant');

/* Temporary UI state that does not need saving */
const ui = { recipeProfile: null, bookFor: null, bookDate: null, bookTime: null, kitchenArea: null };

/* ---------- domain logic ---------- */
function matchRecipes(p) {
  const excluded = new Set(p.allergies);
  const prefer = [];
  p.conditions.forEach((id) => {
    const c = CONDITIONS.find((x) => x.id === id);
    (c?.exclude || []).forEach((a) => excluded.add(a));
    (c?.prefer || []).forEach((t) => prefer.push(t));
  });
  return RECIPES
    .filter((r) => p.ageMonths >= r.minMonths && p.ageMonths <= r.maxMonths && !r.allergens.some((a) => excluded.has(a)))
    .map((r) => ({ r, score: prefer.filter((t) => r.tags.includes(t)).length + (p.ageMonths < 24 && r.tags.includes('ironRich') ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}

function upcomingSlots(c, days = 14) {
  const out = [];
  const now = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    if (!c.availability.days.includes(d.getDay())) continue;
    const date = isoDate(d);
    const taken = S().bookings.filter((b) => b.consultantId === c.id && b.date === date && b.status === 'booked').map((b) => b.time);
    const times = c.availability.hours.filter((h) => !taken.includes(h));
    if (times.length) out.push({ date, times });
  }
  return out;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- router ---------- */
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}
const go = (hash) => { location.hash = hash; };

const routes = {
  '': viewHome, recipes: viewRecipes, consultants: viewConsultants, kitchen: viewKitchen,
  join: viewJoin, signin: viewSignin, dashboard: viewDashboard, admin: viewAdmin, apply: viewApply
};

function render(routeChanged = false) {
  const { parts, query } = parseHash();
  const view = routes[parts[0] || ''] || viewNotFound;
  $('#app').innerHTML = view(parts, query);
  renderNav();
  syncJoinForm();
  if (routeChanged) {
    window.scrollTo(0, 0);
    const h1 = $('#app h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    document.title = parts[0] ? `${h1 ? h1.textContent : 'KidAppetite'} | KidAppetite` : 'KidAppetite | Healthy food kids actually eat';
    $('.site-header').classList.remove('open');
    $('.nav-toggle').setAttribute('aria-expanded', 'false');
  }
}

function renderNav() {
  const u = me();
  const cur = parseHash().parts[0] || '';
  const link = (key, label) => `<a href="#/${key}" ${cur === key ? 'aria-current="page"' : ''}>${label}</a>`;
  $('#nav').innerHTML = `
    ${link('recipes', 'Recipes')}
    ${link('consultants', 'Consultants')}
    ${link('kitchen', 'Mothers\u2019 kitchen')}
    ${u && u.role !== 'admin' ? link('dashboard', 'My space') : ''}
    ${u?.role === 'admin' ? link('admin', 'Approvals') : ''}
    <span class="nav-account">
      ${u
        ? `<span class="who">${avatar(u, 'avatar-sm')}<span>${esc(firstName(u))}<small>${ROLE_LABEL[u.role]}</small></span></span>
           <button class="btn btn-ghost btn-small" data-action="signout">Sign out</button>`
        : `<a class="btn btn-ghost btn-small" href="#/signin">Sign in</a><a class="btn btn-tomato btn-small" href="#/join">Join</a>`}
    </span>`;
}

function gate(title, next) {
  return `<section class="gate">
    <h1>${title}</h1>
    <p class="lede">Sign in or create a free account to continue.</p>
    <div class="actions">
      <a class="btn btn-tomato btn-big" href="#/signin?next=${encodeURIComponent(next || location.hash)}">Sign in</a>
      <a class="btn btn-ghost btn-big" href="#/join">Create an account</a>
    </div></section>`;
}

/* ---------- the animated kid ---------- */
function kidSVG() {
  return `
<svg class="kid" viewBox="0 0 440 440" role="img" aria-labelledby="kidTitle">
  <title id="kidTitle">A happy child eating broccoli from a fork</title>
  <circle cx="220" cy="210" r="192" fill="var(--banana)"/>
  <g class="kid-stroke">
    <g fill="#4A2C20">
      <circle cx="132" cy="128" r="30"/><circle cx="160" cy="98" r="32"/><circle cx="200" cy="86" r="34"/>
      <circle cx="240" cy="98" r="32"/><circle cx="268" cy="128" r="30"/>
    </g>
    <circle cx="112" cy="178" r="16" fill="var(--skin)"/><circle cx="288" cy="178" r="16" fill="var(--skin)"/>
    <path d="M108 440 L108 332 Q108 272 170 268 L230 268 Q292 272 292 332 L292 440 Z" fill="var(--tomato)"/>
    <path d="M176 268 Q200 292 224 268" fill="none"/>
    <circle cx="200" cy="170" r="92" fill="var(--skin)"/>
    <g fill="#4A2C20" stroke="none">
      <circle cx="164" cy="104" r="20"/><circle cx="200" cy="96" r="22"/><circle cx="236" cy="104" r="20"/>
    </g>
    <rect x="30" y="398" width="380" height="70" rx="12" fill="var(--sky)"/>
    <circle cx="140" cy="396" r="15" fill="var(--skin)"/>
    <ellipse cx="352" cy="404" rx="54" ry="13" fill="#fff"/>
    <g stroke-width="3">
      <circle cx="322" cy="401" r="5" fill="var(--leaf)"/><circle cx="333" cy="404" r="5" fill="var(--leaf)"/>
      <path d="M372 398 L392 402 M376 404 L394 407" stroke="var(--carrot)" stroke-width="5" stroke-linecap="round"/>
    </g>
  </g>
  <g transform="translate(168 168)"><g class="kid-eye"><ellipse rx="9" ry="12" fill="var(--ink)"/><circle cx="3" cy="-4" r="3" fill="#fff"/></g></g>
  <g transform="translate(234 168)"><g class="kid-eye"><ellipse rx="9" ry="12" fill="var(--ink)"/><circle cx="3" cy="-4" r="3" fill="#fff"/></g></g>
  <g transform="translate(146 206)"><ellipse class="kid-cheek" rx="16" ry="10" fill="#FF8FA3" opacity=".85"/></g>
  <g transform="translate(260 206)"><ellipse class="kid-cheek" rx="16" ry="10" fill="#FF8FA3" opacity=".85"/></g>
  <path class="kid-smile" d="M188 216 Q205 234 222 216" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
  <g transform="translate(205 220)"><ellipse class="kid-mouth" rx="17" ry="15" fill="#B0243A" stroke="var(--ink)" stroke-width="4" vector-effect="non-scaling-stroke"/></g>
  <path class="kid-yum" d="M330 92 c-8 -14 -30 -8 -26 10 c3 12 26 26 26 26 s23 -14 26 -26 c4 -18 -18 -24 -26 -10 z" fill="var(--tomato)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/>
  <g transform="translate(285 305)">
    <g class="kid-arm kid-stroke">
      <line x1="94" y1="0" x2="114" y2="0" stroke="#8A94B8" stroke-width="5"/>
      <rect x="-6" y="-13" width="64" height="26" rx="13" fill="var(--tomato)"/>
      <rect x="50" y="-11" width="46" height="22" rx="11" fill="var(--skin)"/>
      <circle cx="96" cy="0" r="14" fill="var(--skin)"/>
      <g class="kid-floret" transform="translate(120 0)">
        <circle cx="0" cy="-6" r="9" fill="var(--leaf)"/><circle cx="-8" cy="3" r="8" fill="var(--leaf)"/><circle cx="8" cy="3" r="8" fill="var(--leaf)"/>
      </g>
    </g>
  </g>
</svg>`;
}

/* ---------- views ---------- */
function viewHome() {
  return `
  <section class="hero">
    <div class="hero-copy">
      <h1>Mealtime, minus the negotiation.</h1>
      <p class="lede">Healthy recipes kids actually eat, food consultants who specialise in little ones, and home cooked meals from mothers nearby.</p>
      <div class="actions">
        <a class="btn btn-tomato btn-big" href="#/recipes">Find recipes for my child</a>
        <a class="btn btn-ghost btn-big" href="#/join">Create an account</a>
      </div>
    </div>
    <div class="hero-art">${kidSVG()}</div>
  </section>

  <section class="lunchbox" aria-label="What you can do on KidAppetite">
    <a class="box box-recipes" href="#/recipes">
      <span class="box-emoji" aria-hidden="true">🥕🥦🍠</span>
      <h2>Recipes matched to your child</h2>
      <p>Tell us their age, weight and height, plus anything special like autism, diabetes, reflux or allergies. We pick recipes that fit.</p>
      <span class="box-go">Get recipes</span>
    </a>
    <a class="box box-consult" href="#/consultants">
      <h2>Talk to a food consultant</h2>
      <p>Specialists in children's nutrition, online or in person. Choose a time that works from their calendar.</p>
      <span class="box-go">Book a time</span>
    </a>
    <a class="box box-kitchen" href="#/kitchen">
      <h2>Order from mothers nearby</h2>
      <p>Approved mothers post what they cooked today, made for kids the same age as theirs.</p>
      <span class="box-go">See today's menu</span>
    </a>
  </section>

  <section class="how">
    <h2>How mothers start cooking for their neighbourhood</h2>
    <ol class="steps">
      <li><h3>Create your account</h3><p>Add yourself and your child in two minutes.</p></li>
      <li><h3>Apply to cook</h3><p>Tell us about your kitchen and confirm your food safety training.</p></li>
      <li><h3>Get approved</h3><p>Our team reviews every application before you appear on the menu.</p></li>
      <li><h3>Post and earn</h3><p>Share what you cooked each day. Families nearby order and pick up.</p></li>
    </ol>
  </section>`;
}

function viewRecipes() {
  const u = me();
  const child = u?.children?.[0];
  const p = ui.recipeProfile || (child ? {
    name: child.name, ageMonths: childAge(child), weight: child.weight ?? '', height: child.height ?? '',
    conditions: child.conditions || [], allergies: child.allergies || [], question: ''
  } : { name: '', ageMonths: 0, weight: '', height: '', conditions: [], allergies: [], question: '' });
  const years = p.ageMonths ? Math.floor(p.ageMonths / 12) : '';
  const months = p.ageMonths ? p.ageMonths % 12 : '';
  const checked = (list, v) => (list.includes(v) ? 'checked' : '');

  return `
  <header class="page-head">
    <h1>Recipes matched to your child</h1>
    <p class="lede">A few details about your little one, and we'll suggest recipes that suit their age and needs.</p>
  </header>
  <div class="split">
    <form class="panel" data-form="recipes" novalidate>
      <div class="field"><label for="childName">Child's name <span class="optional">optional</span></label>
        <input id="childName" name="childName" value="${esc(p.name)}" autocomplete="off"></div>
      <div class="row">
        <div class="field"><label for="years">Age: years</label><input id="years" name="years" type="number" min="0" max="12" inputmode="numeric" value="${years}"></div>
        <div class="field"><label for="months">and months</label><input id="months" name="months" type="number" min="0" max="11" inputmode="numeric" value="${months}"></div>
      </div>
      <div class="row">
        <div class="field"><label for="weight">Weight (kg)</label><input id="weight" name="weight" type="number" step="0.1" min="0" value="${esc(p.weight)}"></div>
        <div class="field"><label for="height">Height (cm)</label><input id="height" name="height" type="number" step="0.5" min="0" value="${esc(p.height)}"></div>
      </div>
      <fieldset><legend>Anything we should know?</legend>
        <div class="checks">${CONDITIONS.map((c) => `<label class="check"><input type="checkbox" name="conditions" value="${c.id}" ${checked(p.conditions, c.id)}> ${c.label}</label>`).join('')}</div>
      </fieldset>
      <fieldset><legend>Allergies to avoid</legend>
        <div class="checks">${ALLERGENS.map((a) => `<label class="check"><input type="checkbox" name="allergies" value="${a}" ${checked(p.allergies, a)}> ${a}</label>`).join('')}</div>
      </fieldset>
      <div class="field"><label for="question">A question about food or digestion <span class="optional">optional</span></label>
        <textarea id="question" name="question" rows="3" placeholder="For example: she gets tummy aches after dinner">${esc(p.question)}</textarea></div>
      ${child ? `<label class="check check-plain"><input type="checkbox" name="saveTo" value="${child.id}"> Save these details to ${esc(child.name)}'s profile</label>` : ''}
      <button class="btn btn-tomato btn-big btn-block" type="submit">Show matching recipes</button>
    </form>
    <section id="results" aria-live="polite">
      ${ui.recipeProfile ? recipeResults(ui.recipeProfile) : `<div class="empty"><p class="empty-emoji" aria-hidden="true">🥄</p><p>Fill in the form and your matched recipes will appear here.</p></div>`}
    </section>
  </div>`;
}

function recipeResults(p) {
  const who = p.name ? esc(p.name) : 'your child';
  const facts = [ageLabel(p.ageMonths), p.weight ? `${p.weight} kg` : '', p.height ? `${p.height} cm` : ''].filter(Boolean);
  const need = p.conditions[0] || (p.ageMonths < 12 ? 'solids' : 'picky');

  if (p.ageMonths < 6) {
    return `<div class="notice"><h2>Under 6 months: milk comes first</h2>
      <p>Most babies do best on breast milk or formula alone until around 6 months. A consultant can help you spot signs of readiness for solids.</p>
      <a class="btn btn-banana" href="#/consultants?need=solids">See starting solids consultants</a></div>`;
  }

  const list = matchRecipes(p);
  const notes = p.conditions.map((id) => CONDITIONS.find((c) => c.id === id)).filter(Boolean);

  return `
    <div class="results-head">
      <h2>${list.length} recipe${list.length === 1 ? '' : 's'} for ${who}</h2>
      <div class="tags">${facts.map((f) => `<span class="tag tag-plain">${esc(f)}</span>`).join('')}</div>
    </div>
    ${notes.length ? `<ul class="notes">${notes.map((n) => `<li><strong>${n.label}.</strong> ${esc(n.note)}</li>`).join('')}</ul>` : ''}
    ${p.question ? `<div class="ask"><h3>Your question</h3><blockquote>${esc(p.question)}</blockquote>
      <p>Questions like this deserve an answer from someone who knows ${who}. A consultant can look at the whole picture.</p>
      <a class="btn btn-banana btn-small" href="#/consultants?need=${need}">Find a consultant</a></div>` : ''}
    ${list.length ? `<div class="recipe-list">${list.map(recipeCard).join('')}</div>`
      : `<div class="empty"><p>No recipes match every filter yet. Try removing an allergy, or ask a consultant for a plan built around ${who}.</p></div>`}
    <p class="disclaimer">These suggestions are general ideas, not medical advice. Check with your child's doctor or dietitian, especially for diabetes, allergies or a diagnosed condition.</p>`;
}

function recipeCard(r) {
  return `<details class="recipe">
    <summary>
      <span class="recipe-emoji" aria-hidden="true">${r.emoji}</span>
      <span class="recipe-title">${esc(r.name)}</span>
      <span class="recipe-meta"><span>${ageLabel(r.minMonths)} and up</span><span>${r.time} min</span><span>${esc(r.texture)}</span></span>
      <span class="plus" aria-hidden="true">+</span>
    </summary>
    <div class="recipe-body">
      <div class="tags">${r.tags.map((t) => `<span class="tag">${TAG_LABELS[t]}</span>`).join('')}</div>
      <p class="why">${esc(r.why)}</p>
      <h4>You'll need</h4><ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <h4>Steps</h4><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="allergens">Contains ${allergenText(r.allergens)}.</p>
    </div>
  </details>`;
}

function viewConsultants(parts, q) {
  if (parts[1]) return viewConsultant(parts[1]);
  const mode = q.get('mode') || 'any';
  const need = q.get('need') || 'any';
  let list = consultants().filter((c) => c.status === 'approved');
  if (mode !== 'any') list = list.filter((c) => c.modes.includes(mode));
  if (need !== 'any') list = list.filter((c) => c.specialties.includes(need));
  const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;

  return `
  <header class="page-head">
    <h1>Food consultants for kids</h1>
    <p class="lede">Every consultant is reviewed by our team. Meet online from home or in person nearby.</p>
  </header>
  <form class="filters" onsubmit="return false">
    <div class="field"><label for="need">Help with</label>
      <select id="need" data-change="consult-filter">${opt('any', 'Anything', need)}${Object.entries(SPECIALTIES).map(([k, v]) => opt(k, v, need)).join('')}</select></div>
    <div class="field"><label for="mode">Meeting type</label>
      <select id="mode" data-change="consult-filter">${opt('any', 'Online or in person', mode)}${opt('online', 'Online', mode)}${opt('in-person', 'In person', mode)}</select></div>
  </form>
  ${list.length ? `<div class="cards">${list.map(consultantCard).join('')}</div>`
    : `<div class="empty"><p>No consultants match those filters right now. Try "Online or in person" to see more.</p></div>`}`;
}

function consultantCard(c) {
  const next = upcomingSlots(c)[0];
  return `<article class="card">
    <div class="card-person">${avatar(c)}<div><h2 class="card-title">${esc(c.name)}</h2><p class="muted">${esc(c.title)}</p></div></div>
    <div class="tags">${c.specialties.map((s) => `<span class="tag">${SPECIALTIES[s] || esc(s)}</span>`).join('')}</div>
    <p class="card-line"><strong>${c.modes.map((m) => (m === 'online' ? 'Online' : 'In person')).join(' and ')}</strong>${c.modes.includes('in-person') ? `, ${esc(c.location)}` : ''}</p>
    <p class="card-line muted">${next ? `Next opening ${dateLabel(next.date)}, ${timeLabel(next.times[0])}` : 'Fully booked for two weeks'}</p>
    <div class="card-foot"><span class="price">${money(c.fee)}<small> per session</small></span>
      <a class="btn btn-banana btn-small" href="#/consultants/${c.id}">See times</a></div>
  </article>`;
}

function viewConsultant(id) {
  const c = byId(id);
  if (!c || c.role !== 'consultant' || c.status !== 'approved') return viewNotFound();
  const u = me();
  const slots = upcomingSlots(c);
  if (ui.bookFor !== id || !slots.some((s) => s.date === ui.bookDate)) {
    ui.bookFor = id; ui.bookDate = slots[0]?.date || null; ui.bookTime = null;
  }
  const day = slots.find((s) => s.date === ui.bookDate);
  const canBook = u && (u.role === 'parent' || u.role === 'mother');

  let bookingForm;
  if (!u) {
    bookingForm = `<p>Choose a time above, then <a href="#/signin?next=${encodeURIComponent('#/consultants/' + id)}">sign in</a> or <a href="#/join">create an account</a> to book it.</p>`;
  } else if (!canBook) {
    bookingForm = `<p class="muted">Booking is for parent and mother accounts.</p>`;
  } else {
    const kids = u.children || [];
    bookingForm = `<form data-form="book">
      ${c.modes.length > 1 ? `<fieldset><legend>How would you like to meet?</legend><div class="checks">
        ${c.modes.map((m, i) => `<label class="check"><input type="radio" name="mode" value="${m}" ${i === 0 ? 'checked' : ''}> ${m === 'online' ? 'Online video call' : 'In person at ' + esc(c.location)}</label>`).join('')}
      </div></fieldset>` : `<input type="hidden" name="mode" value="${c.modes[0]}">`}
      ${kids.length ? `<div class="field"><label for="childId">This session is about</label>
        <select id="childId" name="childId">${kids.map((k) => `<option value="${k.id}">${esc(k.name)}, ${ageLabel(childAge(k))}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="note">What would you like to talk about?</label>
        <textarea id="note" name="note" rows="3" placeholder="The more ${esc(firstName(c))} knows, the more useful the session"></textarea></div>
      <button class="btn btn-tomato btn-big btn-block" type="submit" ${ui.bookTime ? '' : 'disabled'}>
        ${ui.bookTime ? `Book ${dateLabel(ui.bookDate)} at ${timeLabel(ui.bookTime)}` : 'Choose a time to book'}</button>
    </form>`;
  }

  return `
  <a class="back" href="#/consultants">All consultants</a>
  <div class="split split-wide">
    <section class="panel profile">
      <div class="card-person">${avatar(c, 'avatar-lg')}<div><h1>${esc(c.name)}</h1><p class="muted">${esc(c.title)}</p></div></div>
      <p>${esc(c.bio)}</p>
      <dl class="facts">
        <div><dt>Helps with</dt><dd>${c.specialties.map((s) => SPECIALTIES[s] || esc(s)).join(', ')}</dd></div>
        <div><dt>Meets</dt><dd>${c.modes.map((m) => (m === 'online' ? 'Online' : 'In person at ' + esc(c.location))).join('; ')}</dd></div>
        <div><dt>Credentials</dt><dd>${esc(c.credentials)}</dd></div>
        <div><dt>Session</dt><dd>${money(c.fee)}, 45 minutes</dd></div>
      </dl>
    </section>
    <section class="panel booking" aria-labelledby="bookTitle">
      <h2 id="bookTitle">Pick a date and time</h2>
      ${slots.length ? `
        <div class="dates" role="group" aria-label="Available dates">
          ${slots.map((s) => {
            const d = new Date(s.date + 'T00:00:00');
            return `<button type="button" class="date-btn" data-action="pick-date" data-date="${s.date}" aria-pressed="${s.date === ui.bookDate}">
              <span>${DAY_NAMES[d.getDay()]}</span><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-CA', { month: 'short' })}</span></button>`;
          }).join('')}
        </div>
        <div class="times" role="group" aria-label="Available times">
          ${day.times.map((t) => `<button type="button" class="time-btn" data-action="pick-time" data-time="${t}" aria-pressed="${t === ui.bookTime}">${timeLabel(t)}</button>`).join('')}
        </div>
        ${bookingForm}`
        : `<div class="empty"><p>${esc(firstName(c))} is fully booked for the next two weeks. Try another consultant or check back soon.</p></div>`}
    </section>
  </div>`;
}

function viewKitchen() {
  const u = me();
  const today = todayISO();
  if (ui.kitchenArea === null) ui.kitchenArea = u?.neighbourhood || 'all';
  let meals = S().meals.filter((m) => m.date === today);
  if (ui.kitchenArea !== 'all') meals = meals.filter((m) => byId(m.cookId)?.neighbourhood === ui.kitchenArea);
  meals.sort((a, b) => (b.portionsLeft > 0) - (a.portionsLeft > 0));

  return `
  <header class="page-head">
    <h1>Mothers\u2019 kitchen</h1>
    <p class="lede">Today's home cooked meals from approved mothers in your neighbourhood. Order before it runs out, then pick it up at the time shown.</p>
  </header>
  ${cookPanel(u)}
  <form class="filters" onsubmit="return false">
    <div class="field"><label for="area">Neighbourhood</label>
      <select id="area" data-change="kitchen-area">
        <option value="all" ${ui.kitchenArea === 'all' ? 'selected' : ''}>All neighbourhoods</option>
        ${NEIGHBOURHOODS.map((n) => `<option ${n === ui.kitchenArea ? 'selected' : ''}>${n}</option>`).join('')}
      </select></div>
    <p class="muted menu-date">Menu for ${dateLabel(today)}</p>
  </form>
  ${meals.length ? `<div class="cards">${meals.map((m) => mealCard(m, u)).join('')}</div>`
    : `<div class="empty"><p>No meals posted in ${esc(ui.kitchenArea)} yet today. Try all neighbourhoods, or check back this afternoon.</p></div>`}`;
}

function cookPanel(u) {
  if (!u) return `<div class="callout"><p><strong>Love to cook?</strong> Mothers can apply to cook for families nearby and earn from home.</p><a class="btn btn-small" href="#/join">Join as a mother</a></div>`;
  if (u.role !== 'mother') return '';
  if (u.cookStatus === 'pending') return `<div class="callout callout-wait"><p><strong>Your cooking application is being reviewed.</strong> You'll be able to post meals as soon as it's approved.</p></div>`;
  if (u.cookStatus !== 'approved') return `<div class="callout"><p><strong>Want to cook for other families?</strong> Apply once, and after approval you can post meals every day.</p><a class="btn btn-small" href="#/apply">Apply to cook</a></div>`;
  const postedToday = S().meals.some((m) => m.cookId === u.id && m.date === todayISO());
  return `<details class="panel post-meal" ${postedToday ? '' : 'open'}>
    <summary><h2>Post today's meal</h2></summary>
    <form data-form="post-meal">
      <div class="field"><label for="mTitle">Meal name</label><input id="mTitle" name="title" required maxlength="80" placeholder="For example: salmon and sweet potato fishcakes"></div>
      <div class="field"><label for="mDesc">Description</label><textarea id="mDesc" name="description" rows="2" required maxlength="240" placeholder="What's in it, texture, portion size"></textarea></div>
      <div class="row">
        <div class="field"><label for="ageMin">Youngest age (months)</label><input id="ageMin" name="ageMin" type="number" min="6" max="144" required value="12"></div>
        <div class="field"><label for="ageMax">Oldest age (months)</label><input id="ageMax" name="ageMax" type="number" min="6" max="144" required value="48"></div>
        <div class="field"><label for="portions">Portions</label><input id="portions" name="portions" type="number" min="1" max="30" required value="6"></div>
        <div class="field"><label for="price">Price per portion ($)</label><input id="price" name="price" type="number" min="1" step="0.5" required value="7"></div>
      </div>
      <fieldset><legend>Contains</legend><div class="checks">
        ${ALLERGENS.map((a) => `<label class="check"><input type="checkbox" name="allergens" value="${a}"> ${a}</label>`).join('')}
      </div><p class="hint">Tick every allergen in the meal. Families filter by these.</p></fieldset>
      <div class="field"><label for="pickup">Pickup window</label><input id="pickup" name="pickup" required placeholder="For example: 5:00 to 6:30 pm"></div>
      <button class="btn btn-tomato" type="submit">Post to today's menu</button>
    </form>
  </details>`;
}

function mealCard(m, u) {
  const cook = byId(m.cookId);
  const cookChild = cook?.children?.[0];
  const fits = (u?.children || []).filter((k) => { const a = childAge(k); return a >= m.ageMin && a <= m.ageMax; });
  const soldOut = m.portionsLeft <= 0;
  const mine = u && m.cookId === u.id;
  return `<article class="card meal ${soldOut ? 'is-soldout' : ''}">
    ${soldOut ? '<span class="stamp">Sold out</span>' : ''}
    <div class="meal-top"><h2 class="card-title">${esc(m.title)}</h2><span class="price">${money(m.price)}</span></div>
    <p>${esc(m.description)}</p>
    <div class="tags">
      <span class="tag tag-plain">For ${ageLabel(m.ageMin)} to ${ageLabel(m.ageMax)}</span>
      ${fits.map((k) => `<span class="tag">Fits ${esc(k.name)}'s age</span>`).join('')}
      ${m.allergens.map((a) => `<span class="tag tag-warn">Contains ${a}</span>`).join('')}
    </div>
    <div class="card-person card-person-sm">${cook ? avatar(cook, 'avatar-sm') : ''}<p class="muted">Cooked by <strong>${esc(cook?.name || 'a mother')}</strong>${cookChild ? `, mum to a ${ageAdj(childAge(cookChild))}` : ''}<br>${esc(cook?.neighbourhood || '')}, pickup ${esc(m.pickup)}</p></div>
    <div class="card-foot">
      <span class="muted">${soldOut ? 'All portions ordered' : `${m.portionsLeft} of ${m.portions} left`}</span>
      ${mine ? '<span class="status status-approved">Your meal</span>' : soldOut ? '' : `<span class="order-row">
        <label class="sr-only" for="qty-${m.id}">Portions</label>
        <select id="qty-${m.id}">${Array.from({ length: Math.min(m.portionsLeft, 5) }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>
        <button class="btn btn-tomato btn-small" data-action="order" data-meal="${m.id}">Order</button></span>`}
    </div>
  </article>`;
}

function viewJoin() {
  if (me()) return `<section class="gate"><h1>You're already signed in</h1><div class="actions"><a class="btn btn-tomato" href="#/dashboard">Go to my space</a></div></section>`;
  const nOpts = NEIGHBOURHOODS.map((n) => `<option>${n}</option>`).join('');
  return `
  <header class="page-head"><h1>Join KidAppetite</h1><p class="lede">Choose how you'll use KidAppetite. You can add more children later.</p></header>
  <form class="panel form-narrow" data-form="join">
    <fieldset><legend>I am a</legend>
      <div class="roles">
        <label class="role"><input type="radio" name="role" value="parent" checked data-change="join-role"><strong>Parent</strong><span>Get recipes, book consultants and order meals.</span></label>
        <label class="role"><input type="radio" name="role" value="mother" data-change="join-role"><strong>Mother who cooks</strong><span>Everything parents get, plus apply to cook for families nearby.</span></label>
        <label class="role"><input type="radio" name="role" value="consultant" data-change="join-role"><strong>Food consultant</strong><span>Offer sessions online or in person and manage your calendar.</span></label>
      </div>
    </fieldset>
    <div class="row">
      <div class="field"><label for="jName">Your full name</label><input id="jName" name="name" required autocomplete="name"></div>
      <div class="field"><label for="jEmail">Email</label><input id="jEmail" name="email" type="email" required autocomplete="email"></div>
    </div>
    <div class="field"><label for="jArea">Neighbourhood</label><select id="jArea" name="neighbourhood">${nOpts}</select></div>

    <fieldset data-for-role="parent mother"><legend>Your child</legend>
      <div class="row">
        <div class="field"><label for="jChild">Child's name</label><input id="jChild" name="childName" required></div>
        <div class="field"><label for="jYears">Age: years</label><input id="jYears" name="childYears" type="number" min="0" max="12" value="1"></div>
        <div class="field"><label for="jMonths">and months</label><input id="jMonths" name="childMonths" type="number" min="0" max="11" value="0"></div>
      </div>
    </fieldset>

    <fieldset data-for-role="mother"><legend>Cooking for others</legend>
      <label class="check check-plain"><input type="checkbox" name="wantsToCook" value="yes" data-change="join-role"> I'd like to apply to cook for other families now</label>
      <fieldset data-cook-fields class="nested">
        <label class="check check-plain"><input type="checkbox" name="foodSafe" value="yes"> I hold a food safety certificate (such as FoodSafe Level 1) or will complete one before cooking</label>
        <div class="field"><label for="jKitchen">Tell us about your kitchen</label><textarea id="jKitchen" name="kitchen" rows="2" placeholder="Pets, prep space, how you handle allergens"></textarea></div>
        <div class="field"><label for="jDishes">Dishes you'd like to cook</label><input id="jDishes" name="dishes"></div>
      </fieldset>
    </fieldset>

    <fieldset data-for-role="consultant"><legend>Your practice</legend>
      <div class="field"><label for="jTitle">Professional title</label><input id="jTitle" name="title" required placeholder="For example: Pediatric dietitian, RD"></div>
      <div class="field"><label for="jCred">Credentials</label><input id="jCred" name="credentials" required placeholder="Registration body and number"></div>
      <fieldset><legend>Specialties</legend><div class="checks">
        ${Object.entries(SPECIALTIES).map(([k, v]) => `<label class="check"><input type="checkbox" name="specialties" value="${k}"> ${v}</label>`).join('')}</div></fieldset>
      <fieldset><legend>I meet families</legend><div class="checks">
        <label class="check"><input type="checkbox" name="modes" value="online" checked> Online</label>
        <label class="check"><input type="checkbox" name="modes" value="in-person"> In person</label></div></fieldset>
      <div class="row">
        <div class="field"><label for="jLoc">Clinic or meeting location</label><input id="jLoc" name="location" placeholder="Online"></div>
        <div class="field"><label for="jFee">Fee per session ($)</label><input id="jFee" name="fee" type="number" min="0" value="90" required></div>
      </div>
      <div class="field"><label for="jBio">Short bio</label><textarea id="jBio" name="bio" rows="3" required></textarea></div>
    </fieldset>

    <button class="btn btn-tomato btn-big btn-block" type="submit">Create my account</button>
    <p class="hint center">Already have an account? <a href="#/signin">Sign in</a></p>
  </form>`;
}

function syncJoinForm() {
  const f = $('form[data-form="join"]');
  if (!f) return;
  const role = f.elements.role.value;
  f.querySelectorAll('[data-for-role]').forEach((fs) => {
    const show = fs.dataset.forRole.split(' ').includes(role);
    fs.hidden = !show; fs.disabled = !show;
  });
  const cook = f.querySelector('[data-cook-fields]');
  const on = role === 'mother' && f.elements.wantsToCook.checked;
  cook.hidden = !on; cook.disabled = !on;
}

function viewSignin(parts, q) {
  const demo = [
    ['u-parent-sara', 'A parent with a picky toddler'],
    ['u-mom-lena', 'An approved mother who cooks'],
    ['u-mom-carla', 'A mother waiting for approval'],
    ['u-con-nadia', 'A consultant with a booking'],
    ['u-admin', 'The KidAppetite team (approvals)']
  ].map(([id, what]) => ({ u: byId(id), what })).filter((x) => x.u);
  const next = q.get('next') || '';
  return `
  <header class="page-head"><h1>Sign in</h1><p class="lede">This is a demo, so there are no passwords yet. Use your email, or try one of the sample accounts.</p></header>
  <div class="split">
    <form class="panel" data-form="signin">
      <input type="hidden" name="next" value="${esc(next)}">
      <div class="field"><label for="sEmail">Email</label><input id="sEmail" name="email" type="email" required autocomplete="email"></div>
      <button class="btn btn-tomato btn-big btn-block" type="submit">Sign in</button>
      <p class="hint center">New here? <a href="#/join">Create an account</a></p>
    </form>
    <section class="panel">
      <h2>Try a sample account</h2>
      <ul class="list">${demo.map(({ u, what }) => `<li><span class="card-person card-person-sm">${avatar(u, 'avatar-sm')}<span><strong>${esc(u.name)}</strong><br><span class="muted">${what}</span></span></span>
        <button class="btn btn-small" data-action="signin-as" data-id="${u.id}" data-next="${esc(next)}">Use this account</button></li>`).join('')}</ul>
    </section>
  </div>`;
}

function viewApply() {
  const u = me();
  if (!u) return gate('Sign in to apply to cook', '#/apply');
  if (u.role !== 'mother') return `<section class="gate"><h1>Cooking is for mother accounts</h1><p class="lede">Create a mother account to apply to cook for families nearby.</p></section>`;
  if (u.cookStatus === 'approved') return `<section class="gate"><h1>You're approved to cook</h1><div class="actions"><a class="btn btn-tomato" href="#/kitchen">Post today's meal</a></div></section>`;
  if (u.cookStatus === 'pending') return `<section class="gate"><h1>Your application is being reviewed</h1><p class="lede">We'll let you know as soon as you're approved.</p></section>`;
  return `
  <header class="page-head"><h1>Apply to cook for families nearby</h1>
    <p class="lede">Our team reviews every application. Once approved, you can post a meal each day and earn from every order.</p></header>
  <form class="panel form-narrow" data-form="apply">
    ${u.cookStatus === 'declined' ? '<div class="notice"><p>Your last application wasn\u2019t approved. Update your details and apply again.</p></div>' : ''}
    <label class="check check-plain"><input type="checkbox" name="foodSafe" value="yes" required> I hold a food safety certificate (such as FoodSafe Level 1) or will complete one before cooking</label>
    <div class="field"><label for="aKitchen">Tell us about your kitchen</label><textarea id="aKitchen" name="kitchen" rows="3" required placeholder="Pets, prep space, how you handle allergens"></textarea></div>
    <div class="field"><label for="aDishes">Dishes you'd like to cook</label><input id="aDishes" name="dishes" required></div>
    <label class="check check-plain"><input type="checkbox" name="labels" value="yes" required> I'll label every meal with its ingredients and allergens</label>
    <button class="btn btn-tomato btn-big btn-block" type="submit">Send application</button>
  </form>`;
}

function viewDashboard() {
  const u = me();
  if (!u) return gate('Sign in to see your space', '#/dashboard');
  if (u.role === 'consultant') return consultantDashboard(u);
  if (u.role === 'admin') return viewAdmin();
  return familyDashboard(u);
}

function familyDashboard(u) {
  const bookings = S().bookings.filter((b) => b.parentId === u.id && b.status === 'booked').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const orders = S().orders.filter((o) => o.buyerId === u.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const kids = u.children || [];
  const condLabel = (id) => CONDITIONS.find((c) => c.id === id)?.label || id;

  return `
  <header class="page-head"><h1>Hi, ${esc(firstName(u))}</h1><p class="lede">Your children, consultations and orders in one place.</p></header>
  <div class="dash">
    <section class="panel">
      <h2>Children</h2>
      <ul class="list">${kids.map((k) => `<li><span><strong>${esc(k.name)}</strong>, ${ageLabel(childAge(k))}
        ${k.conditions?.length ? `<br><span class="muted">${k.conditions.map(condLabel).join(', ')}</span>` : ''}</span>
        <a class="btn btn-small" href="#/recipes">Recipes</a></li>`).join('')}</ul>
      <details class="add-child"><summary>Add a child</summary>
        <form data-form="add-child">
          <div class="row">
            <div class="field"><label for="cName">Name</label><input id="cName" name="name" required></div>
            <div class="field"><label for="cYears">Years</label><input id="cYears" name="years" type="number" min="0" max="12" value="0"></div>
            <div class="field"><label for="cMonths">Months</label><input id="cMonths" name="months" type="number" min="0" max="11" value="6"></div>
          </div>
          <button class="btn btn-banana btn-small" type="submit">Add child</button>
        </form>
      </details>
    </section>

    <section class="panel">
      <h2>Upcoming consultations</h2>
      ${bookings.length ? `<ul class="list">${bookings.map((b) => {
        const c = byId(b.consultantId);
        const kid = kids.find((k) => k.id === b.childId);
        return `<li><span><strong>${dateLabel(b.date)}, ${timeLabel(b.time)}</strong><br>
          <span class="muted">${esc(c?.name || 'Consultant')}, ${b.mode === 'online' ? 'online' : 'in person'}${kid ? ` about ${esc(kid.name)}` : ''}</span></span>
          <button class="btn btn-ghost btn-small" data-action="cancel-booking" data-id="${b.id}">Cancel</button></li>`;
      }).join('')}</ul>` : `<div class="empty empty-sm"><p>No sessions booked.</p><a class="btn btn-small" href="#/consultants">Find a consultant</a></div>`}
    </section>

    <section class="panel">
      <h2>Recent orders</h2>
      ${orders.length ? `<ul class="list">${orders.map((o) => `<li><span><strong>${o.qty} × ${esc(o.title)}</strong><br>
        <span class="muted">From ${esc(byId(o.cookId)?.name || 'a mother')}, pickup ${esc(o.pickup)} on ${dateLabel(o.date)}</span></span>
        <span class="price price-sm">${money(o.qty * o.price)}</span></li>`).join('')}</ul>`
        : `<div class="empty empty-sm"><p>No orders yet.</p><a class="btn btn-small" href="#/kitchen">See today's menu</a></div>`}
    </section>

    ${u.role === 'mother' ? cookingSummary(u) : ''}
  </div>`;
}

function cookingSummary(u) {
  const status = u.cookStatus || 'none';
  const label = { approved: 'Approved to cook', pending: 'Application in review', declined: 'Not approved', none: 'Not applied yet' }[status];
  let body = '';
  if (status === 'approved') {
    const myMeals = S().meals.filter((m) => m.cookId === u.id && m.date === todayISO());
    const earned = S().orders.filter((o) => o.cookId === u.id).reduce((sum, o) => sum + o.qty * o.price, 0);
    body = `<p class="big-number">${money(earned)}<small> earned from orders so far</small></p>
      ${myMeals.length ? `<ul class="list">${myMeals.map((m) => `<li><span><strong>${esc(m.title)}</strong><br><span class="muted">${m.portions - m.portionsLeft} of ${m.portions} portions ordered</span></span></li>`).join('')}</ul>`
        : '<p class="muted">You haven\u2019t posted a meal today.</p>'}
      <a class="btn btn-tomato btn-small" href="#/kitchen">Post today's meal</a>`;
  } else if (status === 'pending') {
    body = '<p>Our team is reviewing your application. You\u2019ll be able to post meals once approved.</p>';
  } else {
    body = '<p>Apply once to cook for families in your neighbourhood.</p><a class="btn btn-tomato btn-small" href="#/apply">Apply to cook</a>';
  }
  return `<section class="panel"><h2>My cooking</h2><p><span class="status status-${status}">${label}</span></p>${body}</section>`;
}

function consultantDashboard(u) {
  const bookings = S().bookings.filter((b) => b.consultantId === u.id && b.status === 'booked').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const std = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const hours = [...new Set([...std, ...u.availability.hours])].sort();
  return `
  <header class="page-head"><h1>Hi, ${esc(firstName(u))}</h1>
    <p class="lede">${u.status === 'approved' ? 'Families can see your profile and book open times.' : 'Your profile is being reviewed. Families will see you once it is approved.'}</p></header>
  <div class="dash">
    <section class="panel">
      <h2>Upcoming sessions</h2>
      ${bookings.length ? `<ul class="list list-stack">${bookings.map((b) => {
        const parent = byId(b.parentId);
        const kid = parent?.children?.find((k) => k.id === b.childId);
        return `<li><div><strong>${dateLabel(b.date)}, ${timeLabel(b.time)}</strong> <span class="status status-approved">${b.mode === 'online' ? 'Online' : 'In person'}</span>
          <p class="muted">${esc(parent?.name || 'A parent')}${kid ? `, about ${esc(kid.name)} (${ageLabel(childAge(kid))})` : ''}</p>
          ${b.note ? `<blockquote>${esc(b.note)}</blockquote>` : ''}</div>
          <button class="btn btn-small" data-action="done-booking" data-id="${b.id}">Mark as done</button></li>`;
      }).join('')}</ul>` : '<div class="empty empty-sm"><p>No sessions booked yet.</p></div>'}
    </section>
    <section class="panel">
      <h2>My availability</h2>
      <form data-form="availability">
        <fieldset><legend>Days I work</legend><div class="checks">
          ${DAY_NAMES.map((d, i) => `<label class="check"><input type="checkbox" name="days" value="${i}" ${u.availability.days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></fieldset>
        <fieldset><legend>Session start times</legend><div class="checks">
          ${hours.map((h) => `<label class="check"><input type="checkbox" name="hours" value="${h}" ${u.availability.hours.includes(h) ? 'checked' : ''}> ${timeLabel(h)}</label>`).join('')}</div></fieldset>
        <button class="btn btn-tomato" type="submit">Save availability</button>
      </form>
    </section>
    <section class="panel">
      <h2>My profile</h2>
      <div class="card-person">${avatar(u)}<div><strong>${esc(u.name)}</strong><p class="muted">${esc(u.title)}</p></div></div>
      <p><span class="status status-${u.status}">${u.status === 'approved' ? 'Approved and listed' : 'In review'}</span></p>
      <p>${esc(u.bio)}</p>
      ${u.status === 'approved' ? `<a class="btn btn-small" href="#/consultants/${u.id}">View my public page</a>` : ''}
    </section>
  </div>`;
}

function viewAdmin() {
  const u = me();
  if (!u) return gate('Sign in to review applications', '#/admin');
  if (u.role !== 'admin') return `<section class="gate"><h1>This page is for the KidAppetite team</h1></section>`;
  const cooks = S().users.filter((x) => x.role === 'mother' && x.cookStatus === 'pending');
  const cons = consultants().filter((x) => x.status === 'pending');
  const counts = {
    families: S().users.filter((x) => x.role === 'parent' || x.role === 'mother').length,
    cooks: S().users.filter((x) => x.cookStatus === 'approved').length,
    consultants: consultants().filter((x) => x.status === 'approved').length,
    orders: S().orders.length
  };
  const row = (x, detail) => `<li><div><span class="card-person card-person-sm">${avatar(x, 'avatar-sm')}<span><strong>${esc(x.name)}</strong><br><span class="muted">${esc(x.neighbourhood || '')}, ${esc(x.email)}</span></span></span>${detail}</div>
    <span class="btn-pair"><button class="btn btn-tomato btn-small" data-action="approve" data-id="${x.id}">Approve</button>
    <button class="btn btn-ghost btn-small" data-action="decline" data-id="${x.id}">Decline</button></span></li>`;
  return `
  <header class="page-head"><h1>Approvals</h1><p class="lede">Review mothers who want to cook and consultants who want to be listed.</p></header>
  <dl class="stats">
    <div><dt>Families</dt><dd>${counts.families}</dd></div>
    <div><dt>Approved cooks</dt><dd>${counts.cooks}</dd></div>
    <div><dt>Listed consultants</dt><dd>${counts.consultants}</dd></div>
    <div><dt>Meal orders</dt><dd>${counts.orders}</dd></div>
  </dl>
  <div class="dash">
    <section class="panel"><h2>Mothers applying to cook</h2>
      ${cooks.length ? `<ul class="list list-stack">${cooks.map((x) => row(x, `
        <p class="app-detail"><strong>Food safety:</strong> ${x.cookApplication?.foodSafe ? 'Confirmed' : 'Not confirmed'}<br>
        <strong>Kitchen:</strong> ${esc(x.cookApplication?.kitchen || 'Not given')}<br>
        <strong>Dishes:</strong> ${esc(x.cookApplication?.dishes || 'Not given')}</p>`)).join('')}</ul>`
        : '<div class="empty empty-sm"><p>No cooking applications waiting.</p></div>'}
    </section>
    <section class="panel"><h2>Consultants applying</h2>
      ${cons.length ? `<ul class="list list-stack">${cons.map((x) => row(x, `
        <p class="app-detail"><strong>${esc(x.title)}</strong><br><strong>Credentials:</strong> ${esc(x.credentials)}<br>
        <strong>Specialties:</strong> ${x.specialties.map((s) => SPECIALTIES[s] || s).join(', ')}</p>`)).join('')}</ul>`
        : '<div class="empty empty-sm"><p>No consultant applications waiting.</p></div>'}
    </section>
  </div>`;
}

function viewNotFound() {
  return `<section class="gate"><h1>We couldn't find that page</h1><p class="lede">It may have moved. Head back to the start.</p>
    <div class="actions"><a class="btn btn-tomato" href="#/">Go to the home page</a></div></section>`;
}

/* ---------- actions (clicks) ---------- */
const actions = {
  'nav-toggle'(el) {
    const h = $('.site-header');
    const open = h.classList.toggle('open');
    el.setAttribute('aria-expanded', String(open));
  },
  signout() { S().sessionUserId = null; Store.save(); ui.kitchenArea = null; ui.recipeProfile = null; toast('Signed out'); go('#/'); render(true); },
  'signin-as'(el) { signIn(byId(el.dataset.id), el.dataset.next); },
  'pick-date'(el) { ui.bookDate = el.dataset.date; ui.bookTime = null; render(); $(`[data-date="${ui.bookDate}"]`)?.focus(); },
  'pick-time'(el) { ui.bookTime = el.dataset.time; render(); $(`[data-time="${ui.bookTime}"]`)?.focus(); },
  order(el) {
    const u = me();
    if (!u) { go('#/signin?next=' + encodeURIComponent('#/kitchen')); return; }
    if (u.role !== 'parent' && u.role !== 'mother') { toast('Ordering is for parent and mother accounts.'); return; }
    const m = S().meals.find((x) => x.id === el.dataset.meal);
    if (!m) return;
    const qty = Number($(`#qty-${m.id}`)?.value || 1);
    if (qty > m.portionsLeft) { toast(`Only ${m.portionsLeft} left.`); return; }
    m.portionsLeft -= qty;
    S().orders.push({ id: uid('o'), mealId: m.id, buyerId: u.id, cookId: m.cookId, title: m.title, price: m.price, qty, pickup: m.pickup, date: m.date, status: 'confirmed', createdAt: Date.now() });
    Store.save();
    toast(`Ordered ${qty} × ${m.title}. Pickup ${m.pickup}.`);
    render();
  },
  'cancel-booking'(el) { setBooking(el.dataset.id, 'cancelled', 'Consultation cancelled'); },
  'done-booking'(el) { setBooking(el.dataset.id, 'done', 'Marked as done'); },
  approve(el) { review(el.dataset.id, 'approved'); },
  decline(el) { review(el.dataset.id, 'declined'); },
  'reset-demo'() {
    if (!confirm('Reset all demo data? Accounts, bookings and orders you created will be removed.')) return;
    Store.reset(); Object.assign(ui, { recipeProfile: null, bookFor: null, bookDate: null, bookTime: null, kitchenArea: null });
    toast('Demo data reset'); go('#/'); render(true);
  }
};

function signIn(u, next) {
  if (!u) return;
  S().sessionUserId = u.id; Store.save();
  ui.kitchenArea = null; ui.recipeProfile = null;
  toast(`Welcome back, ${firstName(u)}`);
  const target = next && next.startsWith('#/') && !next.startsWith('#/signin') ? next : (u.role === 'admin' ? '#/admin' : '#/dashboard');
  if (location.hash === target) render(true); else go(target);
}
function setBooking(id, status, msg) {
  const b = S().bookings.find((x) => x.id === id);
  if (!b) return;
  b.status = status; Store.save(); toast(msg); render();
}
function review(id, status) {
  const x = byId(id);
  if (!x) return;
  if (x.role === 'mother') x.cookStatus = status; else x.status = status;
  Store.save();
  toast(`${status === 'approved' ? 'Approved' : 'Declined'} ${x.name}`);
  render();
}

/* ---------- forms ---------- */
const num = (v) => (v === null || v === '' ? null : Number(v));
const forms = {
  recipes(f, fd) {
    const ageMonths = (num(fd.get('years')) || 0) * 12 + (num(fd.get('months')) || 0);
    if (ageMonths <= 0) { toast('Add your child\u2019s age to see recipes.'); $('#years').focus(); return; }
    const p = {
      name: String(fd.get('childName') || '').trim(), ageMonths,
      weight: num(fd.get('weight')), height: num(fd.get('height')),
      conditions: fd.getAll('conditions'), allergies: fd.getAll('allergies'),
      question: String(fd.get('question') || '').trim()
    };
    ui.recipeProfile = p;
    const saveId = fd.get('saveTo');
    if (saveId) {
      const child = me()?.children?.find((c) => c.id === saveId);
      if (child) {
        Object.assign(child, { ageMonths, ageRecordedOn: todayISO(), weight: p.weight, height: p.height, conditions: p.conditions, allergies: p.allergies });
        if (p.name) child.name = p.name;
        Store.save(); toast(`Saved to ${child.name}'s profile`);
      }
    }
    render();
    $('#results')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  },

  signin(f, fd) {
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const u = S().users.find((x) => x.email.toLowerCase() === email);
    if (!u) { toast('No account uses that email. Check it, or create an account.'); return; }
    signIn(u, fd.get('next'));
  },

  join(f, fd) {
    if (!f.reportValidity()) return;
    const role = fd.get('role');
    const email = String(fd.get('email')).trim().toLowerCase();
    if (S().users.some((x) => x.email.toLowerCase() === email)) { toast('That email already has an account. Sign in instead.'); return; }
    const u = { id: uid('u'), role, name: String(fd.get('name')).trim(), email, neighbourhood: fd.get('neighbourhood'), createdAt: Date.now() };
    if (role === 'parent' || role === 'mother') {
      u.children = [{ id: uid('c'), name: String(fd.get('childName')).trim(), ageMonths: (num(fd.get('childYears')) || 0) * 12 + (num(fd.get('childMonths')) || 0), ageRecordedOn: todayISO(), conditions: [], allergies: [] }];
    }
    if (role === 'mother') {
      const wants = fd.get('wantsToCook') === 'yes';
      if (wants && fd.get('foodSafe') !== 'yes') { toast('Confirm your food safety training to apply to cook.'); return; }
      u.cookStatus = wants ? 'pending' : 'none';
      if (wants) u.cookApplication = { foodSafe: true, kitchen: fd.get('kitchen') || '', dishes: fd.get('dishes') || '', submittedAt: Date.now() };
    }
    if (role === 'consultant') {
      const specialties = fd.getAll('specialties'), modes = fd.getAll('modes');
      if (!specialties.length) { toast('Choose at least one specialty.'); return; }
      if (!modes.length) { toast('Choose online, in person, or both.'); return; }
      Object.assign(u, {
        title: fd.get('title'), credentials: fd.get('credentials'), specialties, modes,
        location: String(fd.get('location') || '').trim() || 'Online', fee: num(fd.get('fee')) || 0, bio: fd.get('bio'),
        status: 'pending', availability: { days: [1, 2, 3, 4, 5], hours: ['09:00', '10:00', '11:00', '14:00', '15:00'] }
      });
    }
    S().users.push(u); S().sessionUserId = u.id; Store.save();
    toast(`Welcome to KidAppetite, ${firstName(u)}`);
    go('#/dashboard');
  },

  book(f, fd) {
    const u = me();
    const c = byId(ui.bookFor);
    if (!u || !c || !ui.bookTime) return;
    const clash = S().bookings.some((b) => b.consultantId === c.id && b.date === ui.bookDate && b.time === ui.bookTime && b.status === 'booked');
    if (clash) { toast('That time was just taken. Please pick another.'); ui.bookTime = null; render(); return; }
    S().bookings.push({ id: uid('b'), consultantId: c.id, parentId: u.id, childId: fd.get('childId') || null, date: ui.bookDate, time: ui.bookTime,
      mode: fd.get('mode'), note: String(fd.get('note') || '').trim(), status: 'booked', createdAt: Date.now() });
    Store.save();
    toast(`Booked with ${c.name}, ${dateLabel(ui.bookDate)} at ${timeLabel(ui.bookTime)}`);
    ui.bookFor = null; ui.bookTime = null;
    go('#/dashboard');
  },

  'post-meal'(f, fd) {
    const u = me();
    if (!u || u.role !== 'mother' || u.cookStatus !== 'approved') return;
    if (!f.reportValidity()) return;
    const ageMin = num(fd.get('ageMin')), ageMax = num(fd.get('ageMax')), portions = num(fd.get('portions'));
    if (ageMax < ageMin) { toast('The oldest age needs to be the same as or higher than the youngest.'); return; }
    S().meals.push({ id: uid('m'), cookId: u.id, date: todayISO(), title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim(),
      ageMin, ageMax, portions, portionsLeft: portions, price: num(fd.get('price')), allergens: fd.getAll('allergens'), pickup: String(fd.get('pickup')).trim(), demo: false });
    Store.save(); toast('Posted to today\u2019s menu'); render();
  },

  apply(f, fd) {
    const u = me();
    if (!u || !f.reportValidity()) return;
    u.cookStatus = 'pending';
    u.cookApplication = { foodSafe: true, kitchen: fd.get('kitchen'), dishes: fd.get('dishes'), submittedAt: Date.now() };
    Store.save(); toast('Application sent'); go('#/dashboard');
  },

  'add-child'(f, fd) {
    const u = me();
    if (!u || !f.reportValidity()) return;
    const name = String(fd.get('name')).trim();
    u.children = u.children || [];
    u.children.push({ id: uid('c'), name, ageMonths: (num(fd.get('years')) || 0) * 12 + (num(fd.get('months')) || 0), ageRecordedOn: todayISO(), conditions: [], allergies: [] });
    Store.save(); toast(`Added ${name}`); render();
  },

  availability(f, fd) {
    const u = me();
    const days = fd.getAll('days').map(Number).sort();
    const hours = fd.getAll('hours').sort();
    if (!days.length || !hours.length) { toast('Pick at least one day and one start time.'); return; }
    u.availability = { days, hours }; Store.save(); toast('Availability saved'); render();
  }
};

/* ---------- change handlers ---------- */
const changes = {
  'consult-filter'(el) {
    const need = $('#need').value, mode = $('#mode').value, activeId = el.id;
    const qs = new URLSearchParams();
    if (need !== 'any') qs.set('need', need);
    if (mode !== 'any') qs.set('mode', mode);
    history.replaceState(null, '', `#/consultants${qs.toString() ? '?' + qs : ''}`);
    render();
    $('#' + activeId)?.focus();
  },
  'kitchen-area'(el) { ui.kitchenArea = el.value; render(); $('#area')?.focus(); },
  'join-role'() { syncJoinForm(); }
};

/* ---------- boot ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  actions[el.dataset.action](el);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f || !forms[f.dataset.form]) return;
  e.preventDefault();
  forms[f.dataset.form](f, new FormData(f));
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el);
});
window.addEventListener('hashchange', () => render(true));

Store.load();
render(true);
