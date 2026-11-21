import './lib/env.js';
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import * as store from './lib/store.js';
import { processEmail, reprocessEmail, updateTicketFields, addMessage, MAILBOX, STATUSES, RESOLUTION_CODES, parseAddress, uploadLink } from './lib/pipeline.js';
import { parseWithClaude, claudeConfigured, MODEL, EFFORT, ParseError } from './lib/claude-parser.js';
import { parseWithRules } from './lib/rules-parser.js';
import { GROUPS, MODULES, CATEGORIES, PRIORITIES, SLA_HOURS } from './lib/taxonomy.js';
import { SAMPLES } from './lib/samples.js';
import { imapState, imapConfig, parseEml } from './lib/imap.js';
import { smtpInfo } from './lib/mailer.js';
import { getMailSettings, saveMailSettings, testImap, testSmtp, startInbound } from './lib/mail-settings.js';
import { requireUser, login, logout, currentUser, authMode, publicUser, hashPassword, passwordProblem } from './lib/auth.js';
import { saveAttachments, sendAttachment } from './lib/attachments.js';
import { verifyKey, licenseStatus, licenseBanner, seatsLeft } from './lib/license.js';
import { ADDONS } from './lib/addons.js';

const PORT = Number(process.env.PORT) || 4100;
const PUB = path.resolve('public');
const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '5mb' }));
app.use(['/api/inbound/eml', '/api/eml/parse'], express.text({ type: '*/*', limit: '10mb' }));
app.use(['/api/tickets/:id/attachments', '/api/public/upload/:id'], express.raw({ type: () => true, limit: '16mb' }));

store.load();

// ---------- pages ----------
// "/" is the landing + sign-in page, "/app" is the desk (signed-in users only), "/upload/:id" is the requester upload page.
app.get('/', (req, res) => res.sendFile(path.join(PUB, 'login.html')));
app.get(['/app', '/app/'], (req, res) => currentUser(req) ? res.sendFile(path.join(PUB, 'index.html')) : res.redirect('/'));
app.get('/upload/:id', (req, res) => res.sendFile(path.join(PUB, 'upload.html')));
app.get('/index.html', (req, res) => res.redirect('/app'));
app.use(express.static(PUB, { index: false }));

// ---------- sign-in (open) ----------
app.get('/api/auth/config', (req, res) => res.json({ mode: authMode() }));
app.get('/api/auth/me', (req, res) => { const u = currentUser(req); u ? res.json(publicUser(u)) : res.status(401).json({ error: 'Not signed in' }); });
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);

// Everything below needs a signed-in user (except /api/inbound and /api/public/*). The acting user comes from the session.
app.use(requireUser);

const health = () => ({ engine: claudeConfigured() ? 'claude' : 'rules', mailbox: MAILBOX, imap: imapState, smtp: smtpInfo(), inboundTokenRequired: Boolean(process.env.INBOUND_TOKEN) });
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => { console.error(err); res.status(500).json({ error: String(err.message || err) }); });
const actorName = req => req.user?.name || 'Unknown';
const adminOnly = (req, res) => { if (store.isAdmin(req.user?.id)) return true; res.status(403).json({ error: 'Only an admin can do this.' }); return false; };
const publicAgent = a => { const { passwordHash, ...rest } = a; return { ...rest, hasPassword: Boolean(passwordHash) }; };

// ---------- read ----------
app.get('/api/health', (req, res) => res.json(health()));
app.get('/api/meta', (req, res) => res.json({ groups: GROUPS, modules: MODULES.map(({ kw, ...m }) => m), categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES, resolutionCodes: RESOLUTION_CODES, sla: SLA_HOURS, samples: SAMPLES, addons: ADDONS }));
const publicSettings = () => { const { licenseKey, ...s } = store.settings(); return s; };
app.get('/api/state', (req, res) => res.json({ me: publicUser(req.user), license: store.isAdmin(req.user.id) ? licenseStatus() : licenseBanner(), health: health(), settings: publicSettings(), tickets: store.tickets().map(({ uploadKey, ...t }) => t), emails: store.emails(), agents: store.publicAgents() }));
app.get('/api/agents', (req, res) => res.json(store.publicAgents()));
app.get('/api/tickets/:id', (req, res) => { const t = store.ticket(req.params.id); if (!t) return res.status(404).json({ error: 'Ticket not found' }); const { uploadKey, ...rest } = t; res.json(rest); });

// ---------- users (admin) ----------
function applyPassword(agent, password) {
  if (!password) return null;
  const bad = passwordProblem(password); if (bad) return bad;
  const a = store.agent(agent.id); a.passwordHash = hashPassword(password); store.save(); return null;
}
app.post('/api/agents', (req, res) => {
  if (!adminOnly(req, res)) return;
  const { actor, password, ...b } = req.body;
  if (password && passwordProblem(password)) return res.status(400).json({ error: passwordProblem(password) });
  if (b.active !== false && seatsLeft() <= 0) return res.status(400).json({ error: seatError() });
  const r = store.addAgent(b); if (r.errors) return res.status(400).json({ error: r.errors.join('. ') });
  applyPassword(r.agent, password);
  store.addAudit({ who: actorName(req), area: 'Users', action: 'User added', target: r.agent.name, detail: `${r.agent.role} · ${r.agent.team} · ${r.agent.access === 'admin' ? 'Admin' : 'Agent'}${password ? ' · password set' : ''}` });
  store.bus.emit('change', { type: 'agents' }); res.json(publicAgent(r.agent));
});
app.patch('/api/agents/:id', (req, res) => {
  if (!adminOnly(req, res)) return;
  const { actor, password, ...b } = req.body;
  if (password && passwordProblem(password)) return res.status(400).json({ error: passwordProblem(password) });
  const before = { ...store.agent(req.params.id) };
  if (before.active === false && b.active === true && seatsLeft() <= 0) return res.status(400).json({ error: seatError() });
  const r = store.updateAgent(req.params.id, b); if (r.errors) return res.status(400).json({ error: r.errors.join('. ') });
  applyPassword(r.agent, password);
  const a = r.agent;
  const changes = ['name', 'email', 'role', 'team', 'access'].filter(k => before[k] !== a[k]).map(k => `${k}: ${before[k]} → ${a[k]}`);
  if (String(before.modules) !== String(a.modules)) changes.push(`modules: ${a.modules.join(', ')}`);
  if (password) changes.push('password changed');
  const action = before.active !== false && a.active === false ? 'User disabled' : before.active === false && a.active !== false ? 'User re-enabled' : 'User updated';
  if (changes.length || action !== 'User updated') store.addAudit({ who: actorName(req), area: 'Users', action, target: a.name, detail: changes.join(' · ') });
  store.bus.emit('change', { type: 'agents' }); res.json(publicAgent(a));
});

// ---------- settings (admin) ----------
app.get('/api/settings', (req, res) => res.json(publicSettings()));

// ---------- license (admin) ----------
const seatError = () => { const s = licenseStatus(); return `Your license allows ${s.maxUsers} active users (admins included) and all are in use. Disable a user or apply a license with more users.`; };
app.get('/api/license', (req, res) => res.json(store.isAdmin(req.user.id) ? licenseStatus() : licenseBanner()));
app.post('/api/license', (req, res) => {
  if (!adminOnly(req, res)) return;
  const v = verifyKey(req.body?.key);
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (v.payload.expires < Date.now()) return res.status(400).json({ error: `This key expired on ${new Date(v.payload.expires).toDateString()}. Ask for a new key.` });
  store.updateSettings({ licenseKey: v.key });
  const p = v.payload;
  store.addAudit({ who: actorName(req), area: 'Settings', action: 'License key applied', target: p.customer, detail: `${p.type === 'demo' ? 'Demo' : 'Annual'} · ${p.maxUsers} users · valid until ${new Date(p.expires).toDateString()}${(p.addons || []).length ? ' · add-ons: ' + p.addons.join(', ') : ''} · ${p.id}` });
  store.bus.emit('change', { type: 'settings' });
  res.json(licenseStatus());
});
app.post('/api/settings', (req, res) => {
  if (!adminOnly(req, res)) return;
  const prev = store.settings();
  if (req.body.authMode === 'password' && !store.agents().some(a => a.access === 'admin' && a.active !== false && a.passwordHash))
    return res.status(400).json({ error: 'Set a password for at least one admin (Users page) before requiring passwords.' });
  const s = store.updateSettings(req.body || {});
  if (prev.analysisMode !== s.analysisMode) store.addAudit({ who: actorName(req), area: 'Settings', action: 'Ticket parsing changed', target: '', detail: `${prev.analysisMode} → ${s.analysisMode}` });
  if ((prev.authMode || 'passwordless') !== (s.authMode || 'passwordless')) store.addAudit({ who: actorName(req), area: 'Settings', action: 'Sign-in method changed', target: '', detail: `${prev.authMode || 'passwordless'} → ${s.authMode}` });
  store.bus.emit('change', { type: 'settings' }); res.json(s);
});
app.get('/api/settings/mail', (req, res) => { if (!adminOnly(req, res)) return; res.json(getMailSettings()); });
app.post('/api/settings/mail', (req, res) => {
  if (!adminOnly(req, res)) return;
  const { actor, ...body } = req.body || {};
  const r = saveMailSettings(body); if (!r.ok) return res.status(400).json({ error: r.errors.join('. ') });
  const parts = [];
  if (body.imap) parts.push(`incoming ${body.imap.user || ''} @ ${body.imap.host || ''}:${body.imap.port || ''}${body.imap.password ? ' · password changed' : ''}`);
  if (body.inbound) parts.push(`read mail using ${body.inbound}`);
  if (body.smtp) parts.push(`outgoing ${body.smtp.user || ''} @ ${body.smtp.host || ''}:${body.smtp.port || ''}${body.smtp.password ? ' · password changed' : ''} · acknowledgements ${body.smtp.autoAck ? 'on' : 'off'} · assignment emails ${body.smtp.notifyAssignee === false ? 'off' : 'on'}`);
  store.addAudit({ who: actorName(req), area: 'Settings', action: body.smtp ? 'Outgoing mail settings saved' : 'Incoming mail settings saved', target: '', detail: parts.join(' · ') });
  store.bus.emit('change', { type: 'settings' }); res.json(r.settings);
});
app.post('/api/settings/mail/test', wrap(async (req, res) => { if (!adminOnly(req, res)) return; const { kind, values } = req.body || {}; res.json(kind === 'smtp' ? await testSmtp(values) : await testImap(values)); }));

// ---------- audit (admin) ----------
app.get('/api/audit', (req, res) => {
  if (!store.isAdmin(req.user.id)) return res.status(403).json({ error: 'The audit log is visible to admins only.' });
  const tickets = store.tickets().flatMap(t => (t.activity || []).map(a => ({ at: a.at, who: /claude|rules/i.test(a.who) ? 'Auto-intake' : a.who, area: 'Tickets', action: a.text, target: t.id, detail: t.title })));
  res.json([...store.auditEntries(), ...tickets].sort((x, y) => y.at - x.at).slice(0, 3000));
});

// ---------- live updates (Server-Sent Events) ----------
app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  const send = ev => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  store.bus.on('change', send);
  req.on('close', () => { clearInterval(ping); store.bus.off('change', send); });
});

// ---------- inbound email ----------
const validateEmail = b => (!b || !b.from || !b.subject || !(b.body || b.text) ? 'Provide from, subject and body.' : null);
app.post('/api/emails', wrap(async (req, res) => { const bad = validateEmail(req.body); if (bad) return res.status(400).json({ error: bad }); res.json(await processEmail(req.body, req.body.source || 'simulator')); }));
// Webhook (open, protected by INBOUND_TOKEN when set)
app.post('/api/inbound', wrap(async (req, res) => {
  if (process.env.INBOUND_TOKEN && req.get('x-inbound-token') !== process.env.INBOUND_TOKEN) return res.status(401).json({ error: 'Invalid x-inbound-token' });
  const b = req.body || {};
  const payload = { from: b.from || b.sender, to: b.to, cc: b.cc, subject: b.subject, body: b.body || b.text || b['body-plain'] || (b.html || '').replace(/<[^>]+>/g, ' ') };
  const bad = validateEmail(payload); if (bad) return res.status(400).json({ error: bad });
  const e = await processEmail(payload, 'webhook');
  res.json({ emailId: e.id, decision: e.analysis.decision, ticketId: e.ticketId, module: e.analysis.primary_module, category: e.analysis.category, priority: e.analysis.priority });
}));
app.post('/api/inbound/eml', wrap(async (req, res) => { if (!req.body || typeof req.body !== 'string') return res.status(400).json({ error: 'Send the raw .eml content as the request body.' }); res.json(await processEmail(await parseEml(req.body), 'eml-upload')); }));
app.post('/api/eml/parse', wrap(async (req, res) => { if (!req.body || typeof req.body !== 'string') return res.status(400).json({ error: 'Send the raw .eml content as the request body.' }); const { attachments, ...e } = await parseEml(req.body); res.json(e); }));
app.post('/api/emails/:id/reprocess', wrap(async (req, res) => { const e = await reprocessEmail(req.params.id); e ? res.json(e) : res.status(404).json({ error: 'Email not found' }); }));
app.post('/api/parse', wrap(async (req, res) => {
  const b = req.body || {};
  const bad = validateEmail(b); if (bad) return res.status(400).json({ error: bad });
  const email = { from: typeof b.from === 'string' ? parseAddress(b.from) : b.from, to: b.to || MAILBOX, cc: b.cc || '', subject: b.subject, body: b.body, receivedAt: Date.now() };
  const ctx = { mailbox: MAILBOX, openTickets: store.tickets().filter(t => !['Resolved', 'Closed'].includes(t.status)).slice(-40), referencedTicket: null };
  if (b.engine === 'rules' || !claudeConfigured()) return res.json(parseWithRules(email, ctx));
  try { res.json(await parseWithClaude(email, ctx, { mode: b.mode || store.settings().analysisMode })); }
  catch (err) { if (err instanceof ParseError) return res.status(502).json({ error: err.message, kind: err.kind }); throw err; }
}));

// ---------- attachments ----------
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|bmp|pdf|txt|log|csv|xlsx?|docx?|pptx?|zip|eml|msg)$/i;
function acceptUpload(t, req, who, source) {
  const name = decodeURIComponent(req.get('x-filename') || '').trim();
  const buf = req.body;
  if (!name) return 'Missing file name.';
  if (!ALLOWED_EXT.test(name)) return 'This file type is not accepted. Use images, PDF, Office, text, log, zip or email files.';
  if (!Buffer.isBuffer(buf) || !buf.length) return 'The file is empty.';
  if (buf.length > 15 * 1024 * 1024) return 'Files must be 15 MB or smaller.';
  if ((t.attachments || []).filter(a => a.uploadedBy).length >= 30) return 'This ticket already has the maximum number of uploaded files.';
  const type = String(req.get('content-type') || 'application/octet-stream').split(';')[0].trim();
  const [meta] = saveAttachments(`T-${t.id}`, [{ name, contentType: type, content: buf }]);
  Object.assign(meta, { uploadedBy: who, source, at: Date.now() });
  (t.attachments ||= []).push(meta);
  t.activity.push({ at: Date.now(), who, text: `${source === 'requester' ? 'Requester uploaded' : 'Uploaded'} ${meta.name}` });
  t.updatedAt = Date.now(); store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
  return meta;
}
app.get('/api/tickets/:id/attachments/:att', (req, res) => { const a = store.ticket(req.params.id)?.attachments?.find(x => x.id === req.params.att); a ? sendAttachment(res, a) : res.status(404).json({ error: 'File not found' }); });
app.get('/api/emails/:id/attachments/:att', (req, res) => { const a = store.email(req.params.id)?.attachments?.find(x => x.id === req.params.att); a ? sendAttachment(res, a) : res.status(404).json({ error: 'File not found' }); });
app.post('/api/tickets/:id/attachments', (req, res) => { const t = store.ticket(req.params.id); if (!t) return res.status(404).json({ error: 'Ticket not found' }); const r = acceptUpload(t, req, req.user.name, 'agent'); typeof r === 'string' ? res.status(400).json({ error: r }) : res.json(r); });
app.get('/api/tickets/:id/upload-link', (req, res) => { const t = store.ticket(req.params.id); t ? res.json({ link: uploadLink(t) }) : res.status(404).json({ error: 'Ticket not found' }); });

// Requester upload page API (no sign-in; the unguessable key in the link is the permission, for one ticket only)
function ticketForKey(req) {
  const t = store.ticket(req.params.id), k = String(req.query.k || '');
  if (!t?.uploadKey || k.length !== t.uploadKey.length) return null;
  return crypto.timingSafeEqual(Buffer.from(k), Buffer.from(t.uploadKey)) ? t : null;
}
app.get('/api/public/upload/:id', (req, res) => {
  const t = ticketForKey(req); if (!t) return res.status(404).json({ error: 'This upload link is not valid. Use the link from your acknowledgement email.' });
  res.json({ id: t.id, title: t.title, closed: ['Closed'].includes(t.status), files: (t.attachments || []).filter(a => a.source === 'requester').map(a => ({ name: a.name, size: a.size, at: a.at })) });
});
app.post('/api/public/upload/:id', (req, res) => {
  const t = ticketForKey(req); if (!t) return res.status(404).json({ error: 'This upload link is not valid.' });
  if (t.status === 'Closed') return res.status(400).json({ error: 'This ticket is closed. Reply to the closure email to reopen it.' });
  const r = acceptUpload(t, req, t.requester?.name || 'Requester', 'requester');
  typeof r === 'string' ? res.status(400).json({ error: r }) : res.json({ name: r.name, size: r.size });
});

// ---------- ticket actions ----------
app.patch('/api/tickets/:id', (req, res) => { const { actor, ...patch } = req.body || {}; const t = updateTicketFields(req.params.id, patch, req.user.name); if (!t) return res.status(404).json({ error: 'Ticket not found' }); if (t.error) return res.status(400).json({ error: t.error }); const { uploadKey, ...rest } = t; res.json(rest); });
app.post('/api/tickets/:id/messages', wrap(async (req, res) => { const r = await addMessage(req.params.id, req.body || {}); r ? res.json({ ...r, ticket: undefined }) : res.status(400).json({ error: 'Ticket not found or empty message' }); }));
app.post('/api/reset', (req, res) => { if (!adminOnly(req, res)) return; store.reset(); store.addAudit({ who: actorName(req), area: 'Settings', action: 'All tickets and emails cleared', target: '', detail: '' }); store.bus.emit('change', { type: 'reset' }); res.json({ ok: true }); });

app.listen(PORT, () => {
  const local = `http://localhost${PORT === 80 ? '' : ':' + PORT}`;
  console.log(`\n  SensAI Desk  →  ${process.env.APP_URL || local}${process.env.APP_URL ? `   (also ${local})` : ''}`);
  console.log(`  Parsing: ${claudeConfigured() ? `${MODEL}${EFFORT ? ', effort ' + EFFORT : ''}` : 'offline rules (set ANTHROPIC_API_KEY in .env)'} · sign-in: ${authMode()}`);
  const ic = imapConfig();
  const mode = startInbound();
  const inbound = mode === 'off' ? 'off' : mode === 'graph' ? `Microsoft 365 → ${MAILBOX}` : ic.host && ic.user ? `IMAP ${ic.user} @ ${ic.host} every ${Math.round(ic.everyMs / 1000)}s (new mail only)` : 'off (no IMAP settings)';
  console.log(`  Mailbox: ${MAILBOX}`);
  console.log(`  Inbound mail: ${inbound}   SMTP replies: ${smtpInfo() ? smtpInfo().host : 'off'}\n`);
});
