/* =========================================================
   Plans Helper — Cloudflare Worker
   • GET /health  → status (does Wallet signing work?)
   • GET /ics     → serves a calendar invite as text/calendar so iPhone opens Apple Calendar's "Add All"
   • GET /pass    → builds + signs an Apple Wallet pass (.pkpass)
   No npm packages needed: paste this whole file into the Cloudflare dashboard editor.

   Wallet needs these Secrets (Settings → Variables and Secrets):
     PASS_TYPE_ID  e.g. pass.com.yourname.plans
     TEAM_ID       your 10-character Apple Team ID
     PASS_CERT     your Pass Type ID certificate (PEM text)
     PASS_KEY      its private key (PEM text, unencrypted)
     WWDR_CERT     Apple WWDR G4 intermediate certificate (PEM text)
   ========================================================= */

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (url.pathname === '/health') return json({ ok: true, app: 'plans-helper', version: 1, calendar: true, wallet: walletReady(env) });
      if (url.pathname === '/ics') return serveICS(url);
      if (url.pathname === '/pass') return await servePass(url, env);
      return page('👋 Plans Helper is running', 'Paste this Worker URL into Plans → Settings → Calendar &amp; Wallet helper.');
    } catch (e) {
      return page('😕 Something went wrong', esc(e.message || String(e)), 500);
    }
  }
};

/* ---------- helpers ---------- */
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(title, msg, status = 200) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plans</title>
<body style="font-family:-apple-system,system-ui;background:#1b0f3b;color:#fff;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">
<div><h2>${title}</h2><p style="opacity:.8;line-height:1.5">${msg}</p><p style="opacity:.6">You can close this and go back to Plans.</p></div></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS } });
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4);
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const safeName = n => (n || 'plan').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'plan';

/* ---------- Calendar ---------- */
function serveICS(url) {
  const d = url.searchParams.get('d'); if (!d) return page('😕 Missing invite', 'No calendar data was sent.', 400);
  const bytes = b64urlToBytes(d);
  const text = new TextDecoder().decode(bytes);
  if (!text.startsWith('BEGIN:VCALENDAR')) return page('😕 Not a calendar invite', 'The data did not look like an invite.', 400);
  return new Response(bytes, { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${safeName(url.searchParams.get('n'))}.ics"`,
    'Cache-Control': 'no-store', ...CORS } });
}

/* ---------- Wallet ---------- */
const walletReady = env => !!(env.PASS_TYPE_ID && env.TEAM_ID && env.PASS_CERT && env.PASS_KEY && env.WWDR_CERT);

async function servePass(url, env) {
  if (!walletReady(env)) return page('🪪 Wallet isn’t set up yet', 'This helper is missing its Apple pass certificate. Follow the Wallet steps in the Plans README.', 501);
  const d = url.searchParams.get('d'); if (!d) return page('😕 Missing pass', 'No pass data was sent.', 400);
  const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(d)));
  const app = url.searchParams.get('a') || '';

  const pass = Object.assign({}, data, {
    formatVersion: 1,
    passTypeIdentifier: env.PASS_TYPE_ID.trim(),
    teamIdentifier: env.TEAM_ID.trim(),
    organizationName: data.organizationName || 'Plans'
  });

  const files = { 'pass.json': new TextEncoder().encode(JSON.stringify(pass)) };
  // Images come from your Plans site (icons/pass/…). Wallet requires icon.png.
  if (/^https:\/\//.test(app)) {
    const want = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png'];
    await Promise.all(want.map(async n => {
      try { const r = await fetch(new URL(`icons/pass/${n}`, app)); if (r.ok) files[n] = new Uint8Array(await r.arrayBuffer()); } catch {}
    }));
  }
  if (!files['icon.png']) files['icon.png'] = FALLBACK_ICON();

  const manifest = {};
  for (const [n, b] of Object.entries(files)) manifest[n] = await hex(await crypto.subtle.digest('SHA-1', b));
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  files['manifest.json'] = manifestBytes;
  files['signature'] = await signDetached(manifestBytes, env);

  const zip = makeZip(files);
  return new Response(zip, { headers: {
    'Content-Type': 'application/vnd.apple.pkpass',
    'Content-Disposition': `attachment; filename="${safeName(url.searchParams.get('n'))}.pkpass"`,
    'Cache-Control': 'no-store', ...CORS } });
}
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/* ---------- PKCS#7 / CMS detached signature (no libraries) ---------- */
function pemToDer(pem) {
  const b64 = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
function dlen(n) {
  if (n < 128) return Uint8Array.of(n);
  const b = []; while (n > 0) { b.unshift(n & 255); n >>= 8; }
  return Uint8Array.of(0x80 | b.length, ...b);
}
const tlv = (tag, ...parts) => { const body = cat(...parts); return cat(Uint8Array.of(tag), dlen(body.length), body); };
const SEQ = (...p) => tlv(0x30, ...p), SET = (...p) => tlv(0x31, ...p);
const INT = n => tlv(0x02, Uint8Array.of(n));
const NUL = Uint8Array.of(0x05, 0x00);
const OCT = b => tlv(0x04, b);
function OID(s) {
  const p = s.split('.').map(Number), out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const b = [v & 127]; let x = v >> 7; while (x) { b.unshift((x & 127) | 128); x >>= 7; } out.push(...b); }
  return tlv(0x06, Uint8Array.from(out));
}
function utc(d) {
  const p = n => String(n).padStart(2, '0');
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(0x17, new TextEncoder().encode(s));
}
// minimal DER reader
function rd(b, i) {
  const tag = b[i]; let len = b[i + 1], h = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + b[i + 2 + k]; h = 2 + n; }
  return { tag, start: i, body: i + h, end: i + h + len };
}
function children(b, node) { const out = []; let i = node.body; while (i < node.end) { const c = rd(b, i); out.push(c); i = c.end; } return out; }
function issuerAndSerial(certDer) {
  const cert = rd(certDer, 0), tbs = children(certDer, cert)[0], f = children(certDer, tbs);
  let k = 0; if (f[0].tag === 0xa0) k = 1;                 // skip [0] version
  const serial = certDer.slice(f[k].start, f[k].end);       // INTEGER
  const issuer = certDer.slice(f[k + 2].start, f[k + 2].end); // Name
  return SEQ(issuer, serial);
}
function toPkcs8(der, pem) {
  if (!/BEGIN RSA PRIVATE KEY/.test(pem)) return der; // already PKCS#8
  return SEQ(INT(0), SEQ(OID('1.2.840.113549.1.1.1'), NUL), OCT(der));
}
function cmpBytes(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }

async function signDetached(content, env) {
  if (/ENCRYPTED/.test(env.PASS_KEY)) throw new Error('PASS_KEY is password-protected. Export it again without a password (see README).');
  const certDer = pemToDer(env.PASS_CERT), wwdrDer = pemToDer(env.WWDR_CERT);
  const keyDer = toPkcs8(pemToDer(env.PASS_KEY), env.PASS_KEY);
  const key = await crypto.subtle.importKey('pkcs8', keyDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', content));
  const sha256 = SEQ(OID('2.16.840.1.101.3.4.2.1'), NUL);
  const attrs = [
    SEQ(OID('1.2.840.113549.1.9.3'), SET(OID('1.2.840.113549.1.7.1'))), // contentType = data
    SEQ(OID('1.2.840.113549.1.9.5'), SET(utc(new Date()))),            // signingTime
    SEQ(OID('1.2.840.113549.1.9.4'), SET(OCT(digest)))                 // messageDigest
  ].sort(cmpBytes);
  const signedAttrsSet = SET(...attrs);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signedAttrsSet));

  const signerInfo = SEQ(
    INT(1), issuerAndSerial(certDer), sha256,
    tlv(0xa0, ...attrs),                                // [0] IMPLICIT signedAttrs
    SEQ(OID('1.2.840.113549.1.1.1'), NUL),              // rsaEncryption
    OCT(sig));
  const signedData = SEQ(
    INT(1), SET(sha256), SEQ(OID('1.2.840.113549.1.7.1')),
    tlv(0xa0, certDer, wwdrDer),                        // [0] IMPLICIT certificates
    SET(signerInfo));
  return SEQ(OID('1.2.840.113549.1.7.2'), tlv(0xa0, signedData));
}

/* ---------- ZIP (stored, no compression) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function makeZip(files) {
  const enc = new TextEncoder(), locals = [], centrals = []; let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = enc.encode(name), crc = crc32(data), sz = data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, n.length, true);
    const local = cat(new Uint8Array(lh.buffer), n, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, n.length, true);
    ch.setUint32(42, off, true);
    centrals.push(cat(new Uint8Array(ch.buffer), n)); locals.push(local); off += local.length;
  }
  const cd = cat(...centrals), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, centrals.length, true); end.setUint16(10, centrals.length, true);
  end.setUint32(12, cd.length, true); end.setUint32(16, off, true);
  return cat(...locals, cd, new Uint8Array(end.buffer));
}

/* tiny 1×1 purple PNG, only used if the icons can't be fetched */
function FALLBACK_ICON() {
  return b64urlToBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg');
}
