// TikTok Live -> virtual temple overlay bridge.
// Usage:
//   node server.js <tiktok_username>     connect to a live stream
//   node server.js --demo                generate fake events for testing
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8787;

const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const NOEL = args.includes('--noel');
const WEDDING = args.includes('--wedding');
const FISHING = args.includes('--fishing');
const BATTLE = args.includes('--battle');
const RACE = args.includes('--race');
const POND = args.includes('--pond');
const SEA = args.includes('--sea');
const USERNAME = (args.find(a => !a.startsWith('--')) || process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three');

// ---------- Avatar proxy (WebGL textures need same-origin images) ----------
const AVATAR_HOSTS = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|ibyteimg\.com|byteimg\.com|pravatar\.cc)$/;
const avatarCache = new Map();
async function proxyAvatar(req, res) {
  let target;
  try { target = new URL(new URL(req.url, 'http://x').searchParams.get('u')); } catch { res.writeHead(400).end(); return; }
  if (target.protocol !== 'https:' || !AVATAR_HOSTS.test(target.hostname)) { res.writeHead(403).end(); return; }
  try {
    let hit = avatarCache.get(target.href);
    if (!hit) {
      const r = await fetch(target, { signal: AbortSignal.timeout(5000) });
      const type = r.headers.get('content-type') || '';
      // Re-check host after redirects
      if (!r.ok || !type.startsWith('image/') || !AVATAR_HOSTS.test(new URL(r.url).hostname)) throw new Error('rejected');
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 2_000_000) throw new Error('too large');
      hit = { type, buf };
      avatarCache.set(target.href, hit);
      if (avatarCache.size > 500) avatarCache.delete(avatarCache.keys().next().value);
    }
    res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'max-age=3600' });
    res.end(hit.buf);
  } catch {
    res.writeHead(502).end();
  }
}

// ---------- Static file server ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/avatar') { proxyAvatar(req, res); return; }
  let base = PUBLIC_DIR;
  let rel = urlPath === '/' ? (SEA ? 'sea.html' : POND ? 'pond.html' : RACE ? 'race.html' : BATTLE ? 'battle.html' : FISHING ? 'fishing.html' : WEDDING ? 'wedding.html' : NOEL ? 'noel.html' : 'overlay.html') : urlPath.replace(/^\/+/, '');
  // Serve three.js (build + examples) from node_modules
  if (urlPath.startsWith('/vendor/three/')) { base = THREE_DIR; rel = urlPath.slice('/vendor/three/'.length); }
  const filePath = path.normalize(path.join(base, rel));
  if (!filePath.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- WebSocket broadcast to overlays ----------
const wss = new WebSocketServer({ server, path: '/ws' });
// Demo: shorter ceremony interval so the wedding loop is visible quickly
if (DEMO && WEDDING) wss.on('connection', ws => ws.send(JSON.stringify({ type: 'config', interval: 40 })));
if (DEMO && FISHING) wss.on('connection', ws => ws.send(JSON.stringify({ type: 'config', bossInterval: 45, autoreel: true })));
if (DEMO && RACE) wss.on('connection', ws => ws.send(JSON.stringify({ type: 'config', lobby: 12 })));
// --verbose: print one line per live event (helps check what TikTok actually sends)
const VERBOSE = args.includes('--verbose');
const ICONS = { join: '👋', chat: '💬', like: '❤️', gift: '🎁', follow: '➕', share: '🔁' };
function broadcast(evt) {
  const msg = JSON.stringify(evt);
  let clients = 0;
  for (const c of wss.clients) if (c.readyState === 1) { c.send(msg); clients++; }
  if (VERBOSE && !DEMO && ICONS[evt.type]) {
    const who = evt.user?.id ? evt.user.nickname : '(no id → ignored by overlay)';
    const extra = evt.type === 'chat' ? `: ${evt.text}` : evt.type === 'gift' ? `: ${evt.giftName} x${evt.count} (${evt.diamonds} coins)` : evt.type === 'like' ? ` x${evt.count}` : '';
    console.log(`${ICONS[evt.type]} ${evt.type} ${who}${extra}  [overlay pages: ${clients}]`);
  }
}

// ---------- Normalize TikTok payloads ----------
// tiktok-live-connector 2.5.0 emits raw proto (v3) messages: user.id / displayId / avatarThumb.urlList,
// chat.content, like.count, gift.gift.{name,diamondCount,type,image}. Older field names are kept as fallbacks.
function normUser(u = {}) {
  const avatar = u.avatarThumb?.urlList?.[0] || u.avatarMedium?.urlList?.[0] || u.profilePicture?.urls?.[0] || u.profilePictureUrl || '';
  const uniqueId = u.displayId || u.uniqueId || '';
  return {
    // Empty id -> overlays ignore the event (never use a random id: it would seat the same viewer repeatedly)
    id: String(u.id || u.idStr || u.userId || uniqueId || ''),
    uniqueId,
    nickname: u.nickname || uniqueId || 'Guest',
    avatar,
  };
}

// Combo gifts (type 1) send an event at the start (repeatEnd=0) and one when the combo ends (repeatEnd=1),
// ~3-4s later. React on the first event, then add only the extra count when the combo ends.
const comboSent = new Map(); // `${userId}:${groupId}` -> count already emitted
// Returns { count: to emit now, prev: already emitted in this combo, total: combo total so far }
function giftCount(key, streak, repeatCount, repeatEnd) {
  const n = repeatCount || 1;
  if (!streak) return { count: n, prev: 0, total: n };
  if (!repeatEnd) {
    if (comboSent.has(key)) return { count: 0, prev: comboSent.get(key), total: n };
    comboSent.set(key, n);
    if (comboSent.size > 1000) comboSent.delete(comboSent.keys().next().value);
    return { count: n, prev: 0, total: n };
  }
  const sent = comboSent.get(key) || 0;
  comboSent.delete(key);
  return { count: n - sent, prev: sent, total: n };
}

function connectTikTok(username) {
  let retry = 0;
  let current = null;
  let reconnectTimer = null;

  // Each attempt uses a brand-new connection object; the old one is torn down first
  const scheduleReconnect = (why, seconds) => {
    if (reconnectTimer) return;
    console.log(`↻ ${why}. Reconnecting in ${seconds}s`);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; start(); }, seconds * 1000);
  };
  const start = () => {
    if (current) { try { current.removeAllListeners(); current.disconnect()?.catch?.(() => {}); } catch { /* already closed */ } }
    // v2.5.0 requires an options object (crashes on undefined)
    const conn = new TikTokLiveConnection(username, {});
    current = conn;
    attach(conn);
    conn.on(WebcastEvent.STREAM_END, () => { console.log('Stream ended'); broadcast({ type: 'status', text: 'ended' }); scheduleReconnect('Waiting for the next live', 15); });
    conn.on('disconnected', () => { if (current === conn) scheduleReconnect('Disconnected', 5); });
    conn.on('error', err => {
      const msg = err?.exception?.message || err?.message || err?.info || String(err);
      if (!/isn't online/.test(msg)) console.error('⚠️ Connection error:', msg); // offline is reported by the connect() handler
    });
    conn.connect()
      .then(state => { retry = 0; console.log(`✅ Connected @${username} (roomId ${state.roomId})`); broadcast({ type: 'status', text: 'connected' }); })
      .catch(err => {
        // Poll every 10s while waiting for the live to start, so viewers who join early are not missed
        const wait = Math.min(10, 5 * ++retry);
        console.error(`❌ Connect failed: ${err?.message || err}`);
        scheduleReconnect('Not live yet or connection failed', wait);
      });
  };
  start();
}

// Event handlers for one connection
function attach(conn) {
  conn.on(WebcastEvent.MEMBER, d => broadcast({ type: 'join', user: normUser(d.user) }));
  conn.on(WebcastEvent.CHAT, d => broadcast({ type: 'chat', user: normUser(d.user), text: d.content ?? d.comment ?? '' }));
  conn.on(WebcastEvent.LIKE, d => broadcast({ type: 'like', user: normUser(d.user), count: d.count ?? d.likeCount ?? 1 }));
  conn.on(WebcastEvent.FOLLOW, d => broadcast({ type: 'follow', user: normUser(d.user) }));
  conn.on(WebcastEvent.SHARE, d => broadcast({ type: 'share', user: normUser(d.user) }));
  conn.on(WebcastEvent.GIFT, d => {
    const g = d.gift || {}, old = d.giftDetails || {};
    const giftType = g.type ?? old.giftType;
    const user = normUser(d.user);
    const { count, prev, total } = giftCount(`${user.id}:${d.groupId || d.giftId}`, giftType === 1, d.repeatCount, d.repeatEnd);
    if (count <= 0) return;
    // diamondCount = the gift's price in coins (what the viewer paid)
    broadcast({
      type: 'gift',
      user,
      giftName: g.name || old.giftName || `Gift #${d.giftId}`,
      giftImage: g.image?.urlList?.[0] || old.giftImage?.giftPictureUrl || '',
      diamonds: g.diamondCount ?? old.diamondCount ?? 1,
      count,
      comboPrev: prev,   // gifts of this combo already sent earlier
      comboTotal: total, // combo total so far (for event thresholds)
    });
  });
}

// Keep the overlay server alive during a stream and leave a trace if something goes wrong
process.on('uncaughtException', err => console.error('⚠️ Uncaught exception:', err?.stack || err));
process.on('unhandledRejection', err => console.error('⚠️ Unhandled rejection:', err?.stack || err));
process.on('exit', code => console.log(`Server process exiting (code ${code})`));

// ---------- Demo mode ----------
function startDemo() {
  const names = ['Minh An', 'Thảo Vy', 'Bảo Ngọc', 'Gia Huy', 'Tâm An', 'Phúc Lộc', 'Hải Đăng', 'Ngọc Hân', 'Thiện Tâm', 'Khánh Linh', 'Đức Trí', 'Mai Chi', 'Quang Vinh', 'Tuệ Minh', 'An Nhiên', 'Hoàng Long'];
  const gifts = NOEL
    ? [['Rose', 1], ['Kẹo gậy', 5], ['Người tuyết', 30], ['Tuần lộc', 99], ['Xe trượt tuyết', 500], ['Ông già Noel', 1000]]
    : [['Hoa hồng', 1], ['Nén nhang', 5], ['Đèn hoa sen', 30], ['Chuông vàng', 99], ['Tượng sư tử', 500], ['Thuyền rồng', 1000]];
  const chats = NOEL
    ? ['Merry Christmas 🎄', 'Giáng Sinh an lành cả nhà ơi', 'Ước gì Noel này có người yêu 😆', 'Tuyết đẹp quá', '🎅🎅🎅', 'Cây thông sáng lên nào!', 'Chúc mọi người Noel ấm áp']
    : ['Nam mô A Di Đà Phật 🙏', 'Cầu bình an cho gia đình', 'Chúc mọi người an lạc', 'Thật thanh tịnh', '🙏🙏🙏', 'Con xin cảm ơn ạ'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const users = names.map((n, i) => ({ id: 'demo' + i, uniqueId: 'user' + i, nickname: n, avatar: `https://i.pravatar.cc/120?img=${i + 5}` }));
  const joined = [];

  if (WEDDING) return startWeddingDemo(users, pick);
  if (FISHING) return startFishingDemo(pick);
  if (BATTLE) return startBattleDemo(pick);
  if (RACE) return startRaceDemo(pick);
  if (POND || SEA) return startPondDemo(pick);

  setInterval(() => {
    const r = Math.random();
    if (r < 0.35 || joined.length < 3) {
      const u = users.find(x => !joined.includes(x)) || pick(users);
      if (!joined.includes(u)) joined.push(u);
      broadcast({ type: 'join', user: u });
    } else if (r < 0.55) {
      const [giftName, diamonds] = pick(gifts);
      broadcast({ type: 'gift', user: pick(joined), giftName, giftImage: '', diamonds, count: 1 + Math.floor(Math.random() * 5) });
    } else if (r < 0.8) {
      broadcast({ type: 'chat', user: pick(joined), text: pick(chats) });
    } else if (r < 0.92) {
      broadcast({ type: 'like', user: pick(joined), count: 5 + Math.floor(Math.random() * 20) });
    } else {
      broadcast({ type: 'follow', user: pick(joined) });
    }
  }, 1800);
}

function startWeddingDemo(users, pick) {
  // Weighted gift list: steal-level gifts (>=299) are rare
  const gifts = [['Rose', 1], ['Rose', 1], ['Rose', 1], ['Bó hoa', 10], ['Bó hoa', 10], ['Nhẫn cưới', 99], ['Xe hoa', 299]];
  const chats = ['Ship cặp này 🚢', 'Đẹp đôi quá', 'Hóng lễ cưới', 'Cho em lên xe hoa với 😆', 'Ai ghép với tui đi', 'Nhà trai đông ghê'];
  const joined = [];
  setInterval(() => {
    const r = Math.random();
    if (joined.length < 6 || r < 0.15) {
      const u = users.find(x => !joined.includes(x));
      if (u) { joined.push(u); broadcast({ type: 'join', user: u }); return; }
    }
    const u = pick(joined);
    const idx = users.indexOf(u);
    if (r < 0.32) broadcast({ type: 'chat', user: u, text: idx % 2 ? 'gái' : 'trai' });
    else if (r < 0.45) broadcast({ type: 'chat', user: u, text: 'cưới' });
    else if (r < 0.75) broadcast({ type: 'chat', user: u, text: pick(['đồng ý', 'Đồng ý!!', '❤']) });
    else if (r < 0.85) broadcast({ type: 'chat', user: u, text: pick(chats) });
    else if (r < 0.95) { const [giftName, diamonds] = pick(gifts); broadcast({ type: 'gift', user: u, giftName, giftImage: '', diamonds, count: 1 + Math.floor(Math.random() * 3) }); }
    else broadcast({ type: 'like', user: u, count: 10 });
  }, 900);
}

function startFishingDemo(pick) {
  const names = ['たかし', 'ゆうき', 'さくら', 'はると', 'みゆ', 'そうた', 'ひなた', 'あおい', 'れん', 'ゆな', 'こはる', 'だいち', 'まお', 'りく', 'めい', 'しょう'];
  const users = names.map((n, i) => ({ id: 'jp' + i, uniqueId: 'jp' + i, nickname: n, avatar: `https://i.pravatar.cc/120?img=${i + 20}` }));
  // Weighted: big gifts are rare
  const gifts = [['バラ', 1], ['バラ', 1], ['バラ', 1], ['指ハート', 5], ['ドーナツ', 30], ['帽子とひげ', 99], ['コーギー', 299]];
  const chats = ['釣れるかな？', 'がんばれー！', 'でかいの来い！', 'わくわく', '今日の海きれい'];
  setInterval(() => {
    const u = pick(users);
    const r = Math.random();
    if (r < 0.38) broadcast({ type: 'chat', user: u, text: '釣る' });
    else if (r < 0.58) broadcast({ type: 'chat', user: u, text: Number(u.id.slice(2)) % 3 ? '釣' : '魚' });
    else if (r < 0.7) broadcast({ type: 'chat', user: u, text: pick(chats) });
    else if (r < 0.85) broadcast({ type: 'like', user: u, count: 5 + Math.floor(Math.random() * 10) });
    else { const [giftName, diamonds] = pick(gifts); broadcast({ type: 'gift', user: u, giftName, giftImage: '', diamonds, count: 1 + Math.floor(Math.random() * 2) }); }
  }, 800);
}

function startBattleDemo(pick) {
  const first = ['たか', 'ゆう', 'さく', 'はる', 'みゆ', 'そう', 'ひな', 'あお', 'れん', 'ゆな', 'こは', 'だい', 'まお', 'りく', 'めい'];
  const users = Array.from({ length: 30 }, (_, i) => ({ id: 'b' + i, uniqueId: 'b' + i, nickname: first[i % 15] + (i >= 15 ? 'ちゃん' : 'くん'), avatar: `https://i.pravatar.cc/120?img=${(i % 70) + 1}` }));
  const gifts = [['バラ', 1], ['バラ', 1], ['バラ', 1], ['指ハート', 5], ['ドーナツ', 30], ['帽子とひげ', 99], ['コーギー', 299], ['花火', 1088]];
  setInterval(() => {
    const u = pick(users);
    const r = Math.random();
    if (r < 0.3) broadcast({ type: 'chat', user: u, text: '参戦！' });
    else if (r < 0.65) broadcast({ type: 'chat', user: u, text: pick(['左', '右', 'ジャンプ', '右', '左']) });
    else if (r < 0.85) broadcast({ type: 'like', user: u, count: 5 });
    else { const [giftName, diamonds] = pick(gifts); broadcast({ type: 'gift', user: u, giftName, giftImage: '', diamonds, count: 1 }); }
  }, 350);
}

function startRaceDemo(pick) {
  const first = ['たか', 'ゆう', 'さく', 'はる', 'みゆ', 'そう', 'ひな', 'あお', 'れん', 'ゆな', 'こは', 'だい', 'まお', 'りく', 'めい'];
  const users = Array.from({ length: 30 }, (_, i) => ({ id: 'r' + i, uniqueId: 'r' + i, nickname: first[i % 15] + (i >= 15 ? 'ちゃん' : 'くん'), avatar: `https://i.pravatar.cc/128?img=${i + 1}` }));
  // Weighted: cheap gifts are common, big ones rare
  const gifts = [['バラ', 1], ['バラ', 1], ['バラ', 1], ['バラ', 1], ['指ハート', 5], ['指ハート', 5], ['ドーナツ', 30], ['ドーナツ', 30], ['帽子とひげ', 99], ['コーギー', 299], ['流れ星', 699], ['花火', 1088]];
  setInterval(() => {
    const u = pick(users);
    const r = Math.random();
    if (r < 0.3) broadcast({ type: 'chat', user: u, text: pick(['参加！', 'いけー！', 'がんばれ', '速い！']) });
    else if (r < 0.5) broadcast({ type: 'chat', user: u, text: 'ジャンプ' });
    else if (r < 0.8) broadcast({ type: 'like', user: u, count: 5 });
    else { const [giftName, diamonds] = pick(gifts); broadcast({ type: 'gift', user: u, giftName, giftImage: '', diamonds, count: 1 }); }
  }, 450);
}

function startPondDemo(pick) {
  const first = ['たか', 'ゆう', 'さく', 'はる', 'みゆ', 'そう', 'ひな', 'あお', 'れん', 'ゆな', 'こは', 'だい', 'まお', 'りく', 'めい'];
  const users = Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i, uniqueId: 'p' + i, nickname: first[i % 15] + (i >= 15 ? 'ちゃん' : 'くん'), avatar: `https://i.pravatar.cc/128?img=${i + 31}` }));
  // Weighted: cheap gifts common, big ones rare
  const gifts = [['バラ', 1], ['バラ', 1], ['バラ', 1], ['指ハート', 5], ['ドーナツ', 30], ['帽子とひげ', 99], ['コーギー', 299], ['流れ星', 699], ['花火', 1088]];
  const active = [];
  setInterval(() => {
    const r = Math.random();
    if (active.length < 6 || r < 0.15) {
      const u = users.find(x => !active.includes(x));
      if (u) { active.push(u); broadcast({ type: 'chat', user: u, text: pick(['参加！', '釣りたい！', 'やる！']) }); return; }
    }
    const u = pick(active);
    if (r < 0.75) broadcast({ type: 'like', user: u, count: 10 + Math.floor(Math.random() * 20) });
    else if (r < 0.9) broadcast({ type: 'chat', user: u, text: pick(['釣れた！', 'でかい！', 'いいな〜', '頑張れ']) });
    else { const [giftName, diamonds] = pick(gifts); broadcast({ type: 'gift', user: u, giftName, giftImage: '', diamonds, count: 1 }); }
  }, 700);
}

server.listen(PORT, () => {
  console.log(`🛕 Overlay: http://localhost:${PORT}/`);
  if (DEMO) { console.log('Demo mode: sending fake events'); startDemo(); }
  else if (USERNAME) connectTikTok(USERNAME);
  else { console.log('Usage: node server.js <tiktok_username>  |  node server.js --demo'); process.exit(1); }
});
