(() => {
  const W = 1080, H = 1920;
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  const params = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  let LOBBY_SEC = Math.max(5, Number(params.get('lobby')) || 20);
  const BATTLE_SEC = Math.max(20, Number(params.get('battle')) || 60);
  const MAX_PLAYERS = 40;
  const PLAT = { x: 540, y: 1150, w: 780, h: 40, minW: 260 };
  const DEATH_Y = 1480;

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
  function fillAvatar(box, user) {
    if (!box) return;
    const fallback = () => { box.textContent = initials(user.nickname); };
    if (!user.avatar || !/^https?:\/\//.test(user.avatar)) return fallback();
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = fallback;
    img.src = user.avatar;
    box.replaceChildren(img);
  }

  // ---------- Physics world ----------
  const engine = Engine.create();
  engine.gravity.y = 1.1;
  let platform, platW, platAngle = 0, platTarget = 0;
  function buildPlatform() {
    if (platform) Composite.remove(engine.world, platform);
    platW = PLAT.w; platAngle = 0; platTarget = 0;
    platform = Bodies.rectangle(PLAT.x, PLAT.y, PLAT.w, PLAT.h, { isStatic: true, friction: 0.6, label: 'platform' });
    Composite.add(engine.world, platform);
  }
  function setPlatWidth(w) {
    w = Math.max(PLAT.minW, w);
    if (Math.abs(w - platW) < 0.5) return;
    Body.setAngle(platform, 0);
    Body.scale(platform, w / platW, 1);
    Body.setAngle(platform, platAngle);
    platW = w;
  }
  buildPlatform();

  // ---------- Players ----------
  const players = new Map(); // id -> player (current round)
  const stats = new Map();   // id -> { user, wins, kills }
  const avatars = new Map(); // url -> Image
  function avatarImg(user) {
    if (!user.avatar || !/^https?:\/\//.test(user.avatar)) return null;
    let img = avatars.get(user.avatar);
    if (!img) {
      img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = user.avatar;
      avatars.set(user.avatar, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  function stat(user) {
    let s = stats.get(user.id);
    if (!s) { s = { user, wins: 0, kills: 0 }; stats.set(user.id, s); }
    s.user = user;
    return s;
  }

  const BASE_R = 44;
  function spawn(user, fromSky) {
    let p = players.get(user.id);
    if (p && p.alive) return p;
    if (!p && players.size >= MAX_PLAYERS) return null;
    const x = PLAT.x + rand(-platW / 2 + 60, platW / 2 - 60);
    const body = Bodies.circle(x, fromSky ? 380 : rand(420, 600), BASE_R, { restitution: 0.55, friction: 0.08, frictionAir: 0.012, density: 0.002, label: 'ball' });
    body.plugin.uid = user.id;
    Composite.add(engine.world, body);
    if (!p) { p = { user, kills: 0 }; players.set(user.id, p); }
    Object.assign(p, { user, body, alive: true, r: BASE_R, bigUntil: 0, heavyUntil: 0, lastHitBy: null, lastHitAt: 0, cmdAt: 0, trail: [], hue: hash(user.id) % 360 });
    stat(user);
    updateCounts();
    return p;
  }
  function aliveList() { return [...players.values()].filter(p => p.alive); }
  function updateCounts() {
    $('#alive').textContent = aliveList().length;
    $('#total').textContent = players.size;
  }

  function eliminate(p) {
    p.alive = false;
    Composite.remove(engine.world, p.body);
    const killer = p.lastHitBy && Date.now() - p.lastHitAt < 5000 ? players.get(p.lastHitBy) : null;
    if (phase === 'battle') {
      if (killer && killer !== p) {
        killer.kills++; stat(killer.user).kills++;
        feed(`<b>${esc(killer.user.nickname)}</b> が ${esc(p.user.nickname)} を場外へ！`);
      } else {
        feed(`${esc(p.user.nickname)} が自滅…`);
      }
      floatText(Math.min(980, Math.max(100, p.body.position.x)), 1400, `脱落！ ${p.user.nickname}`, '#ff6b6b');
      burst(Math.min(1060, Math.max(20, p.body.position.x)), 1440, 30, 20);
      updateCounts();
      if (aliveList().length <= 1) endRound();
    } else {
      // Lobby: falling off just respawns
      setTimeout(() => { if (phase === 'lobby') spawn(p.user, true); }, 600);
    }
  }

  // Track who hit whom
  Events.on(engine, 'collisionStart', ev => {
    for (const { bodyA, bodyB } of ev.pairs) {
      if (bodyA.label !== 'ball' || bodyB.label !== 'ball') continue;
      const rv = Math.hypot(bodyA.velocity.x - bodyB.velocity.x, bodyA.velocity.y - bodyB.velocity.y);
      if (rv < 5) continue;
      const a = players.get(bodyA.plugin.uid), b = players.get(bodyB.plugin.uid);
      if (!a || !b) continue;
      const now = Date.now();
      // The faster ball gets the credit
      const sa = Math.hypot(bodyA.velocity.x, bodyA.velocity.y), sb = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
      if (sa >= sb) { b.lastHitBy = a.user.id; b.lastHitAt = now; } else { a.lastHitBy = b.user.id; a.lastHitAt = now; }
      sparks((bodyA.position.x + bodyB.position.x) / 2, (bodyA.position.y + bodyB.position.y) / 2, Math.min(24, rv * 1.5));
      if (rv > 14) shake(6);
    }
  });

  // ---------- Effects ----------
  const particles = [];
  function sparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(3, 12);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: pick(['#fff', '#ffd23f', '#00f0ff', '#ff2e88']), size: rand(2, 5) });
    }
  }
  function burst(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), v = rand(4, speed);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: pick(['#ff4d00', '#ffd23f', '#ff2e88']), size: rand(3, 8) });
    }
  }
  let shakeAmt = 0;
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
  let slowUntil = 0;
  function slowmo(ms) { slowUntil = performance.now() + ms; $('#slowmo').classList.add('on'); setTimeout(() => $('#slowmo').classList.remove('on'), ms); }
  const floats = [];
  function floatText(x, y, text, color) { floats.push({ x, y, text, color, life: 1 }); }
  function bigText(t) { const b = $('#big'); b.textContent = t; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  function feed(html) {
    const ul = $('#feed');
    const li = document.createElement('li');
    li.innerHTML = html;
    ul.prepend(li);
    while (ul.children.length > 5) ul.lastChild.remove();
  }

  const bombs = [];   // falling bombs { x, y, vy, target, owner }
  const meteors = []; // meteor bodies

  function explode(x, y, ownerId) {
    const R = 420;
    for (const p of aliveList()) {
      if (p.user.id === ownerId) continue;
      const dx = p.body.position.x - x, dy = p.body.position.y - y;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const k = (1 - d / R);
      const nx = dx / (d || 1), ny = dy / (d || 1);
      Body.setVelocity(p.body, { x: p.body.velocity.x + nx * 34 * k, y: p.body.velocity.y + (ny - 0.9) * 30 * k });
      p.lastHitBy = ownerId; p.lastHitAt = Date.now();
    }
    for (let i = 0; i < 90; i++) {
      const a = rand(0, Math.PI * 2), v = rand(6, 26);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: pick(['#fff', '#ffd23f', '#ff4d00', '#ff2e88']), size: rand(4, 10) });
    }
    flashUntil = performance.now() + 180;
    shake(26);
    slowmo(1300);
  }
  let flashUntil = 0;

  // ---------- Gift actions ----------
  function nearestEnemy(p) {
    let best = null, bd = Infinity;
    for (const q of aliveList()) {
      if (q === p) continue;
      const d = Math.hypot(q.body.position.x - p.body.position.x, q.body.position.y - p.body.position.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  function dash(p) {
    const t = nearestEnemy(p);
    const dir = t ? Math.sign(t.body.position.x - p.body.position.x) || 1 : (p.body.position.x < PLAT.x ? 1 : -1);
    Body.setVelocity(p.body, { x: dir * 26, y: -8 });
    p.trailBoost = performance.now() + 700;
  }
  function grow(p) {
    if (performance.now() < p.bigUntil) { p.bigUntil += 10000; return; }
    Body.scale(p.body, 1.7, 1.7);
    p.r = BASE_R * 1.7;
    p.bigUntil = performance.now() + 10000;
  }
  function dropBomb(owner) {
    const targets = aliveList().filter(p => p.user.id !== owner.id);
    const t = targets.length ? pick(targets) : null;
    bombs.push({ x: t ? t.body.position.x : PLAT.x, y: 300, vy: 0, target: t, owner: owner.id });
  }
  function dropMeteor(owner) {
    const x = PLAT.x + rand(-platW / 3, platW / 3);
    const m = Bodies.circle(x, 250, 120, { density: 0.03, restitution: 0.2, frictionAir: 0, label: 'meteor' });
    m.plugin.owner = owner.id;
    Body.setVelocity(m, { x: rand(-3, 3), y: 18 });
    Composite.add(engine.world, m);
    meteors.push(m);
    platTarget = rand(0.18, 0.28) * (Math.random() < 0.5 ? -1 : 1);
    setTimeout(() => { platTarget = 0; }, 5000);
  }

  // ---------- Round flow ----------
  let phase = 'lobby';
  let phaseEnd = Date.now() + LOBBY_SEC * 1000;
  let nextGust = 0;

  function startBattle() {
    if (aliveList().length < 2) { phaseEnd = Date.now() + 10000; return; }
    phase = 'battle';
    phaseEnd = Date.now() + BATTLE_SEC * 1000;
    nextGust = Date.now() + 12000;
    bigText('FIGHT!');
    shake(12);
  }

  function endRound() {
    if (phase !== 'battle') return;
    phase = 'result';
    let winner = aliveList();
    if (winner.length > 1) winner.sort((a, b) => Math.abs(a.body.position.x - PLAT.x) - Math.abs(b.body.position.x - PLAT.x));
    winner = winner[0];
    const res = $('#result');
    if (winner) {
      const s = stat(winner.user); s.wins++;
      res.innerHTML = `<div class="crown">👑</div><div class="av"></div><h1>王者</h1><div class="name">${esc(winner.user.nickname)}</div><div class="stats">撃墜 ${winner.kills} ・ 通算優勝 ${s.wins}回</div>`;
      fillAvatar(res.querySelector('.av'), winner.user);
    } else {
      res.innerHTML = '<h1>全滅！</h1><div class="stats">勝者なし…</div>';
    }
    res.classList.add('on');
    updateBoard();
    setTimeout(resetRound, 6500);
  }

  function resetRound() {
    $('#result').classList.remove('on');
    for (const p of players.values()) if (p.alive) Composite.remove(engine.world, p.body);
    for (const m of meteors) Composite.remove(engine.world, m);
    meteors.length = 0; bombs.length = 0;
    players.clear();
    buildPlatform();
    updateCounts();
    phase = 'lobby';
    phaseEnd = Date.now() + LOBBY_SEC * 1000;
    bigText('参戦受付！');
  }

  function updateBoard() {
    const top = [...stats.values()].filter(s => s.wins || s.kills).sort((a, b) => (b.wins - a.wins) || (b.kills - a.kills)).slice(0, 3);
    $('#board').innerHTML = top.map(s => `<li>${esc(s.user.nickname)}<span>👑${s.wins} 💥${s.kills}</span></li>`).join('');
  }

  // ---------- Main loop ----------
  const ctx = $('#world').getContext('2d');
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(33, now - last); last = now;
    const slow = now < slowUntil;
    Engine.update(engine, dt * (slow ? 0.25 : 1));

    // Platform tilt easing
    if (Math.abs(platTarget - platAngle) > 0.001) { platAngle += (platTarget - platAngle) * 0.05; Body.setAngle(platform, platAngle); }

    // Phase timers
    const left = Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000));
    const chip = $('#phase');
    if (phase === 'lobby') {
      chip.innerHTML = `参戦受付中 <b>${left}</b>`;
      chip.classList.toggle('hot', left <= 5);
      if (left === 0) startBattle();
    } else if (phase === 'battle') {
      chip.innerHTML = `バトル中 <b>${left}</b>`;
      chip.classList.toggle('hot', left <= 15);
      const t = 1 - (phaseEnd - Date.now()) / (BATTLE_SEC * 1000);
      // Platform shrinks over time, faster in the last 15 seconds
      setPlatWidth(PLAT.w - (PLAT.w - PLAT.minW) * Math.min(1, t < 0.75 ? t * 0.6 : 0.45 + (t - 0.75) * 2.2));
      if (Date.now() > nextGust) {
        nextGust = Date.now() + rand(9000, 14000);
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (const p of aliveList()) Body.setVelocity(p.body, { x: p.body.velocity.x + dir * rand(6, 10), y: p.body.velocity.y - 3 });
        floatText(540, 900, dir > 0 ? '突風 →→→' : '←←← 突風', '#9ff');
      }
      if (left === 0) endRound();
    } else {
      chip.innerHTML = '<b>決着！</b>';
    }

    // Shrink expired giants
    for (const p of aliveList()) {
      if (p.bigUntil && now > p.bigUntil) { Body.scale(p.body, 1 / 1.7, 1 / 1.7); p.r = BASE_R; p.bigUntil = 0; }
      if (p.body.position.y > DEATH_Y || p.body.position.x < -150 || p.body.position.x > W + 150) eliminate(p);
    }
    // Bombs fall and explode on contact height
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      if (b.target && b.target.alive) b.x += (b.target.body.position.x - b.x) * 0.08;
      b.vy += 0.9 * (slow ? 0.25 : 1); b.y += b.vy * (slow ? 0.25 : 1);
      const ty = b.target && b.target.alive ? b.target.body.position.y : PLAT.y - 40;
      if (b.y >= ty - 20) { bombs.splice(i, 1); explode(b.x, b.y, b.owner); }
    }
    // Meteors: knock-back credit and cleanup
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      for (const p of aliveList()) {
        if (Math.hypot(p.body.position.x - m.position.x, p.body.position.y - m.position.y) < 120 + p.r + 4 && p.user.id !== m.plugin.owner) { p.lastHitBy = m.plugin.owner; p.lastHitAt = Date.now(); }
      }
      if (!m.plugin.landed && m.position.y > PLAT.y - 200) { m.plugin.landed = true; shake(30); burst(m.position.x, PLAT.y - 20, 60, 22); }
      if (m.position.y > 2100) { Composite.remove(engine.world, m); meteors.splice(i, 1); }
    }

    render(now, slow);
    requestAnimationFrame(loop);
  }

  function render(now, slow) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeAmt > 0.3) { ctx.translate(rand(-shakeAmt, shakeAmt), rand(-shakeAmt, shakeAmt)); shakeAmt *= 0.88; }

    // Platform
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y);
    ctx.rotate(platAngle);
    const g = ctx.createLinearGradient(0, -PLAT.h / 2, 0, PLAT.h / 2);
    g.addColorStop(0, '#5ef6ff'); g.addColorStop(0.5, '#2a1a6e'); g.addColorStop(1, '#120638');
    ctx.fillStyle = g;
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 30;
    roundRect(-platW / 2, -PLAT.h / 2, platW, PLAT.h, 14); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();

    // Trails
    for (const p of aliveList()) {
      const sp = Math.hypot(p.body.velocity.x, p.body.velocity.y);
      p.trail.push({ x: p.body.position.x, y: p.body.position.y });
      if (p.trail.length > (sp > 12 || now < (p.trailBoost || 0) ? 10 : 0)) p.trail.shift();
      if (p.trail.length > 10) p.trail.splice(0, p.trail.length - 10);
      p.trail.forEach((t, i) => {
        ctx.globalAlpha = (i / p.trail.length) * 0.35;
        ctx.fillStyle = `hsl(${p.hue},90%,60%)`;
        ctx.beginPath(); ctx.arc(t.x, t.y, p.r * (0.5 + i / 20), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Balls
    for (const p of aliveList()) {
      const { x, y } = p.body.position;
      const r = p.r;
      ctx.save();
      ctx.translate(x, y);
      if (p.bigUntil) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 40; }
      ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = p.bigUntil ? '#ffd23f' : `hsl(${p.hue},90%,60%)`; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.rotate(p.body.angle);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
      const img = avatarImg(p.user);
      if (img) ctx.drawImage(img, -r, -r, r * 2, r * 2);
      else { ctx.fillStyle = '#eee'; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.fillStyle = '#333'; ctx.font = `900 ${r}px 'M PLUS Rounded 1c'`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initials(p.user.nickname), 0, 2); }
      ctx.restore();
      // Name tag
      const name = p.user.nickname.length > 8 ? p.user.nickname.slice(0, 8) + '…' : p.user.nickname;
      ctx.font = "900 22px 'M PLUS Rounded 1c'";
      const tw = ctx.measureText(name).width + 18;
      ctx.fillStyle = 'rgba(10,0,30,.8)';
      roundRect(-tw / 2, -r - 40, tw, 30, 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, 0, -r - 24);
      ctx.restore();
    }

    // Meteors
    for (const m of meteors) {
      ctx.save();
      ctx.translate(m.position.x, m.position.y);
      ctx.shadowColor = '#ff4d00'; ctx.shadowBlur = 60;
      const mg = ctx.createRadialGradient(-30, -30, 10, 0, 0, 120);
      mg.addColorStop(0, '#ffd23f'); mg.addColorStop(0.4, '#ff4d00'); mg.addColorStop(1, '#5a1a00');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (!m.plugin.landed) for (let k = 0; k < 3; k++) particles.push({ x: m.position.x + rand(-60, 60), y: m.position.y - 100, vx: rand(-2, 2), vy: rand(-6, -2), life: 0.8, color: pick(['#ff4d00', '#ffd23f']), size: rand(4, 10) });
    }
    // Bombs
    for (const b of bombs) {
      ctx.font = '90px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💣', b.x, b.y);
      if (b.target && b.target.alive) {
        ctx.strokeStyle = 'rgba(255,60,60,.9)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(b.target.body.position.x, b.target.body.position.y, b.target.r + 22 + Math.sin(now / 80) * 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Particles
    const k = slow ? 0.25 : 1;
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.vy += 0.35 * k; q.x += q.vx * k; q.y += q.vy * k; q.life -= 0.022 * k;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = q.life; ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    if (particles.length > 900) particles.splice(0, particles.length - 900);

    // Floating texts
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.y -= 1.2; f.life -= 0.012;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = "900 44px 'M PLUS Rounded 1c'"; ctx.textAlign = 'center';
      ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (now < flashUntil) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(0, 0, W, H); }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  requestAnimationFrame(loop);
  bigText('参戦受付！');

  // ---------- Banner queue ----------
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
  function control(p, t) {
    const now = Date.now();
    if (now - p.cmdAt < 700) return false;
    if (/^(左|ひだり|←|l)$/.test(t)) Body.setVelocity(p.body, { x: p.body.velocity.x - 9, y: p.body.velocity.y - 2 });
    else if (/^(右|みぎ|→|r)$/.test(t)) Body.setVelocity(p.body, { x: p.body.velocity.x + 9, y: p.body.velocity.y - 2 });
    else if (/^(ジャンプ|じゃんぷ|jump|j|↑)$/.test(t)) Body.setVelocity(p.body, { x: p.body.velocity.x, y: -16 });
    else return false;
    p.cmdAt = now;
    return true;
  }

  function onChat(e) {
    const t = norm(e.text || '');
    const p = players.get(e.user.id);
    if (p && p.alive) { control(p, t); return; }
    if (phase === 'lobby') spawn(e.user, false);
  }

  function onGift(e) {
    const total = (e.diamonds || 1) * (e.count || 1);
    const tier = total >= 500 ? 4 : total >= 100 ? 3 : total >= 10 ? 2 : 1;
    let p = players.get(e.user.id);
    let what;
    const canPlay = phase === 'lobby' || phase === 'battle';
    if (canPlay && (!p || !p.alive)) {
      p = spawn(e.user, true);
      what = phase === 'battle' ? '空から途中参戦！' : '参戦！';
      if (p && phase === 'battle') floatText(p.body.position.x, 420, '復活！', '#7dff9a');
    }
    if (phase === 'battle' && p && p.alive) {
      if (tier === 1 && !what) { dash(p); what = '体当たり！'; }
      if (tier === 2) { grow(p); what = '巨大化！'; }
      if (tier === 3) { dropBomb(e.user); what = '💣 爆弾投下！'; }
      if (tier === 4) { dropMeteor(e.user); what = '☄️ 隕石落下！！'; }
    }
    if (!what) what = 'ありがとう！';
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)}×${e.count} → ${what}</div></div><div class="ic">${['🌹', '🍩', '💣', '☄️'][tier - 1]}</div>`,
      't' + tier, tier >= 3 ? 3200 : 2000, tier >= 3);
  }

  function onLike(e) {
    const p = players.get(e.user.id);
    if (p && p.alive && Date.now() - (p.likeAt || 0) > 500) {
      p.likeAt = Date.now();
      Body.setVelocity(p.body, { x: p.body.velocity.x + rand(-3, 3), y: Math.min(p.body.velocity.y, -9) });
    }
  }

  const handlers = {
    chat: onChat, gift: onGift, like: onLike,
    join: () => {}, share: () => {},
    follow: e => banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">フォローありがとう！</div></div>`, '', 2000),
    config: e => { if (e.lobby && !params.get('lobby')) LOBBY_SEC = e.lobby; },
  };

  // ---------- WebSocket ----------
  const status = $('#status');
  function connect() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => status.classList.remove('show');
    ws.onmessage = m => {
      let e; try { e = JSON.parse(m.data); } catch { return; }
      if (e.user && !e.user.id) return;
      handlers[e.type]?.(e);
    };
    ws.onclose = () => { status.textContent = 'サーバーに再接続中…'; status.classList.add('show'); setTimeout(connect, 2000); };
  }
  connect();

  window.battle = { emit: e => handlers[e.type]?.(e), start: () => { phaseEnd = Date.now(); } };
})();
