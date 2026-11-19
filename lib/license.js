// License keys: signed with the vendor's private Ed25519 key (kept outside this app); this app only verifies.
// Format: SDK1.<base64url JSON payload>.<base64url signature>
// Payload: { id, customer, type: 'demo'|'annual', maxUsers, issued, expires }  (dates as ms since epoch)
import crypto from 'node:crypto';
import * as store from './store.js';

// Public half of the signing key. Replaced by `npm run license -- keygen`.
export const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAO5Q9HRh1z0TLzjoqg0l0hfUbif3JT8vyxv81B4IKrGE=
-----END PUBLIC KEY-----`;

const DAY = 864e5;
const b64u = { dec: s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64') };

export function verifyKey(raw) {
  const key = String(raw || '').trim().replace(/\s+/g, '');
  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== 'SDK1') return { ok: false, error: 'This is not a SensAI Desk license key. Paste the whole key, starting with SDK1.' };
  let payload;
  try { payload = JSON.parse(b64u.dec(parts[1]).toString('utf8')); } catch { return { ok: false, error: 'The license key is damaged. Paste it again exactly as you received it.' }; }
  let good = false;
  try { good = crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey(PUBLIC_KEY), b64u.dec(parts[2])); } catch { good = false; }
  if (!good) return { ok: false, error: 'The license key could not be verified. It may have been changed or issued for a different installation.' };
  if (!['demo', 'annual'].includes(payload.type) || !(payload.maxUsers > 0) || !(payload.expires > payload.issued)) return { ok: false, error: 'The license key contents are not valid.' };
  return { ok: true, key, payload };
}

// Current license state for the whole app.
export function licenseStatus() {
  const raw = store.settings().licenseKey;
  const activeUsers = store.agents().filter(a => a.active !== false).length;
  if (!raw) return { state: 'none', activeUsers, message: 'No license key has been entered.' };
  const v = verifyKey(raw);
  if (!v.ok) return { state: 'invalid', activeUsers, message: v.error };
  const p = v.payload, now = Date.now();
  const daysLeft = Math.ceil((p.expires - now) / DAY);
  const state = now < p.issued - DAY ? 'notyet' : now > p.expires ? 'expired' : 'valid';
  const warnAt = p.type === 'demo' ? 3 : 30;
  return {
    state, id: p.id, customer: p.customer, type: p.type, maxUsers: p.maxUsers, issued: p.issued, expires: p.expires,
    daysLeft: Math.max(0, daysLeft), activeUsers, overLimit: activeUsers > p.maxUsers,
    expiringSoon: state === 'valid' && daysLeft <= warnAt,
    message: state === 'expired' ? `The ${p.type === 'demo' ? 'demo' : 'annual'} license expired on ${new Date(p.expires).toDateString()}.` : state === 'notyet' ? 'This license is not valid yet.' : '',
  };
}
export const licenseActive = () => licenseStatus().state === 'valid';

// Seats: how many more active users the license allows (Infinity when no valid license, so the check is skipped there).
export function seatsLeft() {
  const s = licenseStatus();
  return s.state === 'valid' ? s.maxUsers - s.activeUsers : Infinity;
}

// Summary safe to show to every signed-in user (for the banner).
export const licenseBanner = () => { const s = licenseStatus(); return { state: s.state, type: s.type, daysLeft: s.daysLeft, expiringSoon: s.expiringSoon, expires: s.expires }; };
