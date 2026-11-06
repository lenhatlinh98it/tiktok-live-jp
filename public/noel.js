(() => {
  const W = 1080, H = 1920;
  const params = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  const GOAL0 = Math.max(10, Number(params.get('goal')) || 1000);
  if (params.get('title')) $('.title').textContent = params.get('title');

  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function initials(n) { return (n || '?').trim().charAt(0).toUpperCase(); }
  function fillAvatar(box, user) {
    const fallback = () => { box.textContent = initials(user.nickname); };
    if (!user.avatar || !/^https?:\/\//.test(user.avatar)) return fallback();
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = fallback;
    img.src = user.avatar;
    box.replaceChildren(img);
  }

  // ---------- Countdown chip ----------
  (function countdown() {
    const now = new Date();
    let xmas = new Date(now.getFullYear(), 11, 25);
    if (now > new Date(now.getFullYear(), 11, 26)) xmas = new Date(now.getFullYear() + 1, 11, 25);
    const days = Math.ceil((xmas - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    $('#countdown').innerHTML = days === 0 ? '🎄 <b>Merry Christmas!</b>' : days === 1 ? '🎅 <b>Đêm Giáng Sinh</b>' : `⛄ Còn <b>${days}</b> ngày tới Giáng Sinh`;
  })();

  // ---------- Tree ----------
  const TIERS = [
    { top: 840, bottom: 1300, hw: 440 },
    { top: 650, bottom: 1080, hw: 365 },
    { top: 470, bottom: 850, hw: 285 },
    { top: 300, bottom: 620, hw: 190 },
  ];
  function tierPath(t) {
    const n = Math.max(3, Math.round(t.hw / 60));
    let d = `M540,${t.top} L${540 + t.hw},${t.bottom}`;
    const step = (2 * t.hw) / n;
    for (let i = 0; i < n; i++) {
      const x1 = 540 + t.hw - step * (i + 1);
      d += ` Q${x1 + step / 2},${t.bottom + 26} ${x1},${t.bottom}`;
    }
    return d + 'Z';
  }
  $('#tree').innerHTML = TIERS.map(t => `<path d="${tierPath(t)}" fill="url(#leaf)" stroke="#0a3520" stroke-width="3"/>`).join('');
  function halfWidthAt(y) {
    let hw = 0;
    for (const t of TIERS) if (y >= t.top && y <= t.bottom) hw = Math.max(hw, t.hw * (y - t.top) / (t.bottom - t.top));
    return hw;
  }

  // Garland lights
  const BULB_COLORS = ['#ff4d6d', '#ffd166', '#4cc9f0', '#80ed99', '#f72585', '#ffffff'];
  const bulbs = [];
  {
    let svg = '';
    TIERS.slice().reverse().forEach((t, ti) => {
      const y0 = t.bottom - 70 - ti * 4;
      const hw = halfWidthAt(y0) - 10;
      const n = Math.round((2 * hw) / 42);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push([540 - hw + 2 * hw * u, y0 - 30 + Math.sin(Math.PI * u) * 46 + u * 40]);
      }
      svg += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#0a2a18" stroke-width="2.5"/>`;
      pts.forEach((p, i) => {
        const c = BULB_COLORS[(i + ti) % BULB_COLORS.length];
        svg += `<circle class="bulb" data-c="${c}" cx="${p[0]}" cy="${p[1] + 6}" r="8" fill="#3a3f47" style="color:${c};animation-delay:${(Math.random() * -1.4).toFixed(2)}s"/>`;
      });
    });
    $('#garland').innerHTML = svg;
    bulbs.push(...document.querySelectorAll('.bulb'));
    bulbs.sort(() => Math.random() - 0.5);
  }
  function setLights(frac) {
    const n = Math.round(bulbs.length * Math.min(1, frac));
    bulbs.forEach((b, i) => {
      const on = i < n;
      b.classList.toggle('lit', on);
      b.setAttribute('fill', on ? b.dataset.c : '#3a3f47');
    });
  }

  // Ornament slots inside the tree silhouette
  const slots = [];
  for (let y = 430, row = 0; y <= 1220; y += 92, row++) {
    const hw = halfWidthAt(y + 60) - 55;
    if (hw < 0) continue;
    const n = Math.floor((2 * hw) / 100) + 1;
    const step = n > 1 ? (2 * hw) / (n - 1) : 0;
    for (let i = 0; i < n; i++) slots.push({ x: n > 1 ? 540 - hw + step * i : 540, y, taken: null });
  }

  // ---------- State ----------
  const ORN_COLORS = ['#d7263d', '#1f9e5a', '#2f80ed', '#c13ae0', '#ff8c1a', '#e0e0e0'];
  const ornaments = new Map(); // id -> { user, el, slot, lastActive, vip }
  const skaters = new Map();   // id -> skater
  const merit = new Map();
  const MAX_SKATERS = 14;
  let acc = 0, goal = GOAL0, level = 0, celebrating = false;

  function updateCount() { $('#count').textContent = ornaments.size; }
  function updateProgress() {
    $('#bar').style.width = Math.min(100, (acc / goal) * 100) + '%';
    $('#ptext').textContent = `${acc} / ${goal} 💎`;
    $('#lvl').textContent = level ? `Đã thắp sáng ${level} lần ✨` : '';
    if (!celebrating) setLights(acc / goal);
  }

  // ---------- Ornaments ----------
  function addOrnament(user) {
    let o = ornaments.get(user.id);
    if (o) { o.lastActive = Date.now(); return o; }
    let free = slots.filter(s => !s.taken);
    if (!free.length) {
      const old = [...ornaments.values()].sort((a, b) => (a.vip - b.vip) || (a.lastActive - b.lastActive))[0];
      if (old) removeOrnament(old);
      free = slots.filter(s => !s.taken);
    }
    if (!free.length) return null;
    const slot = pick(free);
    const el = document.createElement('div');
    el.className = 'orn';
    el.innerHTML = `<div class="swing" style="--c:${pick(ORN_COLORS)};animation-delay:${rand(-3, 0).toFixed(2)}s"><div class="cap"></div><div class="ball"></div><div class="nm">${esc(user.nickname)}</div></div>`;
    fillAvatar(el.querySelector('.ball'), user);
    el.style.transform = `translate(540px, 1750px) scale(.3)`;
    $('#ornaments').appendChild(el);
    el.getBoundingClientRect();
    el.style.transform = `translate(${slot.x}px, ${slot.y}px) scale(1)`;
    o = { user, el, slot, lastActive: Date.now(), vip: (merit.get(user.id)?.total || 0) >= 100 };
    if (o.vip) el.classList.add('vip');
    slot.taken = o;
    ornaments.set(user.id, o);
    updateCount();
    return o;
  }
  function removeOrnament(o) {
    o.slot.taken = null;
    ornaments.delete(o.user.id);
    o.el.classList.add('dropping');
    o.el.style.transform = `translate(${o.slot.x}px, ${o.slot.y + 400}px) scale(.5)`;
    setTimeout(() => o.el.remove(), 1300);
    updateCount();
  }
  function glowOrn(o) {
    if (!o) return;
    o.el.classList.remove('glow'); void o.el.offsetWidth; o.el.classList.add('glow');
  }

  // Wish cards attached to the user's ornament
  const cards = [];
  function wishCard(o, text) {
    if (!o) return;
    while (cards.length >= 4) closeCard(cards[0]);
    const right = o.slot.x <= 540;
    const pos = document.createElement('div');
    pos.style.cssText = `position:absolute;left:${o.slot.x + (right ? 50 : -50)}px;top:${o.slot.y + 10}px;transform:translateX(${right ? '0' : '-100%'})`;
    const c = document.createElement('div');
    c.className = 'card';
    c.style.setProperty('--ox', right ? '0%' : '100%');
    c.textContent = text.length > 70 ? text.slice(0, 68) + '…' : text;
    pos.appendChild(c);
    $('#cards').appendChild(pos);
    const item = { pos, c, timer: setTimeout(() => closeCard(item), 5000) };
    cards.push(item);
  }
  function closeCard(item) {
    const i = cards.indexOf(item);
    if (i < 0) return;
    cards.splice(i, 1);
    clearTimeout(item.timer);
    item.c.classList.add('out');
    setTimeout(() => item.pos.remove(), 400);
  }

  // ---------- Skaters ----------
  const RINK = { cx: 540, cy: 1650, rx: 400, ry: 150 };
  const COATS = ['#d7263d', '#1f9e5a', '#2f80ed', '#8e44ad', '#e67e22'];
  const skaterSVG = c => `<svg viewBox="0 0 80 100"><path d="M24,8 Q40,0 56,8 L66,62 L14,62Z" fill="${c}"/><rect x="12" y="58" width="56" height="8" rx="4" fill="#fff"/><path d="M26,6 Q40,14 54,6 L54,14 Q40,22 26,14Z" fill="#1f7a43"/><path d="M52,12 L60,34 L52,32Z" fill="#1f7a43"/><rect x="27" y="66" width="10" height="22" fill="#2b2d42"/><rect x="43" y="66" width="10" height="22" fill="#2b2d42"/><rect x="24" y="86" width="16" height="8" rx="3" fill="#fff"/><rect x="40" y="86" width="16" height="8" rx="3" fill="#fff"/><path d="M20,97 L42,97 M38,97 L60,97" stroke="#cfd8e3" stroke-width="3" stroke-linecap="round"/></svg>`;

  function addSkater(user) {
    let s = skaters.get(user.id);
    if (s) { s.lastActive = Date.now(); return s; }
    if (skaters.size >= MAX_SKATERS) {
      const old = [...skaters.values()].sort((a, b) => a.lastActive - b.lastActive)[0];
      removeSkater(old);
    }
    const el = document.createElement('div');
    el.className = 'skater arrive';
    el.innerHTML = `<div class="fig"><div class="hat"><i></i></div><div class="head"></div><div class="flipbox">${skaterSVG(pick(COATS))}</div></div><div class="nm">${esc(user.nickname)}</div>`;
    fillAvatar(el.querySelector('.head'), user);
    $('#skaters').appendChild(el);
    s = { user, el, flip: el.querySelector('.flipbox'), a: rand(0, Math.PI * 2), r: rand(0.55, 1), speed: rand(0.25, 0.45) * (Math.random() < 0.15 ? -1 : 1), lastActive: Date.now() };
    skaters.set(user.id, s);
    return s;
  }
  function removeSkater(s) {
    skaters.delete(s.user.id);
    s.el.classList.add('gone');
    setTimeout(() => s.el.remove(), 800);
  }
  function spin(s) { if (!s) return; s.el.classList.remove('spin'); void s.el.offsetWidth; s.el.classList.add('spin'); }

  // ---------- Effects ----------
  const fx = $('#fx');
  function floatAt(x, y, emoji, n) {
    for (let i = 0; i < n; i++) setTimeout(() => {
      const e = document.createElement('div');
      e.className = 'float'; e.textContent = emoji;
      e.style.left = (x - 16) + 'px'; e.style.top = y + 'px';
      e.style.setProperty('--dx', rand(-60, 60) + 'px');
      e.addEventListener('animationend', () => e.remove());
      fx.appendChild(e);
    }, i * 110);
  }
  function skaterTop(s) { return s ? [s.x, s.y - 160 * s.scale] : null; }

  const presents = [];
  function dropPresent(tier) {
    const w = 40 + tier * 18 + rand(0, 15), h = w * rand(0.7, 1);
    const colors = [['#d7263d', '#ffd166'], ['#1f9e5a', '#ffffff'], ['#2f80ed', '#ffd166'], ['#c13ae0', '#ffffff'], ['#ffd166', '#d7263d']];
    const [bx, rb] = pick(colors);
    const g = document.createElement('div');
    g.className = 'gift';
    const x = rand(330, 750), y = rand(1310, 1370);
    g.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;--bx:${bx};--rb:${rb};z-index:${Math.round(y)}`;
    $('#presents').appendChild(g);
    presents.push(g);
    if (presents.length > 40) presents.shift().remove();
  }

  function sleigh() {
    const e = document.createElement('div');
    e.className = 'sleigh';
    e.textContent = '🦌🦌🛷🎅';
    e.addEventListener('animationend', () => e.remove());
    fx.appendChild(e);
  }

  // Canvases: snow (front) + fireworks (back)
  const snowCtx = $('#snow').getContext('2d');
  const fwCtx = $('#fireworks').getContext('2d');
  const flakes = [];
  let stormUntil = 0;
  const newFlake = top => ({ x: rand(0, W), y: top ? rand(-H, 0) : rand(0, H), r: rand(1.5, 4.5), vy: rand(40, 110), ph: rand(0, 6.28), extra: false });
  for (let i = 0; i < 140; i++) flakes.push(newFlake(false));
  function storm(sec, amount) {
    stormUntil = Math.max(stormUntil, performance.now() + sec * 1000);
    for (let i = 0; i < amount && flakes.length < 900; i++) flakes.push(Object.assign(newFlake(true), { extra: true, y: rand(-400, 0), vy: rand(150, 320) }));
  }

  const sparks = [];
  function firework(x, y) {
    const hue = pick([0, 45, 120, 200, 300, 340]);
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2), v = rand(120, 380);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: hue + rand(-15, 15) });
    }
  }
  function fireworkShow(n) {
    for (let i = 0; i < n; i++) setTimeout(() => firework(rand(150, 930), rand(350, 800)), i * 380);
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const stormy = now < stormUntil;
    const wind = stormy ? 160 : 20;

    // Snow
    snowCtx.clearRect(0, 0, W, H);
    snowCtx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.ph += dt; f.y += f.vy * dt; f.x += (Math.sin(f.ph) * 20 + wind) * dt;
      if (f.y > H || f.x > W + 20) {
        if (f.extra && !stormy) { flakes.splice(i, 1); continue; }
        f.y = rand(-40, -5); f.x = rand(-200, W);
      }
      snowCtx.beginPath(); snowCtx.arc(f.x, f.y, f.r, 0, 6.283); snowCtx.fill();
    }

    // Fireworks
    fwCtx.clearRect(0, 0, W, H);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.vy += 160 * dt; p.vx *= 0.985; p.vy *= 0.985;
      const px = p.x, py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.7;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      fwCtx.strokeStyle = `hsla(${p.hue},100%,65%,${p.life})`;
      fwCtx.lineWidth = 3;
      fwCtx.beginPath(); fwCtx.moveTo(px, py); fwCtx.lineTo(p.x, p.y); fwCtx.stroke();
    }

    // Skaters on an elliptical loop
    for (const s of skaters.values()) {
      s.a += s.speed * dt;
      const x = RINK.cx + Math.cos(s.a) * RINK.rx * s.r;
      const y = RINK.cy + Math.sin(s.a) * RINK.ry * s.r;
      const movingRight = -Math.sin(s.a) * s.speed > 0;
      s.x = x; s.y = y; s.scale = 0.8 + 0.35 * ((y - (RINK.cy - RINK.ry)) / (2 * RINK.ry));
      s.el.style.transform = `translate(${x}px, ${y}px) scale(${s.scale.toFixed(3)})`;
      s.el.style.zIndex = Math.round(y);
      s.flip.className = movingRight ? 'flipbox' : 'flipbox flip';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Banner queue ----------
  const queue = [];
  let showing = false;
  function banner(user, html, cls, ms) { queue.push({ user, html, cls, ms }); if (!showing) nextBanner(); }
  function nextBanner() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    const c = document.createElement('div');
    c.className = 'bn ' + (item.cls || '');
    c.innerHTML = item.html;
    const av = c.querySelector('.av');
    if (av && item.user) fillAvatar(av, item.user);
    $('#banner').replaceChildren(c);
    const ms = queue.length > 3 ? 1600 : item.ms;
    setTimeout(() => { c.classList.add('out'); setTimeout(nextBanner, 400); }, ms);
  }

  // ---------- Leaderboard ----------
  function addMerit(user, amount) {
    const m = merit.get(user.id) || { user, total: 0 };
    m.total += amount; m.user = user;
    merit.set(user.id, m);
    const top = [...merit.values()].sort((a, b) => b.total - a.total).slice(0, 3);
    $('#board').innerHTML = top.map(t => `<li>${esc(t.user.nickname)}<span>${t.total}💎</span></li>`).join('');
    const o = ornaments.get(user.id);
    if (o && m.total >= 100 && !o.vip) { o.vip = true; o.el.classList.add('vip'); }
  }

  // ---------- Goal ----------
  function addProgress(amount) {
    acc += amount;
    if (acc >= goal && !celebrating) {
      celebrating = true;
      acc -= goal; level++;
      setLights(1);
      $('#star').classList.add('lit');
      banner(null, `<div class="gimg">🎄</div><div><div class="who">CÂY THÔNG ĐÃ SÁNG!</div><div class="what">Cảm ơn cả nhà · Merry Christmas</div></div><div class="gimg">✨</div>`, 'goal', 5000);
      fireworkShow(14); storm(6, 400); sleigh();
      setTimeout(() => {
        celebrating = false;
        goal = Math.round(GOAL0 * (1 + level * 0.5));
        acc = Math.min(acc, goal - 1);
        updateProgress();
      }, 7000);
    }
    updateProgress();
  }

  // ---------- Event handlers ----------
  function touch(user) {
    const o = addOrnament(user);
    const s = addSkater(user);
    return { o, s };
  }

  function onJoin(user) {
    const isNew = !ornaments.has(user.id);
    const { o } = touch(user);
    if (isNew && o) setTimeout(() => glowOrn(o), 1600);
  }

  function onGift(e) {
    const total = (e.diamonds || 1) * (e.count || 1);
    const tier = total >= 1000 ? 4 : total >= 100 ? 3 : total >= 10 ? 2 : 1;
    addMerit(e.user, total);
    const { o, s } = touch(e.user);
    const gimg = /^https?:\/\//.test(e.giftImage || '') ? `<img class="gimg" src="${encodeURI(e.giftImage)}" referrerpolicy="no-referrer">` : '<div class="gimg">🎁</div>';
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">tặng ${e.count} × ${esc(e.giftName)}</div></div>${gimg}`, 'tier' + tier, tier >= 3 ? 4500 : 3000);
    glowOrn(o); spin(s);
    for (let i = 0; i < Math.min(tier, 3); i++) setTimeout(() => dropPresent(tier), i * 250);
    const top = skaterTop(s);
    if (top) floatAt(top[0], top[1], '🎁', 2 + tier);
    if (tier >= 2) storm(3, tier * 60);
    if (tier >= 3) fireworkShow(tier === 3 ? 3 : 8);
    if (tier >= 4) sleigh();
    addProgress(total);
  }

  function onChat(e) {
    const { o } = touch(e.user);
    if (e.text) wishCard(o, e.text);
  }

  function onLike(e) {
    const s = skaters.get(e.user.id);
    if (s) { s.lastActive = Date.now(); const t = skaterTop(s); floatAt(t[0], t[1], pick(['❤️', '❄️']), Math.min(6, Math.ceil((e.count || 1) / 5))); }
  }

  function onFollow(e) {
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">đã theo dõi · Giáng Sinh an lành 🎄</div></div>`, 'follow', 2800);
    const { o, s } = touch(e.user);
    glowOrn(o); spin(s);
  }

  function onShare(e) {
    const s = skaters.get(e.user.id);
    if (s) { const t = skaterTop(s); floatAt(t[0], t[1], '✨', 5); }
  }

  const handlers = { join: e => onJoin(e.user), gift: onGift, chat: onChat, like: onLike, follow: onFollow, share: onShare };

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
    ws.onclose = () => { status.textContent = 'Đang kết nối lại server…'; status.classList.add('show'); setTimeout(connect, 2000); };
  }
  connect();
  updateProgress();

  window.noel = { emit: e => handlers[e.type]?.(e) };
})();
