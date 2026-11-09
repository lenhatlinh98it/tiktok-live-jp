// Read-only raw probe: logs connection lifecycle, decoded message types and the field layout
// of one sample per type (string values masked). Nothing is sent or saved.
// Usage: node scripts/probe-raw.js <username> [seconds]
import { TikTokLiveConnection } from 'tiktok-live-connector';

const username = (process.argv[2] || '').replace(/^@/, '');
const seconds = Number(process.argv[3]) || 90;
const typeCounts = {};
const samples = {};

// Describe an object's shape: keys -> type, strings masked, arrays summarised
function shape(v, depth = 0) {
  if (v == null) return v;
  if (typeof v === 'string') return v.startsWith('http') ? `url(${new URL(v).hostname})` : `str(${v.length})`;
  if (typeof v !== 'object') return typeof v;
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `…${v.length}`] : [];
  if (depth > 3) return '{…}';
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = shape(val, depth + 1);
  return out;
}

const conn = new TikTokLiveConnection(username, {});
conn.on('websocketConnected', () => console.log('websocket connected'));
conn.on('disconnected', () => console.log('disconnected'));
conn.on('error', e => console.log('error:', e?.message || e));
conn.on('decodedData', (type, data) => {
  typeCounts[type] = (typeCounts[type] || 0) + 1;
  if (!samples[type] && /Chat|Gift|Member|Like|Social/.test(type)) { samples[type] = true; console.log(`\n[${type}]`, JSON.stringify(shape(data), null, 1)); }
});

conn.connect()
  .then(() => { console.log(`connected, listening ${seconds}s`); setTimeout(() => { console.log('\ntype counts:', typeCounts); process.exit(0); }, seconds * 1000); })
  .catch(err => { console.error('connect failed:', err?.message || err); process.exit(2); });
