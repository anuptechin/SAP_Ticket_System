// SLA Management add-on ('sla'): policies, business hours, holidays, pause while awaiting the requester.
// When the add-on is not licensed nothing here changes a ticket: the fixed SLA_HOURS / RESPONSE_HOURS apply.
import * as store from './store.js';
import { addonEnabled } from './license.js';
import { SLA_HOURS, RESPONSE_HOURS } from './taxonomy.js';

const MIN = 60000;
export const slaOn = () => addonEnabled('sla');
const DONE = ['Resolved', 'Closed'];

export function defaultSlaConfig() {
  return {
    policies: ['P1', 'P2', 'P3', 'P4'].map(p => ({ id: 'default-' + p, priority: p, module: 'Any', category: 'Any', responseHours: RESPONSE_HOURS[p], resolutionHours: SLA_HOURS[p] })),
    businessHours: { enabled: false, days: [1, 2, 3, 4, 5, 6], start: '09:30', end: '18:30' }, // 0 = Sunday
    holidays: [],               // [{ date: 'YYYY-MM-DD', name }]
    pauseOnAwaitingInfo: true,
    warnPercent: 75,
  };
}
export const slaConfig = () => ({ ...defaultSlaConfig(), ...(store.settings().sla || {}) });

// ---------- validation for the settings page ----------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validateSlaConfig(c) {
  const errs = [];
  if (!Array.isArray(c.policies) || !c.policies.length) errs.push('Keep at least one SLA policy');
  for (const p of c.policies || []) {
    if (!['P1', 'P2', 'P3', 'P4'].includes(p.priority)) errs.push('Each policy needs a priority P1–P4');
    if (!(p.responseHours > 0 && p.responseHours <= 2000) || !(p.resolutionHours > 0 && p.resolutionHours <= 2000)) errs.push(`Hours must be between 0 and 2000 (${p.priority})`);
    if (p.responseHours > p.resolutionHours) errs.push(`Response time cannot be longer than resolution time (${p.priority}${p.module !== 'Any' ? ' · ' + p.module : ''})`);
  }
  for (const p of ['P1', 'P2', 'P3', 'P4']) if (!(c.policies || []).some(x => x.priority === p && x.module === 'Any' && x.category === 'Any')) errs.push(`Keep the default policy for ${p}`);
  const b = c.businessHours || {};
  if (b.enabled) {
    if (!HHMM.test(b.start) || !HHMM.test(b.end) || b.start >= b.end) errs.push('Business hours need a start before the end, e.g. 09:30 – 18:30');
    if (!Array.isArray(b.days) || !b.days.length) errs.push('Pick at least one working day');
  }
  for (const h of c.holidays || []) if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date)) errs.push('Holiday dates must look like 2026-12-25');
  if (!(c.warnPercent >= 10 && c.warnPercent <= 99)) errs.push('Warning must be between 10% and 99%');
  return [...new Set(errs)];
}

// ---------- calendar maths in the desk's time zone ----------
const TZ = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';
function tzOffsetMin(ms) {
  const s = new Date(ms).toLocaleString('en-US', { timeZone: TZ(), hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [mo, d, y, h, mi, se] = s.match(/\d+/g).map(Number);
  return Math.round((Date.UTC(y, mo - 1, d, h % 24, mi, se) - Math.floor(ms / 1000) * 1000) / MIN);
}
function local(ms) { const off = tzOffsetMin(ms); const d = new Date(ms + off * MIN); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay(), off }; }
const at = (p, hh, mm, dayShift = 0) => Date.UTC(p.y, p.m, p.d + dayShift, hh, mm) - p.off * MIN;
const ymd = p => `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
const hoursOn = cfg => { const b = cfg.businessHours || {}; return b.enabled && HHMM.test(b.start) && HHMM.test(b.end) && b.start < b.end && (b.days || []).length; };

function windowFor(ms, cfg) {
  const p = local(ms), b = cfg.businessHours;
  if (!b.days.includes(p.dow) || (cfg.holidays || []).some(h => h.date === ymd(p))) return { p, open: null };
  const [sh, sm] = b.start.split(':').map(Number), [eh, em] = b.end.split(':').map(Number);
  return { p, open: at(p, sh, sm), close: at(p, eh, em) };
}
// Add working minutes to a moment (wall-clock minutes when business hours are off).
export function addWorkingMinutes(start, minutes, cfg = slaConfig()) {
  if (!hoursOn(cfg)) return start + minutes * MIN;
  let t = start, rem = minutes;
  for (let i = 0; i < 4000; i++) {
    const w = windowFor(t, cfg);
    if (!w.open || t >= w.close) { t = at(w.p, 0, 0, 1); continue; }
    if (t < w.open) t = w.open;
    const avail = (w.close - t) / MIN;
    if (rem <= avail) return t + rem * MIN;
    rem -= avail; t = at(w.p, 0, 0, 1);
  }
  return t;
}
// Working minutes between two moments.
export function workingMinutesBetween(a, b, cfg = slaConfig()) {
  if (b <= a) return 0;
  if (!hoursOn(cfg)) return (b - a) / MIN;
  let t = a, sum = 0;
  for (let i = 0; i < 4000 && t < b; i++) {
    const w = windowFor(t, cfg);
    if (w.open) sum += Math.max(0, (Math.min(b, w.close) - Math.max(t, w.open)) / MIN);
    t = at(w.p, 0, 0, 1);
  }
  return sum;
}

// ---------- policies ----------
export function policyFor(t, cfg = slaConfig()) {
  const fits = cfg.policies.filter(p => p.priority === t.priority && (p.module === 'Any' || p.module === t.module) && (p.category === 'Any' || p.category === t.category));
  const score = p => (p.module !== 'Any' ? 2 : 0) + (p.category !== 'Any' ? 1 : 0);
  return fits.sort((a, b) => score(b) - score(a))[0] || { priority: t.priority, module: 'Any', category: 'Any', responseHours: RESPONSE_HOURS[t.priority], resolutionHours: SLA_HOURS[t.priority] };
}
export const policyLabel = p => `${p.priority}${p.module !== 'Any' ? ' · ' + p.module : ''}${p.category !== 'Any' ? ' · ' + p.category : ''}`;

// Recalculate a ticket's due dates under the SLA add-on. Returns false (no change) when it is not licensed.
export function applySla(t) {
  if (!slaOn()) return false;
  const cfg = slaConfig(), p = policyFor(t, cfg);
  t.slaPolicy = policyLabel(p);
  t.slaTotalMin = p.resolutionHours * 60;
  t.responseDueAt = addWorkingMinutes(t.createdAt, p.responseHours * 60, cfg);
  t.slaDueAt = addWorkingMinutes(t.createdAt, p.resolutionHours * 60 + (t.slaPausedMin || 0), cfg);
  if (t.slaPausedAt) t.slaDueAt = Math.max(t.slaDueAt, Date.now()); // while paused the deadline is held
  return true;
}
// Pause while waiting on the requester; resume and push the deadline out by the paused working time.
export function slaStatusChange(t, from, to) {
  if (!slaOn() || !slaConfig().pauseOnAwaitingInfo) return null;
  if (to === 'Awaiting Info' && from !== 'Awaiting Info' && !t.slaPausedAt) { t.slaPausedAt = Date.now(); return 'SLA paused while waiting on the requester'; }
  if (from === 'Awaiting Info' && to !== 'Awaiting Info' && t.slaPausedAt) {
    const mins = Math.round(workingMinutesBetween(t.slaPausedAt, Date.now()));
    t.slaPausedMin = (t.slaPausedMin || 0) + mins; delete t.slaPausedAt; applySla(t);
    return `SLA resumed · ${mins} working minute${mins === 1 ? '' : 's'} paused`;
  }
  return null;
}
// Share of the resolution time used (1.0 = due now). Works with or without the add-on.
export function slaUsed(t, now = Date.now()) {
  if (DONE.includes(t.status)) return null;
  if (slaOn() && t.slaTotalMin) {
    const cfg = slaConfig();
    const used = workingMinutesBetween(t.createdAt, t.slaPausedAt || now, cfg) - (t.slaPausedMin || 0);
    return Math.max(0, used / t.slaTotalMin);
  }
  return (now - t.createdAt) / Math.max(1, t.slaDueAt - t.createdAt);
}

// ---------- compliance report ----------
export function slaReport(days = 30) {
  const since = Date.now() - days * 864e5;
  const tickets = store.tickets();
  const resolved = tickets.filter(t => t.resolvedAt && t.resolvedAt >= since);
  const met = t => t.resolvedAt <= t.slaDueAt;
  const group = key => Object.entries(resolved.reduce((acc, t) => { const k = t[key] || '—'; (acc[k] ||= []).push(t); return acc; }, {}))
    .map(([k, L]) => ({ key: k, resolved: L.length, met: L.filter(met).length, pct: Math.round(L.filter(met).length / L.length * 100) })).sort((a, b) => a.key.localeCompare(b.key));
  const open = tickets.filter(t => !DONE.includes(t.status));
  const warn = slaConfig().warnPercent / 100;
  return {
    days, resolved: resolved.length, met: resolved.filter(met).length,
    pct: resolved.length ? Math.round(resolved.filter(met).length / resolved.length * 100) : null,
    byPriority: group('priority'), byModule: group('module'),
    breached: open.filter(t => (slaUsed(t) ?? 0) >= 1).map(t => ({ id: t.id, title: t.title, priority: t.priority, assignee: t.assignee, due: t.slaDueAt })),
    atRisk: open.filter(t => { const u = slaUsed(t) ?? 0; return u >= warn && u < 1; }).map(t => ({ id: t.id, title: t.title, priority: t.priority, assignee: t.assignee, due: t.slaDueAt, used: Math.round(slaUsed(t) * 100) })),
    paused: open.filter(t => t.slaPausedAt).length,
  };
}
