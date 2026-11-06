(() => {
  const W = 1080, H = 1920;
  const params = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  let BOSS_INTERVAL = Math.max(20, Number(params.get('boss')) || 300); // seconds between boss battles
  const BATTLE_SECONDS = Math.max(20, Number(params.get('battle')) || 75);
  let AUTOREEL = params.get('autoreel') === '1';
  const MAX_FLOATS = 14;

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
  // Normalize comment: full-width -> half-width, lowercase, trim
  function norm(s) { return String(s).normalize('NFKC').toLowerCase().trim(); }

  // ---------- Fish table ----------
  // rarity: 1 common, 2 uncommon, 3 rare, 4 legendary, 0 junk
  const FISH = [
    { name: 'アジ', e: '🐟', r: 1, min: 15, max: 35 },
    { name: 'イワシ', e: '🐟', r: 1, min: 10, max: 25 },
    { name: 'サバ', e: '🐟', r: 1, min: 25, max: 45 },
    { name: 'ハゼ', e: '🐟', r: 1, min: 8, max: 20 },
    { name: '真鯛', e: '🐠', r: 2, min: 30, max: 70 },
    { name: 'ヒラメ', e: '🐟', r: 2, min: 35, max: 80 },
    { name: 'イカ', e: '🦑', r: 2, min: 20, max: 45 },
    { name: 'タコ', e: '🐙', r: 2, min: 30, max: 90 },
    { name: 'フグ', e: '🐡', r: 3, min: 20, max: 50 },
    { name: 'カツオ', e: '🐟', r: 3, min: 50, max: 100 },
    { name: '本マグロ', e: '🐟', r: 3, min: 100, max: 280 },
    { name: '伊勢エビ', e: '🦞', r: 3, min: 20, max: 40 },
    { name: '黄金の鯛', e: '🐠', r: 4, min: 60, max: 120 },
    { name: 'リュウグウノツカイ', e: '🐉', r: 4, min: 300, max: 600 },
    { name: '長靴', e: '👢', r: 0, min: 25, max: 30 },
    { name: '空き缶', e: '🥫', r: 0, min: 10, max: 12 },
  ];
  const WEIGHTS = { 1: 58, 2: 26, 3: 9, 4: 1.5, 0: 5.5 };
  function rollFish() {
    let t = Math.random() * 100;
    let r = 1;
    for (const k of [1, 2, 3, 4, 0]) { t -= WEIGHTS[k]; if (t <= 0) { r = k; break; } }
    const f = pick(FISH.filter(x => x.r === r));
    return { ...f, size: Math.round(rand(f.min, f.max)) };
  }

  // ---------- Players ----------
  const players = new Map(); // id -> { user, dex:Set, best }
  function player(user) {
    let p = players.get(user.id);
    if (!p) { p = { user, dex: new Set(), best: null }; players.set(user.id, p); $('#anglers').textContent = players.size; }
    p.user = user;
    return p;
  }

  // ---------- Background fish ----------
  setInterval(() => {
    const e = document.createElement('div');
    e.className = 'swim';
    const ltr = Math.random() < 0.5;
    e.textContent = pick(['🐟', '🐠', '🐟', '🐡']);
    e.style.top = rand(820, 1650) + 'px';
    e.style.left = ltr ? '-80px' : '1100px';
    e.style.transform = ltr ? 'scaleX(-1)' : '';
    e.style.setProperty('--dx', (ltr ? 1250 : -1250) + 'px');
    e.style.setProperty('--t', rand(14, 26) + 's');
    if (ltr) e.style.animationName = 'swimR';
    e.addEventListener('animationend', () => e.remove());
    $('#deco').appendChild(e);
  }, 1800);
  const st = document.createElement('style');
  st.textContent = '@keyframes swimR { from { transform: scaleX(-1); } to { transform: translateX(1250px) scaleX(-1); } }';
  document.head.appendChild(st);

  // ---------- Fishing line ----------
  const ROD_TIP = { x: 662, y: 572 };
  function drawLine(x, y) {
    const mx = (ROD_TIP.x + x) / 2, my = Math.max(ROD_TIP.y, y) - 40;
    $('#linePath').setAttribute('d', `M${ROD_TIP.x},${ROD_TIP.y} Q${mx},${my + 120} ${x},${y}`);
  }
  drawLine(760, 650);

  // ---------- Normal fishing ----------
  const floats = new Map();
  const fx = $('#fx');

  async function cast(user) {
    if (boss) return;
    const p = player(user);
    if (floats.has(user.id) || floats.size >= MAX_FLOATS) return;
    const x = pickFloatX();
    const y = 690 + rand(0, 70);
    const el = document.createElement('div');
    el.className = 'float';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.innerHTML = `<div class="bob"><div class="av"></div><div class="pin"></div><div class="ball"></div></div><div class="bang">!</div><div class="nm">${esc(user.nickname)}</div>`;
    fillAvatar(el.querySelector('.av'), user);
    $('#floats').appendChild(el);
    const f = { el, x, y };
    floats.set(user.id, f);
    splash(x, y - 10);

    await sleep(rand(2500, 6500));
    if (boss || !floats.has(user.id)) return removeFloat(user.id);
    el.classList.add('bite');
    await sleep(900);
    const fish = rollFish();
    showCatch(p, fish, x, y);
    removeFloat(user.id);
  }
  function pickFloatX() {
    for (let i = 0; i < 12; i++) {
      // Keep clear of the boat in the middle
      const x = Math.random() < 0.5 ? rand(70, 390) : rand(700, 1010);
      if ([...floats.values()].every(f => Math.abs(f.x - x) > 75)) return x;
    }
    return Math.random() < 0.5 ? rand(70, 390) : rand(700, 1010);
  }
  function removeFloat(id) {
    const f = floats.get(id);
    if (!f) return;
    floats.delete(id);
    f.el.classList.add('gone');
    setTimeout(() => f.el.remove(), 500);
  }
  function splash(x, y) {
    const s = document.createElement('div');
    s.className = 'splash';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.addEventListener('animationend', () => s.remove());
    fx.appendChild(s);
  }

  function showCatch(p, fish, x, y) {
    splash(x, y - 10);
    const c = document.createElement('div');
    c.className = 'catch'; c.textContent = fish.e;
    c.style.left = x + 'px'; c.style.top = (y - 60) + 'px';
    c.addEventListener('animationend', () => c.remove());
    fx.appendChild(c);

    const isNew = !p.dex.has(fish.name) && fish.r !== 0;
    if (fish.r !== 0) p.dex.add(fish.name);
    const lbl = document.createElement('div');
    lbl.className = 'catch-label ' + (fish.r === 0 ? 'joke' : 'r' + fish.r);
    lbl.textContent = fish.r === 0 ? `${fish.name}…😅` : `${fish.name} ${fish.size}cm${isNew ? ' 📖NEW' : ''}`;
    lbl.style.left = Math.min(900, Math.max(180, x)) + 'px'; lbl.style.top = (y - 230) + 'px';
    lbl.addEventListener('animationend', () => lbl.remove());
    fx.appendChild(lbl);

    addFeed(`${p.user.nickname}：${fish.e}${fish.name}${fish.r === 0 ? '' : ' ' + fish.size + 'cm'}`);
    if (fish.r !== 0 && (!p.best || fish.size > p.best.size)) { p.best = fish; updateBoard(); }
    if (fish.r >= 3) gyotaku(p.user, fish, false);
    if (fish.r === 4) confetti(80);
  }

  function addFeed(text) {
    const ul = $('#feed');
    const li = document.createElement('li');
    li.textContent = text;
    ul.prepend(li);
    while (ul.children.length > 4) ul.lastChild.remove();
  }
  function updateBoard() {
    const top = [...players.values()].filter(p => p.best).sort((a, b) => b.best.size - a.best.size).slice(0, 3);
    $('#board').innerHTML = top.map(p => `<li>${esc(p.user.nickname)}<span>${esc(p.best.name)} ${p.best.size}cm</span></li>`).join('');
  }

  // ---------- Gyotaku card queue ----------
  const gyoQueue = [];
  let gyoShowing = false;
  function gyotaku(user, fish, isBoss, extra) {
    gyoQueue.push({ user, fish, isBoss, extra });
    if (!gyoShowing) nextGyo();
  }
  function nextGyo() {
    const g = gyoQueue.shift();
    if (!g) { gyoShowing = false; return; }
    gyoShowing = true;
    const d = new Date();
    const card = document.createElement('div');
    card.className = 'gyo' + (g.isBoss ? ' boss' : '');
    card.innerHTML = `<div class="label">魚 拓</div><div class="print">${g.fish.e}</div><div class="fname">${esc(g.fish.name)}　${g.fish.size}cm</div>`
      + `<div class="meta">釣り人：${esc(g.user.nickname)}${g.extra ? '　' + esc(g.extra) : ''}　｜　${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日</div><div class="hanko">大<br>物</div>`;
    $('#gyotaku').replaceChildren(card);
    setTimeout(() => { card.classList.add('out'); setTimeout(nextGyo, 400); }, g.isBoss ? 5500 : 3200);
  }

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
    const ms = bnQueue.length > 3 ? 1400 : item.ms;
    setTimeout(() => { c.classList.add('out'); setTimeout(nextBanner, 350); }, ms);
  }

  function pop(x, y, text, color) {
    const e = document.createElement('div');
    e.className = 'pop'; e.textContent = text;
    if (color) e.style.color = color;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.setProperty('--dx', rand(-40, 40) + 'px');
    e.addEventListener('animationend', () => e.remove());
    fx.appendChild(e);
  }
  function confetti(n) {
    const colors = ['#ffd23f', '#ff8a1f', '#ffffff', '#2fb7ff', '#ff4e50', '#7dff9a'];
    for (let i = 0; i < n; i++) setTimeout(() => {
      const e = document.createElement('div');
      e.className = 'confetti';
      e.style.cssText = `left:${rand(0, W)}px;background:${pick(colors)};--t:${rand(3.5, 6)}s;--dx:${rand(-200, 200)}px;--r:${rand(-900, 900)}deg`;
      e.addEventListener('animationend', () => e.remove());
      fx.appendChild(e);
    }, rand(0, 1800));
  }

  // ---------- Boss battle ----------
  const BOSSES = [
    { name: 'ヌシ・巨大マグロ', e: '🐟', min: 250, max: 420 },
    { name: 'ヌシ・大鯛', e: '🐠', min: 120, max: 200 },
    { name: 'ヌシ・大ダコ', e: '🐙', min: 300, max: 500 },
    { name: 'ヌシ・伝説のサメ', e: '🦈', min: 400, max: 700 },
  ];
  const PENALTIES = ['語尾に「にゃん」を5分間', '変顔で10秒静止', '一発ギャグを披露', 'リスナーの名前を3人全力で褒める'];
  let boss = null;
  let nextBossAt = Date.now() + BOSS_INTERVAL * 1000;

  function startBoss() {
    for (const id of [...floats.keys()]) removeFloat(id);
    const b = pick(BOSSES);
    boss = { ...b, size: Math.round(rand(b.min, b.max)), phase: 'warn', p: 0.4, endAt: 0, team: new Map(), contrib: new Map(), lockUntil: 0, boostUntil: 0 };
    stage.classList.add('quake');
    setTimeout(() => stage.classList.remove('quake'), 1600);
    banner(null, `<div class="ic">⚠️</div><div><div class="who">ヌシ出現！</div><div class="what">「釣」で釣りチーム ／「魚」で魚チームに参加！</div></div><div class="ic">${b.e}</div>`, 'warn', 4000, true);
    const sh = $('#bossShadow');
    sh.textContent = b.e;
    sh.classList.add('on');
    stage.classList.add('in-battle');
    $('#bossName').textContent = `${b.name}（${boss.size}cm級）`;
    $('#battle').classList.add('on');
    updateBattleUI();
    setTimeout(() => { if (boss) { boss.phase = 'battle'; boss.endAt = Date.now() + BATTLE_SECONDS * 1000; } }, 4000);
  }

  function joinTeam(user, side) {
    if (!boss || boss.phase === 'result') return;
    if (boss.team.has(user.id)) return;
    boss.team.set(user.id, side);
    player(user);
    updateBattleUI();
  }
  function teamOf(user) {
    if (!boss) return null;
    let side = boss.team.get(user.id);
    if (!side) {
      // Unaffiliated gifters help the losing side to keep the battle close
      side = boss.p >= 0.5 ? 'f' : 'a';
      boss.team.set(user.id, side);
    }
    return side;
  }
  function mult() { return boss && boss.phase === 'battle' && boss.endAt - Date.now() <= 15000 ? 2 : 1; }
  // side 'a' pulls toward 1 (caught), 'f' toward 0 (escape)
  function push(side, amount, user, pts) {
    if (!boss || boss.phase !== 'battle') return;
    let a = amount * mult();
    if (side === 'a' && Date.now() < boss.boostUntil) a *= 2;
    boss.p = Math.min(1, Math.max(0, boss.p + (side === 'a' ? a : -a)));
    if (user) {
      const c = boss.contrib.get(user.id) || { user, pts: 0, side };
      c.pts += pts || 0; c.user = user;
      boss.contrib.set(user.id, c);
    }
    checkEnd();
  }
  function checkEnd() {
    if (!boss || boss.phase !== 'battle') return;
    if (boss.p >= 1) endBoss(true);
    else if (boss.p <= 0) endBoss(false);
    else if (Date.now() >= boss.endAt) endBoss(boss.p >= 0.5);
  }

  function updateBattleUI() {
    if (!boss) return;
    let a = 0, f = 0;
    for (const s of boss.team.values()) s === 'a' ? a++ : f++;
    $('#cntA').textContent = a; $('#cntF').textContent = f;
    $('#marker').style.left = (boss.p * 100) + '%';
    const left = boss.phase === 'battle' ? Math.max(0, Math.ceil((boss.endAt - Date.now()) / 1000)) : BATTLE_SECONDS;
    $('#bossTime').textContent = left;
    $('#bossTime').classList.toggle('hot', boss.phase === 'battle' && left <= 15);
    $('#lastspurt').classList.toggle('on', mult() === 2);
    const reel = $('#reelHint');
    const locked = Date.now() < boss.lockUntil, boosted = Date.now() < boss.boostUntil;
    reel.className = 'reel' + (locked ? ' locked' : boosted ? ' boost' : '');
    reel.innerHTML = locked ? '🔒 糸が絡まった！' : boosted ? '🚤 助っ人の船 x2！' : '配信者：<b>スペース連打！</b>';
    for (const side of ['a', 'f']) {
      const top = [...boss.contrib.values()].filter(c => c.side === side).sort((x, y) => y.pts - x.pts)[0];
      const box = $(side === 'a' ? '#mvpA' : '#mvpF');
      if (!top) { box.innerHTML = ''; continue; }
      if (box.dataset.uid !== top.user.id) {
        box.dataset.uid = top.user.id;
        box.innerHTML = side === 'a'
          ? `<div><small>釣りMVP</small>${esc(top.user.nickname)}</div><div class="av"></div>`
          : `<div class="av"></div><div><small>魚MVP</small>${esc(top.user.nickname)}</div>`;
        fillAvatar(box.querySelector('.av'), top.user);
      }
    }
    // Shadow comes closer to the surface as the anglers win
    const sh = $('#bossShadow');
    sh.style.top = (1250 - boss.p * 380) + 'px';
    sh.style.left = (540 + Math.sin(Date.now() / 900) * 160) + 'px';
    drawLine(parseFloat(sh.style.left) || 540, (1250 - boss.p * 380) - 60);
  }

  async function endBoss(caught) {
    boss.phase = 'result';
    updateBattleUI();
    const contrib = [...boss.contrib.values()];
    const mvp = side => contrib.filter(c => c.side === side).sort((x, y) => y.pts - x.pts)[0];
    const res = $('#result');
    if (caught) {
      const m = mvp('a');
      confetti(140);
      res.innerHTML = `<h1 class="win">釣り上げた！！</h1><div class="sub">${esc(boss.name)}　${boss.size}cm</div>`
        + (m ? `<div class="hero"><div class="av"></div><div><div class="t">🎣 釣りMVP</div><div class="n">${esc(m.user.nickname)}</div></div></div>` : '');
      if (m) fillAvatar(res.querySelector('.av'), m.user);
      res.classList.add('on');
      await sleep(4500);
      res.classList.remove('on');
      gyotaku(m ? m.user : { nickname: '配信者' }, { name: boss.name, e: boss.e, size: boss.size }, true, m ? 'ほか釣りチーム一同' : '');
      await sleep(6000);
    } else {
      const m = mvp('f');
      $('#bossShadow').classList.add('thrash');
      const chosen = Math.floor(Math.random() * PENALTIES.length);
      res.innerHTML = `<h1 class="lose">ヌシ逃走…</h1><div class="sub">魚チームの勝利！</div>`
        + (m ? `<div class="hero"><div class="av"></div><div><div class="t">🐟 ヌシの守護者</div><div class="n">${esc(m.user.nickname)}</div></div></div>` : '')
        + `<div class="pen"><div class="pen-title">配信者の罰ゲーム</div>${PENALTIES.map((t, i) => `<div data-i="${i}">${i + 1}. ${esc(t)}</div>`).join('')}</div>`;
      if (m) fillAvatar(res.querySelector('.av'), m.user);
      res.classList.add('on');
      boss.penaltyPicker = m ? m.user.id : null;
      boss.penaltyTimer = setTimeout(() => choosePenalty(chosen), 9000);
      await sleep(13000);
      res.classList.remove('on');
      $('#bossShadow').classList.remove('thrash');
    }
    $('#battle').classList.remove('on');
    $('#bossShadow').classList.remove('on');
    stage.classList.remove('in-battle');
    drawLine(760, 650);
    boss = null;
    nextBossAt = Date.now() + BOSS_INTERVAL * 1000;
  }
  function choosePenalty(i) {
    if (!boss || boss.penaltyChosen) return;
    boss.penaltyChosen = true;
    clearTimeout(boss.penaltyTimer);
    document.querySelectorAll('.pen [data-i]').forEach(el => el.classList.toggle('on', Number(el.dataset.i) === i));
  }

  // Streamer reeling via keyboard (Space / Enter / ArrowUp)
  addEventListener('keydown', e => {
    if (!['Space', 'Enter', 'ArrowUp'].includes(e.code)) return;
    e.preventDefault();
    if (!boss || boss.phase !== 'battle' || Date.now() < boss.lockUntil) return;
    push('a', 0.006);
    document.querySelector('.rod').animate([{ transform: 'rotate(40deg)' }, { transform: 'rotate(25deg)' }, { transform: 'rotate(40deg)' }], { duration: 150 });
  });

  // Main loop
  setInterval(() => {
    const clock = $('#bossClock');
    if (!boss) {
      const left = Math.max(0, Math.ceil((nextBossAt - Date.now()) / 1000));
      clock.innerHTML = `ヌシ出現まで <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`;
      clock.classList.toggle('hot', left <= 10);
      if (left === 0) startBoss();
      return;
    }
    clock.innerHTML = '<b>ヌシとバトル中！</b>';
    clock.classList.add('hot');
    if (boss.phase === 'battle') {
      // Fish pulls constantly; auto-reel simulates the streamer in demo mode
      boss.p = Math.max(0, boss.p - 0.0035 * mult());
      if (AUTOREEL && Date.now() >= boss.lockUntil) boss.p = Math.min(1, boss.p + 0.0034);
      checkEnd();
    }
    if (boss) updateBattleUI();
  }, 100);

  // ---------- Event handlers ----------
  function giftEffect(e) {
    const total = (e.diamonds || 1) * (e.count || 1);
    player(e.user);
    if (!boss || boss.phase !== 'battle') {
      banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)} ×${e.count} ありがとう！</div></div><div class="ic">🎁</div>`, '', 2600);
      cast(e.user);
      return;
    }
    const side = teamOf(e.user);
    const tier = total >= 100 ? 3 : total >= 30 ? 2 : 1;
    let what;
    if (side === 'f') {
      if (tier === 3) { push('f', 0.15, e.user, total); stage.classList.add('quake'); setTimeout(() => stage.classList.remove('quake'), 1500); $('#bossShadow').classList.add('thrash'); setTimeout(() => $('#bossShadow').classList.remove('thrash'), 1500); what = '大暴れ！！'; }
      else if (tier === 2) { push('f', 0.04, e.user, total); boss.lockUntil = Date.now() + 3000; what = '糸が絡まる！（リール封印）'; }
      else { push('f', Math.min(0.03, 0.006 * total), e.user, total); what = 'ヌシが暴れた！'; }
    } else {
      if (tier === 3) { push('a', 0.08, e.user, total); boss.boostUntil = Date.now() + 8000; what = '助っ人の船が到着！（8秒x2）'; }
      else if (tier === 2) { push('a', 0.08, e.user, total); what = 'タモ網で引き寄せ！'; }
      else { push('a', Math.min(0.03, 0.006 * total), e.user, total); what = '巻き上げ！'; }
    }
    banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">${esc(e.giftName)}×${e.count} → ${what}</div></div><div class="ic">${side === 'f' ? '🐟' : '🎣'}</div>`, side + (tier === 3 ? ' big' : ''), tier === 3 ? 3500 : 2200, tier === 3);
    pop(side === 'f' ? 260 : 820, 1300, `${side === 'f' ? '🐟' : '🎣'} ${e.user.nickname}`, side === 'f' ? '#2fb7ff' : '#ff8a1f');
  }

  function onChat(e) {
    const t = norm(e.text || '');
    if (boss) {
      if (/^(魚|さかな|サカナ|f)$/.test(t)) return joinTeam(e.user, 'f');
      if (/^(釣|つり|釣り|釣る|a)$/.test(t)) return joinTeam(e.user, 'a');
      if (boss.phase === 'result' && boss.penaltyPicker === e.user.id && /^[1-4]$/.test(t)) return choosePenalty(Number(t) - 1);
      const side = boss.team.get(e.user.id);
      if (side && boss.phase === 'battle') push(side, 0.004, e.user, 1);
      return;
    }
    if (/釣る|つる|釣り|cast/.test(t)) cast(e.user);
  }

  function onLike(e) {
    if (!boss || boss.phase !== 'battle') return;
    const side = boss.team.get(e.user.id);
    if (side) push(side, Math.min(0.02, 0.0015 * (e.count || 1)), e.user, Math.ceil((e.count || 1) / 5));
  }

  const handlers = {
    join: e => player(e.user),
    chat: onChat, gift: giftEffect, like: onLike,
    follow: e => banner(e.user, `<div class="av"></div><div><div class="who">${esc(e.user.nickname)}</div><div class="what">フォローありがとう！🎣</div></div>`, '', 2400),
    share: () => {},
    config: e => {
      if (e.autoreel != null && params.get('autoreel') == null) AUTOREEL = !!e.autoreel;
      if (e.bossInterval && !params.get('boss')) { BOSS_INTERVAL = e.bossInterval; if (!boss) nextBossAt = Math.min(nextBossAt, Date.now() + BOSS_INTERVAL * 1000); }
    },
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

  window.fishing = { emit: e => handlers[e.type]?.(e), boss: () => { nextBossAt = Date.now(); } };
})();
