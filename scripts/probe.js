// Read-only probe: connect to a public live, print the field layout of a few events of each type
// (strings masked), test the avatar proxy, then exit. Nothing is sent to the room or saved.
// Usage: node scripts/probe.js <username> [seconds] [proxyBase]
import { TikTokLiveConnection } from 'tiktok-live-connector';

const username = (process.argv[2] || '').replace(/^@/, '');
const seconds = Number(process.argv[3]) || 120;
const proxyBase = process.argv[4] || 'http://localhost:8787';
if (!username) { console.log('Usage: node scripts/probe.js <username> [seconds] [proxyBase]'); process.exit(1); }

const WANT = ['Gift', 'Like', 'Member', 'Social', 'Chat'];
const MAX_PER_TYPE = 2;
const counts = {};
const avatarUrls = new Set();
const host = u => { try { return new URL(u).hostname; } catch { return '?'; } };

// Field layout with values masked; the huge user object is reduced to the fields the overlay needs
function shape(v, depth = 0) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.startsWith('http') ? `url(${host(v)})` : `str(${v.length})`;
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `…${v.length}`] : [];
  if (depth > 2) return '{…}';
  const out = {};
  for (const [k, val] of Object.entries(v)) if (k !== 'common') out[k] = shape(val, depth + 1);
  return out;
}
function userSummary(u = {}) {
  const urls = u.avatarThumb?.urlList || [];
  if (urls[0]) avatarUrls.add(urls[0]);
  return { id: typeof u.id, displayId: typeof u.displayId, nickname: typeof u.nickname, avatarThumbUrls: urls.length };
}

const conn = new TikTokLiveConnection(username, {});
conn.on('decodedData', (type, msg) => {
  const k = type.replace('Webcast', '').replace('Message', '');
  if (!WANT.includes(k)) return;
  counts[k] = (counts[k] || 0) + 1;
  const d = msg?.data || msg;
  if (d?.user) userSummary(d.user);
  if (counts[k] <= MAX_PER_TYPE) {
    const { user, ...rest } = d || {};
    console.log(`\n[${k} #${counts[k]}] user=${JSON.stringify(userSummary(user))}\n${JSON.stringify(shape(rest), null, 1)}`);
  }
});

async function finish() {
  console.log('\n===== SUMMARY =====');
  console.log('event counts:', counts);
  console.log('avatar hosts seen:', [...new Set([...avatarUrls].map(host))]);
  for (const u of [...avatarUrls].slice(0, 2)) {
    try {
      const r = await fetch(`${proxyBase}/avatar?u=${encodeURIComponent(u)}`);
      console.log(`proxy test (${host(u)}): HTTP ${r.status} ${r.headers.get('content-type') || ''} ${(await r.arrayBuffer()).byteLength} bytes`);
    } catch (e) { console.log('proxy test failed:', e.message); }
  }
  process.exit(0);
}

conn.connect()
  .then(() => { console.log(`connected; listening ${seconds}s`); setTimeout(finish, seconds * 1000); })
  .catch(err => { console.error('connect failed:', err?.message || err); process.exit(2); });
