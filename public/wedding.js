(() => {
  const W = 1080, H = 1920;
  const params = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  let INTERVAL = Math.max(20, Number(params.get('interval')) || 180); // seconds between ceremonies
  const STEAL = Math.max(1, Number(params.get('steal')) || 299);       // diamonds needed to steal
  const VOTE_SECONDS = 25;
  $('#stealCost').textContent = STEAL;

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
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function norm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim(); }
  function fillAvatar(box, user) {
    const fallback = () => { box.textContent = initials(user.nickname); };
    if (!user.avatar || !/^https?:\/\//.test(user.avatar)) return fallback();
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = fallback;
    img.src = user.avatar;
    box.replaceChildren(img);
  }

  // ---------- Flowers on the arch ----------
  {
    const colors = ['#ff8fb1', '#ffffff', '#e8577e', '#ffd6e2', '#f7c6d9'];
    let g = '';
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI - (Math.PI * i) / 26;
      const x = 260 + Math.cos(a) * 213, y = 220 - Math.sin(a) * 213;
      for (let k = 0; k < 3; k++) g += `<circle cx="${x + rand(-14, 14)}" cy="${y + rand(-14, 14)}" r="${rand(10, 17)}" fill="${pick(colors)}"/>`;
      if (i % 3 === 0) g += `<circle cx="${x}" cy="${y}" r="6" fill="#ffd166"/>`;
    }
    for (const x of [47, 473]) for (let y = 240; y < 580; y += 46) g += `<circle cx="${x + rand(-8, 8)}" cy="${y}" r="${rand(9, 14)}" fill="${pick(colors)}"/><path d="M${x},${y + 10} q${rand(-20, 20)},20 0,34" stroke="#5c9a5f" stroke-width="4" fill="none"/>`;
    $('#flowers').innerHTML = g;
  }

  // ---------- Seats ----------
  const LEFT = [135, 240, 345, 450], RIGHT = [630, 735, 840, 945];
  const FAMILY_ROWS = [1060, 1160, 1260, 1360, 1460];
  const GUEST_ROWS = [1650, 1770];
  const seats = [];
  for (const y of FAMILY_ROWS) {
    for (const x of LEFT) seats.push({ x, y, kind: 'trai', taken: null });
    for (const x of RIGHT) seats.push({ x, y, kind: 'gai', taken: null });
  }
  for (const y of GUEST_ROWS) for (const x of [...LEFT, ...RIGHT]) seats.push({ x, y, kind: 'guest', taken: null });
  for (const s of seats) {
    const el = document.createElement('div');
    el.className = 'seat ' + s.kind;
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    el.style.transform = `translate(-50%,-50%) scale(${scaleAt(s.y)})`;
    $('#seats').appendChild(el);
  }
  function scaleAt(y) { return 0.72 + 0.3 * Math.min(1, Math.max(0, (y - 1060) / 710)); }
  const DOOR = { x: 540, y: 2080 };
  const SPOT = { groom: { x: 470, y: 885 }, bride: { x: 610, y: 885 } };
  const AISLE = 540;

  // ---------- Outfits ----------
  const suit = (c, sit) => sit
    ? `<svg class="sit" viewBox="0 -8 110 80"><path d="M32,0 Q55,-6 78,0 L86,44 L24,44Z" fill="${c}"/><path d="M46,0 L55,22 L64,0Z" fill="#fff"/><rect x="16" y="42" width="78" height="20" rx="8" fill="#2a2a35"/></svg>`
    : `<svg class="stand" viewBox="0 0 110 110"><path d="M28,8 Q55,0 82,8 L92,70 L18,70Z" fill="${c}"/><path d="M45,6 L55,34 L65,6Z" fill="#fff"/><path d="M51,12 L59,12 L55,20Z" fill="#c0392b"/><rect x="33" y="70" width="17" height="38" fill="#2a2a35"/><rect x="60" y="70" width="17" height="38" fill="#2a2a35"/></svg>`;
  const dress = (c, sit) => sit
    ? `<svg class="sit" viewBox="0 -8 110 80"><path d="M36,0 Q55,-6 74,0 L80,40 L30,40Z" fill="${c}"/><path d="M8,66 Q55,26 102,66 Q55,84 8,66Z" fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width="2"/></svg>`
    : `<svg class="stand" viewBox="0 0 110 110"><path d="M34,8 Q55,0 76,8 L80,44 L104,108 Q55,116 6,108 L30,44Z" fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width="2"/><path d="M30,44 Q55,52 80,44" stroke="rgba(255,255,255,.7)" stroke-width="4" fill="none"/></svg>`;
  const TRAI_COLORS = ['#2c3e70', '#34558b', '#1f4e79', '#3d5a80', '#2b4162'];
  const GAI_COLORS = ['#e8577e', '#f28fad', '#c94f7c', '#f7a1c4', '#d6336c'];
  const GUEST_COLORS = ['#9b8aa6', '#a3b18a', '#c9a27e', '#8fa9b8', '#b88fa3'];

  function outfit(p) {
    let html;
    if (p.role === 'groom') html = suit('#1b1b1b') + suit('#1b1b1b', true);
    else if (p.role === 'bride') html = dress('#ffffff') + dress('#ffffff', true);
    else if (p.side === 'trai') { const c = TRAI_COLORS[hash(p.user.id) % 5]; html = suit(c) + suit(c, true); }
    else if (p.side === 'gai') { const c = GAI_COLORS[hash(p.user.id) % 5]; html = dress(c) + dress(c, true); }
    else { const c = GUEST_COLORS[hash(p.user.id) % 5]; html = suit(c) + suit(c, true); }
    p.el.querySelector('.outfit').innerHTML = html;
    p.el.classList.toggle('groom', p.role === 'groom');
    p.el.classList.toggle('bride', p.role === 'bride');
    p.el.classList.toggle('side-trai', p.side === 'trai');
    p.el.classList.toggle('side-gai', p.side === 'gai');
  }

  // ---------- People & movement ----------
  const people = new Map();

  function place(p, x, y, ms) {
    p.x = x; p.y = y;
    const s = p.role ? 1.0 : scaleAt(y);
    p.el.style.transitionDuration = (ms || 0) + 'ms';
    p.el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    p.el.style.zIndex = Math.round(y);
  }
  function walkTo(p, x, y, speed) {
    const ms = Math.max(150, Math.hypot(x - p.x, y - p.y) / speed);
    place(p, x, y, ms);
    return sleep(ms);
  }
  // Walk through waypoints; aborts if another route starts for the same person
  async function route(p, pts, fast) {
    const id = ++p.mv;
    p.el.classList.remove('seated');
    p.el.classList.add(fast ? 'running' : 'walking');
    for (const [x, y] of pts) {
      await walkTo(p, x, y, fast ? 0.9 : 0.34);
      if (p.mv !== id) return false;
    }
    p.el.classList.remove('walking', 'running');
    return true;
  }
  async function goToSeat(p) {
    const s = p.seat;
    const ok = await route(p, [[AISLE, p.y], [AISLE, s.y], [s.x, s.y]]);
    if (ok) p.el.classList.add('seated');
  }

  function freeSeat(kind) {
    const free = seats.filter(s => s.kind === kind && !s.taken);
    if (!free.length) return null;
    const minY = Math.min(...free.map(s => s.y));
    return pick(free.filter(s => s.y === minY));
  }
  function evictable(kind) {
    return [...people.values()]
      .filter(p => p.seat?.kind === kind && !p.reg && !p.role && p.state !== 'leaving')
      .sort((a, b) => a.lastActive - b.lastActive)[0];
  }

  function join(user) {
    let p = people.get(user.id);
    if (p) { p.lastActive = Date.now(); return p; }
    let seat = freeSeat('guest');
    if (!seat) { const old = evictable('guest'); if (old) leave(old); seat = freeSeat('guest'); }
    if (!seat) return null;
    const el = document.createElement('div');
    el.className = 'person';
    el.innerHTML = `<div class="body"><div class="outfit"></div><div class="veil"></div><div class="head"></div><div class="crown">👑</div><div class="heart">💗</div></div><div class="name">${esc(user.nickname)}</div>`;
    fillAvatar(el.querySelector('.head'), user);
    $('#people').appendChild(el);
    p = { user, el, seat, side: null, reg: false, role: null, state: 'in', lastActive: Date.now(), mv: 0, x: 0, y: 0 };
    seat.taken = p;
    people.set(user.id, p);
    outfit(p);
    place(p, DOOR.x + rand(-20, 20), DOOR.y, 0);
    el.getBoundingClientRect();
    route(p, [[AISLE, seat.y], [seat.x, seat.y]]).then(ok => { if (ok) el.classList.add('seated'); });
    updatePool();
    return p;
  }

  async function leave(p) {
    p.state = 'leaving';
    if (p.seat) p.seat.taken = null;
    people.delete(p.user.id);
    updatePool();
    await route(p, [[AISLE, p.y]]);
    p.el.classList.add('leaving');
    await route(p, [[DOOR.x, DOOR.y]]);
    p.el.remove();
  }

  function chooseSide(p, side) {
    if (p.side === side || p.role) return;
    let seat = freeSeat(side);
    if (!seat) { const old = evictable(side); if (old) leave(old); seat = freeSeat(side); }
    if (!seat) { say(p, 'Phe này đã kín chỗ 😅'); return; }
    if (p.seat) p.seat.taken = null;
    p.seat = seat; seat.taken = p;
    p.side = side;
    outfit(p);
    say(p, side === 'trai' ? '🤵 Về nhà trai!' : '👰 Về nhà gái!');
    goToSeat(p);
    updatePool();
  }

  function say(p, text, ms = 4000) {
    if (!p) return;
    p.el.querySelector('.bubble')?.remove();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text.length > 60 ? text.slice(0, 58) + '…' : text;
    p.el.appendChild(b);
    clearTimeout(p.bubbleTimer);
    p.bubbleTimer = setTimeout(() => b.remove(), ms);
  }

  function updatePool() {
    let t = 0, g = 0;
    for (const p of people.values()) if (p.reg && !p.role) { if (p.side === 'trai') t++; else if (p.side === 'gai') g++; }
    $('#poolTrai').textContent = t; $('#poolGai').textContent = g;
  }

  // ---------- Effects ----------
  const fx = $('#fx');
  function floatFrom(p, emoji, n) {
    if (!p) return;
    const s = p.role ? 1 : scaleAt(p.y);
    for (let i = 0; i < n; i++) setTimeout(() => {
      const e = document.createElement('div');
      e.className = 'float'; e.textContent = emoji;
      e.style.left = (p.x - 17) + 'px'; e.style.top = (p.y - 180 * s) + 'px';
      e.style.setProperty('--dx', rand(-60, 60) + 'px');
      e.addEventListener('animationend', () => e.remove());
      fx.appendChild(e);
    }, i * 110);
  }
  function confetti(n) {
    const colors = ['#ff8fb1', '#ffd166', '#ffffff', '#e8577e', '#9bd1ff', '#c3f0ca'];
    for (let i = 0; i < Math.min(n, 160); i++) setTimeout(() => {
      const e = document.createElement('div');
      e.className = 'confetti';
      e.style.cssText = `left:${rand(0, W)}px;background:${pick(colors)};--t:${rand(3.5, 6)}s;--dx:${rand(-200, 200)}px;--r:${rand(-900, 900)}deg`;
      e.addEventListener('animationend', () => e.remove());
      fx.appendChild(e);
    }, rand(0, 2000));
  }
  function big(emoji) {
    const e = document.createElement('div');
    e.className = 'big'; e.textContent = emoji;
    e.addEventListener('animationend', () => e.remove());
    fx.appendChild(e);
  }
  function flash() {
    const e = document.createElement('div');
    e.className = 'flash';
    e.addEventListener('animationend', () => e.remove());
    fx.appendChild(e);
  }

  // ---------- Banner queue ----------
  const queue = [];
  let showing = false;
  function banner(user, html, cls, ms, urgent) {
    const item = { user, html, cls, ms };
    urgent ? queue.unshift(item) : queue.push(item);
    if (!showing) nextBanner();
  }
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
    const ms = queue.length > 3 ? 1500 : item.ms;
    setTimeout(() => { c.classList.add('out'); setTimeout(nextBanner, 400); }, ms);
  }

  // ---------- Ceremony ----------
  let phase = 'idle'; // idle | pick | walk | vote | result
  let nextAt = Date.now() + INTERVAL * 1000;
  let cer = null;
  let pendingEnv = 0;
  const couples = [];

  function setRole(p, role) {
    p.role = role;
    outfit(p);
  }
  function updateCeremonyPanel() {
    if (!cer) return;
    $('#cGroom').textContent = cer.groom.user.nickname;
    $('#cBride').textContent = cer.bride.user.nickname;
    $('#cVotes').textContent = `${cer.votes}/${cer.target}`;
    $('#cMeter').style.width = Math.min(100, (cer.votes / cer.target) * 100) + '%';
    $('#cEnv').textContent = cer.env;
  }

  async function startCeremony() {
    const pool = side => [...people.values()].filter(p => p.reg && p.side === side && !p.role && p.state !== 'leaving');
    const trai = pool('trai'), gai = pool('gai');
    if (!trai.length || !gai.length) {
      banner(null, `<div class="ic">💌</div><div><div class="who">Chưa đủ cặp đăng ký!</div><div class="what">Comment <b>trai</b>/<b>gái</b> rồi <b>cưới</b> để lên lễ đường</div></div>`, '', 3500, true);
      nextAt = Date.now() + 30000;
      return;
    }
    phase = 'pick';
    $('#dim').classList.add('on');
    const groom = pick(trai), bride = pick(gai);
    // Roulette spotlight, slowing down
    let delay = 70;
    for (let i = 0; i < 22; i++) {
      const a = i === 21 ? groom : pick(trai), b = i === 21 ? bride : pick(gai);
      document.querySelectorAll('.person.lit').forEach(e => e.classList.remove('lit'));
      a.el.classList.add('lit'); b.el.classList.add('lit');
      await sleep(delay);
      delay *= 1.12;
    }
    flash();
    await sleep(900);
    document.querySelectorAll('.person.lit').forEach(e => e.classList.remove('lit'));
    $('#dim').classList.remove('on');

    // Couple may have left during roulette
    if (!people.has(groom.user.id) || !people.has(bride.user.id)) { phase = 'idle'; nextAt = Date.now() + 15000; return; }

    const compat = Math.round(rand(55, 100));
    cer = { groom, bride, votes: 0, target: Math.max(6, Math.min(30, 6 + Math.floor(people.size / 4))), env: pendingEnv, endAt: 0, compat };
    pendingEnv = 0;
    setRole(groom, 'groom'); setRole(bride, 'bride');
    $('#cCompat').textContent = `💘 Độ hợp nhau: ${compat}% — ` + (compat >= 95 ? 'Trời sinh một cặp!' : compat >= 85 ? 'Rất xứng đôi' : compat >= 70 ? 'Cũng hợp phết' : 'Hơi lệch pha nhưng không sao 😆');
    updateCeremonyPanel();
    $('#ceremony').classList.add('on');
    banner(null, `<div class="ic">💒</div><div><div class="who">${esc(groom.user.nickname)} ❤ ${esc(bride.user.nickname)}</div><div class="what">Mời cô dâu chú rể lên lễ đường!</div></div>`, 'success', 3500, true);

    phase = 'walk';
    await Promise.all([walkToAltar(groom, 'groom'), walkToAltar(bride, 'bride')]);
    if (phase !== 'walk') return;
    phase = 'vote';
    cer.endAt = Date.now() + VOTE_SECONDS * 1000;
  }

  async function walkToAltar(p, role, fast) {
    const s = SPOT[role];
    const ok = await route(p, [[AISLE, p.y], [AISLE, s.y + 20], [s.x, s.y]], fast);
    if (ok && cer && cer[role] === p) say(p, role === 'groom' ? '🤵 Anh sẵn sàng rồi!' : '👰 Em đến rồi đây!', 2500);
  }

  function addVote(p) {
    if (phase !== 'vote' || !cer) return;
    cer.votes++;
    floatFrom(p, '💖', 1);
    updateCeremonyPanel();
    if (cer.votes >= cer.target) finish(true);
  }

  async function finish(ok) {
    if (phase !== 'vote') return;
    phase = 'result';
    const { groom, bride } = cer;
    if (ok) {
      groom.el.style.setProperty('--lean', '10deg'); bride.el.style.setProperty('--lean', '-10deg');
      groom.el.classList.add('kiss'); bride.el.classList.add('kiss');
      big('💍'); confetti(140); floatFrom(groom, '💕', 6); floatFrom(bride, '💕', 6);
      banner(null, `<div class="ic">💍</div><div><div class="who">${esc(groom.user.nickname)} ❤ ${esc(bride.user.nickname)}</div><div class="what">Đã nên duyên vợ chồng! Tiền mừng ${cer.env}💎</div></div><div class="ic">🎉</div>`, 'success', 5000, true);
      couples.unshift({ a: groom.user.nickname, b: bride.user.nickname, env: cer.env });
      couples.length = Math.min(couples.length, 4);
      $('#couples').innerHTML = couples.map(c => `<li>${esc(c.a)} ❤ ${esc(c.b)}<span>${c.env}💎</span></li>`).join('');
    } else {
      big('💔');
      const lines = ['Cô dâu bỏ chạy 🏃‍♀️', 'Chú rể ngất xỉu 😵', 'Hai họ chưa đồng ý 😅', 'Hẹn kiếp sau nhé 🥲'];
      say(pick([groom, bride]), pick(lines), 4000);
      banner(null, `<div class="ic">💔</div><div><div class="who">Chưa đủ lời chúc phúc!</div><div class="what">Lễ sau nhớ comment <b>đồng ý</b> thật nhiều nhé</div></div>`, '', 4000, true);
    }
    await sleep(6000);
    $('#ceremony').classList.remove('on');
    for (const p of [groom, bride]) {
      p.el.classList.remove('kiss');
      p.reg = false; p.el.classList.remove('reg');
      setRole(p, null);
      if (people.has(p.user.id)) goToSeat(p);
    }
    cer = null;
    phase = 'idle';
    nextAt = Date.now() + INTERVAL * 1000;
    updatePool();
  }

  function steal(thief) {
    if (!cer || !(phase === 'walk' || phase === 'vote')) return false;
    if (thief === cer.groom || thief === cer.bride) return false;
    const side = thief.side || (Math.random() < 0.5 ? 'trai' : 'gai');
    const role = side === 'trai' ? 'groom' : 'bride';
    const old = cer[role];
    cer[role] = thief;
    setRole(old, null);
    say(old, '💔 Ơ kìa…', 3000);
    goToSeat(old);
    setRole(thief, role);
    walkToAltar(thief, role, true);
    cer.votes = Math.floor(cer.votes / 2);
    if (phase === 'vote') cer.endAt += 10000;
    updateCeremonyPanel();
    flash();
    banner(thief.user, `<div class="av"></div><div><div class="who">⚡ ${esc(thief.user.nickname)}</div><div class="what">đã ${role === 'groom' ? 'CƯỚP DÂU' : 'CƯỚP RỂ'} khỏi tay ${esc(old.user.nickname)}!</div></div><div class="ic">💥</div>`, 'steal', 4500, true);
    return true;
  }

  // Clock
  setInterval(() => {
    const clock = $('#clock');
    if (phase === 'idle') {
      const left = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
      clock.innerHTML = `💒 Lễ cưới tiếp theo <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`;
      clock.classList.toggle('hot', left <= 10);
      if (left === 0) startCeremony();
    } else {
      clock.innerHTML = phase === 'pick' ? '💒 <b>Đang chọn cặp đôi…</b>' : '💒 <b>Đang làm lễ!</b>';
      clock.classList.add('hot');
    }
    if (phase === 'vote' && cer) {
      const left = Math.max(0, Math.ceil((cer.endAt - Date.now()) / 1000));
      $('#cTime').textContent = left;
      if (left === 0) finish(cer.votes >= cer.target);
    } else if (cer) {
      $('#cTime').textContent = VOTE_SECONDS;
    }
  }, 250);

  // ---------- Event handlers ----------
  function onChat(e) {
    const p = people.get(e.user.id) || join(e.user);
    if (!p) return;
    p.lastActive = Date.now();
    const t = norm(e.text || '');
    if (/^(nha )?trai$|^nam$|🤵/.test(t)) return chooseSide(p, 'trai');
    if (/^(nha )?gai$|^nu$|👰/.test(t)) return chooseSide(p, 'gai');
    if (/^(cuoi|ghep|ghep doi|dang ky|lay chong|lay vo)( .*)?$|💍/.test(t)) {
      if (!p.reg) { p.reg = true; p.el.classList.add('reg'); updatePool(); }
      say(p, p.side ? '💍 Cho mình lên xe hoa!' : '💍 Chọn phe trước: comment trai / gái');
      return;
    }
    if (/^huy$/.test(t)) { p.reg = false; p.el.classList.remove('reg'); updatePool(); return; }
    if (/dong y|^yes$|^ok$|^dy$|❤|💖|😍/.test(t) && phase === 'vote') { addVote(p); say(p, e.text, 2000); return; }
    say(p, e.text);
  }

  function onGift(e) {
    const p = people.get(e.user.id) || join(e.user);
    const total = (e.diamonds || 1) * (e.count || 1);
    if (p) p.lastActive = Date.now();
    const stole = p && total >= STEAL && steal(p);
    if (cer && phase !== 'pick') cer.env += total; else pendingEnv += total;
    updateCeremonyPanel();
    if (!stole) {
      const target = cer && phase !== 'pick' ? 'mừng cưới' : 'góp quỹ cưới';
      banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${target} ${e.count} × ${esc(e.giftName)} (${total}💎)</div></div><div class="ic">🧧</div>`, '', total >= 100 ? 4000 : 2800);
    }
    floatFrom(p, '🧧', Math.min(8, 2 + Math.floor(Math.log10(total + 1) * 2)));
    if (total >= 100) confetti(total >= 1000 ? 120 : 50);
  }

  function onLike(e) {
    const p = people.get(e.user.id);
    if (p) { p.lastActive = Date.now(); floatFrom(p, '💗', Math.min(5, Math.ceil((e.count || 1) / 5))); }
  }

  function onFollow(e) {
    const p = people.get(e.user.id) || join(e.user);
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">đã theo dõi · chúc sớm gặp nửa kia 💞</div></div>`, '', 2800);
    floatFrom(p, '💞', 4);
  }

  const handlers = {
    join: e => join(e.user),
    chat: onChat, gift: onGift, like: onLike, follow: onFollow,
    share: e => floatFrom(people.get(e.user.id), '✨', 5),
    config: e => { if (!params.get('interval') && e.interval) { INTERVAL = e.interval; if (phase === 'idle') nextAt = Math.min(nextAt, Date.now() + INTERVAL * 1000); } },
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
    ws.onclose = () => { status.textContent = 'Đang kết nối lại server…'; status.classList.add('show'); setTimeout(connect, 2000); };
  }
  connect();

  window.wedding = { emit: e => handlers[e.type]?.(e), start: () => { nextAt = Date.now(); } };
})();
