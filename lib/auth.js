// Sign-in: cookie sessions, passwordless (pilot) or password mode, scrypt password hashes.
import crypto from 'node:crypto';
import * as store from './store.js';

const COOKIE = 'sd_session';
const WEEK = 7 * 24 * 3600e3;

// ---- passwords (scrypt; never stored in plain text) ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}
export const passwordProblem = pw => (String(pw).length < 8 ? 'Password must be at least 8 characters' : null);

// ---- sessions (kept in the database so a restart does not sign everyone out) ----
const sessions = () => (store.raw().sessions ||= {});
function readCookie(req) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}
export function currentUser(req) {
  const token = readCookie(req); if (!token) return null;
  const s = sessions()[token];
  if (!s || s.expires < Date.now()) { if (s) { delete sessions()[token]; store.save(); } return null; }
  const user = store.agent(s.userId);
  if (!user || user.active === false) return null; // disabled users lose access immediately
  return user;
}
function setCookie(res, token, maxAgeMs) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`);
}

// ---- brute-force guard: 10 attempts per minute per address ----
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (attempts.get(ip) || []).filter(t => now - t < 60e3);
  list.push(now); attempts.set(ip, list);
  return list.length > 10;
}

export const authMode = () => (store.settings().authMode === 'password' ? 'password' : 'passwordless');

export function login(req, res) {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = store.agents().find(a => a.email.toLowerCase() === email && a.active !== false);
  const mode = authMode();
  if (!user) return res.status(401).json({ error: 'No active user with that email. Ask your admin to add you on the Users page.' });
  if (mode === 'password') {
    if (!user.passwordHash) return res.status(401).json({ error: 'No password is set for this account yet. Ask your admin to set one.' });
    if (!verifyPassword(req.body?.password || '', user.passwordHash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions()[token] = { userId: user.id, created: Date.now(), expires: Date.now() + WEEK };
  store.addAudit({ who: user.name, area: 'Sign-in', action: 'Signed in', target: user.email, detail: mode === 'password' ? 'with password' : 'passwordless (pilot)' });
  setCookie(res, token, WEEK);
  res.json({ user: publicUser(user) });
}
export function logout(req, res) {
  const token = readCookie(req), user = currentUser(req);
  if (token) { delete sessions()[token]; store.save(); }
  if (user) store.addAudit({ who: user.name, area: 'Sign-in', action: 'Signed out', target: user.email, detail: '' });
  setCookie(res, '', 0);
  res.json({ ok: true });
}
export const publicUser = u => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, team: u.team, access: u.access });

// Every /api route except the ones listed needs a signed-in user. The acting user always comes
// from the session (never from the request body), so "who did what" in the audit log can be trusted.
const OPEN = [/^\/api\/auth\//, /^\/api\/inbound$/, /^\/api\/public\//]; // public = requester upload, checked by its own key
export function requireUser(req, res, next) {
  if (!req.path.startsWith('/api/') || OPEN.some(r => r.test(req.path))) return next();
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.actor = user.id;
  req.query.actor = user.id;
  next();
}
