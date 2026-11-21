// Escalation Matrix add-on ('escalation') + the background watcher for SLA warnings (add-on 'sla').
// Neither runs unless its add-on is licensed.
import * as store from './store.js';
import { addonEnabled } from './license.js';
import { slaOn, slaConfig, slaUsed } from './sla.js';
import { smtpConfigured, sendMail } from './mailer.js';
import { ticketLink, isPlaceholderEmail } from './pipeline.js';

export const escalationOn = () => addonEnabled('escalation');
const DONE = ['Resolved', 'Closed'];
const PL = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const TZ = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';
const fmt = ms => new Date(ms).toLocaleString('en-IN', { timeZone: TZ(), day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

export function defaultEscalationConfig() {
  const lead = store.agents().find(a => a.access === 'admin' && a.active !== false)?.id;
  const lvl = (name, percent, notify) => ({ name, percent, notify, emails: [] });
  return {
    rules: [
      { id: 'r-p1', name: 'Critical incidents', priority: 'P1', module: 'Any', levels: [lvl('Level 1', 50, ['assignee']), lvl('Level 2', 100, ['assignee', ...(lead ? [lead] : [])]), lvl('Level 3', 150, lead ? [lead] : [])] },
      { id: 'r-p2', name: 'High priority', priority: 'P2', module: 'Any', levels: [lvl('Level 1', 75, ['assignee']), lvl('Level 2', 100, ['assignee', ...(lead ? [lead] : [])])] },
    ],
  };
}
export const escalationConfig = () => store.settings().escalation || defaultEscalationConfig();

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validateEscalationConfig(c) {
  const errs = [], ids = new Set(store.agents().map(a => a.id));
  if (!Array.isArray(c.rules)) return ['Rules are missing'];
  for (const r of c.rules) {
    const label = r.name || `${r.priority} ${r.module}`;
    if (!String(r.name || '').trim()) errs.push('Every rule needs a name');
    if (!['Any', 'P1', 'P2', 'P3', 'P4'].includes(r.priority)) errs.push(`${label}: choose a priority`);
    if (!Array.isArray(r.levels) || !r.levels.length || r.levels.length > 4) errs.push(`${label}: use 1 to 4 levels`);
    let last = 0;
    for (const l of r.levels || []) {
      if (!(l.percent >= 10 && l.percent <= 500)) errs.push(`${label}: each level needs a time between 10% and 500%`);
      if (l.percent <= last) errs.push(`${label}: each level must come later than the one before`);
      last = l.percent;
      if (!(l.notify || []).length && !(l.emails || []).length) errs.push(`${label}: ${l.name || 'a level'} has nobody to notify`);
      if ((l.notify || []).some(n => n !== 'assignee' && !ids.has(n))) errs.push(`${label}: unknown user in ${l.name}`);
      if ((l.emails || []).some(e => !EMAIL.test(e))) errs.push(`${label}: check the extra email addresses in ${l.name}`);
    }
  }
  return [...new Set(errs)];
}

export function ruleFor(t, cfg = escalationConfig()) {
  const fits = cfg.rules.filter(r => (r.priority === 'Any' || r.priority === t.priority) && (r.module === 'Any' || r.module === t.module));
  const score = r => (r.module !== 'Any' ? 2 : 0) + (r.priority !== 'Any' ? 1 : 0);
  return fits.sort((a, b) => score(b) - score(a))[0] || null;
}

const log = (t, text, who = 'Escalation') => { t.activity.push({ at: Date.now(), who, text }); t.updatedAt = Date.now(); };
function recipients(t, level) {
  const out = [];
  for (const n of level.notify || []) {
    const a = n === 'assignee' ? store.agent(t.assigneeId) : store.agent(n);
    if (a && a.active !== false && !out.some(x => x.email === a.email)) out.push({ name: a.name, email: a.email });
  }
  for (const e of level.emails || []) if (!out.some(x => x.email === e)) out.push({ name: e, email: e });
  return out;
}
function mailBody(t, heading, extra) {
  const used = slaUsed(t);
  return [heading, '',
    `Ticket:    ${t.id}`, `Title:     ${t.title}`, `Module:    ${t.module}${t.subModule ? ' / ' + t.subModule : ''}`,
    `Priority:  ${t.priority} (${PL[t.priority]})`, `Status:    ${t.status}`, `Assigned:  ${t.assignee || 'Unassigned'} · ${t.assignmentGroup}`,
    `Requester: ${t.requester?.name} <${t.requester?.email}>`, `Resolve by: ${fmt(t.slaDueAt)}${used != null ? `  (${Math.round(used * 100)}% of the resolution time used)` : ''}`,
    ...(extra ? ['', extra] : []), '', `Open the ticket: ${ticketLink(t.id)}`, '', 'SensAI Desk'].join('\n');
}
async function notify(t, people, subject, text, what) {
  const real = people.filter(p => !isPlaceholderEmail(p.email));
  const skipped = people.filter(p => isPlaceholderEmail(p.email)).map(p => p.name);
  if (skipped.length) log(t, `${what}: not emailed to ${skipped.join(', ')} (placeholder address)`);
  if (!real.length) return;
  if (!smtpConfigured()) { log(t, `${what}: email not sent (outgoing mail not configured)`); return; }
  try { await sendMail({ to: real.map(p => p.email).join(', '), subject, text }); log(t, `${what}: emailed ${real.map(p => p.name).join(', ')}`); }
  catch (err) { log(t, `${what}: email failed (${String(err.message || err)})`); }
}

// Fire one escalation level (automatic or manual).
export async function escalate(t, levelIndex, reason, who = 'Escalation') {
  const rule = ruleFor(t); if (!rule || !rule.levels[levelIndex]) return null;
  const level = rule.levels[levelIndex], people = recipients(t, level);
  (t.escalations ||= []).push({ level: levelIndex + 1, name: level.name, rule: rule.name, at: Date.now(), by: who, reason, to: people.map(p => p.name) });
  t.escalationLevel = levelIndex + 1;
  log(t, `Escalated to ${level.name} (${rule.name})${reason ? ' · ' + reason : ''}`, who);
  store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
  await notify(t, people, `[${t.id}] Escalation ${level.name}: ${t.title}`, mailBody(t, `Ticket ${t.id} has been escalated to ${level.name}.`, reason), `${level.name} escalation`);
  store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
  return t.escalations[t.escalations.length - 1];
}

// ---------- background watcher: SLA warnings/breaches + automatic escalation ----------
async function tick() {
  const sla = slaOn(), esc = escalationOn();
  if (!sla && !esc) return;
  const warnAt = sla ? slaConfig().warnPercent / 100 : 1;
  for (const t of store.tickets()) {
    if (DONE.includes(t.status) || t.slaPausedAt) continue;
    const used = slaUsed(t); if (used == null) continue;
    const assignee = store.agent(t.assigneeId);
    if (sla && used >= warnAt && !t.slaWarnedAt) {
      t.slaWarnedAt = Date.now(); log(t, `SLA warning: ${Math.round(used * 100)}% of the resolution time used`, 'SLA');
      if (assignee) await notify(t, [{ name: assignee.name, email: assignee.email }], `[${t.id}] SLA warning: ${t.title}`, mailBody(t, `Ticket ${t.id} has used ${Math.round(used * 100)}% of its resolution time.`), 'SLA warning');
      store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
    }
    if (sla && used >= 1 && !t.slaBreachedAt) {
      t.slaBreachedAt = Date.now(); log(t, 'SLA breached: resolution time exceeded', 'SLA');
      if (assignee) await notify(t, [{ name: assignee.name, email: assignee.email }], `[${t.id}] SLA breached: ${t.title}`, mailBody(t, `Ticket ${t.id} has breached its resolution SLA.`), 'SLA breach');
      store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
    }
    if (esc) {
      const rule = ruleFor(t); if (!rule) continue;
      const fired = t.escalationLevel || 0;
      // highest level now due that has not fired yet (lower ones are skipped, so one email per jump)
      let due = -1; rule.levels.forEach((l, i) => { if (i >= fired && used * 100 >= l.percent) due = i; });
      if (due >= 0) await escalate(t, due, `${Math.round(used * 100)}% of the resolution time used`);
    }
  }
}
let timer = null;
export function startWatcher() {
  if (timer) return;
  const run = () => tick().catch(err => console.error('[escalation]', err.message));
  timer = setInterval(run, 60e3); setTimeout(run, 5e3);
}
// Report for the Escalation page
export function escalationLog(limit = 100) {
  return store.tickets().flatMap(t => (t.escalations || []).map(e => ({ ...e, id: t.id, title: t.title, priority: t.priority, status: t.status }))).sort((a, b) => b.at - a.at).slice(0, limit);
}

// Run the SLA-warning / escalation check immediately (used by tests and admin tools).
export const checkNow = () => tick();
