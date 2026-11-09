import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const stage = $('#stage');
const SEATS = 24;
const GOLDEN_LIKES = Math.max(10, Number(params.get('golden')) || 500);
const GOLDEN_SEC = 30;
const IDLE_MS = 10 * 60 * 1000; // inactive seat can be taken when full

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
// r: 0 junk, 1..5 stars
const FISH = [
  { name: '長靴', e: '👢', r: 0, min: 25, max: 30 }, { name: '空き缶', e: '🥫', r: 0, min: 10, max: 12 },
  { name: 'アジ', e: '🐟', r: 1, min: 15, max: 35 }, { name: 'イワシ', e: '🐟', r: 1, min: 10, max: 25 }, { name: 'ハゼ', e: '🐟', r: 1, min: 8, max: 20 },
  { name: 'フナ', e: '🐟', r: 1, min: 15, max: 30 }, { name: 'サバ', e: '🐟', r: 1, min: 25, max: 45 },
  { name: '真鯛', e: '🐠', r: 2, min: 30, max: 70 }, { name: 'ヒラメ', e: '🐟', r: 2, min: 35, max: 80 }, { name: 'イカ', e: '🦑', r: 2, min: 20, max: 45 },
  { name: 'タコ', e: '🐙', r: 2, min: 30, max: 90 }, { name: 'スズキ', e: '🐟', r: 2, min: 40, max: 90 },
  { name: 'フグ', e: '🐡', r: 3, min: 20, max: 50 }, { name: 'カツオ', e: '🐟', r: 3, min: 50, max: 100 }, { name: '伊勢エビ', e: '🦞', r: 3, min: 20, max: 40 }, { name: 'ブリ', e: '🐟', r: 3, min: 60, max: 110 },
  { name: '本マグロ', e: '🐟', r: 4, min: 120, max: 300 }, { name: 'カジキ', e: '🐟', r: 4, min: 150, max: 350 }, { name: '金目鯛', e: '🐠', r: 4, min: 30, max: 60 },
  { name: '黄金の鯛', e: '🐠', r: 5, min: 60, max: 120 }, { name: 'リュウグウノツカイ', e: '🐉', r: 5, min: 300, max: 600 }, { name: '七色の鯉', e: '🎏', r: 5, min: 80, max: 150 },
];
// Image file per fish in public/fish/ (sliced from the AI sprite sheet); emoji is the fallback
const FISH_IMG = {
  '長靴': 'nagagutsu', '空き缶': 'akikan', 'アジ': 'aji', 'イワシ': 'iwashi', 'ハゼ': 'haze', 'フナ': 'funa', 'サバ': 'saba',
  '真鯛': 'madai', 'ヒラメ': 'hirame', 'イカ': 'ika', 'タコ': 'tako', 'スズキ': 'suzuki', 'フグ': 'fugu', 'カツオ': 'katsuo',
  '伊勢エビ': 'iseebi', 'ブリ': 'buri', '本マグロ': 'maguro', 'カジキ': 'kajiki', '金目鯛': 'kinmedai',
  '黄金の鯛': 'ougon_tai', 'リュウグウノツカイ': 'ryuuguu', '七色の鯉': 'nanairo_koi',
};
const fishImgUrl = name => FISH_IMG[name] ? `/fish/${FISH_IMG[name]}.png` : null;
const R_NAME = ['ゴミ', 'ふつう', 'レア', 'スーパーレア', 'ウルトラレア', '伝説'];
const R_COLOR = ['#888888', '#c9d6e3', '#7fd3ff', '#c08bff', '#ffb347', '#ffe066'];
const R_POINTS = [0, 10, 30, 100, 400, 2000];
// Each gear: odds per rarity [junk, ★1..★5] in %, displayed on screen. Paid gear never yields junk and guarantees a minimum rarity.
const GEARS = [
  { id: 0, name: '竹竿', icon: '🎋', min: 0, casts: Infinity, waitMul: 1, odds: [8, 62, 22, 6.5, 1.3, 0.2] },
  { id: 1, name: '特製エサ', icon: '🪱', min: 1, casts: 5, waitMul: 0.75, odds: [0, 55, 32, 10, 2.5, 0.5] },
  { id: 2, name: 'カーボン竿', icon: '🎣', min: 10, casts: 10, waitMul: 0.85, odds: [0, 0, 70, 24, 5, 1] },
  { id: 3, name: '金の竿', icon: '✨', min: 100, casts: 10, waitMul: 0.85, odds: [0, 0, 0, 78, 19, 3] },
  { id: 4, name: '伝説の竿', icon: '👑', min: 500, casts: 5, waitMul: 0.85, odds: [0, 0, 0, 0, 85, 15] },
];
function gearForDiamonds(d) { return [...GEARS].reverse().find(g => g.id > 0 && d >= g.min) || null; }
function rollFish(gear) {
  let t = Math.random() * 100, r = 1;
  for (let i = 0; i < 6; i++) { t -= gear.odds[i]; if (t <= 0) { r = i; break; } r = i; }
  while (gear.odds[r] === 0) r++; // safety: never land on a 0% tier
  const f = pick(FISH.filter(x => x.r === r));
  return { ...f, size: Math.round(rand(f.min, f.max)) };
}
{
  // Odds table (shown alternately with the how-to panel)
  const rows = GEARS.map(g => `<tr><td>${g.icon} ${g.name}</td>${g.odds.map(o => `<td>${o ? o + '%' : '—'}</td>`).join('')}</tr>`).join('');
  $('#lgOdds').innerHTML = `<div class="odds-title">📊 排出確率（ギフトの道具は表示の★以上が必ず釣れます）</div><table class="odds"><tr><th>道具</th><th>ゴミ</th><th>★1</th><th>★2</th><th>★3</th><th>★4</th><th>★5</th></tr>${rows}</table>`;
  setInterval(() => $('.legend').classList.toggle('odds'), 10000);
}

// ---------- Renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1a2c);
scene.fog = new THREE.Fog(0x0e1a2c, 260, 420);
const camera = new THREE.PerspectiveCamera(46, W / H, 1, 1000);
camera.position.set(0, 190, 92);
camera.lookAt(0, 0, -4);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a3a2a, 1.6));
const moon = new THREE.DirectionalLight(0xfff2dd, 2.2);
moon.position.set(-40, 120, -60);
scene.add(moon);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.4, 0.4, 0.85));
composer.addPass(new OutputPass());

// Pond geometry (ellipse)
const A = 34, B = 52; // pond radii (x, z)
const ellipse = (k, ang) => new THREE.Vector3(Math.cos(ang) * A * k, 0, Math.sin(ang) * B * k);
function ellipseShape(k) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; const p = ellipse(k, a); i ? s.lineTo(p.x, p.z) : s.moveTo(p.x, p.z); }
  return s;
}
// Ground (grass / dirt)
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2e4a2c, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.4;
  scene.add(g);
  // Wooden deck ring where seats are
  const deckShape = ellipseShape(1.34);
  deckShape.holes.push(new THREE.Path(ellipseShape(1.02).getPoints(64)));
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape, 64), new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8 }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = 0.3;
  scene.add(deck);
}
// Pond floor + transparent water
const floor = new THREE.Mesh(new THREE.ShapeGeometry(ellipseShape(1.02), 64), new THREE.MeshStandardMaterial({ color: 0x5fa8a0, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -4;
scene.add(floor);
function noiseTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = rand(6, 26);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? 255 : 0;
    gr.addColorStop(0, `rgba(${v},${v},${v},.25)`); gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 9);
  return t;
}
const waterBump = noiseTexture();
const waterMat = new THREE.MeshStandardMaterial({ color: 0x3fa7c4, transparent: true, opacity: 0.38, roughness: 0.4, metalness: 0, bumpMap: waterBump, bumpScale: 0.8, depthWrite: false });
const water = new THREE.Mesh(new THREE.ShapeGeometry(ellipseShape(1.02), 64), waterMat);
water.rotation.x = -Math.PI / 2; water.position.y = 0;
water.renderOrder = 3;
scene.add(water);
// Stone rim
{
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c8c86, roughness: 0.9 });
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const p = ellipse(1.04, a);
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.6, 2.4), 0), stoneMat);
    st.position.set(p.x, 0.4, p.z);
    st.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    st.scale.y = 0.6;
    scene.add(st);
  }
  // Lily pads
  const padMat = new THREE.MeshStandardMaterial({ color: 0x4f9a4a, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const p = ellipse(rand(0.35, 0.85), rand(0, Math.PI * 2));
    const pad = new THREE.Mesh(new THREE.CircleGeometry(rand(1.6, 2.6), 16, 0.3, Math.PI * 1.85), padMat);
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = rand(0, 6);
    pad.position.set(p.x, 0.12, p.z);
    scene.add(pad);
  }
}
// Lanterns (warm lights) at 4 corners + string of small bulbs around the deck
{
  for (const [x, z] of [[-48, -66], [48, -66], [-48, 66], [48, 66]]) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), new THREE.MeshStandardMaterial({ color: 0x777770 }));
    base.position.y = 3; grp.add(base);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 1.2 }));
    lamp.position.y = 7.5; grp.add(lamp);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0x555550 }));
    roof.position.y = 10.2; roof.rotation.y = Math.PI / 4; grp.add(roof);
    grp.position.set(x, 0, z);
    scene.add(grp);
    const pl = new THREE.PointLight(0xffb060, 400, 70);
    pl.position.set(x, 9, z);
    scene.add(pl);
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = 0; i < 48; i++) {
    const p = ellipse(1.38, (i / 48) * Math.PI * 2);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
    b.position.set(p.x, 5 + Math.sin(i) * 0.4, p.z);
    scene.add(b);
  }
}

// ---------- Fish silhouettes swimming under water ----------
function silhouette(color, glow) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  if (glow) { g.shadowColor = color; g.shadowBlur = 16; }
  g.fillStyle = color;
  g.beginPath(); g.ellipse(56, 32, 40, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(92, 32); g.lineTo(122, 14); g.lineTo(122, 50); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SIL = R_COLOR.map((c, r) => silhouette(r <= 1 ? '#06161e' : c, r >= 2));
const swimmers = [];
function addSwimmer(r, pos) {
  const mat = new THREE.SpriteMaterial({ map: SIL[r], transparent: true, opacity: r <= 1 ? 0.75 : 1, depthWrite: false, toneMapped: r < 2 });
  const sp = new THREE.Sprite(mat);
  const size = r >= 4 ? 13 : r >= 2 ? 9.5 : 7.5;
  sp.scale.set(size, size / 2, 1);
  sp.position.copy(pos || ellipse(rand(0, 0.85), rand(0, Math.PI * 2))).setY(-1.8);
  sp.renderOrder = 2;
  scene.add(sp);
  const s = { sp, r, vel: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(3, 6)), target: null, onArrive: null };
  swimmers.push(s);
  return s;
}
for (let i = 0; i < 26; i++) addSwimmer(Math.random() < 0.85 ? 1 : 2);
function insidePond(p, k = 0.88) { return (p.x / (A * k)) ** 2 + (p.z / (B * k)) ** 2 < 1; }
function updateSwimmers(dt) {
  for (let i = swimmers.length - 1; i >= 0; i--) {
    const s = swimmers[i];
    if (s.target) {
      const d = s.target.clone().setY(-1.8).sub(s.sp.position);
      const dist = d.length();
      if (dist < 0.8) { const cb = s.onArrive; s.target = null; s.onArrive = null; cb?.(s); continue; }
      s.vel.lerp(d.normalize().multiplyScalar(Math.min(14, 4 + dist)), Math.min(1, dt * 3));
    } else {
      s.vel.x += rand(-4, 4) * dt; s.vel.z += rand(-4, 4) * dt;
      const sp = s.vel.length(); if (sp > 6) s.vel.multiplyScalar(6 / sp); if (sp < 2) s.vel.multiplyScalar(2 / Math.max(sp, 0.01));
      if (!insidePond(s.sp.position.clone().addScaledVector(s.vel, 0.5))) s.vel.lerp(s.sp.position.clone().multiplyScalar(-1).setY(0).normalize().multiplyScalar(5), 0.2);
    }
    s.sp.position.addScaledVector(s.vel, dt);
    s.sp.material.rotation = Math.atan2(s.vel.z, -s.vel.x) * -1 + Math.PI;
  }
}
function removeSwimmer(s) { scene.remove(s.sp); s.sp.material.dispose(); swimmers.splice(swimmers.indexOf(s), 1); }

// ---------- Seats & players ----------
function faceTexture(user, ring) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = img => {
    g.clearRect(0, 0, 256, 256);
    g.save(); g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.clip();
    if (img) g.drawImage(img, 18, 18, 220, 220);
    else { g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#222'; g.font = '900 130px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials(user.nickname), 128, 136); }
    g.restore();
    g.lineWidth = 14; g.strokeStyle = tex.ring || '#ffffff'; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
    tex.needsUpdate = true;
  };
  tex.ring = ring; tex.redraw = () => draw(tex.img || null);
  draw(null);
  const url = avatarUrl(user);
  if (url) { const img = new Image(); img.onload = () => { tex.img = img; draw(img); }; img.src = url; }
  return tex;
}
const GEAR_RING = ['#ffffff', '#9be38b', '#5ac8ff', '#ffd23f', '#ff6ad5'];
const seats = Array.from({ length: SEATS }, (_, i) => {
  const ang = (i / SEATS) * Math.PI * 2 + Math.PI / SEATS;
  const pos = ellipse(1.19, ang).setY(0.4);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x5a3a24 }));
  cushion.position.copy(pos);
  scene.add(cushion);
  return { i, ang, pos, player: null };
});

const players = new Map();  // id -> player (seated)
const stats = new Map();    // id -> { user, pts, best, dex:Set }
const DAY = new Date().toISOString().slice(0, 10);
try { const saved = JSON.parse(localStorage.getItem('pond-' + DAY) || '[]'); for (const s of saved) stats.set(s.user.id, { ...s, dex: new Set(s.dex) }); } catch { /* storage unavailable */ }
function saveStats() { try { localStorage.setItem('pond-' + DAY, JSON.stringify([...stats.values()].map(s => ({ ...s, dex: [...s.dex] })))); } catch { /* ignore */ } }
let record = null;
for (const s of stats.values()) if (s.best && (!record || s.best.size > record.fish.size)) record = { user: s.user, fish: s.best };

// Fill seats spread around the pond (0, 12, 6, 18, 3, 15, ...) instead of one side first
const SEAT_ORDER = (() => {
  const order = [];
  for (const step of [12, 6, 3, 1]) for (let i = 0; i < SEATS; i += step) if (!order.includes(i)) order.push(i);
  return order;
})();
function freeSeat() { const i = SEAT_ORDER.find(k => !seats[k].player); return i == null ? null : seats[i]; }
const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
function seat(user) {
  let p = players.get(user.id);
  if (p) { p.lastActive = Date.now(); return p; }
  let s = freeSeat();
  if (!s) {
    const idle = [...players.values()].filter(q => Date.now() - q.lastActive > IDLE_MS && q.gear.id === 0).sort((a, b) => a.lastActive - b.lastActive)[0];
    if (!idle) return null;
    unseat(idle);
    s = freeSeat();
  }
  const tex = faceTexture(user, GEAR_RING[0]);
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthWrite: false }));
  face.scale.setScalar(10);
  face.position.copy(s.pos).setY(6);
  face.renderOrder = 5;
  scene.add(face);
  const dir = new THREE.Vector3().sub(s.pos).setY(0).normalize();
  const floatPos = s.pos.clone().addScaledVector(dir, rand(12, 17)).add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3))).setY(0.3);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x551010 }));
  bob.position.copy(floatPos);
  scene.add(bob);
  const tip = s.pos.clone().addScaledVector(dir, 4).setY(7);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([tip, floatPos]);
  const line = new THREE.Line(lineGeo, lineMat);
  scene.add(line);
  const label = document.createElement('div');
  label.className = 'lbl';
  $('#labels').appendChild(label);
  p = { user, seat: s, face, tex, bob, line, floatPos, tip, label, gear: GEARS[0], castsLeft: Infinity, state: 'idle', lastActive: Date.now(), token: 0, seenBoosts: new Set(), skip: false };
  s.player = p;
  players.set(user.id, p);
  if (!stats.has(user.id)) stats.set(user.id, { user, pts: 0, best: null, dex: new Set() });
  stats.get(user.id).user = user;
  updateLabel(p);
  fishLoop(p);
  return p;
}
function unseat(p) {
  p.token++;
  p.seat.player = null;
  players.delete(p.user.id);
  for (const o of [p.face, p.bob, p.line]) scene.remove(o);
  p.tex.dispose(); p.label.remove();
}
function updateLabel(p) {
  const st = stats.get(p.user.id);
  const name = p.user.nickname.length > 7 ? p.user.nickname.slice(0, 7) + '…' : p.user.nickname;
  p.label.style.setProperty('--c', GEAR_RING[p.gear.id]);
  p.label.innerHTML = `${esc(name)}<small>${p.gear.icon}${p.gear.id ? ' 残り' + p.castsLeft : ''} ・ 📖${st ? st.dex.size : 0}</small>`;
  if (p.tex.ring !== GEAR_RING[p.gear.id]) { p.tex.ring = GEAR_RING[p.gear.id]; p.tex.redraw(); }
}
function setGear(p, gear) {
  if (p.gear.id === gear.id) p.castsLeft += gear.casts;
  else if (gear.id > p.gear.id) { p.gear = gear; p.castsLeft = gear.casts; }
  else { /* weaker gear than current: add casts to current instead */ p.castsLeft += gear.casts; }
  updateLabel(p);
}

// ---------- Fishing loop ----------
// Waiting time (seconds) depends on the rarity of the fish that will bite: bigger fish take longer
const WAIT_BY_R = [[15, 35], [20, 40], [30, 55], [45, 75], [60, 100], [80, 130]];
// Fight duration (seconds) before the fish is landed
const FIGHT_BY_R = [0.6, 1, 1.6, 2.4, 3.6, 5];
const SPEED = Math.max(0.1, Number(params.get('speed')) || 1); // >1 = faster (testing only)
let goldenUntil = 0;
// Pond-wide speed boosts (golden time, chum). Each boost cuts every player's remaining wait once by `factor`.
const boosts = []; // { id, factor, until }
let boostSeq = 0;
function startBoost(factor, ms) { boosts.push({ id: ++boostSeq, factor, until: performance.now() + ms }); }
function applyBoosts(p, now, remaining) {
  for (const b of boosts) {
    if (now < b.until && !p.seenBoosts.has(b.id)) { p.seenBoosts.add(b.id); remaining *= b.factor; }
  }
  return remaining;
}
async function fishLoop(p) {
  const token = ++p.token;
  const alive = () => p.token === token && players.has(p.user.id);
  // First cast after sitting down comes a bit sooner so new players see action
  let first = true;
  while (alive()) {
    let gear = p.gear;
    let fish = rollFish(gear);
    const [lo, hi] = WAIT_BY_R[fish.r];
    let wait = rand(lo, hi) * 1000 * gear.waitMul / SPEED;
    if (first) { wait *= 0.5; first = false; }
    p.state = 'wait';
    p.skip = false;
    // While waiting: occasional nibbles; boosts shorten the wait; a gift sets p.skip for an instant bite
    let end = performance.now() + applyBoosts(p, performance.now(), Math.max(0, wait - 2200));
    let nextNibble = performance.now() + rand(2500, 7000);
    while (performance.now() < end && !p.skip) {
      await sleep(200);
      if (!alive()) return;
      const now = performance.now();
      end = now + applyBoosts(p, now, Math.max(0, end - now));
      if (now >= nextNibble && now < end - 800) {
        nextNibble = now + rand(2500, 7000);
        if (Math.random() < 0.6) { p.nibbleAt = now; if (Math.random() < 0.4) showAt(p.floatPos, 'nibble', 'ちょん…'); }
      }
    }
    if (!alive()) return;
    // Gear changed while waiting (gift) -> this cast uses the new gear
    if (p.gear !== gear) { gear = p.gear; fish = rollFish(gear); }
    p.state = 'approach';
    const start = p.floatPos.clone().add(new THREE.Vector3(rand(-14, 14), 0, rand(-14, 14)));
    if (!insidePond(start)) start.multiplyScalar(0.6);
    const sw = addSwimmer(Math.max(1, fish.r), start);
    await new Promise(res => { sw.target = p.floatPos; sw.onArrive = res; setTimeout(res, 2600); });
    if (swimmers.includes(sw)) removeSwimmer(sw);
    if (!alive()) return;
    // Bite
    p.state = 'bite';
    showAt(p.floatPos, 'bang', '!');
    const t0 = performance.now();
    while (performance.now() - t0 < 700) { p.bob.position.y = 0.3 - Math.abs(Math.sin((performance.now() - t0) / 60)) * 0.9; await sleep(16); }
    p.bob.position.y = 0.3;
    if (!alive()) return;
    // Fight: the float is dragged around, longer for bigger fish
    p.state = 'fight';
    if (fish.r >= 2) showAt(p.seat.pos.clone().setY(9), 'fight', fish.r >= 4 ? '大物だ！ファイト！' : 'ファイト！');
    const fightMs = FIGHT_BY_R[fish.r] * 1000;
    const f0 = performance.now();
    let lastSplash = 0;
    while (performance.now() - f0 < fightMs) {
      const t = (performance.now() - f0) / 1000;
      const rad = 1 + Math.min(3, fish.r * 0.6);
      p.bob.position.set(p.floatPos.x + Math.cos(t * 5) * rad, 0.3 - Math.abs(Math.sin(t * 9)) * 0.8, p.floatPos.z + Math.sin(t * 7) * rad);
      if (performance.now() - lastSplash > 450) { lastSplash = performance.now(); splash(p.bob.position, 6); }
      await sleep(16);
      if (!alive()) return;
    }
    p.bob.position.copy(p.floatPos);
    // Catch: fish jumps out toward the seat
    jumpFish(p, fish);
    splash(p.floatPos);
    await sleep(700);
    if (!alive()) return;
    landFish(p, fish, gear);
    p.state = 'rest';
    await sleep(rand(3000, 5000) / SPEED);
  }
}

const jumpers = [];
const emojiTexCache = new Map();
function emojiTex(e) {
  if (emojiTexCache.has(e)) return emojiTexCache.get(e);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  emojiTexCache.set(e, t);
  return t;
}
const fishTexCache = new Map();
const texLoader = new THREE.TextureLoader();
function fishTex(fish) {
  const url = fishImgUrl(fish.name);
  if (!url) return { tex: emojiTex(fish.e), aspect: 1 };
  let entry = fishTexCache.get(url);
  if (!entry) {
    entry = { tex: texLoader.load(url, t => { entry.aspect = t.image.width / t.image.height; }), aspect: 2 };
    entry.tex.colorSpace = THREE.SRGBColorSpace;
    fishTexCache.set(url, entry);
  }
  return entry;
}
// Preload all fish images so the first catch already shows the picture
Object.keys(FISH_IMG).forEach(name => fishTex({ name }));
function jumpFish(p, fish) {
  const { tex, aspect } = fishTex(fish);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthWrite: false }));
  const h = fish.r >= 4 ? 6 : 4.2;
  sp.scale.set(h * aspect, h, 1);
  sp.renderOrder = 6;
  scene.add(sp);
  jumpers.push({ sp, from: p.floatPos.clone(), to: p.seat.pos.clone().setY(6), t: 0 });
}
function updateJumpers(dt) {
  for (let i = jumpers.length - 1; i >= 0; i--) {
    const j = jumpers[i];
    j.t += dt / 0.9;
    const k = Math.min(1, j.t);
    j.sp.position.copy(j.from).lerp(j.to, k).setY(j.from.y + Math.sin(Math.PI * k) * 14 + k * 4);
    j.sp.material.rotation = -k * Math.PI * 2;
    j.sp.material.opacity = k > 0.8 ? (1 - k) * 5 : 1;
    if (j.t >= 1) { scene.remove(j.sp); j.sp.material.dispose(); jumpers.splice(i, 1); }
  }
}

const drops = [];
const dropGeo = new THREE.SphereGeometry(0.3, 6, 4);
const dropMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff });
function splash(pos, n = 14) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.copy(pos);
    scene.add(m);
    const a = rand(0, Math.PI * 2);
    drops.push({ m, v: new THREE.Vector3(Math.cos(a) * rand(2, 6), rand(6, 12), Math.sin(a) * rand(2, 6)), life: 0.9 });
  }
}
function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life -= dt;
    d.v.y -= 25 * dt;
    d.m.position.addScaledVector(d.v, dt);
    if (d.life <= 0 || d.m.position.y < -0.5) { scene.remove(d.m); drops.splice(i, 1); }
  }
}

function landFish(p, fish, gear) {
  const st = stats.get(p.user.id);
  const pts = Math.round(R_POINTS[fish.r] * (fish.size / ((FISH.find(f => f.name === fish.name).min + FISH.find(f => f.name === fish.name).max) / 2)));
  const isNew = fish.r > 0 && !st.dex.has(fish.name);
  if (fish.r > 0) st.dex.add(fish.name);
  st.pts += pts;
  if (fish.r > 0 && (!st.best || fish.size > st.best.size)) st.best = { name: fish.name, e: fish.e, size: fish.size, r: fish.r };
  if (fish.r > 0 && (!record || fish.size > record.fish.size)) { record = { user: p.user, fish: { name: fish.name, e: fish.e, size: fish.size, r: fish.r } }; updateRecord(); }
  saveStats();
  showAt(p.seat.pos.clone().setY(9), 'catch r' + fish.r, fish.r === 0 ? `${fish.e}${fish.name}…` : `${fish.e}${fish.name} ${fish.size}cm ${'★'.repeat(fish.r)}${isNew ? ' 📖NEW' : ''}`);
  if (gear.id > 0) { p.castsLeft--; if (p.castsLeft <= 0) { p.gear = GEARS[0]; p.castsLeft = Infinity; } }
  updateLabel(p);
  if (fish.r >= 3) addFeed(`${p.user.nickname}：${fish.e}${fish.name} ${fish.size}cm ${'★'.repeat(fish.r)}`);
  // Center card only for ★4 / ★5 so announcements stay special
  if (fish.r >= 4) fishCard(p.user, fish, gear);
  if (fish.r === 5) { flashScreen(); confetti(140); }
  else if (fish.r === 4) confetti(60);
  rankDirty = true;
}

// ---------- DOM overlays ----------
const proj = new THREE.Vector3();
function toScreen(v) { proj.copy(v).project(camera); return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H }; }
function showAt(pos3, cls, text) {
  const sp = toScreen(pos3);
  const e = document.createElement('div');
  e.className = cls; e.textContent = text;
  e.style.left = sp.x + 'px'; e.style.top = sp.y + 'px';
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
function updateRecord() {
  $('#record').innerHTML = record ? `${esc(record.fish.e)} <b>${esc(record.fish.name)} ${record.fish.size}cm</b><br>${esc(record.user.nickname)}` : '—';
}
updateRecord();
let rankDirty = true;
function updateRank() {
  const top = [...stats.values()].filter(s => s.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 5);
  $('#rank').innerHTML = top.map(s => `<li>${esc(s.user.nickname)}<span>${s.pts}pt</span></li>`).join('');
}

// Big card for ★3+ catches (queued)
const cardQueue = [];
let cardShowing = false;
function fishCard(user, fish, gear) { cardQueue.push({ user, fish, gear }); if (cardQueue.length > 4) cardQueue.splice(0, cardQueue.length - 4); if (!cardShowing) nextCard(); }
function nextCard() {
  const c = cardQueue.shift();
  if (!c) { cardShowing = false; return; }
  cardShowing = true;
  const el = document.createElement('div');
  el.className = 'fc r' + c.fish.r;
  el.style.setProperty('--rc', R_COLOR[c.fish.r]);
  const img = fishImgUrl(c.fish.name);
  el.innerHTML = `<div class="stars">${'★'.repeat(c.fish.r)}</div><div class="rname">${R_NAME[c.fish.r]}</div>`
    + (img ? `<img class="fish-img" src="${img}" alt="">` : `<div class="fish">${c.fish.e}</div>`)
    + `<div class="fname">${esc(c.fish.name)}</div><div class="size">${c.fish.size}cm</div>`
    + `<div class="who"><div class="av"></div>${esc(c.user.nickname)}</div><div class="gear">${c.gear.icon} ${c.gear.name}で釣り上げた！</div>`;
  fillAvatar(el.querySelector('.av'), c.user);
  $('#card').replaceChildren(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(nextCard, 350); }, c.fish.r >= 5 ? 5000 : c.fish.r >= 4 ? 3800 : 2600);
}

// Banner queue
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

// ---------- Golden time gauge (likes + gifts, community goal) ----------
const GIFT_GAUGE = 10; // 1 diamond counts as 10 likes
let gauge = 0;
const gaugeContrib = new Map(); // id -> { user, pts } for the current gauge
function addGauge(user, pts) {
  if (performance.now() < goldenUntil) return;
  gauge += pts;
  if (user) { const c = gaugeContrib.get(user.id) || { user, pts: 0 }; c.pts += pts; c.user = user; gaugeContrib.set(user.id, c); }
  if (gauge >= GOLDEN_LIKES) {
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

// ---------- Chum (撒き餌): big gifts boost the whole pond ----------
const CHUM_MIN = 100;   // diamonds needed
const CHUM_SEC = 20;
let chumUntil = 0, chumBy = null;
const chumSwimmers = [];
function chumEvent(user) {
  chumUntil = Math.max(chumUntil, performance.now()) + CHUM_SEC * 1000;
  chumBy = user;
  startBoost(0.4, CHUM_SEC * 1000);
  // A school of fish rushes in
  for (let i = 0; i < 22; i++) chumSwimmers.push(addSwimmer(Math.random() < 0.75 ? 1 : 2, ellipse(rand(0.2, 0.8), rand(0, Math.PI * 2))));
  setTimeout(() => {
    if (performance.now() < chumUntil - 500) return; // extended by another chum
    for (const s of chumSwimmers.splice(0)) if (swimmers.includes(s)) removeSwimmer(s);
  }, CHUM_SEC * 1000 + 50);
  banner(user, `<div class="av"></div><div><div class="who">${esc(user.nickname)}さんが撒き餌！</div><div class="what">${CHUM_SEC}秒間 池全体で爆釣チャンス！</div></div><div class="ic">🐟</div>`, 'g3', 3500, true);
}

function updateGolden(now) {
  const golden = now < goldenUntil, chum = now < chumUntil;
  $('.golden').classList.toggle('on', golden || chum);
  if (golden) {
    const left = Math.ceil((goldenUntil - now) / 1000);
    $('#gtext').innerHTML = `🌟 黄金タイム中！ 釣れる速さ2倍 <b>${left}</b>秒`;
    $('#gbar').style.width = ((goldenUntil - now) / (GOLDEN_SEC * 1000) * 100) + '%';
  } else if (chum) {
    const left = Math.ceil((chumUntil - now) / 1000);
    $('#gtext').innerHTML = `🐟 ${esc(chumBy.nickname)}さんの撒き餌で爆釣中！ <b>${left}</b>秒`;
    $('#gbar').style.width = Math.min(100, (chumUntil - now) / (CHUM_SEC * 1000) * 100) + '%';
  } else {
    $('#gtext').innerHTML = `❤️いいね・🎁ギフトで <b>黄金タイム</b> ${Math.floor(gauge / GOLDEN_LIKES * 100)}%`;
    $('#gbar').style.width = (gauge / GOLDEN_LIKES * 100) + '%';
  }
  waterMat.color.setHex(golden ? 0xd8b450 : chum ? 0x4fc3a0 : 0x3fa7c4);
  // Chum bubbles on the surface
  if (chum && Math.random() < 0.8) splash(ellipse(rand(0, 0.85), rand(0, Math.PI * 2)).setY(0.2), 5);
  for (let i = boosts.length - 1; i >= 0; i--) if (now > boosts[i].until) boosts.splice(i, 1);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let lastUi = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  waterBump.offset.x += dt * 0.01; waterBump.offset.y += dt * 0.006;
  updateSwimmers(dt);
  updateJumpers(dt);
  updateDrops(dt);
  for (const p of players.values()) {
    if (p.state !== 'bite' && p.state !== 'fight') {
      const nib = now - (p.nibbleAt || 0);
      p.bob.position.y = 0.3 + Math.sin(now / 400 + p.seat.i) * 0.12 - (nib < 450 ? Math.sin(nib / 450 * Math.PI) * 0.5 : 0);
    }
    // Keep the line attached to the float (it moves during the fight)
    const lp = p.line.geometry.attributes.position;
    lp.setXYZ(1, p.bob.position.x, p.bob.position.y, p.bob.position.z);
    lp.needsUpdate = true;
    const sp = toScreen(p.seat.pos.clone().setY(1.2));
    p.label.style.left = sp.x + 'px'; p.label.style.top = sp.y + 'px';
  }
  if (now - lastUi > 250) {
    lastUi = now;
    updateGolden(now);
    if (rankDirty) { rankDirty = false; updateRank(); }
  }
  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- Event handlers ----------
function onGift(e) {
  const total = (e.diamonds || 1) * (e.count || 1);
  const gear = gearForDiamonds(total);
  const p = seat(e.user);
  if (!p) { banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)} ありがとう！（満席）</div></div>`, '', 2000); return; }
  p.lastActive = Date.now();
  setGear(p, gear);
  // Instant bite if the player is waiting
  const instant = p.state === 'wait';
  if (instant) { p.skip = true; showAt(p.seat.pos.clone().setY(9), 'fight', '即ヒット！'); }
  addGauge(e.user, total * GIFT_GAUGE);
  banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)}×${e.count} → ${gear.icon} ${gear.name}（+${gear.casts}回）${instant ? '・即ヒット！' : ''}</div></div><div class="ic">${gear.icon}</div>`,
    'g' + Math.min(4, gear.id), gear.id >= 3 ? 3200 : 2000, gear.id >= 3);
  if (total >= CHUM_MIN) chumEvent(e.user);
}

const handlers = {
  chat: e => { const p = seat(e.user); if (p) p.lastActive = Date.now(); },
  gift: onGift,
  like: e => { const p = players.get(e.user.id); if (p) p.lastActive = Date.now(); addGauge(e.user, e.count || 1); },
  join: () => {}, share: () => {},
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

window.pond = { emit: e => handlers[e.type]?.(e), golden: () => addGauge(null, GOLDEN_LIKES) };
