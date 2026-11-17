// Tiny JSON-file store + event bus. Swap for a real database in production.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'db.json');
// Five demo support agents (fictional people; their addresses are never emailed).
export const SEED_AGENTS = [
  { id: 'AG-01', name: 'Sneha Kulkarni', role: 'Service Desk Lead', team: 'SAP Service Desk', email: 'sneha.kulkarni@company.in', modules: ['ALL'], access: 'admin' },
  { id: 'AG-02', name: 'Meera Pillai', role: 'SAP FI/CO Consultant', team: 'SAP FI/CO Team', email: 'meera.pillai@company.in', modules: ['FI', 'FI-AA', 'CO', 'TR', 'FSCM'] },
  { id: 'AG-03', name: 'Rohit Bansal', role: 'SAP MM/SD Consultant', team: 'SAP Logistics Team', email: 'rohit.bansal@company.in', modules: ['MM', 'SD', 'PP', 'QM', 'PM', 'EWM', 'TM', 'PS'] },
  { id: 'AG-04', name: 'Imran Qureshi', role: 'Basis & Security Administrator', team: 'Basis & Infrastructure', email: 'imran.qureshi@company.in', modules: ['BASIS', 'SEC', 'HANA', 'SOLMAN'] },
  { id: 'AG-05', name: 'Pooja Verma', role: 'ABAP & Integration Developer', team: 'Development Team', email: 'pooja.verma@company.in', modules: ['ABAP', 'FIORI', 'PI/PO', 'CPI', 'EDI'] },
];
const defaultSettings = () => ({ analysisMode: process.env.ANALYSIS_MODE === 'detailed' ? 'detailed' : 'basic' });
const empty = () => ({ seq: { ticket: 1001, email: 1 }, tickets: [], emails: [], agents: structuredClone(SEED_AGENTS), settings: defaultSettings() });

let db = empty();
let timer = null;

export function load() {
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = empty(); }
  if (!Array.isArray(db.agents) || !db.agents.length) { db.agents = structuredClone(SEED_AGENTS); save(); }
  // older data: give every user an access level and active flag (first user is the admin)
  db.agents.forEach((a, i) => { if (!a.access) a.access = i === 0 ? 'admin' : 'agent'; if (a.active === undefined) a.active = true; });
  const names = Object.fromEntries(db.agents.map(a => [a.id, a.name]));
  (db.tickets || []).forEach(t => { if (t.assigneeId && names[t.assigneeId] && t.assignee !== names[t.assigneeId]) t.assignee = names[t.assigneeId]; });
  if (!db.settings) { db.settings = defaultSettings(); save(); }
  return db;
}
export function isEmpty() { return db.tickets.length === 0 && db.emails.length === 0; }
export function reset() { db = empty(); flush(); }
function flush() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 1));
  fs.renameSync(FILE + '.tmp', FILE);
}
export function save() { clearTimeout(timer); timer = setTimeout(flush, 150); }

export const raw = () => db; // whole database object (sessions live here)
export const tickets = () => db.tickets;
export const agents = () => db.agents || [];
export const publicAgents = () => agents().map(({ passwordHash, ...a }) => ({ ...a, hasPassword: Boolean(passwordHash) }));
export const settings = () => db.settings || defaultSettings();
export function updateSettings(patch) {
  const s = { ...settings() };
  if (['basic', 'detailed'].includes(patch.analysisMode)) s.analysisMode = patch.analysisMode;
  if (['passwordless', 'password'].includes(patch.authMode)) s.authMode = patch.authMode;
  db.settings = s; save(); return s;
}
export const agent = id => (db.agents || []).find(a => a.id === id);
// ---- audit trail of admin actions (ticket actions live in each ticket's activity) ----
export function addAudit(entry) {
  if (!Array.isArray(db.audit)) db.audit = [];
  db.audit.push({ at: Date.now(), ...entry });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  save();
}
export const auditEntries = () => db.audit || [];
export const isAdmin = id => agent(id)?.access === 'admin' && agent(id)?.active !== false;

// ---- user management (admins only; checked by the server route) ----
const clean = v => String(v ?? '').trim();
function validateAgent(a, selfId) {
  const errs = [];
  if (a.name.length < 2) errs.push('Enter the full name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) errs.push('Enter a valid email address');
  else if (agents().some(x => x.id !== selfId && x.email.toLowerCase() === a.email.toLowerCase())) errs.push('Another user already has this email');
  if (!a.role) errs.push('Enter the role');
  if (!a.team) errs.push('Choose the team');
  if (!a.modules.length) errs.push('Pick at least one module (or All modules)');
  if (!['admin', 'agent'].includes(a.access)) errs.push('Choose Admin or Agent access');
  return errs;
}
const shape = (b, base = {}) => ({
  ...base,
  name: clean(b.name ?? base.name), email: clean(b.email ?? base.email).toLowerCase(), role: clean(b.role ?? base.role), team: clean(b.team ?? base.team),
  modules: Array.isArray(b.modules) ? [...new Set(b.modules.map(clean).filter(Boolean))] : base.modules || [],
  access: b.access ?? base.access ?? 'agent', active: b.active ?? base.active ?? true,
});
export function addAgent(body) {
  const a = shape(body);
  const errs = validateAgent(a); if (errs.length) return { errors: errs };
  const n = Math.max(0, ...agents().map(x => Number(String(x.id).replace(/\D/g, '')) || 0)) + 1;
  a.id = 'AG-' + String(n).padStart(2, '0');
  if (a.modules.includes('ALL')) a.modules = ['ALL'];
  db.agents.push(a); save(); return { agent: a };
}
export function updateAgent(id, body) {
  const cur = agent(id); if (!cur) return { errors: ['User not found'] };
  const a = shape(body, cur);
  const errs = validateAgent(a, id); if (errs.length) return { errors: errs };
  if (a.modules.includes('ALL')) a.modules = ['ALL'];
  // never leave the desk without an active admin
  const admins = agents().filter(x => x.id !== id && x.access === 'admin' && x.active !== false);
  if (!admins.length && (a.access !== 'admin' || a.active === false)) return { errors: ['At least one active admin is required'] };
  const renamed = cur.name !== a.name;
  Object.assign(cur, a);
  if (renamed) db.tickets.forEach(t => { if (t.assigneeId === id) t.assignee = cur.name; }); // keep ticket copies of the name in step
  save(); return { agent: cur };
}
export const emails = () => db.emails;
export const ticket = id => db.tickets.find(t => t.id.toUpperCase() === String(id).toUpperCase());
export const email = id => db.emails.find(e => e.id === id);
export const nextTicketId = () => `SAP-${db.seq.ticket++}`;
export const nextEmailId = () => `EM-${String(db.seq.email++).padStart(5, '0')}`;
export function addEmail(e) { db.emails.push(e); save(); return e; }
export function addTicket(t) { db.tickets.push(t); save(); return t; }
