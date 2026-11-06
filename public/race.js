import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const stage = $('#stage');
let LOBBY_SEC = Math.max(5, Number(params.get('lobby')) || 20);
const MAX_MARBLES = 40;

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function initials(n) { return (n || '?').trim().charAt(0).toUpperCase(); }
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function norm(s) { return String(s).normalize('NFKC').toLowerCase().trim(); }
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

// ---------- Renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05051a);
scene.fog = new THREE.FogExp2(0x070722, 0.0028);
const camera = new THREE.PerspectiveCamera(70, W / H, 0.5, 3000);
scene.add(new THREE.HemisphereLight(0xccd6ff, 0x332244, 2.0));
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(80, 200, 60);
scene.add(sun);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Soft bloom: only the brightest highlights glow
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.35, 0.3, 0.85));
composer.addPass(new OutputPass());

// Stars
{
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(500, 1400));
    arr.set([v.x, v.y - 100, v.z - 200], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab4ff, size: 1.8, sizeAttenuation: false, fog: false })));
}

// ---------- Track ----------
const TRACK_W = 18;
const UP = new THREE.Vector3(0, 1, 0);
const pts = [];
for (let i = 0; i < 22; i++) {
  const a = i * 0.85;
  const r = 80 + Math.sin(i * 1.3) * 25;
  pts.push(new THREE.Vector3(Math.cos(a) * r, -i * 9 + Math.sin(i * 0.7) * 4, Math.sin(a) * r - i * 22));
}
const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
const L = curve.getLength();
const FINISH = L - 12;

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
function frameAt(s, out = {}) {
  const u = Math.min(1, Math.max(0, s / L));
  const p = curve.getPointAt(u, out.p || new THREE.Vector3());
  const t = curve.getTangentAt(u, out.t || new THREE.Vector3());
  if (s < 0) p.addScaledVector(t, s);
  if (s > L) p.addScaledVector(t, s - L);
  const side = (out.side || new THREE.Vector3()).crossVectors(t, UP).normalize();
  return { p, t, side };
}
function posAt(s, lat, h = 0, out = new THREE.Vector3()) {
  const f = frameAt(s, { p: _p, t: _t, side: _s });
  return out.copy(f.p).addScaledVector(f.side, lat).addScaledVector(UP, h);
}

function makeTrackTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#141a3a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,160,255,.12)'; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = '#3aa0c8'; g.fillRect(0, 0, 6, 256); g.fillRect(250, 0, 6, 256);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(124, 30, 8, 80); g.fillRect(124, 158, 8, 80);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
{
  const SEG = 900;
  const pos = [], uv = [], idx = [];
  const s0 = -80, s1 = L + 40;
  for (let i = 0; i <= SEG; i++) {
    const s = s0 + (s1 - s0) * (i / SEG);
    const f = frameAt(s);
    const a = f.p.clone().addScaledVector(f.side, -TRACK_W / 2), b = f.p.clone().addScaledVector(f.side, TRACK_W / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, s / 18, 1, s / 18);
    if (i < SEG) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: makeTrackTexture(), roughness: 0.6, side: THREE.DoubleSide })));
  // Rails: soft colored, not glowing
  for (const [lat, color] of [[-TRACK_W / 2, 0x3fb6d9], [TRACK_W / 2, 0xd9508f]]) {
    const rp = [];
    for (let i = 0; i <= 240; i++) rp.push(posAt(s0 + (s1 - s0) * (i / 240), lat, 0.8, new THREE.Vector3()));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 600, 0.4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 })));
  }
  for (let k = 1; k < 11; k++) {
    const s = L * k / 11;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(TRACK_W * 0.72, 0.35, 8, 48), new THREE.MeshStandardMaterial({ color: k % 2 ? 0x3fb6d9 : 0xd9508f, emissive: k % 2 ? 0x3fb6d9 : 0xd9508f, emissiveIntensity: 0.35, transparent: true, opacity: 0.7 }));
    const f = frameAt(s);
    ring.position.copy(f.p).addScaledVector(UP, 5);
    ring.lookAt(ring.position.clone().add(f.t));
    scene.add(ring);
  }
}

function gate(s, text, colors) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? colors[0] : colors[1]; g.fillRect(i * 32, j * 32, 32, 32); }
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(120, 14, 272, 68);
  g.fillStyle = '#fff'; g.font = '900 56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  const f = frameAt(s);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W + 4, 3.6, 0.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  banner.position.set(0, 13, 0);
  grp.add(banner);
  for (const x of [-(TRACK_W / 2 + 1.5), TRACK_W / 2 + 1.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 14, 12), new THREE.MeshStandardMaterial({ color: 0xd4af37 }));
    post.position.set(x, 7, 0);
    grp.add(post);
  }
  grp.position.copy(f.p);
  grp.lookAt(f.p.clone().add(new THREE.Vector3(f.t.x, 0, f.t.z)));
  scene.add(grp);
}
gate(0, 'START', ['#ffffff', '#111111']);
gate(FINISH, 'GOAL', ['#ffd23f', '#111111']);

const obstacles = [0.22, 0.42, 0.62, 0.8].map(fr => {
  const s = L * fr;
  const grp = new THREE.Group();
  const f = frameAt(s);
  grp.position.copy(f.p).addScaledVector(UP, 0.1);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 6, 12), new THREE.MeshStandardMaterial({ color: 0x555577 }));
  post.position.y = 3;
  grp.add(post);
  const arm = new THREE.Group();
  arm.position.y = 2.2;
  for (const rot of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W - 1, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xff9a2e, roughness: 0.5 }));
    bar.rotation.y = rot;
    arm.add(bar);
  }
  grp.add(arm);
  scene.add(grp);
  return { s, arm };
});

// ---------- Particles ----------
const particles = [];
const partGeo = new THREE.SphereGeometry(0.35, 6, 4);
function emit(pos, color, n, speed, life = 0.8, size = 1) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 600) break;
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    m.scale.setScalar(size * rand(0.6, 1.4));
    scene.add(m);
    particles.push({ m, v: new THREE.Vector3().randomDirection().multiplyScalar(rand(0.3, 1) * speed), life, max: life });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life -= dt;
    if (q.life <= 0) { scene.remove(q.m); q.m.material.dispose(); particles.splice(i, 1); continue; }
    q.m.position.addScaledVector(q.v, dt);
    q.v.y -= 9 * dt;
    q.m.material.opacity = q.life / q.max;
  }
}
function flashScreen() { const fl = $('#flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }

const bolts = [];
function boltAt(target) {
  const top = target.clone().add(new THREE.Vector3(rand(-10, 10), 70, rand(-10, 10)));
  const ptsL = [];
  for (let i = 0; i <= 12; i++) {
    const p = top.clone().lerp(target, i / 12);
    if (i > 0 && i < 12) p.add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3)));
    ptsL.push(p);
  }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsL, false, 'catmullrom', 0), 48, 0.35, 5), new THREE.MeshBasicMaterial({ color: 0xcfe8ff }));
  scene.add(line);
  bolts.push({ line, life: 0.4 });
  emit(target, 0xcfe8ff, 30, 30, 0.6, 1.2);
}

// ---------- Marbles ----------
const marbles = new Map();
const wins = new Map();
const R = 2.4;
const sphereGeo = new THREE.SphereGeometry(R, 40, 24);
const shieldGeo = new THREE.SphereGeometry(R * 1.45, 32, 16);

// Face texture: crisp circle avatar, drawn on a sprite that always faces the camera
function faceTexture(user, hue) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = img => {
    g.clearRect(0, 0, 256, 256);
    g.save(); g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.clip();
    if (img) g.drawImage(img, 16, 16, 224, 224);
    else { g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#222'; g.font = '900 140px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials(user.nickname), 128, 138); }
    g.restore();
    g.lineWidth = 10; g.strokeStyle = '#fff'; g.beginPath(); g.arc(128, 128, 114, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 8; g.strokeStyle = `hsl(${hue},90%,55%)`; g.beginPath(); g.arc(128, 128, 123, 0, Math.PI * 2); g.stroke();
    tex.needsUpdate = true;
  };
  draw(null);
  const url = avatarUrl(user);
  if (url) { const img = new Image(); img.onload = () => draw(img); img.src = url; }
  return tex;
}
// Glass shell with an equator band so rolling is visible
function bandTexture(hue) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = `hsla(${hue},90%,60%,.95)`;
  g.fillRect(0, 56, 256, 16);
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 10, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addMarble(user, s, lat) {
  let m = marbles.get(user.id);
  if (m) return m;
  if (marbles.size >= MAX_MARBLES) return null;
  const hue = hash(user.id) % 360;
  const group = new THREE.Group();
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture(user, hue), toneMapped: false, depthWrite: false }));
  face.scale.setScalar(R * 1.9);
  face.renderOrder = 1;
  const shell = new THREE.Mesh(sphereGeo, new THREE.MeshPhysicalMaterial({ map: bandTexture(hue), transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, depthWrite: false }));
  shell.renderOrder = 2;
  group.add(face, shell);
  scene.add(group);
  const shield = new THREE.Mesh(shieldGeo, new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.visible = false;
  group.add(shield);
  const label = document.createElement('div');
  label.className = 'lbl';
  label.style.setProperty('--c', `hsl(${hue},90%,60%)`);
  label.textContent = user.nickname.length > 8 ? user.nickname.slice(0, 8) + '…' : user.nickname;
  $('#labels').appendChild(label);
  m = { user, group, shell, face, shieldMesh: shield, label, hue, s, lat, latV: 0, speed: 0, nitroUntil: 0, stunUntil: 0, likeUntil: 0, jumpAt: -1e9, shield: false, finished: false, place: 0, ph: rand(0, 100), fq: rand(0.3, 0.7) };
  marbles.set(user.id, m);
  placeMarble(m, 0, performance.now());
  $('#count').textContent = marbles.size;
  return m;
}
function lobbySlot(i) { return { s: -6 - Math.floor(i / 5) * 6, lat: ((i % 5) - 2) * 3.4 }; }
function jumpHeight(m, now) { const k = (now - m.jumpAt) / 800; return k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 7 : 0; }
function placeMarble(m, ds, now) {
  const f = frameAt(m.s, { p: _p, t: _t, side: _s });
  m.group.position.copy(f.p).addScaledVector(f.side, m.lat).addScaledVector(UP, R + 0.3 + jumpHeight(m, now));
  if (ds) m.shell.rotateOnWorldAxis(f.side, -ds / R);
}
function clearMarbles() {
  for (const m of marbles.values()) {
    scene.remove(m.group);
    m.face.material.map.dispose(); m.face.material.dispose();
    m.shell.material.map.dispose(); m.shell.material.dispose();
    m.shieldMesh.material.dispose();
    m.label.remove();
  }
  marbles.clear();
  for (const o of oils) scene.remove(o.mesh);
  for (const ms of missiles) scene.remove(ms.mesh);
  oils.length = 0; missiles.length = 0;
  $('#count').textContent = 0;
}
function racing() { return [...marbles.values()].filter(m => !m.finished); }
function ordered() { return [...marbles.values()].sort((a, b) => (a.finished && b.finished) ? a.place - b.place : (b.finished - a.finished) || (b.s - a.s)); }

// ---------- Attacks ----------
const oils = [];
const missiles = [];
const oilGeo = new THREE.CircleGeometry(4.2, 24);
const missileGeo = new THREE.ConeGeometry(0.8, 3.2, 10);

function hit(target, kind, attacker) {
  const now = performance.now();
  if (target.finished) return;
  if (target.shield) {
    target.shield = false;
    target.shieldMesh.visible = false;
    emit(target.group.position, 0x66ddff, 30, 20, 0.6, 1);
    fxText(target.group.position, '🛡️ ガード！', '#9be8ff');
    return;
  }
  const dur = { missile: 1600, oil: 1200, bolt: 2000, obstacle: 800 }[kind] || 1000;
  target.stunUntil = now + dur;
  target.latV = rand(-10, 10);
  if (kind === 'missile') { emit(target.group.position, 0xff7a2e, 40, 26, 0.7, 1.3); flashScreen(); fxText(target.group.position, '💥 被弾！', '#ff9a5a'); }
  if (kind === 'oil') { emit(target.group.position, 0x222222, 16, 10, 0.6, 1); fxText(target.group.position, '🛢️ スリップ！', '#cccccc'); }
  if (kind === 'bolt') { boltAt(target.group.position.clone()); fxText(target.group.position, '⚡ 落雷！', '#cfe8ff'); }
  if (kind === 'obstacle') { emit(target.group.position, 0xff9a2e, 16, 16, 0.5); fxText(target.group.position, 'ガツン！', '#ffb366'); }
  void attacker;
}

function fireMissile(from) {
  const others = racing().filter(x => x !== from);
  if (!others.length) return null;
  const target = others.filter(x => x.s > from.s).sort((a, b) => a.s - b.s)[0]
    || others.sort((a, b) => b.s - a.s)[0];
  const mesh = new THREE.Mesh(missileGeo, new THREE.MeshStandardMaterial({ color: 0xff4d3a, emissive: 0xff4d3a, emissiveIntensity: 0.6 }));
  mesh.position.copy(from.group.position);
  scene.add(mesh);
  missiles.push({ mesh, from: from.group.position.clone(), target, t: 0, dur: 0.75, attacker: from });
  return target;
}
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const ms = missiles[i];
    ms.t += dt / ms.dur;
    const to = ms.target.group.position;
    const k = Math.min(1, ms.t);
    const p = ms.from.clone().lerp(to, k).addScaledVector(UP, Math.sin(Math.PI * k) * 8);
    ms.mesh.lookAt(p);
    ms.mesh.rotateX(Math.PI / 2);
    ms.mesh.position.copy(p);
    emit(p, 0xffb36b, 1, 2, 0.35, 0.7);
    if (ms.t >= 1) { scene.remove(ms.mesh); ms.mesh.material.dispose(); missiles.splice(i, 1); hit(ms.target, 'missile', ms.attacker); }
  }
}
function dropOil(m) {
  const mesh = new THREE.Mesh(oilGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.6 }));
  const s = m.s - 7;
  const f = frameAt(s);
  mesh.position.copy(f.p).addScaledVector(f.side, m.lat).addScaledVector(UP, 0.08);
  mesh.lookAt(mesh.position.clone().add(UP));
  scene.add(mesh);
  oils.push({ s, lat: m.lat, owner: m, until: performance.now() + 12000, mesh });
}
function addShield(m) { m.shield = true; m.shieldMesh.visible = true; }

// ---------- Round flow ----------
let phase = 'lobby';
let phaseEnd = performance.now() + LOBBY_SEC * 1000;
let finishCount = 0, firstFinishAt = 0, raceStart = 0;
let slowUntil = 0;
let camFocus = null;
const BASE_SPEED = L / 45;

function bigText(t) { const b = $('#big'); b.textContent = t; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }

async function startCountdown() {
  if (marbles.size < 2) { phaseEnd = performance.now() + 8000; return; }
  phase = 'countdown';
  for (const t of ['3', '2', '1']) { bigText(t); await new Promise(r => setTimeout(r, 900)); }
  bigText('GO!');
  phase = 'race';
  raceStart = performance.now();
}

function finishMarble(m) {
  m.finished = true;
  m.place = ++finishCount;
  if (m.place === 1) {
    firstFinishAt = performance.now();
    slowUntil = performance.now() + 1500;
    camFocus = { m, until: performance.now() + 2500 };
    bigText('GOAL!');
    emit(m.group.position, 0xffd23f, 80, 40, 1.2, 1.4);
  }
}

function showResult() {
  phase = 'result';
  const top = ordered().slice(0, 3);
  if (top[0]) wins.set(top[0].user.id, { user: top[0].user, n: (wins.get(top[0].user.id)?.n || 0) + 1 });
  updateBoard();
  const order = [top[1], top[0], top[2]];
  const cls = ['p2', 'p1', 'p3'], num = ['2', '1', '3'];
  const res = $('#result');
  res.innerHTML = `<h1>🏆 RESULT</h1><div class="podium">${order.map((m, i) => m ? `<div class="pod ${cls[i]}"><div class="av"></div><div class="nm">${esc(m.user.nickname)}</div><div class="block">${num[i]}</div></div>` : '').join('')}</div>`;
  res.querySelectorAll('.pod').forEach((el, i) => fillAvatar(el.querySelector('.av'), order.filter(Boolean)[i].user));
  res.classList.add('on');
  setTimeout(() => {
    res.classList.remove('on');
    clearMarbles();
    finishCount = 0; firstFinishAt = 0; camFocus = null;
    phase = 'lobby';
    phaseEnd = performance.now() + LOBBY_SEC * 1000;
    bigText('参加受付！');
  }, 7500);
}
function updateBoard() {
  const top = [...wins.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  $('#board').innerHTML = top.map(w => `<li>${esc(w.user.nickname)}<span>👑${w.n}</span></li>`).join('');
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
let lastRank = 0;
posAt(-52, 0, 24, camPos); posAt(-12, 0, 0, camLook);

function loop() {
  const now = performance.now();
  const timeScale = now < slowUntil ? 0.3 : 1;
  const dt = Math.min(0.05, clock.getDelta()) * timeScale;
  const t = now / 1000;

  const chip = $('#phase');
  if (phase === 'lobby') {
    const left = Math.max(0, Math.ceil((phaseEnd - now) / 1000));
    chip.innerHTML = `参加受付中 <b>${left}</b>`;
    chip.classList.toggle('hot', left <= 5);
    if (left === 0) startCountdown();
  } else if (phase === 'countdown') {
    chip.innerHTML = '<b>まもなくスタート</b>';
  } else if (phase === 'race') {
    chip.innerHTML = `レース中 <b>${Math.floor((now - raceStart) / 1000)}s</b>`;
    chip.classList.remove('hot');
    if (firstFinishAt && (finishCount >= Math.min(3, marbles.size) || now - firstFinishAt > 8000)) showResult();
    else if (now - raceStart > 100000) showResult();
  }

  for (const m of marbles.values()) {
    if (phase === 'race' || (phase === 'result' && m.finished)) {
      const f = frameAt(m.s, { p: _p, t: _t, side: _s });
      let target = m.finished ? 0 : BASE_SPEED * (0.88 + 0.24 * (0.5 + 0.5 * Math.sin(t * m.fq + m.ph))) * (1 + Math.max(0, -f.t.y) * 0.9);
      if (now < m.nitroUntil) target *= 1.9;
      if (now < m.likeUntil) target *= 1.12;
      if (now < m.stunUntil) target *= 0.1;
      m.speed += (target - m.speed) * Math.min(1, dt * (m.finished ? 1.5 : 3));
      const prev = m.s;
      const ds = m.speed * dt;
      m.s += ds;
      m.latV += rand(-6, 6) * dt;
      m.latV *= 0.97;
      m.lat += m.latV * dt * 3;
      const lim = TRACK_W / 2 - R - 0.6;
      if (Math.abs(m.lat) > lim) { m.lat = Math.sign(m.lat) * lim; m.latV *= -0.6; }
      const airborne = jumpHeight(m, now) > 1.5;
      if (!m.finished && !airborne) {
        for (const o of obstacles) if (prev < o.s && m.s >= o.s && Math.random() < 0.35) hit(m, 'obstacle');
        for (let i = oils.length - 1; i >= 0; i--) {
          const o = oils[i];
          if (o.owner !== m && prev < o.s && m.s >= o.s && Math.abs(o.lat - m.lat) < 5) { hit(m, 'oil'); scene.remove(o.mesh); oils.splice(i, 1); }
        }
      }
      placeMarble(m, ds, now);
      if (now < m.nitroUntil) emit(m.group.position, pick([0x5ad1ff, 0xffffff, 0x8a7dff]), 2, 4, 0.45, 0.9);
      if (!m.finished && m.s >= FINISH && phase === 'race') finishMarble(m);
    } else if (phase === 'lobby' || phase === 'countdown') {
      placeMarble(m, 0, now);
      m.group.position.y += Math.sin(t * 3 + m.ph) * 0.3;
    }
  }
  for (let i = oils.length - 1; i >= 0; i--) if (now > oils[i].until) { scene.remove(oils[i].mesh); oils.splice(i, 1); }

  for (const o of obstacles) o.arm.rotation.y += dt * 1.6;
  for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) { scene.remove(bolts[i].line); bolts.splice(i, 1); } }
  updateMissiles(dt);
  updateParticles(dt);

  // Camera: high chase cam that widens with the spread of the leading pack
  const ord = ordered();
  let focus = null;
  if (camFocus && now < camFocus.until && marbles.has(camFocus.m.user.id)) focus = camFocus.m;
  else { camFocus = null; focus = ord[0]; }
  if ((phase === 'race' || phase === 'result') && focus) {
    let head = focus.s, tail = focus.s;
    if (!camFocus) {
      // Frame the busiest 120-unit stretch of track (the main pack), not just the leader
      const ss = racing().map(m => m.s).sort((a, b) => a - b);
      if (ss.length) {
        let best = 0, j = 0;
        for (let i = 0; i < ss.length; i++) {
          while (ss[i] - ss[j] > 120) j++;
          if (i - j + 1 >= best) { best = i - j + 1; head = ss[i]; tail = ss[j]; }
        }
      }
    }
    const span = head - tail;
    posAt(tail - 32 - span * 0.15, 0, 26 + span * 0.3, tmpV);
    posAt((head + tail) / 2 + 12, 0, 0, tmpL);
  } else {
    posAt(-52, 0, 24, tmpV); posAt(-12, 0, 0, tmpL);
  }
  camPos.lerp(tmpV, 0.08);
  camLook.lerp(tmpL, 0.12);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  composer.render();
  updateLabels(ord);
  if (now - lastRank > 250) { lastRank = now; updateRank(ord); }
  requestAnimationFrame(loop);
}

const proj = new THREE.Vector3();
function toScreen(v) {
  proj.copy(v).project(camera);
  return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H, visible: proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 };
}
function updateLabels(ord) {
  const leader = ord[0];
  const list = [...marbles.values()].map(m => ({ m, d: m.group.position.distanceTo(camera.position) })).sort((a, b) => a.d - b.d);
  list.forEach(({ m }, i) => {
    const sp = toScreen(tmpV.copy(m.group.position).addScaledVector(UP, R + 1.4));
    const show = sp.visible && (i < 16 || m === leader);
    m.label.style.display = show ? '' : 'none';
    if (show) { m.label.style.left = sp.x + 'px'; m.label.style.top = sp.y + 'px'; m.label.classList.toggle('lead', m === leader && phase !== 'lobby'); }
  });
}
function updateRank(ord) {
  $('#rank').innerHTML = ord.slice(0, 5).map(m => `<li>${esc(m.user.nickname)}${m.finished ? '<span>🏁</span>' : ''}</li>`).join('');
}
function fxText(pos3, text, color) {
  const sp = toScreen(tmpL.copy(pos3).addScaledVector(UP, R + 3));
  if (!sp.visible) return;
  const e = document.createElement('div');
  e.className = 'fx-text'; e.textContent = text; e.style.color = color;
  e.style.left = sp.x + 'px'; e.style.top = sp.y + 'px';
  e.addEventListener('animationend', () => e.remove());
  $('#labels').appendChild(e);
}
requestAnimationFrame(loop);
bigText('参加受付！');

// ---------- Banner ----------
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

// ---------- Event handlers ----------
function joinLobby(user) {
  if (phase !== 'lobby' || marbles.has(user.id)) return null;
  const slot = lobbySlot(marbles.size);
  return addMarble(user, slot.s, slot.lat);
}
function joinLate(user) {
  const minS = Math.min(...racing().map(m => m.s), FINISH - 40);
  const m = addMarble(user, Math.max(0, minS - 6), rand(-4, 4));
  if (m) { m.speed = BASE_SPEED; fxText(m.group.position, '途中参加！', '#7dff9a'); }
  return m;
}

// Gift tiers (diamonds x count): every tier maps to one fixed effect, no randomness
const TIERS = [
  { min: 1000, icon: '🌀', cls: 't4' },
  { min: 500, icon: '⚡', cls: 't4' },
  { min: 100, icon: '🛡️', cls: 't3' },
  { min: 30, icon: '🚀', cls: 't2' },
  { min: 5, icon: '🛢️', cls: 't1' },
  { min: 1, icon: '🔥', cls: 't1' },
];
function onGift(e) {
  const total = (e.diamonds || 1) * (e.count || 1);
  const tier = TIERS.find(x => total >= x.min);
  const now = performance.now();
  let m = marbles.get(e.user.id);
  let what = 'ありがとう！';
  if (!m && phase === 'lobby') { m = joinLobby(e.user); what = '参加！'; }
  else if (!m && phase === 'race') { m = joinLate(e.user); what = '途中参加！'; }
  if (m && phase === 'race' && !m.finished) {
    if (tier.min === 1) { m.nitroUntil = Math.max(now, m.nitroUntil) + 2000; what = '🔥 ニトロ 2秒！'; fxText(m.group.position, '🔥 ニトロ！', '#7fd8ff'); }
    if (tier.min === 5) { dropOil(m); what = '🛢️ 後ろにオイル！'; fxText(m.group.position, '🛢️ オイル！', '#cccccc'); }
    if (tier.min === 30) { const tg = fireMissile(m); what = tg ? `🚀 ${tg.user.nickname} にミサイル！` : '🚀 ミサイル！'; }
    if (tier.min === 100) { addShield(m); m.nitroUntil = Math.max(now, m.nitroUntil) + 3000; what = '🛡️ バリア＋ニトロ3秒！'; fxText(m.group.position, '🛡️ バリア！', '#9be8ff'); }
    if (tier.min === 500) {
      const victims = racing().filter(x => x !== m).sort((a, b) => b.s - a.s).slice(0, 3);
      victims.forEach((v, i) => setTimeout(() => hit(v, 'bolt', m), i * 250));
      flashScreen();
      if (victims[0]) camFocus = { m: victims[0], until: now + 1600 };
      what = '⚡ 上位3人に落雷！！';
    }
    if (tier.min === 1000) {
      emit(m.group.position, 0xb388ff, 50, 25, 0.8, 1.2);
      m.s = Math.min(FINISH - 15, m.s + L * 0.12);
      placeMarble(m, 0, now);
      addShield(m);
      emit(m.group.position, 0xb388ff, 60, 25, 0.9, 1.3);
      camFocus = { m, until: now + 1800 };
      fxText(m.group.position, '🌀 ワープ！', '#d0b3ff');
      what = '🌀 ワープ＋バリア！！';
    }
  }
  banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)}×${e.count} → ${esc(what)}</div></div><div class="ic">${tier.icon}</div>`,
    tier.cls, tier.min >= 100 ? 3000 : 1800, tier.min >= 500);
}

function onChat(e) {
  if (phase === 'lobby') { joinLobby(e.user); return; }
  const m = marbles.get(e.user.id);
  if (!m || phase !== 'race' || m.finished) return;
  const now = performance.now();
  if (/ジャンプ|じゃんぷ|jump|^j$/.test(norm(e.text || '')) && now - m.jumpAt > 3000) {
    m.jumpAt = now;
    fxText(m.group.position, 'ジャンプ！', '#ffffff');
  }
}

const handlers = {
  chat: onChat,
  gift: onGift,
  like: e => { const m = marbles.get(e.user.id); if (m && phase === 'race') m.likeUntil = performance.now() + 700; },
  join: () => {}, share: () => {},
  follow: e => banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">フォローありがとう！</div></div>`, '', 2000),
  config: e => { if (e.lobby && !params.get('lobby')) { LOBBY_SEC = e.lobby; if (phase === 'lobby') phaseEnd = Math.min(phaseEnd, performance.now() + LOBBY_SEC * 1000); } },
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

window.race = { emit: e => handlers[e.type]?.(e), start: () => { phaseEnd = performance.now(); } };
