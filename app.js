/* =========================================================
   Plans — v1.0.0
   Make plans the fun way. Vanilla JS, offline-ready PWA.
   ========================================================= */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pick = a => a[Math.floor(Math.random() * a.length)];
const pad = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const setPath = (o, path, v) => { const k = path.split('.'); let t = o; for (let i = 0; i < k.length - 1; i++) t = t[k[i]]; t[k[k.length - 1]] = v; };

/* ---------- storage ---------- */
const K = { plans: 'plans.v1', settings: 'plans.settings.v1', draft: 'plans.draft.v1' };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Storage is full 😬 Try removing some attachments.'); } };
let plans = load(K.plans, []);
let settings = Object.assign({ sound: true, transition: 'mix', theme: 'party', alarm: 60, launchNew: true }, load(K.settings, {}));
const savePlans = () => save(K.plans, plans);
const saveSettings = () => save(K.settings, settings);

/* IndexedDB for attachments (photos/files can be big) */
const FileDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('plans-files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => { this._db = r.result; res(r.result); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('files', mode); const st = t.objectStore('files');
      const req = fn(st); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    });
  },
  put(id, v) { return this.tx('readwrite', s => s.put(v, id)); },
  get(id) { return this.tx('readonly', s => s.get(id)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  keys() { return this.tx('readonly', s => s.getAllKeys()); }
};

/* ---------- data ---------- */
const STEPS = [
  { key: 'name',   emoji: '🎉', title: "What's the occasion?",     sub: 'Give it a name worthy of the group chat.' },
  { key: 'where',  emoji: '📍', title: 'Where is it happening?',   sub: 'Search a venue or address, or keep it mysterious.', optional: true },
  { key: 'when',   emoji: '⏰', title: 'When, and for how long?',  sub: 'Pick a day, a time, and a vibe-length.' },
  { key: 'dress',  emoji: '👗', title: "What's the dress code?",   sub: 'Sweatpants or sequins? You decide.', optional: true },
  { key: 'guests', emoji: '🧑‍🤝‍🧑', title: "Who's coming?",          sub: 'Type a name, hit enter. Repeat until popular.', optional: true },
  { key: 'food',   emoji: '🍕', title: 'Are we expecting food?',   sub: 'Honestly the most important question.', optional: true },
  { key: 'drinks', emoji: '🍹', title: 'Are we expecting drinks?', sub: 'Hydration is a party skill.', optional: true },
  { key: 'notes',  emoji: '📝', title: 'Anything else?',           sub: 'Notes, tickets, reservation numbers, screenshots.', optional: true },
  { key: 'review', emoji: '✨', title: 'Look at this plan!',       sub: 'Tap any line to tweak it.' }
];
const STEP_IX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

const OCCASIONS = [['Birthday Bash','🎂'],['Dinner','🍝'],['Game Night','🎲'],['Date Night','💘'],['Brunch','🥞'],['Concert','🎸'],['Movie Night','🍿'],['Happy Hour','🍻'],['House Party','🪩'],['Hangout','😎'],['Road Trip','🚗'],['Friendsgiving','🦃'],['Holiday Party','🎄'],['Sports Game','🏟️'],['Karaoke','🎤'],['Beach Day','🏖️'],['Meeting','💼'],['Trip','✈️']];
const EMOJIS = ['🎉','🥳','🎂','🍕','🍝','🍣','🌮','🍔','🥞','☕','🍻','🍷','🍹','🎲','🎮','🎬','🍿','🎤','🎸','🪩','💘','🏖️','🏕️','✈️','🚗','⚽','🏀','🏈','⚾','🎳','⛳','🧘','🛍️','📚','💼','🦃','🎄','🎃','🐣','🎆','🌸','🌞','❄️','🐶'];
const DRESS = [
  { k: 'Relaxed',       e: '🩴', d: 'Sweatpants are legal' },
  { k: 'Casual',        e: '👕', d: 'Jeans & a tee' },
  { k: 'Smart Casual',  e: '👔', d: 'Nice, not try-hard' },
  { k: 'Dressy',        e: '👗', d: 'Bring the good shoes' },
  { k: 'Cocktail',      e: '🍸', d: 'Little black dress energy' },
  { k: 'Semi-Formal',   e: '🤵', d: 'Suit, no tux' },
  { k: 'Black Tie',     e: '🎩', d: 'Fancy fancy' },
  { k: 'Themed',        e: '🎭', d: 'Costumes encouraged' },
  { k: 'Sporty',        e: '🏃', d: 'Sneakers required' },
  { k: 'Beach / Pool',  e: '🩱', d: 'Sunscreen is an outfit' },
  { k: 'Outdoor',       e: '🧥', d: 'Layers! It\u2019s Chicago' },
  { k: 'Anything Goes', e: '🤷', d: 'Wear whatever' }
];
const FOOD_TYPES = [
  { k: 'Self-made',        e: '👩‍🍳', d: 'Someone is cooking!',    ph: "What's cooking? e.g. Lasagna, salad, cookies" },
  { k: 'Potluck',          e: '🥘', d: 'Everyone brings a dish', ph: 'Theme or must-haves? e.g. Taco bar — bring a topping' },
  { k: 'Ordering out',     e: '🛵', d: 'Delivery hero incoming', ph: "From where? e.g. Lou Malnati's 🍕" },
  { k: 'Going out to eat', e: '🍽️', d: 'Restaurant time',        ph: 'Where & what time? e.g. Girl & the Goat, 7:30' },
  { k: 'Snacks only',      e: '🍿', d: 'Chips are a food group', ph: 'Snack lineup? e.g. Chips, dip, gummy worms' }
];
const DRINK_TYPES = [
  { k: 'Self-made',            e: '🍹', d: 'Mixology hour',         ph: 'Signature drink? e.g. Spicy margs 🌶️' },
  { k: 'Providing drinks',     e: '🥤', d: 'Host has it covered',   ph: "What's stocked? e.g. Wine, seltzers, soda" },
  { k: 'BYOB',                 e: '🍾', d: 'Bring your own',        ph: 'Any requests? e.g. Bring a bottle to share' },
  { k: 'Going out for drinks', e: '🍻', d: 'Bar crawl energy',      ph: 'Which spot? e.g. Rooftop bar downtown' },
  { k: 'Coffee & tea',         e: '☕', d: 'Caffeinated plans',     ph: 'Where or what? e.g. Oat lattes all around' },
  { k: 'Zero-proof',           e: '🧃', d: 'Mocktails & sodas',     ph: 'e.g. Mocktails, kombucha, sparkling water' }
];
const REF_TYPES = [['Reservation ID','🍽️'],['Ticket #','🎟️'],['Confirmation #','✅'],['Booking Ref','🏨'],['Order #','📦'],['Flight #','✈️'],['Other','🔖']];
const ALARMS = [[null,'None'],[0,'At start'],[15,'15 min'],[30,'30 min'],[60,'1 hour'],[120,'2 hours'],[1440,'1 day'],[2880,'2 days']];
const DURATIONS = [[30,'30m'],[60,'1h'],[90,'1.5h'],[120,'2h'],[180,'3h'],[240,'4h'],[360,'6h'],['custom','Custom'],['tbd','🤷 Not sure']];
const RSVP = { invited: ['✉️','Invited'], going: ['✅','Going'], maybe: ['🤔','Maybe'], no: ['❌',"Can't"] };
const RSVP_ORDER = ['invited','going','maybe','no'];
// [key, label, accent1, accent2, bg1, bg2, light?]
const THEMES = [
  ['party','Party','#ff4fa3','#8a5cff','#1b0f3b','#3d1056'],
  ['sunset','Sunset','#ff7a59','#ff3d7f','#2a0d1f','#5c1a2c'],
  ['ocean','Ocean','#2ee6d6','#3a8bff','#061a30','#0b3d5e'],
  ['forest','Forest','#7be08b','#2fb36d','#0b1f15','#173d28'],
  ['midnight','Midnight','#ffd166','#6c7bff','#07070f','#16163a'],
  ['aurora','Aurora','#5effc1','#b06bff','#04141f','#1b1846'],
  ['neon','Neon','#39ff14','#ff00e6','#050505','#151022'],
  ['cherry','Cherry','#ff4d6d','#c9184a','#1f0710','#4a0e22'],
  ['royal','Royal','#ffcf56','#4361ee','#0a0f2e','#1d2a6b'],
  ['lavender','Lavender','#d6a8ff','#8f7bff','#1a1430','#33285c'],
  ['ember','Ember','#ff9f1c','#e85d04','#1a0e06','#3d1f0c'],
  ['coffee','Coffee','#e6b98a','#b07a4f','#1c140f','#3a2a20'],
  ['retro','Retro','#f4a261','#2a9d8f','#14213d','#263c5c'],
  ['holiday','Holiday','#ff3b3b','#22b860','#1d0808','#0e2c1b'],
  ['spooky','Spooky','#ff7518','#9d4edd','#0d0612','#2a0f2e'],
  ['mono','Mono','#ffffff','#8a8a8a','#0b0b0b','#262626'],
  ['candy','Candy','#ff5fa2','#7a5cff','#fff0f7','#e6f0ff',1],
  ['mint','Mint','#14b8a6','#22c55e','#effcf6','#e0f2fe',1],
  ['peach','Peach','#ff7a59','#f43f5e','#fff4ec','#ffe4e6',1],
  ['sky','Sky','#3b82f6','#06b6d4','#eef6ff','#e0f7ff',1],
  ['lemonade','Lemonade','#f59e0b','#ec4899','#fffbea','#fff0f6',1],
  ['paper','Paper','#111827','#6b7280','#fafaf7','#ecebe6',1]
];
const TRANSITIONS = [['mix','🎲 Mix It Up'],['slide','➡️ Slide'],['bounce','🏀 Bounce'],['flip','🔄 Flip'],['zoom','🔍 Zoom'],['swirl','🌀 Swirl'],['card','🃏 Card']];
const TAGLINES = ['Less calendar, more party.','Your future self says thanks.','Group chat chaos, organized.','Let\u2019s make it official.','Main character energy only.','Plans so good they need a name.'];
const KIND_ICON = { restaurant:'🍽️',fast_food:'🍔',cafe:'☕',bar:'🍸',pub:'🍺',biergarten:'🍻',nightclub:'🪩',park:'🌳',cinema:'🎬',theatre:'🎭',stadium:'🏟️',museum:'🏛️',hotel:'🏨',zoo:'🦁',attraction:'🎡',bowling_alley:'🎳',ice_cream:'🍦',bakery:'🥐',library:'📚',beach:'🏖️',station:'🚉',aerodrome:'✈️',airport:'✈️',school:'🏫',university:'🎓',college:'🎓',place_of_worship:'⛪',arts_centre:'🎨',sports_centre:'🏋️',fitness_centre:'🏋️',golf_course:'⛳',marina:'⛵',supermarket:'🛒',mall:'🛍️',city:'🏙️',town:'🏘️',village:'🏘️',house:'🏠',residential:'🏠',apartments:'🏢',street:'🛣️',music_venue:'🎵',events_venue:'🎪',community_centre:'🏢',playground:'🛝',garden:'🌷',swimming_pool:'🏊',escape_game:'🔐',amusement_arcade:'🕹️',theme_park:'🎢',winery:'🍷',brewery:'🍺',hospital:'🏥',pharmacy:'💊',fuel:'⛽',parking:'🅿️',bus_stop:'🚌',office:'💼',hairdresser:'💇',clothes:'👗' };

/* ---------- app state ---------- */
const S = { draft: null, step: 0, editing: false, returnToReview: false, tab: 'upcoming', geo: null, results: [], view: 'home' };
let view, app;

/* =========================================================
   SOUND — synthesized with Web Audio (no audio files needed)
   ========================================================= */
const Sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ctx = new AC(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur, { type = 'sine', vol = .15, delay = 0, slide = null, attack = .006 } = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .03);
  },
  noise(dur, { vol = .08, delay = 0, from = 600, to = 3000, q = .9 } = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay, len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t); src.stop(t + dur + .03);
  },
  play(name) {
    if (!settings.sound) return;
    try {
      const T = this.tone.bind(this), N = this.noise.bind(this);
      switch (name) {
        case 'tap':    T(700, .06, { type: 'triangle', vol: .09, slide: 1000 }); break;
        case 'pop':    T(380, .11, { vol: .22, slide: 1150 }); T(1500, .05, { type: 'triangle', vol: .04, delay: .05 }); break;
        case 'emoji':  T(520, .08, { vol: .18, slide: 1300 }); T(1760, .08, { type: 'triangle', vol: .05, delay: .06 }); break;
        case 'next':   N(.3, { from: 300, to: 3800, vol: .07 }); T(587, .09, { type: 'triangle', vol: .09, delay: .08 }); T(880, .13, { type: 'triangle', vol: .09, delay: .15 }); break;
        case 'back':   N(.26, { from: 3500, to: 300, vol: .06 }); T(660, .09, { type: 'triangle', vol: .08, delay: .06 }); T(440, .12, { type: 'triangle', vol: .08, delay: .13 }); break;
        case 'add':    T(988, .07, { type: 'square', vol: .045 }); T(1319, .13, { type: 'square', vol: .045, delay: .07 }); break;
        case 'remove': T(520, .16, { type: 'triangle', vol: .12, slide: 140 }); break;
        case 'yes':    [523, 659, 784].forEach((f, i) => T(f, .16, { type: 'triangle', vol: .1, delay: i * .07 })); break;
        case 'no':     T(311, .22, { type: 'sawtooth', vol: .045, slide: 293 }); T(277, .5, { type: 'sawtooth', vol: .045, delay: .26, slide: 207 }); break;
        case 'error':  T(170, .11, { type: 'square', vol: .05 }); T(150, .16, { type: 'square', vol: .05, delay: .12 }); break;
        case 'tada':   [523, 659, 784, 1047].forEach((f, i) => T(f, .28, { type: 'triangle', vol: .11, delay: i * .09 }));
                       T(1047, .8, { vol: .09, delay: .38 }); T(1568, .7, { vol: .05, delay: .42 }); N(.7, { from: 4000, to: 9000, vol: .04, delay: .3 }); break;
        case 'shutter':N(.05, { from: 2500, to: 1800, vol: .2, q: .6 }); N(.07, { from: 1800, to: 1200, vol: .16, q: .6, delay: .08 }); break;
        case 'toggle': T(900, .05, { type: 'square', vol: .035 }); T(1200, .05, { type: 'square', vol: .03, delay: .05 }); break;
        case 'open':   N(.22, { from: 400, to: 2200, vol: .05 }); T(660, .1, { type: 'triangle', vol: .06, delay: .06 }); break;
        case 'close':  N(.2, { from: 2200, to: 400, vol: .045 }); break;
        case 'sparkle':for (let i = 0; i < 5; i++) T(1400 + Math.random() * 1600, .12, { type: 'sine', vol: .05, delay: i * .05 }); break;
        case 'tick':   T(1800, .025, { type: 'square', vol: .025 }); break;
        case 'whoosh': N(.4, { from: 200, to: 5000, vol: .08 }); break;
        case 'pin':    T(1200, .06, { vol: .1, slide: 600 }); T(300, .14, { vol: .2, delay: .07, slide: 120 }); break;
        case 'copy':   T(1046, .06, { type: 'triangle', vol: .08 }); T(1568, .09, { type: 'triangle', vol: .08, delay: .06 }); break;
      }
    } catch (e) { /* audio is optional */ }
  }
};

/* =========================================================
   FX — confetti + emoji bursts on a canvas
   ========================================================= */
const FX = {
  c: null, x: null, parts: [], raf: 0, w: 0, h: 0,
  init() { this.c = $('#fx'); this.x = this.c.getContext('2d'); this.resize(); },
  resize() {
    if (!this.c) return; const r = app.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height; this.c.width = r.width * d; this.c.height = r.height * d; this.x.setTransform(d, 0, 0, d, 0, 0);
  },
  colors() { const cs = getComputedStyle(document.documentElement); return ['--a1', '--a2', '--a3'].map(v => cs.getPropertyValue(v).trim()).concat(['#ffffff', '#66e3ff']); },
  burst(x, y, emojis, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
      this.parts.push({ t: 'e', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: .3, life: 1, decay: .016 + Math.random() * .012, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, size: 16 + Math.random() * 14, e: pick(emojis) });
    }
    this.run();
  },
  sparkle(x, y, n = 14) {
    const cols = this.colors();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4;
      this.parts.push({ t: 's', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: .04, life: 1, decay: .025 + Math.random() * .02, size: 2 + Math.random() * 3, col: pick(cols) });
    }
    this.run();
  },
  confetti(n = 170) {
    const cols = this.colors();
    for (let i = 0; i < n; i++) {
      this.parts.push({ t: 'c', x: Math.random() * this.w, y: -20 - Math.random() * this.h * .6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, g: .05, life: 1, decay: .0035 + Math.random() * .002, rot: Math.random() * 6, vr: (Math.random() - .5) * .25, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, col: pick(cols), wob: Math.random() * 10 });
    }
    // a few emoji cannons from the bottom corners
    for (let i = 0; i < 16; i++) {
      const left = i % 2 === 0;
      this.parts.push({ t: 'e', x: left ? 0 : this.w, y: this.h, vx: (left ? 1 : -1) * (4 + Math.random() * 5), vy: -12 - Math.random() * 8, g: .32, life: 1, decay: .008, rot: 0, vr: (Math.random() - .5) * .2, size: 22 + Math.random() * 14, e: pick(['🎉', '🥳', '✨', '🎊', '💫', '⭐']) });
    }
    this.run();
  },
  run() {
    if (this.raf) return;
    const loop = () => {
      const x = this.x; x.clearRect(0, 0, this.w, this.h);
      this.parts = this.parts.filter(p => p.life > 0 && p.y < this.h + 60);
      for (const p of this.parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        x.save(); x.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
        if (p.t === 'e') { p.rot += p.vr; x.translate(p.x, p.y); x.rotate(p.rot); x.font = `${p.size}px system-ui, "Apple Color Emoji"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.e, 0, 0); }
        else if (p.t === 'c') { p.rot += p.vr; p.wob += .1; p.vx *= .99; x.translate(p.x + Math.sin(p.wob) * 2, p.y); x.rotate(p.rot); x.scale(1, Math.cos(p.wob)); x.fillStyle = p.col; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        else { x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y, p.size * p.life + .5, 0, 7); x.fill(); }
        x.restore();
      }
      if (this.parts.length) this.raf = requestAnimationFrame(loop); else { this.raf = 0; x.clearRect(0, 0, this.w, this.h); }
    };
    this.raf = requestAnimationFrame(loop);
  }
};
const pt = (e, el) => {
  const r = app.getBoundingClientRect();
  if (e && e.clientX) return { x: e.clientX - r.left, y: e.clientY - r.top };
  if (el) { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top }; }
  return { x: r.width / 2, y: r.height / 2 };
};

/* contained tap effect: animates inside the button, never outside it */
function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 700); }
const bumpSel = sel => requestAnimationFrame(() => bump($(sel)));

/* ---------- toast ---------- */
let toastT;
let toastUntil = 0;
function hideToast() { const t = $('#toast'); if (t) t.classList.remove('show'); toastUntil = 0; clearTimeout(toastT); }
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  toastUntil = Date.now() + ms; clearTimeout(toastT); toastT = setTimeout(hideToast, ms);
}
// iOS freezes timers while the Calendar/Share sheet is open, so also hide on return, on tap, and on a clock check
['visibilitychange', 'pageshow', 'focus'].forEach(ev => window.addEventListener(ev, () => { if (toastUntil && Date.now() >= toastUntil - 200) hideToast(); }));
setInterval(() => { if (toastUntil && Date.now() > toastUntil) hideToast(); }, 500);

/* =========================================================
   TIME HELPERS
   ========================================================= */
function planTimes(p) {
  if (!p || !p.date || p.dateTBD) return { start: null, end: null };
  const [y, m, d] = p.date.split('-').map(Number);
  if (p.timeTBD && !p.allDay) return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  if (p.allDay) return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + (p.days || 1)) };
  const [hh, mm] = (p.time || '19:00').split(':').map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  let end;
  if (p.duration === 'custom' && p.endDate && p.endTime) {
    const [y2, m2, d2] = p.endDate.split('-').map(Number), [h2, n2] = p.endTime.split(':').map(Number);
    end = new Date(y2, m2 - 1, d2, h2, n2);
  } else end = new Date(start.getTime() + (Number(p.duration) || 120) * 60000);
  if (end <= start) end = new Date(start.getTime() + 3600000);
  return { start, end };
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayDiff = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const fmtT = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtD = d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
function fmtWhen(p) {
  const { start, end } = planTimes(p); if (!start) return 'Date TBD';
  if (p.timeTBD && !p.allDay) return `${fmtD(start)} · Time TBD`;
  if (p.allDay) { const last = new Date(end.getTime() - 864e5); return ((p.days || 1) > 1 ? `${fmtD(start)} – ${fmtD(last)}` : fmtD(start)) + ' · All day'; }
  if (p.duration === 'tbd') return `${fmtD(start)} · ${fmtT(start)} · end TBD`;
  if (sameDay(start, end)) return `${fmtD(start)} · ${fmtT(start)} – ${fmtT(end)}`;
  return `${fmtD(start)} ${fmtT(start)} – ${fmtD(end)} ${fmtT(end)}`;
}
function fmtDur(p) {
  const { start, end } = planTimes(p); if (!start) return 'Length TBD';
  if (p.timeTBD && !p.allDay) return 'Time & length TBD';
  if (p.duration === 'tbd') return 'Length TBD';
  if (p.allDay) return `${p.days || 1} day${(p.days || 1) > 1 ? 's' : ''}`;
  const m = Math.round((end - start) / 60000), h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} hr${h > 1 ? 's' : ''}${r ? ` ${r} min` : ''}` : `${r} min`;
}
function countdown(p) {
  const { start, end } = planTimes(p); if (!start) return 'Date TBD';
  const now = new Date(), s = start.getTime(), e = end.getTime();
  if (now >= s && now < e) return 'Happening now! 🎉';
  if (s > now) {
    const mins = Math.round((s - now) / 60000);
    if (mins < 60) return `in ${mins} min`;
    const dd = dayDiff(now, start);
    if (dd === 0) { const h = Math.round(mins / 60); return `Today · in ${h} hr${h > 1 ? 's' : ''}`; }
    if (dd === 1) return 'Tomorrow';
    return `in ${dd} days`;
  }
  const dd = dayDiff(end, now);
  return dd === 0 ? 'Earlier today' : dd === 1 ? 'Yesterday' : `${dd} days ago`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late? 🌙' : h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 😎' : h < 22 ? 'Good evening 🌆' : 'Night owl mode 🦉';
}

/* =========================================================
   PLAN MODEL
   ========================================================= */
const newDraft = () => ({
  id: uid(), name: '', emoji: '🎉', loc: null, locQuery: '',
  date: '', time: '19:00', allDay: false, duration: 120, endDate: '', endTime: '', days: 1,
  dress: '', dressNote: '', guests: [],
  food: { on: null, type: '', details: '', assign: {} },
  drinks: { on: null, type: '', details: '' },
  notes: '', refs: [], files: [], alarm: settings.alarm, createdAt: Date.now()
});
const isEmptyDraft = d => !d || (!d.name.trim() && !d.loc && !d.date && !d.guests.length && !d.files.length && !d.notes);
const planById = id => plans.find(p => p.id === id);
let draftT;
function saveDraft() { if (S.draft) save(K.draft, { draft: S.draft, step: S.step, editing: S.editing }); }
function saveDraftSoon() { clearTimeout(draftT); draftT = setTimeout(saveDraft, 350); }
function clearDraft() { localStorage.removeItem(K.draft); }

const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const avatar = n => `<span class="av" style="background:linear-gradient(135deg,hsl(${hue(n)} 75% 58%),hsl(${(hue(n) + 40) % 360} 75% 48%))">${esc(initials(n))}</span>`;
const mapsURL = l => l.lat != null ? `https://maps.apple.com/?q=${encodeURIComponent(l.name)}&ll=${l.lat},${l.lon}${l.full ? `&address=${encodeURIComponent(l.full)}` : ''}` : `https://maps.apple.com/?q=${encodeURIComponent([l.name, l.address].filter(Boolean).join(' '))}`;
const locLine = l => l ? [l.name, l.address].filter(Boolean).join(', ') : '';
const dressEmoji = k => k === 'Not sure yet' ? '🤷' : (DRESS.find(x => x.k === k) || {}).e || '👔';
const typeEmoji = (list, k) => (list.find(x => x.k === k) || {}).e || '✨';

function planText(p, o = {}) {
  const L = [];
  if (!o.noHead) { L.push(`${p.emoji} ${p.name}`); L.push(`🗓 ${fmtWhen(p)}`); }
  if (p.loc) { L.push(`📍 ${locLine(p.loc)}`); if (o.links) L.push(mapsURL(p.loc)); }
  if (p.dress || p.dressNote) L.push(`👔 Dress code: ${[p.dress, p.dressNote].filter(Boolean).join(' — ')}`);
  if (p.food.on === 'tbd') L.push('🍽 Food: TBD');
  else if (p.food.on) {
    L.push(`🍽 Food: ${[p.food.type || 'Yes', p.food.details].filter(Boolean).join(' — ')}`);
    Object.entries(p.food.assign || {}).forEach(([n, v]) => v && L.push(`   • ${n}: ${v}`));
  } else if (p.food.on === false) L.push('🍽 Food: None planned');
  if (p.drinks.on === 'tbd') L.push('🥂 Drinks: TBD');
  else if (p.drinks.on) L.push(`🥂 Drinks: ${[p.drinks.type || 'Yes', p.drinks.details].filter(Boolean).join(' — ')}`);
  else if (p.drinks.on === false) L.push('🥂 Drinks: None planned');
  if (p.guests.length) L.push(`👥 Guests (${p.guests.length}): ${p.guests.map(g => g.name).join(', ')}${p.guestsTBD ? ' + more TBD' : ''}`);
  else if (p.guestsTBD) L.push('👥 Guests: TBD');
  if (!o.noRefs) p.refs.filter(r => r.value).forEach(r => L.push(`🎟 ${r.label}: ${r.value}`));
  if (p.notes) L.push(`📝 ${p.notes}`);
  if (o.ics && p.files.length) L.push(`📎 ${p.files.length} attachment${p.files.length > 1 ? 's' : ''} saved in the Plans app`);
  if (o.sig) L.push('', 'Planned with Plans ✨');
  return L.join('\n');
}

/* =========================================================
   CALENDAR (.ics) EXPORT
   ========================================================= */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsParam = s => String(s).replace(/["\r\n]/g, ' ');
function icsFold(line) {
  const enc = new TextEncoder(); let out = '', cur = '', bytes = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (bytes + b > 73) { out += cur + '\r\n '; cur = ''; bytes = 1; } cur += ch; bytes += b; }
  return out + cur;
}
const icsUTC = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDay = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
function buildICS(p) {
  const { start, end } = planTimes(p);
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plans//Plans App 1.0//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${p.id}@plans.app`, `DTSTAMP:${icsUTC(new Date())}`];
  if (p.allDay || p.timeTBD) { L.push(`DTSTART;VALUE=DATE:${icsDay(start)}`, `DTEND;VALUE=DATE:${icsDay(end)}`); }
  else { L.push(`DTSTART:${icsUTC(start)}`, `DTEND:${icsUTC(end)}`); }
  L.push(`SUMMARY:${icsEsc(`${p.emoji} ${p.name}`)}`);
  if (p.loc) {
    const l = p.loc, addr = l.full || l.address || '';
    const isAddrOnly = !addr || addr.startsWith(l.name);
    // Apple Calendar writes locations as "Place Name\nStreet, City, ST ZIP, Country"
    L.push(`LOCATION:${icsEsc(isAddrOnly ? (addr || l.name) : `${l.name}\n${addr}`)}`);
    if (l.lat != null) {
      L.push(`GEO:${l.lat};${l.lon}`);
      L.push(`X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="${icsParam(addr || l.name)}";X-APPLE-RADIUS=70;X-TITLE="${icsParam(l.name)}":geo:${l.lat},${l.lon}`);
    }
  }
  const desc = planText(p, { noHead: true, ics: true });
  if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`);
  if (p.alarm !== null && p.alarm !== undefined) {
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(p.name)}`, `TRIGGER:${p.alarm === 0 ? 'PT0M' : `-PT${p.alarm}M`}`, 'END:VALARM');
  }
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
const slug = s => (s || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plan';
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function calendarSheet(id) {
  // Only used when a plan has no date yet — everything else goes straight to Calendar.
  const p = planById(id); if (!p) return;
  openSheet(`<div class="d-hero"><span class="de">🗓️</span><h2>No date yet!</h2><span class="pill">${esc(p.emoji)} ${esc(p.name)}</span></div>
    <p class="hint" style="text-align:center;margin:12px 0 18px">Calendar needs a day to put this on. Pick a date and it's good to go.</p>
    <div class="act-grid"><button class="btn primary full" data-act="edit-when" data-id="${p.id}">📅 Pick a date</button></div>`);
}
// UTF-8 safe base64url (keeps emoji in titles intact)
function b64url(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// A real same-origin URL that the service worker answers with Content-Type: text/calendar.
// iOS treats that like any normal .ics link and pops the "Add All" calendar preview — in Safari AND from the Home Screen.
const calURL = p => new URL(`calendar/${slug(p.name)}.ics?e=${b64url(buildICS(p))}`, location.href).href;
function calOpen(p) {
  if (!p) return;
  if (!planTimes(p).start) return calendarSheet(p.id);
  Sound.play('sparkle');
  const ics = buildICS(p);
  if (isIOS) {
    // must stay synchronous inside the tap so iOS allows it
    if (navigator.serviceWorker && navigator.serviceWorker.controller) location.href = calURL(p);
    else location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    toast('Tap “Add All” to drop it in your calendar 📅', 3200);
  } else {
    downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `${slug(p.name)}.ics`);
    toast('Calendar file downloaded — open it to add 📅', 3200);
  }
}
async function calShare(p) {
  if (!p) return;
  if (!planTimes(p).start) return calendarSheet(p.id);
  const name = `${slug(p.name)}.ics`, ics = buildICS(p);
  const file = new File([ics], name, { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: p.name }); Sound.play('sparkle'); }
    catch (e) { if (e.name !== 'AbortError') toast("Couldn't open the share sheet 😕 Try again"); }
  } else downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), name);
}
async function sharePlan(p) {
  const text = planText(p, { links: true, sig: true });
  if (navigator.share) { try { await navigator.share({ title: p.name, text }); Sound.play('sparkle'); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(text, 'Invite copied — paste it in the group chat 📋');
}
async function copyText(t, msg = 'Copied! 📋') {
  try { await navigator.clipboard.writeText(t); }
  catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  Sound.play('copy'); toast(msg);
}

/* =========================================================
   LOCATION SEARCH (Photon by Komoot → OpenStreetMap; Nominatim fallback)
   ========================================================= */
let searchT, searchSeq = 0;
const US_STATES = { alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE','district of columbia':'DC',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY','puerto rico':'PR' };
// structured address → { street, city, state, postcode, country, cc }
function photonParts(p) {
  return { street: [p.housenumber, p.street].filter(Boolean).join(' '), city: p.city || p.town || p.village || p.district || p.county || '',
    state: p.state || '', postcode: p.postcode || '', country: p.country || '', cc: (p.countrycode || '').toUpperCase() };
}
function nominatimParts(a = {}) {
  return { street: [a.house_number, a.road || a.pedestrian].filter(Boolean).join(' '), city: a.city || a.town || a.village || a.suburb || a.county || '',
    state: a.state || '', postcode: a.postcode || '', country: a.country || '', cc: (a.country_code || '').toUpperCase() };
}
// Apple-style: "1531 N Damen Ave, Chicago, IL 60622, United States"
function fmtAddr(pt, { country = false, skip = '' } = {}) {
  if (!pt) return '';
  const us = pt.cc === 'US';
  const st = us ? (US_STATES[(pt.state || '').toLowerCase()] || pt.state) : pt.state;
  const region = [st, pt.postcode].filter(Boolean).join(' ');
  const parts = [pt.street, pt.city, region, country ? (us ? 'United States' : pt.country) : (!us ? pt.country : '')].filter(Boolean);
  return [...new Set(parts)].filter(x => x !== skip).join(', ');
}
function makeLoc(name, parts, lat, lon, kind) {
  const nm = name || parts.street || parts.city || 'Unnamed place';
  return { name: nm, address: fmtAddr(parts, { skip: nm }), full: fmtAddr(parts, { country: true }), parts, lat, lon, kind };
}
function distMi(a, b) {
  if (!a || b.lat == null) return null;
  const R = 3958.8, toR = x => x * Math.PI / 180, dLa = toR(b.lat - a.lat), dLo = toR(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtMi = m => m == null ? '' : m < .1 ? 'here' : m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`;
async function searchPlaces(q) {
  const seq = ++searchSeq; const box = $('#results'); if (!box) return;
  if (q.trim().length < 2) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  let out = [];
  try {
    const bias = S.geo ? `&lat=${S.geo.lat}&lon=${S.geo.lon}` : '';
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en${bias}`);
    if (!r.ok) throw new Error('photon ' + r.status);
    const j = await r.json();
    out = j.features.map(f => {
      const p = f.properties, [lon, lat] = f.geometry.coordinates;
      return makeLoc(p.name, photonParts(p), lat, lon, p.osm_value);
    });
  } catch (e) {
    try {
      const vb = S.geo ? `&viewbox=${S.geo.lon - .5},${S.geo.lat + .5},${S.geo.lon + .5},${S.geo.lat - .5}` : '';
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}${vb}`);
      const j = await r.json();
      out = j.map(x => makeLoc(x.name || x.display_name.split(', ')[0], nominatimParts(x.address), +x.lat, +x.lon, x.type));
    } catch (e2) { out = null; }
  }
  if (seq !== searchSeq || !$('#results')) return;
  S.results = out || [];
  renderResults(q, out === null);
}
function renderResults(q, failed) {
  const box = $('#results'); if (!box) return;
  const list = S.results.map((r, i) => {
    const d = distMi(S.geo, r);
    return `<button class="result" style="animation-delay:${i * .04}s" data-act="pick-loc" data-i="${i}"><span class="ri">${KIND_ICON[r.kind] || '📍'}</span><span class="rt"><b>${esc(r.name)}</b><small>${esc(r.address || r.kind || '')}</small></span><span class="rd">${fmtMi(d)}</span></button>`;
  }).join('');
  box.innerHTML = (failed ? `<div class="empty" style="padding:14px">🛰️ The map elves aren't answering. Check your connection — or just use what you typed.</div>` : '')
    + (!failed && !S.results.length ? `<div class="empty" style="padding:14px">🔍 No matches. Try adding a city, or use it as typed.</div>` : '')
    + list
    + `<button class="result custom" data-act="loc-custom"><span class="ri">✍️</span><span class="rt"><b>Use “${esc(q)}”</b><small>Just save the text as the location</small></span></button>`;
}
function getGeo() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('No geolocation'));
    navigator.geolocation.getCurrentPosition(p => { S.geo = { lat: p.coords.latitude, lon: p.coords.longitude }; res(S.geo); }, rej, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}
async function reverseGeo(g) {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${g.lat}&lon=${g.lon}&lang=en`); const j = await r.json(); const f = j.features[0];
    if (f) { const p = f.properties; return makeLoc(p.name, photonParts(p), g.lat, g.lon, p.osm_value); }
  } catch {}
  return { name: 'Current location', address: `${g.lat.toFixed(4)}, ${g.lon.toFixed(4)}`, lat: g.lat, lon: g.lon, kind: 'pin' };
}
/* =========================================================
   WIZARD
   ========================================================= */
function stepHead(st, i) {
  const words = st.title.split(' ').map((w, j) => `<span class="w anim" style="animation-delay:${.12 + j * .06}s">${esc(w)}</span>`).join(' ');
  return `<div class="step-head"><div class="step-emoji anim">${st.key === 'name' ? esc(S.draft.emoji) : st.emoji}</div>
    <div class="step-count">Step ${i + 1} of ${STEPS.length}</div><h2 class="step-title">${words}</h2><p class="step-sub">${esc(st.sub)}</p></div>`;
}

const STEP_HTML = {
  name(d) {
    return `<input id="f-name" class="big-input" data-bind="name" placeholder="e.g. Taco Tuesday Extravaganza" maxlength="80" value="${esc(d.name)}" enterkeyhint="next" autocomplete="off" autocapitalize="words">
<button class="unsure ${d.name === TBD_NAME ? 'on' : ''}" data-act="unsure-name"><span class="ue">🤷</span><span class="ut">Not sure what to call it yet</span><span class="uc">${d.name === TBD_NAME ? '✓' : ''}</span></button>
      <div class="label">Pick a vibe <small class="lbl-hint">or tap ＋ for your own</small></div>
      <div class="hscroll" id="emo-row">${emojiRowHTML(d)}</div>
      <div class="label">Need inspiration?</div>
      <div class="chips">${OCCASIONS.map(([n, e]) => `<button class="chip ${d.name === n ? 'on' : ''}" data-act="occasion" data-n="${esc(n)}" data-e="${e}">${e} ${esc(n)}</button>`).join('')}</div>`;
  },
  where(d) {
    return `<div class="search-box"><span class="si">🔎</span><input id="f-where" type="search" placeholder="Search venues, places, addresses…" value="${esc(d.locQuery)}" autocomplete="off" enterkeyhint="search">
        <button class="near ${S.geo ? 'on' : ''}" data-act="near-me" aria-label="Search near me">🧭</button></div>
      <div class="chips quick">
        <button class="chip sm" data-act="loc-here">📍 Where I am now</button>
        <button class="chip sm" data-act="loc-quick" data-v="My place">🏠 My place</button>
        <button class="chip sm" data-act="loc-quick" data-v="Their place">🏡 Their place</button>
        <button class="chip sm" data-act="loc-quick" data-v="Virtual / Online">💻 Virtual</button>
      </div>
      <button class="unsure ${d.loc && d.loc.tbd ? 'on' : ''}" data-act="unsure-where"><span class="ue">🤷</span><span class="ut">Don't know where yet</span><span class="uc">${d.loc && d.loc.tbd ? '✓' : ''}</span></button>
      <div id="loc-selected">${locCard(d.loc)}</div>
      <div id="results" class="results"></div>
      <p class="credit">Place search by Photon (Komoot) · Map data © OpenStreetMap contributors</p>`;
  },
  when(d) {
    return `<button class="unsure ${d.dateTBD ? 'on' : ''}" data-act="unsure-date"><span class="ue">🤷</span><span class="ut">Don't know when yet</span><span class="uc">${d.dateTBD ? '✓' : ''}</span></button>
      <div id="when-body" class="${d.dateTBD ? 'tbd-dim' : ''}">
      <div class="label">Quick picks</div>
      <div class="hscroll qd-row">${quickDates().map(q => `<button class="qd ${!d.dateTBD && d.date === q.date && d.time === q.time && !d.allDay && !d.timeTBD ? 'on' : ''}" data-act="quick-date" data-d="${q.date}" data-t="${q.time}"><span class="qe">${q.e}</span><b>${q.t}</b><small>${q.sub}</small></button>`).join('')}</div>
      <div class="grid2">
        <label class="fld"><span>📅 Date</span><input class="inp" type="date" data-bind="date" value="${esc(d.date)}"></label>
        <label class="fld"><span>🕖 Starts</span><input class="inp" type="time" data-bind="time" value="${esc(d.time)}" ${d.allDay || d.timeTBD ? 'disabled' : ''}></label>
      </div>
      <div class="toggle-row"><span>☀️ All-day event<small>Trips, festivals, lazy Sundays</small></span><button class="switch ${d.allDay ? 'on' : ''}" data-act="toggle-allday" aria-label="All day"></button></div>
      <div class="toggle-row" id="timetbd-row" ${d.allDay ? 'hidden' : ''}><span>🕐 Not sure of the time<small>Know the day, figuring out the rest</small></span><button class="switch ${d.timeTBD ? 'on' : ''}" data-act="toggle-timetbd" aria-label="Time not decided"></button></div>
      <div id="dur-section" class="${d.timeTBD && !d.allDay ? 'tbd-dim' : ''}">
      <div class="label" id="dur-label">${d.allDay ? 'How many days?' : 'How long?'}</div>
      <div id="dur-wrap">${durationHTML(d)}</div>
      </div>
      <div id="when-summary">${whenStub(d)}</div>
      </div>`;
  },
  dress(d) {
    return `<div class="dress-grid">${DRESS.map(x => `<button class="dress ${d.dress === x.k ? 'on' : ''}" data-act="dress" data-v="${esc(x.k)}"><span class="de">${x.e}</span><b>${esc(x.k)}</b><small>${esc(x.d)}</small></button>`).join('')}</div>
      <div style="margin-top:12px"><button class="unsure ${d.dress === 'Not sure yet' ? 'on' : ''}" data-act="unsure-dress"><span class="ue">🤷</span><span class="ut">No idea what to wear yet</span><span class="uc">${d.dress === 'Not sure yet' ? '✓' : ''}</span></button></div>
      <label class="fld"><span>✍️ Any specifics?</span><input class="inp" data-bind="dressNote" value="${esc(d.dressNote)}" placeholder="e.g. Wear something green 💚" maxlength="120"></label>`;
  },
  guests(d) {
    const recent = recentGuests(d);
    return `<div class="add-row"><input id="f-guest" class="inp" placeholder="Type a name, hit enter" enterkeyhint="enter" autocomplete="off" autocapitalize="words" maxlength="40"><button class="add-btn" data-act="add-guest" aria-label="Add guest">＋</button></div>
      <p class="hint">Tip: paste a list like “Sam, Alex, Jordan” to add everyone at once.</p>
      <div style="margin-top:12px"><button class="unsure ${d.guestsTBD ? 'on' : ''}" data-act="unsure-guests"><span class="ue">🤷</span><span class="ut">Not sure who's coming yet</span><span class="uc">${d.guestsTBD ? '✓' : ''}</span></button></div>
      ${recent.length ? `<div class="label">Regulars</div><div class="chips" id="recent">${recent.map(n => `<button class="chip sm" data-act="recent-guest" data-n="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="label">Guest list <span class="count-pill" id="gcount">${d.guests.length} + you</span></div>
      <div id="guest-list" class="guest-list">${guestsHTML(d)}</div>`;
  },
  food(d) { return ynStep(d, 'food'); },
  drinks(d) { return ynStep(d, 'drinks'); },
  notes(d) {
    return `<button class="unsure ${false ? 'on' : ''}" data-act="unsure-notes"><span class="ue">🤷</span><span class="ut">Nothing else to add right now</span><span class="uc">${false ? '✓' : ''}</span></button>
      <label class="fld"><span>📝 Notes</span><textarea class="inp" data-bind="notes" rows="4" placeholder="Parking info, gate code, gift ideas, secret plans…">${esc(d.notes)}</textarea></label>
      <div class="label">🎟️ Reference numbers</div>
      <div id="refs">${refsHTML(d)}</div>
      <div class="chips">${REF_TYPES.map(([t, e]) => `<button class="chip sm" data-act="add-ref" data-v="${esc(t)}">${e} ${esc(t)}</button>`).join('')}</div>
      <div class="label">📎 Photos & files</div>
      <div class="attach-btns">
        <label class="att-btn">📸 Photos<input type="file" accept="image/*" multiple data-file="1"></label>
        <label class="att-btn">📄 Files<input type="file" multiple data-file="1"></label>
      </div>
      <div id="files" class="file-grid">${filesHTML(d.files, true)}</div>
      <div class="label">⏰ Calendar reminder</div>
      <div class="chips">${ALARMS.map(([v, l]) => `<button class="chip sm ${d.alarm === v ? 'on' : ''}" data-act="alarm" data-v="${v}">${l}${v !== null && v !== 0 ? ' before' : ''}</button>`).join('')}</div>`;
  },
  review(d) { return ticketHTML(d, true); }
};
const TBD_NAME = 'Something Fun (TBD)';

function emojiList(d) {
  const mine = (settings.myEmojis || []).filter(e => !EMOJIS.includes(e));
  const list = [...mine, ...EMOJIS];
  if (d.emoji && !list.includes(d.emoji)) list.unshift(d.emoji);
  return list;
}
function emojiRowHTML(d) {
  const custom = d.emoji && !EMOJIS.includes(d.emoji);
  return `<label class="emo emo-add" aria-label="Use your own emoji"><span class="plus">＋</span><input id="f-emoji" type="text" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Type any emoji"></label>`
    + emojiList(d).map(e => `<button class="emo ${d.emoji === e ? 'on' : ''} ${custom && d.emoji === e || (settings.myEmojis || []).includes(e) ? 'mine' : ''}" data-act="set-emoji" data-v="${esc(e)}">${esc(e)}</button>`).join('');
}
function lastEmoji(str) {
  const segs = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map(x => x.segment) : [...str];
  for (let i = segs.length - 1; i >= 0; i--) if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segs[i])) return segs[i];
  return null;
}
function setDraftEmoji(e) {
  S.draft.emoji = e;
  const se = $('.panel.current .step-emoji'); if (se) se.textContent = e;
  $$('#emo-row .emo[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === e));
  saveDraftSoon();
}
function useCustomEmoji(input) {
  const e = lastEmoji(input.value); input.value = '';
  if (!e) { if (input.dataset.typed) { toast('That one needs to be an emoji 🙂 Switch to the emoji keyboard 🌐'); Sound.play('error'); } return; }
  settings.myEmojis = [e, ...(settings.myEmojis || []).filter(x => x !== e)].slice(0, 8); saveSettings();
  S.draft.emoji = e;
  const row = $('#emo-row'); row.innerHTML = emojiRowHTML(S.draft); row.scrollTo({ left: 0, behavior: 'smooth' });
  setDraftEmoji(e); input = $('#f-emoji'); input.blur(); Sound.play('emoji'); toast(`Vibe set to ${e}`);
}

const YN = {
  food:   { TYPES: FOOD_TYPES,  yes: ['😋', 'Yes, feed us!'], no: ['🙅', 'Nope'], noMsg: 'No food? Bold. Eat before you come. 🫡', noEmoji: '🥪', det: '🍴' },
  drinks: { TYPES: DRINK_TYPES, yes: ['🥂', 'Yes, cheers!'],  no: ['🚰', 'Nope'], noMsg: 'Water it is. Your liver sends its regards. 💧', noEmoji: '🚰', det: '🧊' }
};
function ynStep(d, key) {
  const c = YN[key], f = d[key];
  return `<div class="yn">
      <button class="yn-btn ${f.on === true ? 'on' : f.on != null ? 'off' : ''}" data-act="yn" data-k="${key}" data-v="1"><span class="ye">${c.yes[0]}</span>${c.yes[1]}</button>
      <button class="yn-btn ${f.on === false ? 'on' : f.on != null ? 'off' : ''}" data-act="yn" data-k="${key}" data-v="0"><span class="ye">${c.no[0]}</span>${c.no[1]}</button>
      <button class="yn-btn ${f.on === 'tbd' ? 'on' : f.on != null ? 'off' : ''}" data-act="yn" data-k="${key}" data-v="tbd"><span class="ye">🤔</span>Not sure</button>
    </div><div id="yn-body">${ynBody(d, key, false)}</div>`;
}
function ynBody(d, key, animate) {
  const c = YN[key], f = d[key], t = c.TYPES.find(x => x.k === f.type);
  if (f.on === true) return `<div class="${animate ? 'reveal' : ''}">
      <div class="label">What kind?</div>
      <div class="type-grid">${c.TYPES.map(x => `<button class="type ${f.type === x.k ? 'on' : ''}" data-act="ytype" data-k="${key}" data-v="${esc(x.k)}"><span class="de">${x.e}</span><b>${esc(x.k)}</b><small>${esc(x.d)}</small></button>`).join('')}</div>
      <label class="fld"><span>${c.det} Details</span><textarea class="inp" id="yn-details" data-bind="${key}.details" rows="3" placeholder="${esc(t ? t.ph : 'Any details?')}">${esc(f.details)}</textarea></label>
      <div id="assign-wrap">${assignHTML(d, key)}</div>
    </div>`;
  if (f.on === 'tbd') return `<div class="no-msg ${animate ? 'pop' : ''}"><span class="big">🤔</span>${key === 'food' ? "Food's a mystery for now. We'll figure it out." : "Drinks TBD. Future you will decide."}</div>`;
  if (f.on === false) return `<div class="no-msg ${animate ? 'pop' : ''}"><span class="big">${c.noEmoji}</span>${esc(c.noMsg)}</div>`;
  return '';
}
function assignHTML(d, key) {
  const f = d[key];
  if (key !== 'food' || f.type !== 'Potluck' || !d.guests.length) return '';
  return `<div class="reveal"><div class="label">Who's bringing what?</div>${d.guests.map(g => `<div class="assign-row">${avatar(g.name)}<span class="an">${esc(g.name)}</span><input class="inp" data-assign="${esc(g.name)}" value="${esc((f.assign || {})[g.name] || '')}" placeholder="bringing…" maxlength="60"></div>`).join('')}</div>`;
}
// When-step partial updater
function setUnsure(act, on) {
  const b = $(`.unsure[data-act="${act}"]`); if (!b) return;
  b.classList.toggle('on', !!on); b.querySelector('.uc').textContent = on ? '✓' : '';
}
function updateWhen(opts = {}) {
  const d = S.draft;
  $$('[data-act="quick-date"]').forEach(c => c.classList.toggle('on', !d.dateTBD && !d.allDay && !d.timeTBD && c.dataset.d === d.date && c.dataset.t === d.time));
  setUnsure('unsure-date', d.dateTBD); const wb = $('#when-body'); if (wb) wb.classList.toggle('tbd-dim', !!d.dateTBD);
  const tr = $('#timetbd-row'); if (tr) tr.hidden = !!d.allDay;
  const ts = $('[data-act="toggle-timetbd"]'); if (ts) ts.classList.toggle('on', !!d.timeTBD);
  const ds = $('#dur-section'); if (ds) ds.classList.toggle('tbd-dim', !!(d.timeTBD && !d.allDay));
  const di = $('[data-bind="date"]'); if (di && di.value !== d.date) di.value = d.date;
  const ti = $('[data-bind="time"]'); if (ti) { if (ti.value !== d.time) ti.value = d.time; ti.disabled = d.allDay || d.timeTBD; }
  const sw = $('[data-act="toggle-allday"]'); if (sw) sw.classList.toggle('on', d.allDay);
  const lb = $('#dur-label'); if (lb) lb.textContent = d.allDay ? 'How many days?' : 'How long?';
  if (opts.dur) $('#dur-wrap').innerHTML = durationHTML(d, opts.animate);
  else $$('[data-act="duration"]').forEach(c => c.classList.toggle('on', String(d.duration) === c.dataset.v));
  $('#when-summary').innerHTML = whenStub(d, false);
}

function quickDates() {
  const now = new Date(), out = [], add = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const md = d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const tl = t => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: m ? '2-digit' : undefined }); };
  const mk = (d, time, e, t) => out.push({ date: isoDate(d), time, e, t, sub: `${md(d)} · ${tl(time)}` });
  const dow = now.getDay(), toDow = t => ((t - dow + 7) % 7) || 7;
  const fri = add(toDow(5)), sat = add(toDow(6)), sun = add(toDow(0));
  mk(now, now.getHours() >= 19 ? '21:00' : '19:00', '🌙', 'Tonight');
  mk(add(1), '19:00', '☀️', 'Tomorrow');
  mk(fri, '19:00', '🎉', 'Friday night');
  mk(sat, '11:00', '🥞', 'Saturday brunch');
  mk(sat, '19:00', '🪩', 'Saturday night');
  mk(sun, '13:00', '😌', 'Sunday afternoon');
  mk(add(7), '19:00', '📆', 'Next week');
  return out;
}
function durationHTML(d, animate) {
  if (d.allDay) return `<div class="stepper"><button data-act="days" data-v="-1">−</button><b>${d.days} day${d.days > 1 ? 's' : ''}</b><button data-act="days" data-v="1">＋</button></div>`;
  return `<div class="chips">${DURATIONS.map(([v, l]) => `<button class="chip ${String(d.duration) === String(v) ? 'on' : ''}" data-act="duration" data-v="${v}">${l}</button>`).join('')}</div>
    ${d.duration === 'custom' ? `<div class="grid2 ${animate ? 'reveal' : ''}"><label class="fld"><span>🏁 End date</span><input class="inp" type="date" data-bind="endDate" value="${esc(d.endDate || d.date)}"></label>
      <label class="fld"><span>🕚 Ends</span><input class="inp" type="time" data-bind="endTime" value="${esc(d.endTime)}"></label></div>` : ''}`;
}
function whenStub(d, animate = true) {
  const { start } = planTimes(d);
  if (d.dateTBD) return `<div class="stub empty-stub">🤷 Date TBD. You can pick one anytime by editing the plan.</div>`;
  if (!start) return `<div class="stub empty-stub">Pick a date and watch the magic ✨</div>`;
  return `<div class="stub ${animate ? 'stub-in' : ''}"><div class="sd"><small>${start.toLocaleDateString(undefined, { month: 'short' })}</small><b>${start.getDate()}</b><small>${start.toLocaleDateString(undefined, { weekday: 'short' })}</small></div>
    <div class="sb"><b>${esc(fmtWhen(d))}</b><small>⏳ ${esc(fmtDur(d))}</small><small>🚀 ${esc(countdown(d))}</small></div></div>`;
}
function locCard(l) {
  if (!l) return '';
  const icon = KIND_ICON[l.kind] || (l.lat == null ? '🗺️' : '📍');
  return `<div class="loc-card"><div class="lc"><span class="ri">${icon}</span><span class="rt"><b>${esc(l.name)}</b><small>${esc(l.address || (l.lat == null ? 'Saved as text' : ''))}</small></span></div>
    <div class="acts">${l.lat != null || l.address ? `<a class="btn small" href="${esc(mapsURL(l))}" target="_blank" rel="noopener">🗺️ Maps</a>` : ''}<button class="btn small" data-act="loc-clear">✕ Change</button></div></div>`;
}
function recentGuests(d) {
  const have = new Set(d.guests.map(g => g.name.toLowerCase())), count = {};
  plans.forEach(p => p.guests.forEach(g => { if (!have.has(g.name.toLowerCase())) count[g.name] = (count[g.name] || 0) + 1; }));
  return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
}
function guestsHTML(d, newName) {
  if (!d.guests.length) return `<div class="guest-empty">No guests yet. A party of one is still a party. 🕺</div>`;
  return d.guests.map((g, i) => `<span class="gchip ${g.name === newName ? 'new' : ''}">${avatar(g.name)}${esc(g.name)}<button class="gx" data-act="del-guest" data-i="${i}" aria-label="Remove">✕</button></span>`).join('');
}
function refsHTML(d) {
  return d.refs.map((r, i) => `<div class="ref-row"><span class="rl">${esc(r.label)}</span><input class="inp" data-ref="${i}" value="${esc(r.value)}" placeholder="ABC123" autocapitalize="characters" autocomplete="off"><button class="x" data-act="del-ref" data-i="${i}">✕</button></div>`).join('');
}
function fileIcon(t) { return t.startsWith('image/') ? '🖼️' : t === 'application/pdf' ? '📕' : t.startsWith('video/') ? '🎞️' : t.startsWith('audio/') ? '🎵' : '📄'; }
function filesHTML(files, editable) {
  return files.map(f => `<div class="ftile" data-act="view-file" data-id="${f.id}">${f.thumb ? `<img src="${f.thumb}" alt="">` : `<span class="fi">${fileIcon(f.type)}</span><span class="fn">${esc(f.name)}</span>`}
    ${editable ? `<button class="mini-x" data-act="del-file" data-id="${f.id}" aria-label="Remove">✕</button>` : ''}</div>`).join('');
}

function ticketHTML(d, editable) {
  const row = (step, icon, label, value) => {
    const tag = editable ? 'button' : 'div';
    return `<${tag} class="t-row" ${editable ? `data-act="goto" data-step="${STEP_IX[step]}"` : ''}><span class="ti">${icon}</span><span class="tv"><small>${label}</small>${value ? `<b>${value}</b>` : `<b class="dim">Not set</b>`}</span>${editable ? '<span class="tedit">✏️</span>' : ''}</${tag}>`;
  };
  const food = d.food.on === 'tbd' ? 'Not sure yet 🤔' : d.food.on ? esc([d.food.type || 'Yes!', d.food.details].filter(Boolean).join(' — ')) + (Object.values(d.food.assign || {}).some(Boolean) ? '\n' + Object.entries(d.food.assign).filter(x => x[1]).map(([n, v]) => `• ${esc(n)}: ${esc(v)}`).join('\n') : '') : d.food.on === false ? 'No food planned' : '';
  const drinks = d.drinks.on === 'tbd' ? 'Not sure yet 🤔' : d.drinks.on ? esc([d.drinks.type || 'Yes!', d.drinks.details].filter(Boolean).join(' — ')) : d.drinks.on === false ? 'No drinks planned' : '';
  const alarm = ALARMS.find(a => a[0] === d.alarm);
  return `<div class="ticket">
    <div class="t-top"><span class="te">${esc(d.emoji)}</span><h2>${esc(d.name || 'Untitled plan')}</h2><small>${esc(countdown(d))}</small></div>
    <div class="t-perf"></div>
    ${row('name', '🏷️', 'Occasion', esc(d.name))}
    ${row('where', '📍', 'Where', d.loc ? esc(locLine(d.loc)) : '')}
    ${row('when', '🗓️', 'When', d.date || d.dateTBD ? `${esc(fmtWhen(d))}\n⏳ ${esc(fmtDur(d))}` : '')}
    ${row('dress', d.dress ? dressEmoji(d.dress) : '👔', 'Dress code', esc([d.dress, d.dressNote].filter(Boolean).join(' — ')))}
    ${row('guests', '👥', `Guests${d.guests.length ? ` (${d.guests.length})` : ''}`, esc(d.guests.map(g => g.name).join(', ') + (d.guestsTBD ? (d.guests.length ? ' + more TBD' : 'Guest list TBD') : '')))}
    ${row('food', d.food.on === 'tbd' ? '🤔' : d.food.on ? typeEmoji(FOOD_TYPES, d.food.type) : '🍽️', 'Food', food)}
    ${row('drinks', d.drinks.on === 'tbd' ? '🤔' : d.drinks.on ? typeEmoji(DRINK_TYPES, d.drinks.type) : '🥤', 'Drinks', drinks)}
    ${row('notes', '📝', 'Notes & extras', esc([d.notes, ...d.refs.filter(r => r.value).map(r => `${r.label}: ${r.value}`), d.files.length ? `📎 ${d.files.length} attachment${d.files.length > 1 ? 's' : ''}` : '', alarm && alarm[0] !== null ? `⏰ Reminder: ${alarm[1]}${alarm[0] ? ' before' : ''}` : ''].filter(Boolean).join('\n')))}
    ${editable ? '<div class="barcode"></div>' : '<div class="t-end"></div>'}
  </div>`;
}

/* ---------- wizard frame + transitions ---------- */
function renderWizard(dir = 1) {
  S.view = 'wizard';
  if (!$('.wizard')) {
    view.innerHTML = `<div class="screen wizard screen-in">
      <header class="wiz-top">
        <button class="icon-btn" data-act="wiz-back" id="wizBack" aria-label="Back"></button>
        <div class="progress"><div class="bar" id="pbar"></div><div class="runner" id="prunner"><span></span></div></div>
        <button class="icon-btn" data-act="themes" aria-label="Themes">🎨</button>
        <button class="icon-btn" data-act="toggle-sound" id="wizSound" aria-label="Sound">${settings.sound ? '🔊' : '🔇'}</button>
      </header>
      <div class="stage" id="stage"></div>
      <footer class="wiz-foot" id="wfoot"></footer></div>`;
  }
  const st = STEPS[S.step], last = STEPS.length - 1;
  const pct = S.step / last;
  $('#pbar').style.width = `calc(${pct * 100}% )`;
  $('#prunner').style.left = `calc(${Math.max(.04, Math.min(.96, pct)) * 100}%)`;
  $('#prunner span').textContent = S.step === last ? '🥳' : st.emoji;
  $('#wizBack').textContent = S.returnToReview ? '✓' : S.step === 0 ? '🏠' : '‹';
  $('#wizBack').style.fontSize = S.step === 0 || S.returnToReview ? '20px' : '30px';
  const nextLabel = st.key === 'review' ? (S.editing ? 'Save changes 💾' : 'Save Plan 🎉') : S.returnToReview ? 'Back to review ✓' : `Next <span class="arr">→</span>`;
  $('#wfoot').innerHTML = `${st.optional && !S.returnToReview ? `<button class="btn skip" data-act="wiz-skip">Skip</button>` : ''}<button class="btn primary next" data-act="wiz-next">${nextLabel}</button>`;
  swapPanel(stepHead(st, S.step) + STEP_HTML[st.key](S.draft), dir);
  afterStep(st.key);
}
let swapping = false;
function swapPanel(html, dir) {
  const stage = $('#stage'), old = stage.querySelector('.panel.current');
  const style = settings.transition === 'mix' ? pick(['slide', 'bounce', 'flip', 'zoom', 'swirl', 'card']) : settings.transition;
  // clear any leftovers from a previous, unfinished transition (prevents stacked/ghost panels)
  $$('.panel:not(.current)', stage).forEach(x => x.remove());
  const p = document.createElement('div');
  p.className = `panel current in-${style}`; p.style.setProperty('--dir', dir); p.innerHTML = html;
  swapping = true; stage.classList.add('swapping');
  if (old) {
    old.classList.remove('current'); old.className = `panel leaving out-${style}`; old.style.setProperty('--dir', dir);
  }
  stage.appendChild(p);
  const finish = () => {
    if (!p.isConnected) return;
    p.classList.remove(`in-${style}`); if (old) old.remove();
    swapping = false; stage.classList.remove('swapping');
    const em = p.querySelector('.step-emoji'); if (em) em.classList.add('idle');
  };
  p.addEventListener('animationend', e => { if (e.target === p) finish(); }, { once: false });
  setTimeout(finish, 700); // safety net if animationend never fires (backgrounded tab, etc.)
  return p;
}
function refreshStep() {
  const p = $('#stage .panel.current'); if (!p) return;
  const st = p.scrollTop; p.classList.add('static');
  p.innerHTML = stepHead(STEPS[S.step], S.step) + STEP_HTML[STEPS[S.step].key](S.draft);
  const em = p.querySelector('.step-emoji'); if (em) em.classList.add('idle');
  p.scrollTop = st;
}
function afterStep(key) {
  if (key === 'where' && S.draft.locQuery && !S.draft.loc) searchPlaces(S.draft.locQuery);
  if (key === 'review') setTimeout(() => { Sound.play('sparkle'); const t = $('.panel.current .t-top');  }, 450);
}
function validate(key) {
  const d = S.draft;
  if (key === 'name' && !d.name.trim()) return 'Every great plan needs a name ✍️';
  if (key === 'when' && !d.dateTBD) {
    if (!d.date) return 'Pick a date first 📅';
    if (!d.allDay && !d.timeTBD && !d.time) return 'What time does it start? ⏰';
    if (!d.allDay && !d.timeTBD && d.duration === 'custom') {
      if (!d.endTime) return 'When does it end? 🏁';
      const [y, m, dd] = (d.endDate || d.date).split('-').map(Number), [h, n] = d.endTime.split(':').map(Number);
      if (new Date(y, m - 1, dd, h, n) <= planTimes({ ...d, duration: 120 }).start) return 'It ends before it starts? Time travel not supported 🕰️';
    }
  }
  return null;
}
function wizNext(skip, e) {
  if (swapping) return;
  const st = STEPS[S.step];
  if (!skip) {
    const err = validate(st.key);
    if (err) { const p = $('#stage .panel.current'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); Sound.play('error'); toast(err); return; }
  }
  if (st.key === 'when' && S.draft.duration === 'custom' && !S.draft.endDate) S.draft.endDate = S.draft.date;
  if (st.key === 'review') return savePlan();
  if (S.returnToReview) { S.returnToReview = false; S.step = STEPS.length - 1; } else S.step++;
  Sound.play(skip ? 'whoosh' : 'next');
  const kb = document.activeElement && document.activeElement.matches && document.activeElement.matches('input,textarea');
  if (kb) document.activeElement.blur();
  // let the keyboard finish closing first so the screen doesn't jump mid-transition
  if (kb) setTimeout(() => { renderWizard(1); saveDraft(); }, 140); else { renderWizard(1); saveDraft(); }
}
function wizBack() {
  if (swapping) return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (S.returnToReview) { S.returnToReview = false; S.step = STEPS.length - 1; Sound.play('back'); renderWizard(-1); saveDraft(); return; }
  if (S.step === 0) return exitWizard();
  S.step--; Sound.play('back'); renderWizard(-1); saveDraft();
}
function gotoStep(i) { if (swapping) return; S.returnToReview = true; S.step = i; Sound.play('pop'); renderWizard(-1); saveDraft(); }
async function exitWizard() {
  if (S.editing) {
    const ok = await ask('✋', 'Leave without saving?', 'Your edits to this plan will be tossed.', 'Discard edits', 'Keep editing');
    if (!ok) return;
    S.draft = null; clearDraft(); cleanupOrphans(); renderHome(); return;
  }
  if (isEmptyDraft(S.draft)) { S.draft = null; clearDraft(); }
  else { saveDraft(); toast('Draft saved — finish it anytime 📝'); S.draft = null; }
  Sound.play('back'); renderHome();
}
async function startNew(silent) {
  const dr = load(K.draft, null);
  if (!silent && dr && dr.draft && !isEmptyDraft(dr.draft)) {
    const ok = await ask('📝', 'You have a draft!', `Continue “${dr.draft.name || 'Untitled plan'}” or start a fresh one?`, 'Continue draft', 'Start fresh');
    if (ok) return resumeDraft();
    clearDraft();
  }
  S.draft = newDraft(); S.step = 0; S.editing = false; S.returnToReview = false; S.results = [];
  if (!silent) Sound.play('whoosh');
  view.innerHTML = ''; renderWizard(1); saveDraft();
}
function resumeDraft() {
  const dr = load(K.draft, null); if (!dr || !dr.draft) return startNew(true);
  S.draft = dr.draft; S.step = Math.min(dr.step || 0, STEPS.length - 1); S.editing = !!dr.editing; S.returnToReview = false;
  view.innerHTML = ''; Sound.play('whoosh'); renderWizard(1);
}
function savePlan() {
  const d = S.draft; d.updatedAt = Date.now();
  const i = plans.findIndex(p => p.id === d.id);
  const wasEdit = i >= 0;
  if (wasEdit) plans[i] = clone(d); else plans.push(clone(d));
  savePlans(); clearDraft();
  S.draft = null; S.editing = false; S.returnToReview = false;
  renderDone(d.id, wasEdit); cleanupOrphans();
}

/* ---------- guests ---------- */
function addGuest(raw, e) {
  const d = S.draft; const names = String(raw).split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  let added = null;
  for (const n of names) {
    if (d.guests.some(g => g.name.toLowerCase() === n.toLowerCase())) { toast(`${n} is already on the list 😉`); Sound.play('error'); continue; }
    d.guests.push({ name: n, rsvp: 'invited' }); added = n;
  }
  if (!added) return;
  Sound.play('add');
  $('#guest-list').innerHTML = guestsHTML(d, added);
  $('#gcount').textContent = `${d.guests.length} + you`;
  const chip = $$('#guest-list .gchip.new').pop(); if (chip) { }
  const rec = $('#recent'); if (rec) { $$('#recent .chip').forEach(c => { if (d.guests.some(g => g.name === c.dataset.n)) c.remove(); }); }
  saveDraftSoon();
}

/* ---------- attachments ---------- */
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const thumbC = document.createElement('canvas'), ts = Math.min(1, 260 / Math.max(W, H));
    thumbC.width = Math.round(W * ts); thumbC.height = Math.round(H * ts); thumbC.getContext('2d').drawImage(img, 0, 0, thumbC.width, thumbC.height);
    const thumb = thumbC.toDataURL('image/jpeg', .72);
    // keep originals (sharp QR codes on tickets!) unless they're huge
    if (file.size < 4.5 * 1024 * 1024 && /image\/(png|jpeg|gif|webp)/.test(file.type)) return { blob: file, type: file.type, thumb };
    const sc = Math.min(1, 2200 / Math.max(W, H)), c = document.createElement('canvas');
    c.width = Math.round(W * sc); c.height = Math.round(H * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
    return { blob: blob || file, type: blob ? 'image/jpeg' : file.type, thumb };
  } catch { return { blob: file, type: file.type, thumb: null }; }
  finally { URL.revokeObjectURL(url); }
}
async function handleFiles(list) {
  const files = [...list]; if (!files.length || !S.draft) return;
  const grid = $('#files');
  for (const f of files) {
    if (f.size > 40 * 1024 * 1024) { toast(`${f.name} is over 40 MB — too chonky 🐘`); continue; }
    const ph = document.createElement('div'); ph.className = 'ftile loading'; grid && grid.appendChild(ph);
    try {
      let blob = f, type = f.type || 'application/octet-stream', thumb = null;
      if (type.startsWith('image/')) { const r = await compressImage(f); blob = r.blob; type = r.type || type; thumb = r.thumb; }
      const id = 'f_' + uid(), buf = await blob.arrayBuffer();
      await FileDB.put(id, { buf, type, name: f.name || 'file' });
      S.draft.files.push({ id, name: f.name || 'file', type, size: buf.byteLength, thumb });
      Sound.play('shutter');
    } catch (err) { console.error(err); toast(`Couldn't add ${f.name} 😕`); }
    ph.remove();
    if ($('#files')) $('#files').innerHTML = filesHTML(S.draft.files, true);
  }
  saveDraft();
}
async function viewFile(id) {
  const meta = (S.draft && S.draft.files.find(f => f.id === id)) || plans.flatMap(p => p.files).find(f => f.id === id);
  const rec = await FileDB.get(id).catch(() => null);
  if (!rec) { toast('That file has gone missing 🕵️'); return; }
  const blob = new Blob([rec.buf], { type: rec.type }), url = URL.createObjectURL(blob);
  const root = $('#viewer-root'); root.classList.add('open'); Sound.play('open');
  const isImg = rec.type.startsWith('image/');
  root.innerHTML = `<div class="viewer"><div class="vtop"><button data-act="close-viewer">✕</button><b>${esc(rec.name)}</b><button data-act="share-file" data-id="${id}">📤</button></div>
    <div class="vbody">${isImg ? `<img src="${url}" alt="">` : `<div class="vfile"><div class="fi">${fileIcon(rec.type)}</div><h3>${esc(rec.name)}</h3><p>${(rec.buf.byteLength / 1024 / 1024).toFixed(2)} MB</p>
      <a class="btn primary" href="${url}" target="_blank" rel="noopener">👀 Open</a></div>`}</div></div>`;
  root.dataset.url = url;
  void meta;
}
async function shareFile(id) {
  const rec = await FileDB.get(id).catch(() => null); if (!rec) return;
  const file = new File([rec.buf], rec.name, { type: rec.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch {} }
  else downloadBlob(file, rec.name);
}
function closeViewer() { const r = $('#viewer-root'); if (r.dataset.url) URL.revokeObjectURL(r.dataset.url); r.innerHTML = ''; r.classList.remove('open'); Sound.play('close'); }
async function cleanupOrphans() {
  try {
    const keys = await FileDB.keys(), used = new Set();
    plans.forEach(p => p.files.forEach(f => used.add(f.id)));
    const dr = load(K.draft, null); if (dr && dr.draft) dr.draft.files.forEach(f => used.add(f.id));
    if (S.draft) S.draft.files.forEach(f => used.add(f.id));
    for (const k of keys) if (!used.has(k)) await FileDB.del(k);
  } catch {}
}

/* =========================================================
   HOME
   ========================================================= */
function renderHome() {
  S.view = 'home';
  const now = Date.now();
  const all = plans.map(p => ({ p, ...planTimes(p) }));
  const up = all.filter(o => !o.end || o.end.getTime() >= now).sort((a, b) => (a.start ? a.start.getTime() : 9e15) - (b.start ? b.start.getTime() : 9e15));
  const past = all.filter(o => o.end && o.end.getTime() < now).sort((a, b) => b.start - a.start);
  const list = S.tab === 'upcoming' ? up : past;
  const next = up.find(o => o.start);
  const dr = load(K.draft, null);
  const hasDraft = dr && dr.draft && !isEmptyDraft(dr.draft);
  view.innerHTML = `<div class="screen home screen-in">
    <header class="topbar">
      <div><div class="hello">${greeting()}</div><h1 class="logo">Plans<span class="dot">.</span></h1></div>
      <div class="top-actions"><button class="icon-btn" data-act="themes" aria-label="Themes">🎨</button><button class="icon-btn" data-act="toggle-sound" aria-label="Sound">${settings.sound ? '🔊' : '🔇'}</button><button class="icon-btn" data-act="settings" aria-label="Settings">⚙️</button></div>
    </header>
    <div class="scroll">
      ${hasDraft ? `<div class="draft-banner"><span class="de">${esc(dr.draft.emoji)}</span><span class="dt"><b>${esc(dr.draft.name || 'Untitled plan')}</b><small>${dr.draft.id && planById(dr.draft.id) ? 'Unsaved edits' : 'Draft in progress'} · step ${(dr.step || 0) + 1} of ${STEPS.length}</small></span><button data-act="continue-draft">Finish</button><button class="x" data-act="discard-draft" aria-label="Discard">✕</button></div>` : ''}
      ${next ? `<button class="nextup" data-act="open" data-id="${next.p.id}"><div class="lbl">⏳ Next up</div><div class="nm"><span class="e">${esc(next.p.emoji)}</span><span>${esc(next.p.name)}</span></div>${tickerHTML(next.start, next.end)}</button>` : ''}
      <button class="mega-btn" data-act="new-plan"><span class="mega-plus">＋</span><span><b>Make a Plan</b><small>${esc(pick(TAGLINES))}</small></span></button>
      <div class="seg"><button class="${S.tab === 'upcoming' ? 'on' : ''}" data-act="tab" data-v="upcoming">Upcoming · ${up.length}</button><button class="${S.tab === 'past' ? 'on' : ''}" data-act="tab" data-v="past">Past · ${past.length}</button></div>
      <div class="cards">${list.length ? list.map((o, i) => planCard(o.p, i)).join('') : emptyHTML()}</div>
    </div></div>`;
}
function emptyHTML() {
  return S.tab === 'upcoming'
    ? `<div class="empty"><span class="ee">🦗</span><b>It's quiet… too quiet.</b>Tap <b>Make a Plan</b> and give your calendar something to brag about.</div>`
    : `<div class="empty"><span class="ee">📼</span><b>No past plans yet.</b>Memories will show up here after the fun.</div>`;
}
function planCard(p, i) {
  const g = p.guests.slice(0, 4);
  return `<button class="pcard" style="animation-delay:${i * .05}s" data-act="open" data-id="${p.id}">
    <span class="pe">${esc(p.emoji)}</span>
    <span class="pi"><div class="pn">${esc(p.name)}</div><div class="pw">🗓 ${esc(fmtWhen(p))}</div>${p.loc ? `<div class="pl">📍 ${esc(p.loc.name)}</div>` : ''}
      <div class="pm"><span class="pill" data-cd="${p.id}">${esc(countdown(p))}</span>${g.length ? `<span class="avs">${g.map(x => avatar(x.name)).join('')}</span>${p.guests.length > 4 ? `<small style="color:var(--muted)">+${p.guests.length - 4}</small>` : ''}` : ''}</div></span></button>`;
}
function tickerHTML(start, end) {
  return `<div class="ticker" data-tick="${start.getTime()}" data-end="${end.getTime()}">${tickerInner(start.getTime(), end.getTime())}</div>`;
}
function tickerInner(s, e) {
  const now = Date.now();
  if (now >= s && now < e) return `<div style="grid-column:1/-1"><b>🎉 Happening now!</b></div>`;
  const diff = Math.max(0, s - now), d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, sec = Math.floor(diff / 1e3) % 60;
  return [[d, 'days'], [h, 'hrs'], [m, 'min'], [sec, 'sec']].map(([v, l]) => `<div><b>${pad(v)}</b><small>${l}</small></div>`).join('');
}
function tick() {
  $$('[data-tick]').forEach(el => { el.innerHTML = tickerInner(+el.dataset.tick, +el.dataset.end); });
  if (S.view === 'home' && new Date().getSeconds() === 0) $$('[data-cd]').forEach(el => { const p = planById(el.dataset.cd); if (p) el.textContent = countdown(p); });
}

/* ---------- done screen ---------- */
function renderDone(id, wasEdit) {
  const p = planById(id); S.view = 'done';
  view.innerHTML = `<div class="screen done screen-in"><div class="scroll">
    <div class="done-burst">${esc(p.emoji)}</div>
    <h1 class="done-title">${wasEdit ? pick(['Updated!', 'Fresh edits saved!', 'Even better now!']) : pick(["It's a plan!", 'Locked in!', 'Plans: made.', 'Look at you go!', 'Calendar, meet fun.'])}</h1>
    <p class="done-sub">${esc(p.name)} · ${esc(countdown(p))}</p>
    ${ticketHTML(p, false)}
    <div class="done-actions">
      <button class="btn primary" data-act="cal" data-id="${p.id}">📅 Add to Apple Calendar</button>
      <button class="btn" data-act="cal-share" data-id="${p.id}">🗓️ Send calendar invite</button>
      <button class="btn" data-act="share" data-id="${p.id}">📤 Share with the crew</button>
      <button class="btn ghost" data-act="go-home">🏠 My Plans</button>
    </div></div></div>`;
  setTimeout(() => { Sound.play('tada'); FX.confetti(); }, 150);
}

/* ---------- detail sheet ---------- */
function detailHTML(p) {
  const counts = RSVP_ORDER.map(k => [k, p.guests.filter(g => (g.rsvp || 'invited') === k).length]).filter(x => x[1]);
  const row = (i, l, v, extra = '', sub = '') => `<div class="d-row"><span class="di">${i}</span><span class="dv"><small>${l}</small><b>${v}</b>${sub ? `<span>${sub}</span>` : ''}</span>${extra}</div>`;
  const assigns = Object.entries(p.food.assign || {}).filter(x => x[1]);
  const alarm = ALARMS.find(a => a[0] === p.alarm);
  return `<div class="d-hero"><span class="de">${esc(p.emoji)}</span><h2>${esc(p.name)}</h2><span class="pill">${esc(countdown(p))}</span></div>
    <div class="sec-title">The details</div>
    <div class="d-box">
      ${row('🗓️', 'When', esc(fmtWhen(p)), '', `⏳ ${esc(fmtDur(p))}${alarm && alarm[0] !== null ? ` · ⏰ ${esc(alarm[1])}${alarm[0] ? ' before' : ''}` : ''}`)}
      ${p.loc ? row('📍', 'Where', esc(p.loc.name), (p.loc.lat != null || p.loc.address) ? `<a class="link" href="${esc(mapsURL(p.loc))}" target="_blank" rel="noopener">Maps ↗</a>` : '', esc(p.loc.address || '')) : ''}
      ${p.dress || p.dressNote ? row(dressEmoji(p.dress), 'Dress code', esc(p.dress || 'Custom'), '', esc(p.dressNote)) : ''}
      ${p.food.on === 'tbd' ? row('🤔', 'Food', 'Not sure yet') : p.food.on !== null ? row(p.food.on ? typeEmoji(FOOD_TYPES, p.food.type) : '🍽️', 'Food', p.food.on ? esc(p.food.type || 'Yes!') : 'None planned', '', esc([p.food.details, ...assigns.map(([n, v]) => `• ${n}: ${v}`)].filter(Boolean).join('\n'))) : ''}
      ${p.drinks.on === 'tbd' ? row('🤔', 'Drinks', 'Not sure yet') : p.drinks.on !== null ? row(p.drinks.on ? typeEmoji(DRINK_TYPES, p.drinks.type) : '🥤', 'Drinks', p.drinks.on ? esc(p.drinks.type || 'Yes!') : 'None planned', '', esc(p.drinks.details)) : ''}
      ${p.guestsTBD && !p.guests.length ? row('👥', 'Guests', 'Guest list TBD') : ''}
      ${p.notes ? row('📝', 'Notes', esc(p.notes)) : ''}
    </div>
    ${p.refs.some(r => r.value) ? `<div class="sec-title">🎟️ Reference numbers · tap to copy</div><div class="d-box">${p.refs.filter(r => r.value).map(r => `<div class="d-row copyable" data-act="copy" data-v="${esc(r.value)}"><span class="di">🔖</span><span class="dv"><small>${esc(r.label)}</small><b style="font-family:ui-monospace,Menlo,monospace">${esc(r.value)}</b></span><span class="link">Copy</span></div>`).join('')}</div>` : ''}
    ${p.guests.length ? `<div class="sec-title">👥 Guest list · tap to RSVP</div><div class="rsvp-sum">${counts.map(([k, n]) => `<span class="pill">${RSVP[k][0]} ${n} ${RSVP[k][1]}</span>`).join('')}</div>
      <div class="rsvp-list">${p.guests.map((g, i) => { const r = g.rsvp || 'invited'; return `<button class="rsvp" data-act="rsvp" data-id="${p.id}" data-i="${i}">${avatar(g.name)}<span class="rn">${esc(g.name)}</span><span class="rs ${r}">${RSVP[r][0]} ${RSVP[r][1]}</span></button>`; }).join('')}</div>` : ''}
    ${p.files.length ? `<div class="sec-title">📎 Attachments</div><div class="file-grid">${filesHTML(p.files, false)}</div>` : ''}
    <div class="act-grid">
      <button class="btn primary full" data-act="cal" data-id="${p.id}">📅 Add to Apple Calendar</button>
      <button class="btn" data-act="share" data-id="${p.id}">📤 Share</button>
      <button class="btn" data-act="edit" data-id="${p.id}">✏️ Edit</button>
      <button class="btn" data-act="dup" data-id="${p.id}">🧬 Duplicate</button>
      <button class="btn danger" data-act="del" data-id="${p.id}">🗑️ Delete</button>
    </div>`;
}
function openDetail(id) { const p = planById(id); if (p) openSheet(detailHTML(p)); }

/* ---------- sheets / dialogs ---------- */
function openSheet(html) {
  const root = $('#sheet-root');
  root.classList.remove('closing');
  root.innerHTML = `<div class="backdrop" data-act="close-sheet"></div><div class="sheet"><div class="grab"></div><button class="sheet-x" data-act="close-sheet" aria-label="Close">✕</button><div class="sheet-body">${html}</div></div>`;
  root.classList.add('open'); Sound.play('open');
  const sheet = $('.sheet', root), grab = $('.grab', root); let y0 = null, dy = 0;
  grab.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
  grab.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
  grab.addEventListener('touchend', () => { sheet.style.transition = 'transform .25s'; if (dy > 90) closeSheet(); else sheet.style.transform = ''; y0 = null; dy = 0; });
}
function updateSheet(html) { const b = $('#sheet-root .sheet-body'); if (b) { const st = b.scrollTop; b.innerHTML = html; b.scrollTop = st; } }
function closeSheet() {
  const root = $('#sheet-root'); if (!root.classList.contains('open')) return;
  root.classList.add('closing'); Sound.play('close');
  setTimeout(() => { root.innerHTML = ''; root.classList.remove('open', 'closing'); }, 280);
}
function ask(emoji, title, msg, okLabel, cancelLabel = 'Cancel', danger = false) {
  return new Promise(res => {
    const root = $('#dialog-root'); root.classList.add('open'); Sound.play('pop');
    root.innerHTML = `<div class="backdrop" data-dlg="0"></div><div class="dialog"><div class="dg-e">${emoji}</div><h3>${esc(title)}</h3><p>${esc(msg)}</p>
      <div class="dg-btns"><button class="btn primary ${danger ? 'danger' : ''}" data-dlg="1">${esc(okLabel)}</button><button class="btn ghost" data-dlg="0">${esc(cancelLabel)}</button></div></div>`;
    root.onclick = e => { const b = e.target.closest('[data-dlg]'); if (!b) return; e.stopPropagation(); root.innerHTML = ''; root.classList.remove('open'); root.onclick = null; Sound.play('tap'); res(b.dataset.dlg === '1'); };
  });
}

/* ---------- settings ---------- */
function settingsHTML() {
  return `<h3>⚙️ Settings</h3>
    <div class="set-row"><span>🔊 Sound effects<small>Pops, whooshes & a very proud “ta-da”</small></span><button class="switch ${settings.sound ? 'on' : ''}" data-act="set-sound"></button></div>
    <div class="set-row"><span>🚀 Open to a new plan<small>Jump straight into the questions on launch</small></span><button class="switch ${settings.launchNew ? 'on' : ''}" data-act="set-launch"></button></div>
    <div class="sec-title">🎬 Screen transitions</div>
    <div class="chips">${TRANSITIONS.map(([k, l]) => `<button class="chip sm ${settings.transition === k ? 'on' : ''}" data-act="set-trans" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="sec-title">🎨 Theme</div><button class="btn small" data-act="themes">🎨 Choose a color theme · ${esc((THEMES.find(t => t[0] === settings.theme) || THEMES[0])[1])}</button>
    <div class="sec-title">⏰ Default calendar reminder</div>
    <div class="chips">${ALARMS.map(([v, l]) => `<button class="chip sm ${settings.alarm === v ? 'on' : ''}" data-act="set-alarm" data-v="${v}">${l}${v !== null && v !== 0 ? ' before' : ''}</button>`).join('')}</div>
    <div class="sec-title">💾 Backup</div>
    <div class="act-grid" style="margin-top:0">
      <button class="btn small" data-act="export">⬆️ Export backup</button>
      <label class="btn small" style="position:relative;overflow:hidden">⬇️ Import backup<input type="file" accept=".json,application/json" id="import-file" style="position:absolute;inset:0;opacity:0"></label>
    </div>
    <p class="about">Plans v1.5.1 · Everything is stored on this device.<br>Place search by Photon (Komoot) · Map data © OpenStreetMap contributors.</p>`;
}
function swatchesHTML() {
  const sw = t => `<button class="swatch ${settings.theme === t[0] ? 'on' : ''}" data-act="set-theme" data-v="${t[0]}"><i style="background:linear-gradient(160deg,${t[4]},${t[5]})"><em style="background:${t[2]}"></em><em style="background:${t[3]}"></em></i>${t[1]}</button>`;
  return `<div class="sec-title">🌙 Dark</div><div class="swatches">${THEMES.filter(t => !t[6]).map(sw).join('')}</div>
    <div class="sec-title">☀️ Light</div><div class="swatches">${THEMES.filter(t => t[6]).map(sw).join('')}</div>`;
}
function themeSheet() { openSheet(`<h3>🎨 Color themes</h3><p class="hint" style="margin-top:-6px">Tap one to try it on. It's saved automatically.</p>${swatchesHTML()}
  <div class="set-row" style="margin-top:20px"><span>🎲 Surprise me<small>Random theme</small></span><button class="btn small" style="width:auto" data-act="random-theme">Shuffle</button></div>`); }
function applyTheme() {
  if (!THEMES.some(t => t[0] === settings.theme)) settings.theme = 'party';
  const th = THEMES.find(t => t[0] === settings.theme);
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.tone = th[6] ? 'light' : 'dark';
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim();
}
const bufToB64 = buf => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(new Blob([buf])); });
const b64ToBuf = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
async function exportBackup() {
  toast('Packing your plans… 📦');
  const files = {};
  for (const p of plans) for (const f of p.files) { const r = await FileDB.get(f.id).catch(() => null); if (r) files[f.id] = { type: r.type, name: r.name, data: await bufToB64(r.buf) }; }
  const json = JSON.stringify({ app: 'Plans', version: 1, exported: new Date().toISOString(), settings, plans, files });
  const name = `plans-backup-${isoDate(new Date())}.json`, file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Plans backup' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  downloadBlob(file, name);
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text()); if (j.app !== 'Plans' || !Array.isArray(j.plans)) throw new Error('bad');
    for (const [id, f] of Object.entries(j.files || {})) await FileDB.put(id, { type: f.type, name: f.name, buf: b64ToBuf(f.data) });
    let n = 0; j.plans.forEach(p => { const i = plans.findIndex(x => x.id === p.id); if (i >= 0) plans[i] = p; else plans.push(p); n++; });
    savePlans(); Sound.play('tada'); FX.confetti(80); toast(`Imported ${n} plan${n === 1 ? '' : 's'} 🎉`);
    closeSheet(); renderHome();
  } catch { Sound.play('error'); toast("That doesn't look like a Plans backup 🤔"); }
}

/* =========================================================
   ACTIONS (event delegation)
   ========================================================= */
const ACTIONS = {
  'new-plan': () => startNew(false),
  'continue-draft': () => resumeDraft(),
  'discard-draft': async () => { if (await ask('🗑️', 'Toss this draft?', 'It will be gone for good.', 'Toss it', 'Keep it', true)) { clearDraft(); Sound.play('remove'); cleanupOrphans(); renderHome(); } },
  'settings': () => openSheet(settingsHTML()),
  'toggle-sound': el => { settings.sound = !settings.sound; saveSettings(); el.textContent = settings.sound ? '🔊' : '🔇'; Sound.play('toggle'); toast(settings.sound ? 'Sound on 🔊' : 'Shh… sound off 🤫'); },
  'tab': el => { S.tab = el.dataset.v; Sound.play('tap'); renderHome(); },
  'open': el => openDetail(el.dataset.id),
  'go-home': () => { Sound.play('back'); renderHome(); },
  'wiz-back': () => wizBack(),
  'wiz-next': (el, e) => wizNext(false, e),
  'wiz-skip': (el, e) => wizNext(true, e),
  'goto': el => gotoStep(+el.dataset.step),

  // name
  'set-emoji': el => { setDraftEmoji(el.dataset.v); Sound.play('emoji'); },
  'occasion': el => {
    S.draft.name = el.dataset.n; Sound.play('pop');
    const ni = $('#f-name'); if (ni) ni.value = el.dataset.n;
    $$('[data-act="occasion"]').forEach(c => c.classList.toggle('on', c === el));
    if (!S.draft.emoji || EMOJIS.includes(S.draft.emoji) || S.draft.emoji === '🎉') setDraftEmoji(el.dataset.e); else saveDraftSoon();
  },
  'near-me': async el => {
    el.textContent = '⏳';
    try { await getGeo(); Sound.play('pin'); toast('Searching near you 🧭'); el.classList.add('on'); const q = $('#f-where').value; if (q) searchPlaces(q); }
    catch { Sound.play('error'); toast('Location is off. Settings → Privacy → Location Services → Safari Websites 📍'); }
    el.textContent = '🧭';
  },
  'loc-here': async el => {
    el.textContent = '⏳ Finding you…';
    try { const g = await getGeo(); const l = await reverseGeo(g); setLoc(l); }
    catch { Sound.play('error'); toast("Couldn't get your location 📍"); }
    el.textContent = '📍 Where I am now';
  },
  'loc-quick': el => setLoc({ name: el.dataset.v, address: '', lat: null, lon: null, kind: el.dataset.v === 'My place' ? 'house' : null }),
  'pick-loc': el => setLoc(S.results[+el.dataset.i]),
  'loc-custom': () => setLoc({ name: $('#f-where').value.trim(), address: '', lat: null, lon: null }),
  'loc-clear': () => { S.draft.loc = null; Sound.play('remove'); $('#loc-selected').innerHTML = ''; const i = $('#f-where'); if (i) { i.focus(); if (i.value) searchPlaces(i.value); } saveDraftSoon(); },

  // when
  'quick-date': el => { const wasAll = S.draft.allDay; S.draft.date = el.dataset.d; S.draft.time = el.dataset.t; S.draft.allDay = false; S.draft.dateTBD = false; S.draft.timeTBD = false; Sound.play('pop'); updateWhen({ dur: wasAll }); saveDraftSoon(); },
  'toggle-allday': () => { S.draft.allDay = !S.draft.allDay; Sound.play('toggle'); updateWhen({ dur: true }); saveDraftSoon(); },
  'duration': el => {
    const v = el.dataset.v, wasCustom = S.draft.duration === 'custom';
    S.draft.duration = v === 'custom' || v === 'tbd' ? v : +v;
    if (v === 'custom' && !S.draft.endDate) S.draft.endDate = S.draft.date;
    Sound.play('pop'); updateWhen({ dur: wasCustom !== (v === 'custom'), animate: v === 'custom' }); saveDraftSoon();
  },
  'days': el => { S.draft.days = Math.max(1, Math.min(30, (S.draft.days || 1) + +el.dataset.v)); Sound.play('tick'); updateWhen({ dur: true }); saveDraftSoon(); },
  'dress': el => { setUnsure('unsure-dress', false); const v = el.dataset.v; S.draft.dress = S.draft.dress === v ? '' : v; $$('.dress').forEach(b => b.classList.toggle('on', b.dataset.v === S.draft.dress)); Sound.play(S.draft.dress ? 'pop' : 'remove'); saveDraftSoon(); },
  'add-guest': (el, e) => { const i = $('#f-guest'); if (i.value.trim()) { addGuest(i.value, e); i.value = ''; } i.focus(); },
  'recent-guest': el => addGuest(el.dataset.n),
  'del-guest': el => { const i = +el.dataset.i, chip = el.closest('.gchip'); const n = S.draft.guests[i].name; chip.classList.add('out'); Sound.play('remove'); setTimeout(() => { S.draft.guests.splice(i, 1); delete S.draft.food.assign[n]; $('#guest-list').innerHTML = guestsHTML(S.draft); $('#gcount').textContent = `${S.draft.guests.length} + you`; saveDraftSoon(); }, 250); },

  // food & drinks
  'yn': el => {
    const k = el.dataset.k, v = el.dataset.v, val = v === '1' ? true : v === '0' ? false : 'tbd', f = S.draft[k];
    if (f.on === val) return;
    if (val === true) { f.on = true; Sound.play('yes'); }
    else { S.draft[k] = k === 'food' ? { on: val, type: '', details: '', assign: {} } : { on: val, type: '', details: '' }; Sound.play(val === false ? 'no' : 'pop'); }
    $$(`.yn-btn[data-k="${k}"]`).forEach(b => { const bv = b.dataset.v === '1' ? true : b.dataset.v === '0' ? false : 'tbd'; b.classList.toggle('on', bv === val); b.classList.toggle('off', bv !== val); });
    $('#yn-body').innerHTML = ynBody(S.draft, k, true); saveDraftSoon();
  },
  'ytype': el => {
    const k = el.dataset.k, f = S.draft[k], wasPot = f.type === 'Potluck';
    f.type = f.type === el.dataset.v ? '' : el.dataset.v; Sound.play('pop');
    $$(`.type[data-k="${k}"]`).forEach(b => b.classList.toggle('on', b.dataset.v === f.type));
    const t = YN[k].TYPES.find(x => x.k === f.type), ta = $('#yn-details'); if (ta) ta.placeholder = t ? t.ph : 'Any details?';
    if (wasPot !== (f.type === 'Potluck')) $('#assign-wrap').innerHTML = assignHTML(S.draft, k);
    saveDraftSoon();
  },
  'add-ref': el => { S.draft.refs.push({ label: el.dataset.v, value: '' }); Sound.play('add'); $('#refs').innerHTML = refsHTML(S.draft); const ins = $$('#refs input'); ins[ins.length - 1].focus(); saveDraftSoon(); },
  'del-ref': el => { S.draft.refs.splice(+el.dataset.i, 1); Sound.play('remove'); $('#refs').innerHTML = refsHTML(S.draft); saveDraftSoon(); },
  'del-file': (el, e) => { e.stopPropagation(); S.draft.files = S.draft.files.filter(f => f.id !== el.dataset.id); Sound.play('remove'); $('#files').innerHTML = filesHTML(S.draft.files, true); saveDraft(); },
  'view-file': el => viewFile(el.dataset.id),
  'share-file': el => shareFile(el.dataset.id),
  'close-viewer': () => closeViewer(),
  'alarm': el => { S.draft.alarm = el.dataset.v === 'null' ? null : +el.dataset.v; $$('[data-act="alarm"]').forEach(b => b.classList.toggle('on', b === el)); Sound.play('tick'); saveDraftSoon(); },

  // plan actions
  'cal': el => calOpen(planById(el.dataset.id)),
  'cal-share': el => calShare(planById(el.dataset.id)),
  'share': el => sharePlan(planById(el.dataset.id)),
  'copy': el => copyText(el.dataset.v),
  'rsvp': (el, e) => {
    const p = planById(el.dataset.id), g = p.guests[+el.dataset.i];
    g.rsvp = RSVP_ORDER[(RSVP_ORDER.indexOf(g.rsvp || 'invited') + 1) % RSVP_ORDER.length]; savePlans();
    Sound.play(g.rsvp === 'going' ? 'yes' : g.rsvp === 'no' ? 'no' : 'pop');
    
    updateSheet(detailHTML(p));
  },
  'edit': async el => {
    const p = planById(el.dataset.id), dr = load(K.draft, null);
    if (dr && dr.draft && !isEmptyDraft(dr.draft) && dr.draft.id !== p.id && !(await ask('📝', 'Replace your draft?', `Editing this plan will toss your unsaved draft “${dr.draft.name || 'Untitled plan'}”.`, 'Edit anyway', 'Cancel'))) return;
    closeSheet(); S.draft = clone(p); S.editing = true; S.returnToReview = false; S.step = STEPS.length - 1; view.innerHTML = ''; Sound.play('whoosh'); renderWizard(1); saveDraft();
  },
  'dup': async el => {
    const p = clone(planById(el.dataset.id)); p.id = uid(); p.name = `${p.name} (again!)`; p.createdAt = Date.now(); p.guests.forEach(g => g.rsvp = 'invited');
    for (const f of p.files) { const r = await FileDB.get(f.id).catch(() => null); const nid = 'f_' + uid(); if (r) await FileDB.put(nid, r); f.id = nid; }
    closeSheet(); S.draft = p; S.editing = false; S.returnToReview = false; S.step = STEP_IX.when; view.innerHTML = '';
    Sound.play('sparkle'); toast('Cloned! Pick a new date 🧬'); renderWizard(1); saveDraft();
  },
  'del': async el => {
    const p = planById(el.dataset.id);
    if (!(await ask('🗑️', `Delete “${p.name}”?`, 'This plan and its attachments will be gone forever.', 'Delete it', 'Keep it', true))) return;
    plans = plans.filter(x => x.id !== p.id); savePlans(); Sound.play('remove'); closeSheet(); cleanupOrphans(); renderHome(); toast('Plan deleted 👋');
  },
  'close-sheet': () => closeSheet(),

  // settings
  'set-sound': el => { settings.sound = !settings.sound; saveSettings(); el.classList.toggle('on', settings.sound); Sound.play('toggle'); const t = $('[data-act="toggle-sound"]'); if (t) t.textContent = settings.sound ? '🔊' : '🔇'; },
  'set-launch': el => { settings.launchNew = !settings.launchNew; saveSettings(); el.classList.toggle('on', settings.launchNew); Sound.play('toggle'); },
  'set-trans': el => { settings.transition = el.dataset.v; saveSettings(); $$('[data-act="set-trans"]').forEach(b => b.classList.toggle('on', b === el)); Sound.play('whoosh'); },
  'set-theme': (el, e) => { settings.theme = el.dataset.v; saveSettings(); applyTheme(); $$('[data-act="set-theme"]').forEach(b => b.classList.toggle('on', b === el)); Sound.play('sparkle'); toast(`Theme: ${THEMES.find(t => t[0] === settings.theme)[1]} 🎨`); },
  'set-alarm': el => { settings.alarm = el.dataset.v === 'null' ? null : +el.dataset.v; saveSettings(); $$('[data-act="set-alarm"]').forEach(b => b.classList.toggle('on', b === el)); Sound.play('tick'); },
  'themes': () => themeSheet(),
  'random-theme': () => { const o = THEMES.filter(t => t[0] !== settings.theme); settings.theme = pick(o)[0]; saveSettings(); applyTheme(); Sound.play('sparkle'); updateSheet(`<h3>🎨 Color themes</h3><p class="hint" style="margin-top:-6px">Tap one to try it on. It's saved automatically.</p>${swatchesHTML()}<div class="set-row" style="margin-top:20px"><span>🎲 Surprise me<small>Random theme</small></span><button class="btn small" style="width:auto" data-act="random-theme">Shuffle</button></div>`); toast(`Theme: ${THEMES.find(t => t[0] === settings.theme)[1]} 🎨`); },
  'unsure-name': () => {
    const d = S.draft, on = d.name !== TBD_NAME;
    d.name = on ? TBD_NAME : ''; if (on && d.emoji === '🎉') setDraftEmoji('🤷');
    const ni = $('#f-name'); if (ni) ni.value = d.name;
    $$('[data-act="occasion"]').forEach(c => c.classList.remove('on'));
    setUnsure('unsure-name', on); Sound.play(on ? 'pop' : 'remove'); saveDraftSoon();
  },
  'unsure-where': () => {
    if (S.draft.loc && S.draft.loc.tbd) { ACTIONS['loc-clear'](); setUnsure('unsure-where', false); return; }
    setLoc({ name: 'Location TBD', address: '', lat: null, lon: null, kind: null, tbd: true }); setUnsure('unsure-where', true);
  },
  'unsure-date': () => { S.draft.dateTBD = !S.draft.dateTBD; Sound.play(S.draft.dateTBD ? 'pop' : 'toggle'); updateWhen(); saveDraftSoon(); },
  'toggle-timetbd': () => { S.draft.timeTBD = !S.draft.timeTBD; Sound.play('toggle'); updateWhen(); saveDraftSoon(); },
  'unsure-dress': () => {
    const on = S.draft.dress !== 'Not sure yet'; S.draft.dress = on ? 'Not sure yet' : '';
    $$('.dress').forEach(b => b.classList.remove('on')); setUnsure('unsure-dress', on); Sound.play(on ? 'pop' : 'remove'); saveDraftSoon();
  },
  'unsure-guests': () => { S.draft.guestsTBD = !S.draft.guestsTBD; setUnsure('unsure-guests', S.draft.guestsTBD); Sound.play(S.draft.guestsTBD ? 'pop' : 'remove'); saveDraftSoon(); },
  'unsure-notes': (el, e) => { const b = el; b.classList.add('on'); b.querySelector('.uc').textContent = '✓'; wizNext(true, e); },
  'edit-when': el => {
    const p = planById(el.dataset.id); closeSheet(); S.draft = clone(p); S.draft.dateTBD = false; S.editing = true; S.returnToReview = true; S.step = STEP_IX.when;
    view.innerHTML = ''; Sound.play('whoosh'); renderWizard(1); saveDraft();
  },
  'export': () => exportBackup()
};

function setLoc(l) {
  if (!l || !l.name) return;
  setUnsure('unsure-where', !!l.tbd);
  S.draft.loc = { tbd: !!l.tbd, name: l.name, address: l.address || '', full: l.full || '', parts: l.parts || null, lat: l.lat ?? null, lon: l.lon ?? null, kind: l.kind || null };
  Sound.play('pin');
  $('#loc-selected').innerHTML = locCard(S.draft.loc); $('#results').innerHTML = '';
  const i = $('#f-where'); if (i) i.blur();
  const c = $('#loc-selected .loc-card'); if (c) { }
  saveDraftSoon();
}

/* =========================================================
   BOOT
   ========================================================= */
function bindEvents() {
  $('#toast').addEventListener('click', hideToast);
  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || !app.contains(el)) return;
    const fn = ACTIONS[el.dataset.act]; if (fn) fn(el, e);
  });
  app.addEventListener('input', e => {
    const t = e.target; if (!S.draft && !t.id) return;
    if (t.dataset.bind && S.draft) {
      setPath(S.draft, t.dataset.bind, t.value); saveDraftSoon();
      const b = t.dataset.bind;
      if (b === 'date' && t.value) { S.draft.dateTBD = false; updateWhen(); }
      if (b === 'name') setUnsure('unsure-name', t.value === TBD_NAME);
      if (['date', 'time', 'endDate', 'endTime'].includes(b)) { const w = $('#when-summary'); if (w) w.innerHTML = whenStub(S.draft); $$('[data-act="quick-date"]').forEach(c => c.classList.remove('on')); }
      if (b === 'name') $$('[data-act="occasion"]').forEach(c => c.classList.toggle('on', c.dataset.n === t.value));
    }
    if (t.id === 'f-emoji') { t.dataset.typed = '1'; if (t.value) useCustomEmoji(t); return; }
    if (t.id === 'f-where') { S.draft.locQuery = t.value; clearTimeout(searchT); searchT = setTimeout(() => searchPlaces(t.value), 450); saveDraftSoon(); }
    if (t.id === 'f-guest' && /[,\n;]/.test(t.value)) { const parts = t.value.split(/[,\n;]/); const rest = parts.pop(); addGuest(parts.join(',')); t.value = rest.trimStart(); }
    if (t.dataset.ref != null && S.draft) { S.draft.refs[+t.dataset.ref].value = t.value; saveDraftSoon(); }
    if (t.dataset.assign != null && S.draft) { S.draft.food.assign[t.dataset.assign] = t.value; saveDraftSoon(); }
  });
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.file) { handleFiles(t.files).finally(() => { t.value = ''; }); }
    if (t.id === 'import-file' && t.files[0]) importBackup(t.files[0]);
  });
  app.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; const t = e.target;
    if (t.id === 'f-emoji') { e.preventDefault(); t.blur(); return; }
    if (t.id === 'f-guest') { e.preventDefault(); if (t.value.trim()) { addGuest(t.value); t.value = ''; } }
    else if (t.id === 'f-name') { e.preventDefault(); wizNext(false); }
    else if (t.id === 'f-where') { e.preventDefault(); clearTimeout(searchT); searchPlaces(t.value); t.blur(); }
  });
  // iOS needs a user gesture before audio can play
  const unlock = () => { if (settings.sound) Sound.ensure(); };
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('pointerdown', unlock, { once: true });
  // keyboard: keep the focused field visible
  app.addEventListener('focusin', e => { if (e.target.matches('input,textarea') && e.target.id !== 'f-emoji') setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });
}
function orientationLock() {
  const rot = $('#rotator');
  const set = () => {
    const a = typeof window.orientation === 'number' ? window.orientation : (screen.orientation ? screen.orientation.angle : 0);
    const ang = a === 270 ? -90 : a;
    const land = (a === 90 || a === -90 || a === 270) ? true : (typeof window.orientation === 'number' || screen.orientation) ? false : (innerWidth > innerHeight && innerHeight < 560);
    const h = document.documentElement;
    h.classList.toggle('land', land); h.classList.toggle('land-l', land && ang === 90); h.classList.toggle('land-r', land && ang === -90);
    if (land) { rot.style.width = innerHeight + 'px'; rot.style.height = innerWidth + 'px'; } else { rot.style.width = ''; rot.style.height = ''; }
    requestAnimationFrame(() => FX.resize());
  };
  addEventListener('resize', set); addEventListener('orientationchange', () => setTimeout(set, 250)); set();
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {}); } catch {}
}
async function boot() {
  app = $('#app'); view = $('#view');
  applyTheme(); FX.init(); orientationLock(); bindEvents();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  view.innerHTML = `<div class="splash"><div class="splash-logo"><div class="cal-ico" aria-hidden="true"><i class="ring r1"></i><i class="ring r2"></i>
      <div class="cal-top">${new Date().toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</div>
      <div class="cal-day">${new Date().getDate()}</div><div class="cal-check">✓</div></div></div>
    <div class="splash-word">${'Plans'.split('').map((c, i) => `<span style="animation-delay:${.25 + i * .07}s">${c}</span>`).join('')}</div>
    <div class="splash-tag">Making plans, minus the boring.</div></div>`;
  await sleep(1350);
  $('.splash') && $('.splash').classList.add('out'); await sleep(380);
  view.innerHTML = '';
  const dr = load(K.draft, null);
  if (dr && dr.draft && !isEmptyDraft(dr.draft)) { resumeDraft(); setTimeout(() => toast('Picked up right where you left off 👋'), 500); }
  else if (settings.launchNew) startNew(true);
  else renderHome();
  setInterval(tick, 1000);
  cleanupOrphans();
}
document.addEventListener('DOMContentLoaded', boot);
