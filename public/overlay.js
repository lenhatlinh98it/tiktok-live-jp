(() => {
  const W = 1080, H = 1920;
  const params = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const stage = $('#stage');

  if (params.get('title')) $('#title').textContent = params.get('title');

  // ---------- Fit 1080x1920 stage into window ----------
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  // ---------- Seat layout (rows from back to front) ----------
  const ROWS = [
    { y: 1010, n: 4, w: 460 },
    { y: 1150, n: 5, w: 600 },
    { y: 1300, n: 6, w: 700 },
    { y: 1450, n: 6, w: 740 },
    { y: 1600, n: 7, w: 780 },
  ];
  const DOOR = { x: 540, y: 2080 };
  const seats = [];
  ROWS.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const x = 540 - r.w / 2 + (r.w / (r.n - 1)) * i;
      seats.push({ x, y: r.y, row: ri, taken: null });
      const el = document.createElement('div');
      el.className = 'seat';
      el.style.left = x + 'px'; el.style.top = r.y + 'px';
      el.style.transform = `translate(-50%,-50%) scale(${scaleAt(r.y)})`;
      $('#seats').appendChild(el);
    }
  });
  function scaleAt(y) { return 0.72 + 0.38 * Math.min(1, Math.max(0, (y - 1000) / 640)); }

  // ---------- People ----------
  const ROBES = ['#b8641c', '#8d5a3b', '#c98a2b', '#6f4e37', '#a0522d', '#7a6a55'];
  const people = new Map(); // id -> person
  const merit = new Map();  // id -> { user, total }

  const robeStand = c => `<svg class="robe stand" viewBox="0 0 120 120"><path d="M30,10 Q60,0 90,10 L108,118 Q60,126 12,118Z" fill="${c}"/><path d="M34,12 L86,110" stroke="rgba(0,0,0,.25)" stroke-width="10"/><path d="M50,40 L60,26 L70,40Z" fill="#f1d7b5"/></svg>`;
  const robeSit = c => `<svg class="robe sit" viewBox="0 -12 120 92"><path d="M36,0 Q60,-6 84,0 L94,48 L26,48Z" fill="${c}"/><path d="M2,66 Q60,28 118,66 Q60,90 2,66Z" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M55,14 L60,-8 L65,14Z" fill="#f1d7b5"/></svg>`;

  function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }
  // Fill a container with the user's avatar (falls back to initial letter)
  function fillAvatar(box, user) {
    const fallback = () => { box.textContent = initials(user.nickname); };
    if (!user.avatar || !/^https?:\/\//.test(user.avatar)) return fallback();
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = fallback;
    img.src = user.avatar;
    box.replaceChildren(img);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function place(p, x, y, ms) {
    p.x = x; p.y = y;
    p.el.style.transitionDuration = (ms || 0) + 'ms';
    p.el.style.transform = `translate(${x}px, ${y}px) scale(${scaleAt(y)})`;
    p.el.style.zIndex = Math.round(y);
  }
  function walkTo(p, x, y) {
    const d = Math.hypot(x - p.x, y - p.y);
    const ms = Math.max(200, d / 0.32); // ~320px/s
    place(p, x, y, ms);
    return new Promise(r => setTimeout(r, ms));
  }

  function freeSeat() {
    const free = seats.filter(s => !s.taken);
    if (!free.length) return null;
    const frontRow = Math.min(...free.map(s => s.row)); // fill back rows first, near the altar
    const row = free.filter(s => s.row === frontRow);
    return row[Math.floor(Math.random() * row.length)];
  }

  function evictOne() {
    // Oldest inactive non-VIP leaves to make room
    const list = [...people.values()].filter(p => p.state === 'seated').sort((a, b) => (a.vip - b.vip) || (a.lastActive - b.lastActive));
    if (list[0]) leave(list[0]);
  }

  async function join(user) {
    let p = people.get(user.id);
    if (p) { p.lastActive = Date.now(); Object.assign(p.user, user); return p; }
    let seat = freeSeat();
    if (!seat) { evictOne(); seat = freeSeat(); }
    if (!seat) return null;

    const el = document.createElement('div');
    el.className = 'person walking';
    const robe = ROBES[Math.floor(Math.random() * ROBES.length)];
    el.innerHTML = `<div class="body"><div class="aura"></div>${robeStand(robe)}${robeSit(robe)}<div class="head"></div></div><div class="name">${esc(user.nickname)}</div>`;
    fillAvatar(el.querySelector('.head'), user);
    $('#people').appendChild(el);

    p = { user, el, seat, state: 'walking', lastActive: Date.now(), vip: merit.has(user.id) && merit.get(user.id).total >= 100 };
    if (p.vip) el.classList.add('vip');
    seat.taken = p;
    people.set(user.id, p);
    updateCount();

    place(p, DOOR.x + (Math.random() * 40 - 20), DOOR.y, 0);
    el.getBoundingClientRect(); // flush start position
    await walkTo(p, 540, seat.y + 30);
    if (p.state !== 'walking') return p;
    await walkTo(p, seat.x, seat.y + 30);
    if (p.state !== 'walking') return p;
    await walkTo(p, seat.x, seat.y);
    if (p.state !== 'walking') return p;
    el.classList.remove('walking');
    el.classList.add('seated');
    p.state = 'seated';
    return p;
  }

  async function leave(p) {
    p.state = 'leaving';
    p.seat.taken = null;
    people.delete(p.user.id);
    updateCount();
    p.el.classList.remove('seated');
    p.el.classList.add('walking');
    await walkTo(p, 540, p.y + 30);
    p.el.classList.add('leaving');
    await walkTo(p, DOOR.x, DOOR.y);
    p.el.remove();
  }

  function updateCount() { $('#count').textContent = people.size; }

  function say(p, text) {
    if (!p) return;
    p.el.querySelector('.bubble')?.remove();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text.length > 60 ? text.slice(0, 58) + '…' : text;
    p.el.appendChild(b);
    clearTimeout(p.bubbleTimer);
    p.bubbleTimer = setTimeout(() => b.remove(), 4500);
  }

  function glow(p) {
    if (!p) return;
    p.el.classList.remove('glow'); void p.el.offsetWidth; p.el.classList.add('glow');
  }

  // ---------- Effects ----------
  const fx = $('#fx');
  function floatFrom(p, emoji, n) {
    if (!p) return;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const e = document.createElement('div');
        e.className = 'float'; e.textContent = emoji;
        e.style.left = (p.x - 17) + 'px'; e.style.top = (p.y - 200 * scaleAt(p.y)) + 'px';
        e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
        e.addEventListener('animationend', () => e.remove());
        fx.appendChild(e);
      }, i * 120);
    }
  }
  function petalRain(n) {
    n = Math.min(n, 140);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const e = document.createElement('div');
        e.className = 'petal';
        e.style.left = (Math.random() * W) + 'px'; e.style.top = '-30px';
        e.style.setProperty('--t', (4 + Math.random() * 3) + 's');
        e.style.setProperty('--dx', (Math.random() * 300 - 150) + 'px');
        e.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
        e.addEventListener('animationend', () => e.remove());
        fx.appendChild(e);
      }, Math.random() * 2500);
    }
  }
  function lightBurst() {
    const r = document.createElement('div');
    r.className = 'ray-burst';
    r.addEventListener('animationend', () => r.remove());
    $('#rays').appendChild(r);
    const h = $('.halo'); h.classList.remove('burst'); void h.offsetWidth; h.classList.add('burst');
  }
  // Incense smoke loop
  setInterval(() => {
    const e = document.createElement('div');
    e.className = 'puff';
    e.style.left = (Math.random() * 30) + 'px';
    e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    e.addEventListener('animationend', () => e.remove());
    $('#smoke').appendChild(e);
  }, 700);

  // ---------- Banner queue ----------
  const queue = [];
  let showing = false;
  // html must only contain escaped text; the avatar is filled via DOM into .av
  function banner(user, html, cls, ms) { queue.push({ user, html, cls, ms }); if (!showing) nextBanner(); }
  function nextBanner() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    const c = document.createElement('div');
    c.className = 'card ' + (item.cls || '');
    c.innerHTML = item.html;
    fillAvatar(c.querySelector('.av'), item.user);
    $('#banner').replaceChildren(c);
    const ms = queue.length > 3 ? 1600 : item.ms; // speed up when backlog grows
    setTimeout(() => { c.classList.add('out'); setTimeout(nextBanner, 400); }, ms);
  }

  // ---------- Merit board ----------
  function addMerit(user, amount) {
    const m = merit.get(user.id) || { user, total: 0 };
    m.total += amount; m.user = user;
    merit.set(user.id, m);
    const top = [...merit.values()].sort((a, b) => b.total - a.total).slice(0, 3);
    $('#board').innerHTML = top.map(t => `<li>${esc(t.user.nickname)}<span>${t.total}💎</span></li>`).join('');
    const p = people.get(user.id);
    if (p && m.total >= 100 && !p.vip) { p.vip = true; p.el.classList.add('vip'); }
  }

  // ---------- Event handlers ----------
  async function onJoin(user) {
    const existed = people.has(user.id);
    const p = await join(user);
    if (!existed && p) setTimeout(() => say(p, '🙏 Nam mô A Di Đà Phật'), 200);
  }

  async function onGift(e) {
    const total = (e.diamonds || 1) * (e.count || 1);
    const tier = total >= 1000 ? 4 : total >= 100 ? 3 : total >= 10 ? 2 : 1;
    addMerit(e.user, total);
    const gimg = /^https?:\/\//.test(e.giftImage || '') ? `<img class="gimg" src="${encodeURI(e.giftImage)}" referrerpolicy="no-referrer">` : '🎁';
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">dâng ${e.count} × ${esc(e.giftName)}</div></div>${gimg}`,
      'tier' + tier, tier >= 3 ? 5000 : 3200);
    const p = people.get(e.user.id) || await join(e.user);
    glow(p);
    floatFrom(p, '🪷', 3 + tier * 2);
    if (tier >= 2) petalRain(tier === 2 ? 25 : tier === 3 ? 70 : 140);
    if (tier >= 3) lightBurst();
    if (tier >= 4) setTimeout(lightBurst, 1500);
  }

  async function onChat(e) {
    const p = people.get(e.user.id) || await join(e.user);
    if (p) { p.lastActive = Date.now(); say(p, e.text); }
  }

  function onLike(e) {
    const p = people.get(e.user.id);
    if (p) { p.lastActive = Date.now(); floatFrom(p, '❤️', Math.min(6, Math.ceil((e.count || 1) / 5))); }
  }

  async function onFollow(e) {
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">đã theo dõi · Chúc an lạc 🙏</div></div>`, 'follow', 2800);
    const p = people.get(e.user.id) || await join(e.user);
    glow(p);
  }

  function onShare(e) {
    const p = people.get(e.user.id);
    if (p) floatFrom(p, '✨', 5);
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

  // Expose for manual testing in DevTools
  window.temple = { emit: e => handlers[e.type]?.(e) };
})();
