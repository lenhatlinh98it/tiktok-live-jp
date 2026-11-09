// 釣り船ライブ – boat-at-sea fishing overlay (2D canvas over an AI-painted background)
const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const stage = $('#stage');
const GOLDEN_GOAL = Math.max(10, Number(params.get('golden')) || 500);
const GOLDEN_SEC = 30;
const IDLE_MS = 10 * 60 * 1000;
const SPEED = Math.max(0.1, Number(params.get('speed')) || 1); // >1 = faster (testing only)

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

// Phone use (screen-share streaming): tap once to go fullscreen and hide the browser bars
if (matchMedia('(pointer: coarse)').matches) {
  const hint = document.createElement('div');
  hint.className = 'fs-hint';
  hint.textContent = 'タップで全画面';
  document.body.appendChild(hint);
  const goFull = () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
    hint.remove();
  };
  addEventListener('click', goFull, { once: true });
  addEventListener('fullscreenchange', fit);
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function initials(n) { return (n || '?').trim().charAt(0).toUpperCase(); }
function avatarUrl(user) { return user.avatar && /^https:\/\//.test(user.avatar) ? '/avatar?u=' + encodeURIComponent(user.avatar) : null; }
function fillAvatar(box, user) {
  if (!box) return;
  const fallback = () => { box.textContent = initials(user.nickname); };
  const url = avatarUrl(user);
  if (!url) return fallback();
  const img = new Image();
  img.onerror = fallback;
  img.src = url;
  box.replaceChildren(img);
}

// ---------- Fish & gear tables ----------
const FISH = [
  { name: '長靴', e: '👢', r: 0, min: 25, max: 30, img: 'nagagutsu' }, { name: '空き缶', e: '🥫', r: 0, min: 10, max: 12, img: 'akikan' },
  { name: 'アジ', e: '🐟', r: 1, min: 15, max: 35, img: 'aji' }, { name: 'イワシ', e: '🐟', r: 1, min: 10, max: 25, img: 'iwashi' },
  { name: 'ハゼ', e: '🐟', r: 1, min: 8, max: 20, img: 'haze' }, { name: 'フナ', e: '🐟', r: 1, min: 15, max: 30, img: 'funa' },
  { name: 'サバ', e: '🐟', r: 1, min: 25, max: 45, img: 'saba' },
  { name: '真鯛', e: '🐠', r: 2, min: 30, max: 70, img: 'madai' }, { name: 'ヒラメ', e: '🐟', r: 2, min: 35, max: 80, img: 'hirame' },
  { name: 'イカ', e: '🦑', r: 2, min: 20, max: 45, img: 'ika' }, { name: 'タコ', e: '🐙', r: 2, min: 30, max: 90, img: 'tako' },
  { name: 'スズキ', e: '🐟', r: 2, min: 40, max: 90, img: 'suzuki' },
  { name: 'フグ', e: '🐡', r: 3, min: 20, max: 50, img: 'fugu' }, { name: 'カツオ', e: '🐟', r: 3, min: 50, max: 100, img: 'katsuo' },
  { name: '伊勢エビ', e: '🦞', r: 3, min: 20, max: 40, img: 'iseebi' }, { name: 'ブリ', e: '🐟', r: 3, min: 60, max: 110, img: 'buri' },
  { name: '本マグロ', e: '🐟', r: 4, min: 120, max: 300, img: 'maguro' }, { name: 'カジキ', e: '🐟', r: 4, min: 150, max: 350, img: 'kajiki' },
  { name: '金目鯛', e: '🐠', r: 4, min: 30, max: 60, img: 'kinmedai' },
  { name: '黄金の鯛', e: '🐠', r: 5, min: 60, max: 120, img: 'ougon_tai' }, { name: 'リュウグウノツカイ', e: '🐉', r: 5, min: 300, max: 600, img: 'ryuuguu' },
  { name: '七色の鯉', e: '🎏', r: 5, min: 80, max: 150, img: 'nanairo_koi' },
  // Batch 2 (sheet 2)
  { name: 'タイヤ', e: '🛞', r: 0, min: 55, max: 70, img: 'taiya' },
  { name: 'カサゴ', e: '🐟', r: 1, min: 15, max: 30, img: 'kasago' }, { name: 'メバル', e: '🐟', r: 1, min: 15, max: 30, img: 'mebaru' },
  { name: 'キス', e: '🐟', r: 1, min: 15, max: 28, img: 'kisu' }, { name: 'カワハギ', e: '🐟', r: 1, min: 15, max: 30, img: 'kawahagi' },
  { name: 'クロダイ', e: '🐟', r: 2, min: 30, max: 60, img: 'kurodai' }, { name: 'イシダイ', e: '🐟', r: 2, min: 30, max: 60, img: 'ishidai' },
  { name: 'アマダイ', e: '🐟', r: 2, min: 30, max: 50, img: 'amadai' },
  { name: 'タチウオ', e: '🐟', r: 3, min: 80, max: 150, img: 'tachiuo' }, { name: 'シマアジ', e: '🐟', r: 3, min: 40, max: 90, img: 'shimaaji' },
  { name: 'アンコウ', e: '🐟', r: 3, min: 40, max: 100, img: 'ankou' }, { name: 'ヒラマサ', e: '🐟', r: 3, min: 70, max: 130, img: 'hiramasa' },
  { name: 'クエ', e: '🐟', r: 4, min: 80, max: 150, img: 'kue' }, { name: 'マンボウ', e: '🐡', r: 4, min: 150, max: 330, img: 'manbou' },
  { name: 'シーラカンス', e: '🐟', r: 5, min: 120, max: 200, img: 'shiiraakansu' },
];
const R_NAME = ['ゴミ', 'ふつう', 'レア', 'スーパーレア', 'ウルトラレア', '伝説'];
const R_COLOR = ['#888888', '#c9d6e3', '#7fd3ff', '#c08bff', '#ffb347', '#ffe066'];
const R_POINTS = [0, 10, 30, 100, 400, 2000];
// Bait decides WHAT bites: odds per rarity [junk, ★1..★5] (%), shown on screen.
// Paid bait never yields junk, guarantees a minimum rarity, and is NOT used up when the fish escapes.
const BAITS = [
  { id: 0, name: '普通のエサ', icon: '🦐', min: 0, casts: Infinity, waitMul: 1, odds: [8, 62, 22, 6.5, 1.3, 0.2] },
  { id: 1, name: '特製エサ', icon: '🪱', min: 1, casts: 5, waitMul: 0.8, odds: [0, 55, 32, 10, 2.5, 0.5] },
  { id: 2, name: '高級エサ', icon: '🦑', min: 10, casts: 5, waitMul: 0.85, odds: [0, 0, 70, 24, 5, 1] },
  { id: 3, name: '金のエサ', icon: '✨', min: 100, casts: 5, waitMul: 0.85, odds: [0, 0, 0, 78, 19, 3] },
  { id: 4, name: '伝説のエサ', icon: '👑', min: 500, casts: 3, waitMul: 0.85, odds: [0, 0, 0, 0, 85, 15] },
];
// Rod decides whether you KEEP the fish: multiplies the escape chance. Used up per cast.
const RODS = [
  { id: 0, name: '竹竿', icon: '🎋', min: 0, casts: Infinity, escMul: 1 },
  { id: 1, name: 'カーボン竿', icon: '🎣', min: 10, casts: 10, escMul: 0.6 },
  { id: 2, name: '金の竿', icon: '🥇', min: 100, casts: 15, escMul: 0.35 },
  { id: 3, name: '伝説の竿', icon: '🔱', min: 500, casts: 10, escMul: 0.15 },
];
// Base escape chance by rarity (bigger fish fight harder)
const ESCAPE_BY_R = [0, 0.15, 0.25, 0.35, 0.45, 0.55];
const BAIT_RING = ['#ffffff', '#9be38b', '#5ac8ff', '#ffd23f', '#ff6ad5'];
// Waiting time (s) by rarity of the fish that will bite, and fight duration (s)
const WAIT_BY_R = [[15, 35], [20, 40], [30, 55], [45, 75], [60, 100], [80, 130]];
const FIGHT_BY_R = [0.6, 1, 1.6, 2.4, 3.6, 5];
// Depth band (stage y) per rarity: rare fish live deeper
const DEPTH_BY_R = [[600, 760], [600, 820], [800, 1000], [1000, 1180], [1180, 1340], [1300, 1420]];
const SURFACE_Y = 505;

const baitFor = d => [...BAITS].reverse().find(b => b.id > 0 && d >= b.min) || null;
const rodFor = d => [...RODS].reverse().find(r => r.id > 0 && d >= r.min) || null;
function rollByOdds(odds) {
  let t = Math.random() * 100, r = 1;
  for (let i = 0; i < 6; i++) { t -= odds[i]; r = i; if (t <= 0) break; }
  while (odds[r] === 0) r++;
  const f = pick(FISH.filter(x => x.r === r));
  return { ...f, size: Math.round(rand(f.min, f.max)) };
}
const rollFish = bait => rollByOdds(bait.odds);
{
  const rows = BAITS.map(b => `<tr><td>${b.icon} ${b.name}</td>${b.odds.map(o => `<td>${o ? o + '%' : '—'}</td>`).join('')}</tr>`).join('');
  const esc2 = ESCAPE_BY_R.slice(1).map((v, i) => `★${i + 1} ${Math.round(v * 100)}%`).join(' / ');
  $('#lgOdds').innerHTML = `<div class="odds-title">📊 エサ別の排出確率（ギフトのエサは表示の★以上が必ず釣れます）</div><table class="odds"><tr><th>エサ</th><th>ゴミ</th><th>★1</th><th>★2</th><th>★3</th><th>★4</th><th>★5</th></tr>${rows}</table>`
    + `<div class="odds-note">🎣 バラシ率（基本）${esc2} → カーボン竿×0.6 ・ 金の竿×0.35 ・ 伝説の竿×0.15</div>`;
  setInterval(() => $('.legend').classList.toggle('odds'), 10000);
}

// Preload fish images
const fishImg = {};
for (const f of FISH) { const im = new Image(); im.src = `/fish/${f.img}.png`; fishImg[f.name] = im; }
const imgReady = im => im && im.complete && im.naturalWidth > 0;

// Bait sprites shown on the hook (pre-rendered once). Paid baits glow.
const BAIT_GLOW = [null, '#9be38b', '#5ac8ff', '#ffd23f', '#ff6ad5'];
const baitSprites = BAITS.map(b => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (b.id === 4) {
    // Legendary bait: rainbow orb
    const gr = g.createRadialGradient(26, 26, 2, 32, 32, 18);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#ffd1f5'); gr.addColorStop(0.7, '#a58bff'); gr.addColorStop(1, '#4fd6ff');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.stroke();
  } else {
    g.font = '34px serif';
    g.fillText(b.id === 1 ? '🪱' : b.id === 2 ? '🦑' : '🦐', 32, 34);
    if (b.id === 3) { // golden shrimp: tint the emoji gold
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,200,40,.6)'; g.fillRect(0, 0, 64, 64);
    }
  }
  return c;
});

// ---------- Boat & seats ----------
const BOAT = { x: 40, w: 1000, h: 333, top: SURFACE_Y - 0.84 * 333 };
const boatEl = $('#boat');
let bobY = 0, bobR = 0;
const SEATS = [];
for (let i = 0; i < 8; i++) SEATS.push({ x: 330 + i * 86, base: 240, row: 'front' });
for (let i = 0; i < 8; i++) SEATS.push({ x: 373 + i * 86, base: 168, row: 'back' });
SEATS.forEach((s, i) => { s.i = i; s.player = null; });
// Fill seats spread along the deck
const byX = [...SEATS].sort((a, b) => a.x - b.x);
const SEAT_ORDER = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15].map(k => byX[k]);
function freeSeat() { return SEAT_ORDER.find(s => !s.player) || null; }
// Stage coordinates of a seat point (local boat coords + boat position + bob)
function seatStage(s, dx = 0, dy = 0) { return { x: BOAT.x + s.x + dx, y: BOAT.top + bobY + s.base + dy }; }
function rodTip(s) { return seatStage(s, 72, -46); }

// ---------- Players & stats ----------
const players = new Map();
const stats = new Map();
const DAY = new Date().toISOString().slice(0, 10);
try { const saved = JSON.parse(localStorage.getItem('sea-' + DAY) || '[]'); for (const s of saved) stats.set(s.user.id, { ...s, dex: new Set(s.dex) }); } catch { /* storage unavailable */ }
function saveStats() { try { localStorage.setItem('sea-' + DAY, JSON.stringify([...stats.values()].map(s => ({ ...s, dex: [...s.dex] })))); } catch { /* ignore */ } }
let record = null;
for (const s of stats.values()) if (s.best && (!record || s.best.size > record.fish.size)) record = { user: s.user, fish: s.best };

// passive = seated just for entering the room (no comment/like/gift yet).
// When the boat is full, active viewers replace the earliest passive one; passive viewers only take free seats.
function seat(user, passive = false) {
  let p = players.get(user.id);
  if (p) { if (!passive) { p.lastActive = Date.now(); p.passive = false; } return p; }
  let s = freeSeat();
  if (!s) {
    if (passive) return null;
    const all = [...players.values()];
    const victim = all.filter(q => q.passive).sort((a, b) => a.lastActive - b.lastActive)[0]
      || all.filter(q => Date.now() - q.lastActive > IDLE_MS && q.bait.id === 0 && q.rod.id === 0).sort((a, b) => a.lastActive - b.lastActive)[0];
    if (!victim) return null;
    unseat(victim);
    s = freeSeat();
  }
  const el = document.createElement('div');
  el.className = 'seat ' + s.row;
  el.style.left = s.x + 'px'; el.style.top = s.base + 'px';
  el.innerHTML = '<div class="rod"></div><div class="av"></div><div class="tag"></div>';
  fillAvatar(el.querySelector('.av'), user);
  $('#seats').appendChild(el);
  const tip = rodTip(s);
  p = { user, seat: s, el, bait: BAITS[0], baitLeft: Infinity, rod: RODS[0], rodLeft: Infinity, state: 'idle', lastActive: Date.now(), token: 0, seenBoosts: new Set(), skip: false, frenzy: false,
    hook: { x: tip.x + rand(-10, 30), y: tip.y, targetY: tip.y }, nibbleAt: 0, passive };
  s.player = p;
  players.set(user.id, p);
  if (!stats.has(user.id)) stats.set(user.id, { user, pts: 0, best: null, dex: new Set() });
  stats.get(user.id).user = user;
  updateTag(p);
  fishLoop(p);
  return p;
}
function unseat(p) { p.token++; p.seat.player = null; players.delete(p.user.id); p.el.remove(); }
function updateTag(p) {
  const st = stats.get(p.user.id);
  const name = p.user.nickname.length > 6 ? p.user.nickname.slice(0, 6) + '…' : p.user.nickname;
  p.el.style.setProperty('--ring', BAIT_RING[p.bait.id]);
  const b = p.bait.icon + (p.bait.id ? p.baitLeft : '');
  const r = p.rod.icon + (p.rod.id ? p.rodLeft : '');
  p.el.querySelector('.tag').innerHTML = `${esc(name)}<small>${b} ${r} 📖${st ? st.dex.size : 0}</small>`;
}
// Better item replaces the current one; same or weaker item adds uses to the current one
function addItem(p, kind, item) {
  if (!item) return;
  const cur = p[kind], left = kind + 'Left';
  if (item.id > cur.id) { p[kind] = item; p[left] = item.casts; } else p[left] += item.casts;
}

// ---------- Underwater life ----------
const swimmers = []; // ambient fish
function spawnSwimmer(r, opts = {}) {
  const f = pick(FISH.filter(x => x.r === r));
  const [y0, y1] = DEPTH_BY_R[r];
  const dir = Math.random() < 0.5 ? -1 : 1;
  const w = opts.w || (r >= 4 ? rand(170, 220) : r >= 2 ? rand(110, 150) : rand(80, 110));
  const s = { f, r, w, x: opts.x ?? (dir > 0 ? -w : W + w), y: opts.y ?? rand(y0, y1), vx: dir * rand(35, 80) * (r >= 4 ? 0.6 : 1), ph: rand(0, 6), temp: !!opts.temp, alpha: opts.alpha ?? 0.9 };
  swimmers.push(s);
  return s;
}
const AMBIENT = [[1, 6], [2, 4], [3, 2], [4, 1], [5, 1]];
for (const [r, n] of AMBIENT) for (let i = 0; i < n; i++) spawnSwimmer(r, { x: rand(0, W) });
const bubbles = [];
const sparkles = [];
function bubble(x, y, n = 1, spread = 10) { for (let i = 0; i < n; i++) bubbles.push({ x: x + rand(-spread, spread), y, r: rand(2, 6), vy: rand(40, 90), life: rand(2, 5) }); }

// Active catch animations: fish approaching / fighting / reeled / jumping
const actors = [];

// ---------- Fishing loop ----------
let goldenUntil = 0;
const boosts = [];
let boostSeq = 0;
function startBoost(factor, ms) { boosts.push({ id: ++boostSeq, factor, until: performance.now() + ms }); }
function applyBoosts(p, now, remaining) {
  for (const b of boosts) if (now < b.until && !p.seenBoosts.has(b.id)) { p.seenBoosts.add(b.id); remaining *= b.factor; }
  return remaining;
}
async function fishLoop(p) {
  const token = ++p.token;
  const alive = () => p.token === token && players.has(p.user.id);
  let first = true;
  while (alive()) {
    let bait = p.bait;
    let fish = rollFish(bait);
    const [lo, hi] = WAIT_BY_R[fish.r];
    let wait = rand(lo, hi) * 1000 * bait.waitMul / SPEED;
    if (first) { wait *= 0.5; first = false; }
    // Cast: the hook sinks to the depth band of the fish that will bite
    const tip = rodTip(p.seat);
    p.hook.x = tip.x + rand(-10, 30);
    p.hook.y = SURFACE_Y;
    p.hook.targetY = rand(...DEPTH_BY_R[fish.r]);
    p.state = 'wait';
    p.skip = false;
    let end = performance.now() + applyBoosts(p, performance.now(), Math.max(0, wait - 2200));
    let nextNibble = performance.now() + rand(2500, 7000);
    while (performance.now() < end && !p.skip && !p.frenzy) {
      await sleep(200);
      if (!alive()) return;
      const now = performance.now();
      end = now + applyBoosts(p, now, Math.max(0, end - now));
      if (now >= nextNibble && now < end - 800) {
        nextNibble = now + rand(2500, 7000);
        if (Math.random() < 0.6) { p.nibbleAt = now; if (Math.random() < 0.4) showAt(p.hook.x, p.hook.y - 20, 'nibble', 'ちょん…'); }
      }
    }
    if (!alive()) return;
    // Bait changed while waiting (gift) -> this cast uses the new bait
    if (p.bait !== bait) { bait = p.bait; fish = rollFish(bait); p.hook.targetY = rand(...DEPTH_BY_R[fish.r]); }
    // Giant school event: a big fish bites, unless the player's own bait guarantees better
    const frenzyId = p.frenzy;
    if (frenzyId) {
      p.frenzy = false;
      if (bait.odds.slice(0, 4).some(o => o > 0)) { fish = rollByOdds(FRENZY_ODDS); p.hook.targetY = rand(...DEPTH_BY_R[fish.r]); }
    }
    const rod = p.rod;
    // Approach: the fish swims in toward the hook
    p.state = 'approach';
    const fromLeft = Math.random() < 0.5;
    const actor = { p, fish, w: fish.r >= 4 ? 200 : fish.r >= 2 ? 140 : fish.r === 0 ? 80 : 100,
      x: p.hook.x + (fromLeft ? -420 : 420), y: p.hook.targetY + rand(-40, 40), phase: 'approach', t: 0, dir: fromLeft ? 1 : -1 };
    actor.sx = actor.x; actor.sy = actor.y;
    actors.push(actor);
    await sleep(2200);
    if (!alive()) { actors.splice(actors.indexOf(actor), 1); return; }
    // Bite
    p.state = 'bite';
    actor.phase = 'bite';
    showAt(p.hook.x, p.hook.y - 30, 'bang', '!');
    bubble(p.hook.x, p.hook.y, 8, 20);
    await sleep(700);
    if (!alive()) { actors.splice(actors.indexOf(actor), 1); return; }
    // Fight
    p.state = 'fight';
    actor.phase = 'fight';
    p.el.classList.add('fight');
    const head = seatStage(p.seat, 0, -90);
    if (fish.r >= 2) showAt(head.x, head.y, 'fight', fish.r >= 4 ? '大物だ！ファイト！' : 'ファイト！');
    await sleep(FIGHT_BY_R[fish.r] * 1000);
    p.el.classList.remove('fight');
    if (!alive()) { actors.splice(actors.indexOf(actor), 1); return; }
    // The rod is used up per cast
    if (rod.id > 0) { p.rodLeft--; if (p.rodLeft <= 0) { p.rod = RODS[0]; p.rodLeft = Infinity; } }
    // Escape check (bigger fish escape more; better rods hold better)
    if (Math.random() < ESCAPE_BY_R[fish.r] * rod.escMul) {
      p.state = 'escape';
      actor.phase = 'escape'; actor.t = 0; actor.sx = actor.x; actor.sy = actor.y;
      p.hook.targetY = SURFACE_Y;
      showAt(head.x, head.y, 'escape', `プツン…${fish.r ? fish.name : ''}に逃げられた😭`);
      if (fish.r >= 4) banner(p.user, `<div class="av"></div><div><div class="who">${esc(p.user.nickname)}さんが${esc(fish.name)}に逃げられた…！</div><div class="what">金の竿・伝説の竿ならバラシ率ダウン！</div></div><div class="ic">💔</div>`, 'g1', 3000);
      if (frenzyId) frenzyResult(frenzyId, false);
      updateTag(p); // paid bait is kept when the fish escapes
      await sleep(1200);
      actors.splice(actors.indexOf(actor), 1);
      if (!alive()) return;
      p.state = 'rest';
      await restWait(p, alive);
      continue;
    }
    // Reel up along the line, then jump onto the boat
    p.state = 'reel';
    actor.phase = 'reel'; actor.t = 0; actor.sx = actor.x; actor.sy = actor.y;
    await sleep(1000);
    actor.phase = 'jump'; actor.t = 0; actor.sx = actor.x; actor.sy = SURFACE_Y;
    bubble(actor.x, SURFACE_Y, 12, 30);
    await sleep(800);
    actors.splice(actors.indexOf(actor), 1);
    if (!alive()) return;
    landFish(p, fish, bait, rod);
    if (frenzyId) frenzyResult(frenzyId, true);
    p.state = 'rest';
    p.hook.targetY = SURFACE_Y;
    await restWait(p, alive);
  }
}
// Short pause between casts; a gift (skip) or giant school (frenzy) ends it early
async function restWait(p, alive) {
  const end = performance.now() + rand(3000, 5000) / SPEED;
  while (performance.now() < end && !p.skip && !p.frenzy && alive()) await sleep(200);
}

function landFish(p, fish, bait, rod) {
  const st = stats.get(p.user.id);
  const base = FISH.find(f => f.name === fish.name);
  const pts = Math.round(R_POINTS[fish.r] * (fish.size / ((base.min + base.max) / 2)));
  const isNew = fish.r > 0 && !st.dex.has(fish.name);
  if (fish.r > 0) st.dex.add(fish.name);
  st.pts += pts;
  if (fish.r > 0 && (!st.best || fish.size > st.best.size)) st.best = { name: fish.name, e: fish.e, size: fish.size, r: fish.r };
  if (fish.r > 0 && (!record || fish.size > record.fish.size)) { record = { user: p.user, fish: st.best }; updateRecord(); }
  saveStats();
  const head = seatStage(p.seat, 0, -96);
  showAt(head.x, head.y, 'catch r' + fish.r, fish.r === 0 ? `${fish.e}${fish.name}…` : `${fish.name} ${fish.size}cm ${'★'.repeat(fish.r)}${isNew ? ' 📖NEW' : ''}`);
  // Bait is used up only when the fish is actually landed
  if (bait.id > 0 && p.bait === bait) { p.baitLeft--; if (p.baitLeft <= 0) { p.bait = BAITS[0]; p.baitLeft = Infinity; } }
  updateTag(p);
  if (fish.r >= 3) addFeed(`${p.user.nickname}：${fish.name} ${fish.size}cm ${'★'.repeat(fish.r)}`);
  if (fish.r >= 4) fishCard(p.user, fish, bait, rod);
  if (fish.r === 5) { flashScreen(); confetti(140); } else if (fish.r === 4) confetti(60);
  rankDirty = true;
}

// ---------- Rendering ----------
const uctx = $('#under').getContext('2d');
const octx = $('#over').getContext('2d');
function drawFish(ctx, f, x, y, w, dir, r, wobble = 0, alpha = 1) {
  const im = fishImg[f.name];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(wobble);
  if (dir > 0) ctx.scale(-1, 1); // images face left
  if (r >= 3) { ctx.shadowColor = R_COLOR[r]; ctx.shadowBlur = r >= 5 ? 40 : 24; }
  if (imgReady(im)) { const h = w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, -w / 2, -h / 2, w, h); }
  else { ctx.font = `${w * 0.6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.e, 0, 0); }
  ctx.restore();
}

let last = performance.now();
let lastUi = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  // Boat bobbing
  bobY = Math.sin(t * 1.1) * 5;
  bobR = Math.sin(t * 0.8) * 0.6;
  boatEl.style.transform = `translateY(${BOAT.top + bobY}px) rotate(${bobR}deg)`;

  uctx.clearRect(0, 0, W, H);
  octx.clearRect(0, 0, W, H);

  // Ambient fish
  for (let i = swimmers.length - 1; i >= 0; i--) {
    const s = swimmers[i];
    s.x += s.vx * dt;
    const yy = s.y + Math.sin(t * 1.5 + s.ph) * 6;
    if (s.x < -s.w - 40 || s.x > W + s.w + 40) {
      if (s.temp) { swimmers.splice(i, 1); continue; }
      s.vx = -s.vx; // turn around off-screen
    }
    drawFish(uctx, s.f, s.x, yy, s.w, Math.sign(s.vx), s.r, Math.sin(t * 3 + s.ph) * 0.04, s.alpha);
  }

  // Lines & hooks
  uctx.strokeStyle = 'rgba(255,255,255,.75)';
  uctx.lineWidth = 2;
  for (const p of players.values()) {
    const tip = rodTip(p.seat);
    const h = p.hook;
    h.y += (h.targetY - h.y) * Math.min(1, dt * 1.6);
    let hx = h.x, hy = h.y;
    const nib = now - p.nibbleAt;
    if (nib < 450) hy += Math.sin(nib / 450 * Math.PI) * 14;
    if (p.state === 'bite') { hx += Math.sin(t * 40) * 6; hy += Math.abs(Math.sin(t * 25)) * 16; }
    if (p.state === 'fight') { hx += Math.sin(t * 9) * 26; hy += Math.sin(t * 13) * 18; }
    p.hookDraw = { x: hx, y: hy };
    uctx.beginPath();
    uctx.moveTo(tip.x, tip.y);
    uctx.quadraticCurveTo((tip.x + hx) / 2 + 10, Math.min(tip.y, SURFACE_Y) + 40, hx, hy);
    uctx.stroke();
    // Bobber at the surface + small hook
    uctx.fillStyle = '#ff3b3b';
    const bobberX = lerp(tip.x, hx, (SURFACE_Y - tip.y) / Math.max(1, hy - tip.y));
    if (hy > SURFACE_Y + 5) { uctx.beginPath(); uctx.arc(bobberX, SURFACE_Y - 2 + Math.sin(t * 2 + p.seat.i) * 2, 6, 0, Math.PI * 2); uctx.fill(); }
    uctx.fillStyle = '#ddd';
    uctx.beginPath(); uctx.arc(hx, hy, 3, 0, Math.PI * 2); uctx.fill();
    // Bait on the hook while waiting (eaten once the fish bites)
    if ((p.state === 'wait' || p.state === 'approach') && hy > SURFACE_Y + 20) {
      const b = p.bait, size = b.id ? 46 : 34;
      const sway = Math.sin(t * 2.2 + p.seat.i) * 0.25;
      uctx.save();
      uctx.translate(hx, hy + 14);
      uctx.rotate(sway);
      if (BAIT_GLOW[b.id]) { uctx.shadowColor = BAIT_GLOW[b.id]; uctx.shadowBlur = 18 + Math.sin(t * 4) * 6; }
      uctx.drawImage(baitSprites[b.id], -size / 2, -size / 2, size, size);
      uctx.restore();
      // Sparkles around paid bait
      if (b.id >= 2 && Math.random() < 0.08 * b.id) sparkles.push({ x: hx + rand(-22, 22), y: hy + 14 + rand(-22, 22), life: 0.6, color: BAIT_GLOW[b.id] });
    }
    // "Bait equipped" burst right after a gift
    if (now - (p.baitFxAt || 0) < 900) {
      const k = (now - p.baitFxAt) / 900;
      uctx.save();
      uctx.globalAlpha = 1 - k;
      uctx.strokeStyle = BAIT_GLOW[p.bait.id] || '#fff';
      uctx.lineWidth = 4;
      uctx.beginPath(); uctx.arc(hx, hy + 14, 10 + k * 60, 0, Math.PI * 2); uctx.stroke();
      uctx.restore();
    }
  }

  // Catch actors
  for (const a of actors) {
    const hk = a.p.hookDraw || a.p.hook;
    a.t += dt;
    if (a.phase === 'approach') {
      const k = ease(Math.min(1, a.t / 2.2));
      a.x = lerp(a.sx, hk.x - a.dir * a.w * 0.35, k); a.y = lerp(a.sy, hk.y, k);
      drawFish(uctx, a.fish, a.x, a.y, a.w, a.dir, a.fish.r, Math.sin(t * 6) * 0.05);
    } else if (a.phase === 'bite' || a.phase === 'fight') {
      a.x = hk.x - a.dir * a.w * 0.35; a.y = hk.y;
      drawFish(uctx, a.fish, a.x, a.y, a.w, a.dir, a.fish.r, Math.sin(t * (a.phase === 'fight' ? 18 : 10)) * 0.25);
      if (Math.random() < 0.3) bubble(a.x, a.y, 1, 20);
    } else if (a.phase === 'reel') {
      const k = ease(Math.min(1, a.t / 1.0));
      a.x = lerp(a.sx, hk.x, k); a.y = lerp(a.sy, SURFACE_Y + 10, k);
      a.p.hook.y = a.y; a.p.hook.targetY = a.y;
      drawFish(uctx, a.fish, a.x, a.y, a.w, a.dir, a.fish.r, -0.9 * a.dir);
    } else if (a.phase === 'escape') {
      // Line snapped: the fish darts away and fades
      a.x += a.dir * 700 * dt; a.y += Math.sin(t * 8) * 2;
      drawFish(uctx, a.fish, a.x, a.y, a.w, a.dir, a.fish.r, Math.sin(t * 20) * 0.15, Math.max(0, 1 - a.t / 1.1));
      if (Math.random() < 0.5) bubble(a.x - a.dir * a.w / 2, a.y, 1, 8);
    } else if (a.phase === 'jump') {
      const k = Math.min(1, a.t / 0.8);
      const dst = seatStage(a.p.seat, 0, -60);
      const x = lerp(a.sx, dst.x, k), y = lerp(a.sy, dst.y, k) - Math.sin(Math.PI * k) * 160;
      drawFish(octx, a.fish, x, y, a.w * (1 + k * 0.2), a.dir, a.fish.r, -k * Math.PI * 2 * a.dir, k > 0.85 ? (1 - k) / 0.15 : 1);
    }
  }

  // Sparkles (paid bait)
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.life -= dt; s.y -= 12 * dt;
    if (s.life <= 0) { sparkles.splice(i, 1); continue; }
    const r = 5 * (s.life / 0.6);
    uctx.save();
    uctx.globalAlpha = Math.min(1, s.life * 2);
    uctx.fillStyle = s.color;
    uctx.shadowColor = s.color; uctx.shadowBlur = 8;
    uctx.beginPath();
    uctx.moveTo(s.x, s.y - r); uctx.lineTo(s.x + r * 0.3, s.y - r * 0.3); uctx.lineTo(s.x + r, s.y); uctx.lineTo(s.x + r * 0.3, s.y + r * 0.3);
    uctx.lineTo(s.x, s.y + r); uctx.lineTo(s.x - r * 0.3, s.y + r * 0.3); uctx.lineTo(s.x - r, s.y); uctx.lineTo(s.x - r * 0.3, s.y - r * 0.3);
    uctx.closePath(); uctx.fill();
    uctx.restore();
  }

  // Bubbles
  uctx.strokeStyle = 'rgba(220,250,255,.7)';
  uctx.lineWidth = 1.5;
  if (Math.random() < 0.15) bubble(rand(0, W), 1500, 1, 0);
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.vy * dt; b.x += Math.sin(t * 3 + i) * 0.4; b.life -= dt;
    if (b.y < SURFACE_Y || b.life <= 0) { bubbles.splice(i, 1); continue; }
    uctx.beginPath(); uctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); uctx.stroke();
  }

  if (now - lastUi > 250) { lastUi = now; updateGolden(now); if (rankDirty) { rankDirty = false; updateRank(); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- DOM overlays ----------
function showAt(x, y, cls, text) {
  const e = document.createElement('div');
  e.className = cls; e.textContent = text;
  e.style.left = x + 'px'; e.style.top = y + 'px';
  e.addEventListener('animationend', () => e.remove());
  $('#labels').appendChild(e);
}
function flashScreen() { const fl = $('#flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
function confetti(n) {
  const colors = ['#ffd23f', '#ff8ac2', '#8ad8ff', '#9be38b', '#ffffff', '#c08bff'];
  for (let i = 0; i < n; i++) setTimeout(() => {
    const e = document.createElement('div');
    e.className = 'confetti';
    e.style.cssText = `left:${rand(0, W)}px;background:${pick(colors)};--t:${rand(3.5, 6)}s;--dx:${rand(-200, 200)}px;--r:${rand(-900, 900)}deg`;
    e.addEventListener('animationend', () => e.remove());
    stage.appendChild(e);
  }, rand(0, 1800));
}
function addFeed(text) {
  const ul = $('#feed');
  const li = document.createElement('li');
  li.textContent = text;
  ul.prepend(li);
  while (ul.children.length > 3) ul.lastChild.remove();
}
function updateRecord() { $('#record').innerHTML = record ? `<b>${esc(record.fish.name)} ${record.fish.size}cm</b><br>${esc(record.user.nickname)}` : '—'; }
updateRecord();
let rankDirty = true;
function updateRank() {
  const top = [...stats.values()].filter(s => s.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 5);
  $('#rank').innerHTML = top.map(s => `<li>${esc(s.user.nickname)}<span>${s.pts}pt</span></li>`).join('');
}

// Big card for ★4 / ★5 (queued)
const cardQueue = [];
let cardShowing = false;
function fishCard(user, fish, bait, rod) { cardQueue.push({ user, fish, gear: { icon: bait.icon + rod.icon, name: `${bait.name}＋${rod.name}` } }); if (cardQueue.length > 4) cardQueue.splice(0, cardQueue.length - 4); if (!cardShowing) nextCard(); }
function nextCard() {
  const c = cardQueue.shift();
  if (!c) { cardShowing = false; return; }
  cardShowing = true;
  const el = document.createElement('div');
  el.className = 'fc r' + c.fish.r;
  el.style.setProperty('--rc', R_COLOR[c.fish.r]);
  el.innerHTML = `<div class="stars">${'★'.repeat(c.fish.r)}</div><div class="rname">${R_NAME[c.fish.r]}</div><img class="fish-img" src="/fish/${FISH.find(f => f.name === c.fish.name).img}.png" alt="">`
    + `<div class="fname">${esc(c.fish.name)}</div><div class="size">${c.fish.size}cm</div>`
    + `<div class="who"><div class="av"></div>${esc(c.user.nickname)}</div><div class="gear">${c.gear.icon} ${c.gear.name}で釣り上げた！</div>`;
  fillAvatar(el.querySelector('.av'), c.user);
  $('#card').replaceChildren(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(nextCard, 350); }, c.fish.r >= 5 ? 5000 : 3800);
}

const bnQueue = [];
let bnShowing = false;
function banner(user, html, cls, ms, urgent) {
  const item = { user, html, cls, ms };
  urgent ? bnQueue.unshift(item) : bnQueue.push(item);
  if (!bnShowing) nextBanner();
}
function nextBanner() {
  const item = bnQueue.shift();
  if (!item) { bnShowing = false; return; }
  bnShowing = true;
  const c = document.createElement('div');
  c.className = 'bn ' + (item.cls || '');
  c.innerHTML = item.html;
  if (item.user) fillAvatar(c.querySelector('.av'), item.user);
  $('#banner').replaceChildren(c);
  const ms = bnQueue.length > 3 ? 1300 : item.ms;
  setTimeout(() => { c.classList.add('out'); setTimeout(nextBanner, 300); }, ms);
}

// ---------- Golden time gauge (likes + gifts) ----------
const GIFT_GAUGE = 10;
let gauge = 0;
const gaugeContrib = new Map();
function addGauge(user, pts) {
  if (performance.now() < goldenUntil) return;
  gauge += pts;
  if (user) { const c = gaugeContrib.get(user.id) || { user, pts: 0 }; c.pts += pts; c.user = user; gaugeContrib.set(user.id, c); }
  if (gauge >= GOLDEN_GOAL) {
    const mvp = [...gaugeContrib.values()].sort((a, b) => b.pts - a.pts)[0];
    gauge = 0; gaugeContrib.clear();
    goldenUntil = performance.now() + GOLDEN_SEC * 1000;
    startBoost(0.5, GOLDEN_SEC * 1000);
    banner(mvp ? mvp.user : null,
      `${mvp ? '<div class="av"></div>' : '<div class="ic">🌟</div>'}<div><div class="who">黄金タイム突入！</div><div class="what">${mvp ? esc(mvp.user.nickname) + 'さんのおかげで ' : ''}${GOLDEN_SEC}秒間 釣れる速さ2倍！</div></div><div class="ic">🌟</div>`,
      'gold', 3800, true);
    flashScreen();
  }
}

// ---------- Chum (撒き餌) ----------
const CHUM_MIN = 100, CHUM_SEC = 20;
let chumUntil = 0, chumBy = null;
function chumEvent(user) {
  chumUntil = Math.max(chumUntil, performance.now()) + CHUM_SEC * 1000;
  chumBy = user;
  startBoost(0.4, CHUM_SEC * 1000);
  // A school of fish rushes in from both sides
  for (let i = 0; i < 16; i++) {
    const r = Math.random() < 0.7 ? 1 : 2;
    const s = spawnSwimmer(r, { temp: true, y: rand(620, 1000), w: rand(70, 110) });
    s.vx *= 1.6;
  }
  banner(user, `<div class="av"></div><div><div class="who">${esc(user.nickname)}さんが撒き餌！</div><div class="what">${CHUM_SEC}秒間 海全体で爆釣チャンス！</div></div><div class="ic">🐟</div>`, 'g3', 3500, true);
}
// ---------- Giant school (巨大魚の群れ): huge gifts make big fish bite every hook ----------
const FRENZY_MIN = 1000;                    // diamonds needed
const FRENZY_ODDS = [0, 0, 0, 60, 32, 8];   // free event odds for everyone (★3+), shown in the banner
let frenzySeq = 0;
const frenzies = new Map(); // id -> { total, caught, escaped, by }
function frenzyEvent(user) {
  const id = ++frenzySeq;
  const targets = [...players.values()];
  frenzies.set(id, { total: targets.length, caught: 0, escaped: 0, by: user });
  for (const p of targets) { p.frenzy = id; p.skip = true; }
  // Fallback: show the summary even if someone leaves the boat mid-event
  setTimeout(() => frenzySummary(id), 30000);
  stage.classList.add('quake');
  setTimeout(() => stage.classList.remove('quake'), 1800);
  flashScreen();
  // The school sweeps across the deep water
  for (let i = 0; i < 12; i++) {
    const r = pick([3, 3, 4, 4, 5]);
    const s = spawnSwimmer(r, { temp: true, y: rand(700, 1350), w: rand(170, 240), x: -260 - i * 90 });
    s.vx = rand(160, 230);
  }
  banner(user, `<div class="av"></div><div><div class="who">${esc(user.nickname)}さんが巨大魚の群れを呼んだ！</div><div class="what">全員の竿に大物がヒット！ 釣り上げられるか!?（★3 60%・★4 32%・★5 8%）</div></div><div class="ic">🐋</div>`, 'g4', 4500, true);
}
function frenzyResult(id, caught) {
  const f = frenzies.get(id);
  if (!f) return;
  caught ? f.caught++ : f.escaped++;
  if (f.caught + f.escaped >= f.total) frenzySummary(id);
}
function frenzySummary(id) {
  const f = frenzies.get(id);
  if (!f) return;
  {
    frenzies.delete(id);
    f.total = f.caught + f.escaped;
    banner(f.by, `<div class="av"></div><div><div class="who">大漁！ ${f.total}人中 ${f.caught}人が釣り上げた！</div><div class="what">${f.escaped}人は逃げられた… 群れを呼んだのは ${esc(f.by.nickname)}さん</div></div><div class="ic">🎉</div>`, 'gold', 4000, true);
    if (f.caught) confetti(80);
  }
}

function updateGolden(now) {
  const golden = now < goldenUntil, chum = now < chumUntil;
  $('.golden').classList.toggle('on', golden || chum);
  if (golden) {
    $('#gtext').innerHTML = `🌟 黄金タイム中！ 釣れる速さ2倍 <b>${Math.ceil((goldenUntil - now) / 1000)}</b>秒`;
    $('#gbar').style.width = ((goldenUntil - now) / (GOLDEN_SEC * 1000) * 100) + '%';
  } else if (chum) {
    $('#gtext').innerHTML = `🐟 ${esc(chumBy.nickname)}さんの撒き餌で爆釣中！ <b>${Math.ceil((chumUntil - now) / 1000)}</b>秒`;
    $('#gbar').style.width = Math.min(100, (chumUntil - now) / (CHUM_SEC * 1000) * 100) + '%';
  } else {
    $('#gtext').innerHTML = `❤️いいね・🎁ギフトで <b>黄金タイム</b> ${Math.floor(gauge / GOLDEN_GOAL * 100)}%`;
    $('#gbar').style.width = (gauge / GOLDEN_GOAL * 100) + '%';
  }
  $('#tint').className = 'tint' + (golden ? ' golden' : chum ? ' chum' : '');
  if (chum) bubble(rand(0, W), rand(700, 1100), 3, 20);
  for (let i = boosts.length - 1; i >= 0; i--) if (now > boosts[i].until) boosts.splice(i, 1);
}

// ---------- Event handlers ----------
function onGift(e) {
  const total = (e.diamonds || 1) * (e.count || 1);
  const bait = baitFor(total), rod = rodFor(total);
  const p = seat(e.user);
  if (!p) { banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)} ありがとう！（満員）</div></div>`, '', 2000); return; }
  p.lastActive = Date.now();
  addItem(p, 'bait', bait);
  addItem(p, 'rod', rod);
  // Visual feedback on the hook: burst ring + label
  p.baitFxAt = performance.now();
  const hk = p.hookDraw || p.hook;
  if (hk.y > SURFACE_Y + 20) showAt(hk.x, hk.y - 10, 'nibble', `${p.bait.icon}${p.bait.name}装着！`);
  updateTag(p);
  addGauge(e.user, total * GIFT_GAUGE);
  // Pond-wide events use the combo total, firing once when the combo crosses the threshold
  const coins = e.diamonds || 1;
  const cumNow = coins * (e.comboTotal ?? e.count ?? 1), cumBefore = coins * (e.comboPrev ?? 0);
  const crossed = min => cumNow >= min && cumBefore < min;
  if (crossed(FRENZY_MIN)) { frenzyEvent(e.user); return; }
  const instant = p.state === 'wait';
  if (instant) { p.skip = true; const head = seatStage(p.seat, 0, -96); showAt(head.x, head.y, 'fight', '即ヒット！'); }
  const items = [`${bait.icon}${bait.name}+${bait.casts}`, rod ? `${rod.icon}${rod.name}+${rod.casts}` : ''].filter(Boolean).join(' ');
  banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)}×${e.count} → ${items}${instant ? '・即ヒット！' : ''}</div></div><div class="ic">${bait.icon}</div>`,
    'g' + Math.min(4, bait.id), bait.id >= 3 ? 3200 : 2000, bait.id >= 3);
  if (crossed(CHUM_MIN)) chumEvent(e.user);
}

const handlers = {
  chat: e => { const p = seat(e.user); if (p) p.lastActive = Date.now(); },
  gift: onGift,
  like: e => { const p = players.get(e.user.id); if (p) { p.lastActive = Date.now(); p.passive = false; } addGauge(e.user, e.count || 1); },
  // Entering the room is enough to board while there are free seats
  join: e => seat(e.user, true),
  share: () => {},
  follow: e => banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">フォローありがとう！</div></div>`, '', 2000),
  config: () => {},
};

// ---------- WebSocket ----------
const status = $('#status');
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => status.classList.remove('show');
  ws.onmessage = msg => {
    let e; try { e = JSON.parse(msg.data); } catch { return; }
    if (e.user && !e.user.id) return;
    handlers[e.type]?.(e);
  };
  ws.onclose = () => { status.textContent = 'サーバーに再接続中…'; status.classList.add('show'); setTimeout(connect, 2000); };
}
connect();

window.sea = { emit: e => handlers[e.type]?.(e), golden: () => addGauge(null, GOLDEN_GOAL) };
