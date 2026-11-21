// Email → parsing → ticket action. Uses the AI parser when configured, the offline rules otherwise.
import crypto from 'node:crypto';
import * as store from './store.js';
import { saveAttachments } from './attachments.js';
import { applySla, slaStatusChange } from './sla.js';
import { parseWithClaude, claudeConfigured, ParseError } from './claude-parser.js';
import { parseWithRules } from './rules-parser.js';
import { smtpConfigured, sendMail } from './mailer.js';
import { MODULE_CODES, UNKNOWN, CATEGORIES, DECISIONS, PRIORITIES, SLA_HOURS, RESPONSE_HOURS, moduleByCode } from './taxonomy.js';

// Vague SAP requests still get a ticket (status Awaiting Info) so nothing is lost; set CLARIFY_CREATES_TICKET=false to only reply.
const CLARIFY_CREATES_TICKET = process.env.CLARIFY_CREATES_TICKET !== 'false';

// Live binding: importers always see the current value after Settings are saved.
export let MAILBOX = process.env.SUPPORT_MAILBOX || 'sap.helpdesk@company.in';
export function setMailbox(v) { if (v) MAILBOX = v; }
const DONE = ['Resolved', 'Closed'];
export const STATUSES = ['New', 'Awaiting Info', 'Assigned', 'In Progress', 'Awaiting Approval', 'Resolved', 'Closed'];

export function parseAddress(s) {
  const m = String(s || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
  const e = String(s || '').trim().toLowerCase();
  return { name: e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown sender', email: e || 'unknown@unknown' };
}

function context(email) {
  const open = store.tickets().filter(t => !DONE.includes(t.status))
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
  const ref = (`${email.subject}\n${email.body}`).match(/\bSAP-\d{4,}\b/i);
  return { mailbox: MAILBOX, openTickets: open, referencedTicket: ref ? store.ticket(ref[0]) : null };
}

// Accept 'pi/po', ' FI ', 'Basis' etc. and map to the canonical code; anything else becomes UNKNOWN.
const normModule = v => { const k = String(v || '').trim().toUpperCase().replace(/\s+/g, ''); return MODULE_CODES.find(c => c.toUpperCase() === k) || UNKNOWN; };

// Clamp model output to the allowed vocabulary so the UI never sees an unexpected value.
function sanitize(p) {
  const pick = (v, list, d) => list.includes(v) ? v : d;
  const arr = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
  const e = p.entities || {};
  return {
    ...p,
    category: pick(p.category, CATEGORIES, 'Incident'),
    decision: pick(p.decision, DECISIONS, 'create_ticket'),
    primary_module: normModule(p.primary_module),
    secondary_modules: [...new Set(arr(p.secondary_modules).map(normModule))].filter(c => c !== UNKNOWN && c !== normModule(p.primary_module)),
    priority: pick(p.priority, PRIORITIES, 'P3'),
    impact: pick(p.impact, ['Enterprise-wide', 'Multiple departments', 'Single department', 'Single user'], 'Single user'),
    urgency: pick(p.urgency, ['Critical', 'High', 'Medium', 'Low'], 'Medium'),
    sentiment: pick(p.sentiment, ['Calm', 'Concerned', 'Frustrated', 'Escalated'], 'Calm'),
    confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
    title: String(p.title || '').slice(0, 140),
    entities: Object.fromEntries(['transaction_codes', 'error_messages', 'document_numbers', 'company_codes', 'plants', 'other_org_units', 'materials', 'business_partners', 'programs_jobs_interfaces', 'sap_user_ids', 'systems'].map(k => [k, arr(e[k])])),
    missing_information: arr(p.missing_information),
    clarification_questions: arr(p.clarification_questions),
    suggested_next_steps: arr(p.suggested_next_steps),
    related_ticket_id: String(p.related_ticket_id || '').toUpperCase(),
    requester_details: Object.fromEntries(['name', 'designation', 'department', 'company', 'phone', 'location'].map(k => [k, String(p.requester_details?.[k] || '').trim()])),
    description: {
      ...Object.fromEntries(['problem_statement', 'expected_result', 'actual_result', 'business_impact', 'affected_users', 'first_occurred', 'workaround'].map(k => [k, String(p.description?.[k] || '').trim()])),
      steps_to_reproduce: arr(p.description?.steps_to_reproduce),
    },
    change_request: {
      ...Object.fromEntries(['requested_change', 'business_justification', 'approver', 'target_date'].map(k => [k, String(p.change_request?.[k] || '').trim()])),
      complexity: pick(p.change_request?.complexity, ['Low', 'Medium', 'High', 'Not applicable'], 'Not applicable'),
    },
  };
}

// Only the newest AI draft is current; older ones are kept for the record but marked superseded.
// AUTO_ACK=true (or legacy AUTO_REPLY=true): email the acknowledgement when a ticket is CREATED.
// Replies on existing tickets stay drafts, so an out-of-office reply can never start an email loop.
const autoAck = () => process.env.AUTO_ACK === 'true' || process.env.AUTO_REPLY === 'true';
const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const fmtTZ = ms => new Date(ms).toLocaleString('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const PL = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
export function ackText(t) {
  const first = (t.requester?.name || '').split(' ')[0] || 'Sir/Madam';
  return [`Dear ${first},`, '', 'Thank you for your email. Your request has been registered with SAP Support.', '', `Ticket number: ${t.id}`, `Subject: ${t.emailSubject || t.title}`, '', `Please keep [${t.id}] in the subject line of any reply about this request.`, '', `To add screenshots or files to this ticket, use: ${uploadLink(t)}`, '', 'Regards,', 'SAP Service Desk'].join('\n');
}
function addDraft(t, text, at, { acknowledge = false } = {}) {
  const reply = String(text || '').replaceAll('{TICKET_ID}', t.id).trim();
  if (!reply) return;
  for (const m of t.messages) if (m.draft) { m.draft = false; m.superseded = true; }
  const msg = { at, dir: 'auto', from: 'SAP Service Desk', email: MAILBOX, text: reply, draft: true, ack: acknowledge };
  t.messages.push(msg);
  if (acknowledge && autoAck() && smtpConfigured()) queueAutoReply(t, msg);
}
function queueAutoReply(t, msg) {
  setImmediate(async () => {
    try {
      await sendMail({ to: t.requester.email, subject: `[${t.id}] ${t.emailSubject || t.title}`, text: msg.text });
      Object.assign(msg, { draft: false, sent: true, auto: true });
      log(t, `Acknowledgement emailed to ${t.requester.email}`, 'Auto-intake');
    } catch (err) {
      msg.sendError = String(err.message || err);
      log(t, `Acknowledgement could not be sent: ${msg.sendError}`, 'Auto-intake');
    }
    store.save();
    store.bus.emit('change', { type: 'ticket', id: t.id });
  });
}

// Keep what we already know; fill blanks and add new facts from a later email.
function mergeDetails(oldD = {}, newD = {}) {
  const out = { ...oldD };
  for (const [k, v] of Object.entries(newD)) {
    if (Array.isArray(v)) out[k] = [...new Set([...(oldD[k] || []), ...v])];
    else if (v && typeof v === 'object') out[k] = mergeDetails(oldD[k], v);
    else if (v && (!oldD[k] || oldD[k] === 'Not stated' || oldD[k] === 'Not applicable')) out[k] = v;
  }
  return out;
}

const log = (t, text, who = 'Auto-intake') => { t.activity.push({ at: Date.now(), who, text }); t.updatedAt = Date.now(); };

function mergeEntities(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = [...new Set([...(a[k] || []), ...b[k]])];
  return out;
}

function createTicket(email, a, meta) {
  const mod = a.primary_module === UNKNOWN ? null : moduleByCode(a.primary_module);
  const now = Date.now();
  const id = store.nextTicketId();
  const vague = a.decision === 'request_clarification';
  // Only genuinely vague requests wait on the requester; detailed ones go straight to the team (missing items stay listed).
  const status = vague ? 'Awaiting Info' : a.category === 'Change Request' ? 'Awaiting Approval' : 'New';
  const t = {
    id, title: a.title || email.subject, summary: a.summary, needsClarification: vague,
    details: { requester: { ...a.requester_details, email: email.from.email }, description: a.description, changeRequest: a.category === 'Change Request' ? a.change_request : null },
    attachments: email.attachments || [],
    responseDueAt: now + RESPONSE_HOURS[a.priority] * 3600e3, firstResponseAt: null,
    category: ['Follow-up', 'Not SAP-related', 'Irrelevant'].includes(a.category) ? 'Incident' : a.category,
    module: a.primary_module, subModule: a.sub_module, secondaryModules: a.secondary_modules,
    process: a.business_process, priority: a.priority, impact: a.impact, urgency: a.urgency, priorityReason: a.priority_reason,
    status, assignmentGroup: mod?.team || 'SAP Service Desk', assignee: '',
    requester: email.from, createdAt: now, updatedAt: now, slaDueAt: now + SLA_HOURS[a.priority] * 3600e3,
    entities: a.entities, missing: a.missing_information, questions: a.clarification_questions, nextSteps: a.suggested_next_steps,
    sentiment: a.sentiment, confidence: a.confidence, reasoning: a.reasoning, engine: meta.engine, model: meta.model,
    watchers: [], emailIds: [email.id],
    messages: [{ at: email.receivedAt, dir: 'in', from: email.from.name, email: email.from.email, text: email.body, emailId: email.id }],
    activity: [],
  };
  log(t, `Created from email ${email.id} · ${t.category} · ${t.module}${t.subModule ? ' / ' + t.subModule : ''}`, 'Auto-intake');
  log(t, `Routed to ${t.assignmentGroup}`);
  t.emailSubject = String(email.subject || '').replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').trim();
  addDraft(t, ackText(t), now + 1, { acknowledge: true });
  // Detailed mode only: a suggested follow-up (e.g. clarification questions) for the agent to review. Never sent automatically.
  if (a.decision === 'request_clarification' && a.reply_to_requester) addDraft(t, a.reply_to_requester, now + 2);
  if (status === 'Awaiting Info') log(t, 'Waiting for: ' + a.missing_information.join(', '));
  // SLA add-on: policy-based deadlines in business hours; pause straight away if we are waiting on the requester.
  if (applySla(t)) { log(t, `SLA policy ${t.slaPolicy}`, 'SLA'); const n = slaStatusChange(t, 'New', t.status); if (n) log(t, n, 'SLA'); }
  return store.addTicket(t);
}

function updateTicket(t, email, a, kind) {
  const statusBefore = t.status;
  t.messages.push({ at: email.receivedAt, dir: 'in', from: email.from.name, email: email.from.email, text: email.body, emailId: email.id, duplicate: kind === 'duplicate' });
  t.emailIds.push(email.id);
  t.entities = mergeEntities(t.entities, a.entities);
  t.attachments = [...(t.attachments || []), ...(email.attachments || [])];
  let reclassified = false;
  if (kind !== 'duplicate') {
    // A vague ticket that now has real content gets properly classified.
    if ((t.needsClarification || t.module === UNKNOWN) && a.primary_module !== UNKNOWN && a.decision !== 'request_clarification') {
      reclassified = true;
      const m = moduleByCode(a.primary_module);
      log(t, `Reclassified from the new details: ${t.module} → ${a.primary_module}${a.sub_module ? ' / ' + a.sub_module : ''}, ${t.priority} → ${a.priority}`);
      Object.assign(t, { title: a.title || t.title, module: a.primary_module, subModule: a.sub_module, secondaryModules: a.secondary_modules, process: a.business_process, priority: a.priority, impact: a.impact, urgency: a.urgency, priorityReason: a.priority_reason, assignmentGroup: m?.team || t.assignmentGroup, needsClarification: false, confidence: a.confidence, reasoning: a.reasoning });
      // The reply describes the real request; "Follow-up" is about the email, not the ticket. Default to Incident.
      t.category = ['Incident', 'Change Request', 'Service Request', 'Query'].includes(a.category) && !(a.category === 'Query' && t.category === 'Query') ? a.category : 'Incident';
      t.slaDueAt = t.createdAt + SLA_HOURS[t.priority] * 3600e3;
      t.responseDueAt = t.createdAt + RESPONSE_HOURS[t.priority] * 3600e3;
      // The vague placeholder record is replaced by the new, real description (non-empty fields win).
      const fresh = Object.fromEntries(Object.entries(a.description).filter(([, v]) => Array.isArray(v) ? v.length : v));
      t.details = { ...t.details, description: { ...t.details?.description, ...fresh } };
      if (t.category === 'Change Request') t.details.changeRequest = a.change_request;
    }
    t.details = mergeDetails(t.details, { requester: email.from.email === t.requester.email ? a.requester_details : {}, description: a.description, changeRequest: t.category === 'Change Request' ? a.change_request : {} });
  }
  if (kind === 'duplicate') {
    if (!t.watchers.find(w => w.email === email.from.email)) t.watchers.push(email.from);
    log(t, `Duplicate report from ${email.from.name} linked; added as watcher`);
  } else {
    // The parser re-evaluates what is still missing using the referenced ticket context.
    const before = t.missing.length;
    t.missing = a.missing_information.filter(m => t.missing.some(x => x.toLowerCase().split(/\W+/)[0] === m.toLowerCase().split(/\W+/)[0])) ;
    if (a.missing_information.length === 0) t.missing = [];
    const filled = before - t.missing.length;
    if (a.summary) t.summary = a.summary;
    log(t, `Reply from ${email.from.name} added${filled > 0 ? ` · ${filled} missing detail${filled > 1 ? 's' : ''} now provided` : ''}`);
    addDraft(t, a.reply_to_requester, Date.now()); // fresh draft that reflects the new information
    if (t.status === 'Awaiting Info' && t.missing.length === 0) { t.status = 'In Progress'; log(t, 'All required information received → In Progress'); }
    else if (t.status === 'Awaiting Info' && reclassified) { t.status = t.category === 'Change Request' ? 'Awaiting Approval' : 'New'; log(t, `Enough detail to start work → ${t.status} (still open: ${t.missing.join(', ') || 'nothing'})`); }
    if (DONE.includes(t.status) && a.category !== 'Irrelevant') { t.status = 'In Progress'; log(t, 'Reopened: requester replied after resolution'); }
  }
  { const n = slaStatusChange(t, statusBefore, t.status); if (n) log(t, n, 'SLA'); }
  if (reclassified) applySla(t);
  t.updatedAt = Date.now();
  store.save();
}

export async function processEmail(raw, source = 'simulator') {
  const id = store.nextEmailId();
  // Files (incl. screenshots pasted into the body) are written to disk; only their details are kept on the email/ticket.
  const files = !Array.isArray(raw.attachments) ? [] : raw.reuseAttachments ? raw.attachments : saveAttachments(id, raw.attachments);
  const e = store.addEmail({
    id, source, receivedAt: Date.now(),
    from: typeof raw.from === 'string' ? parseAddress(raw.from) : raw.from,
    to: raw.to || MAILBOX, cc: raw.cc || '', subject: raw.subject || '(no subject)',
    body: String(raw.body || raw.text || '').replace(/\r\n/g, '\n').trim(),
    attachments: files,
    status: 'processing',
  });
  store.bus.emit('change', { type: 'email', id: e.id });

  const ctx = context(e);
  let result, error = null;
  if (claudeConfigured()) {
    try { result = await parseWithClaude(e, ctx, { mode: store.settings().analysisMode }); }
    catch (err) {
      error = err instanceof ParseError ? { kind: err.kind, message: err.message } : { kind: 'unexpected', message: String(err?.message || err) };
      console.error('[parser]', error.message);
      result = parseWithRules(e, ctx);
    }
  } else {
    result = parseWithRules(e, ctx);
  }

  const a = sanitize(result.parsed);
  // A ticket reference in the subject always wins over a "create" decision.
  if (ctx.referencedTicket && ['create_ticket', 'mark_duplicate'].includes(a.decision)) { a.decision = 'update_existing'; a.related_ticket_id = ctx.referencedTicket.id; }
  const related = a.related_ticket_id ? store.ticket(a.related_ticket_id) : null;
  if (['update_existing', 'mark_duplicate'].includes(a.decision) && !related) a.decision = a.is_sap_related ? 'create_ticket' : 'ignore';

  let ticketId = null;
  if (a.decision === 'create_ticket' || (a.decision === 'request_clarification' && a.is_sap_related && CLARIFY_CREATES_TICKET)) ticketId = createTicket(e, a, result.meta).id;
  else if (a.decision === 'update_existing') { updateTicket(related, e, a, 'update'); ticketId = related.id; }
  else if (a.decision === 'mark_duplicate') { updateTicket(related, e, a, 'duplicate'); ticketId = related.id; }

  Object.assign(e, { status: 'processed', analysis: a, meta: result.meta, error, ticketId, processedAt: Date.now() });
  store.save();
  store.bus.emit('change', { type: 'email', id: e.id, ticketId });
  return e;
}

export async function reprocessEmail(id) {
  const e = store.email(id);
  if (!e) return null;
  return processEmail({ from: e.from, to: e.to, cc: e.cc, subject: e.subject, body: e.body, attachments: e.attachments, reuseAttachments: true }, e.source.replace(/ \(re-run\)$/, '') + ' (re-run)');
}

// ---- assignment notification to the agent ----
const PLACEHOLDER_DOMAINS = /@(company\.in|example\.[a-z]+|.*\.test|.*\.invalid)$/i; // demo / fake addresses are never emailed
export const isPlaceholderEmail = e => PLACEHOLDER_DOMAINS.test(String(e || ''));
const notifyAssignee = () => process.env.NOTIFY_ASSIGNEE !== 'false';
const baseUrl = () => (process.env.APP_URL || `http://localhost${Number(process.env.PORT) === 80 ? '' : ':' + (process.env.PORT || 4100)}`).replace(/\/+$/, '');
// The desk lives at /app; signing in first brings the agent straight back to this ticket.
export const ticketLink = id => `${baseUrl()}/app#ticket-${id}`;
// Requester upload page for one ticket; the random key in the link is the only permission.
export function uploadLink(t) {
  if (!t.uploadKey) { t.uploadKey = crypto.randomBytes(12).toString('hex'); store.save(); }
  return `${baseUrl()}/upload/${t.id}?k=${t.uploadKey}`;
}
const htmlEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function assignmentEmail(t, ag, who) {
  const link = ticketLink(t.id);
  const rows = [['Ticket', t.id], ['Title', t.title], ['Module', `${t.module}${t.subModule ? ' / ' + t.subModule : ''}`], ['Category', t.category], ['Priority', `${t.priority} (${PL[t.priority]})`],
    ['Requester', `${t.requester?.name || ''} <${t.requester?.email || ''}>`], ['Status', t.status], ['Respond by', fmtTZ(t.responseDueAt)], ['Resolve by', fmtTZ(t.slaDueAt)]];
  const summary = t.details?.description?.problem_statement || t.summary || '';
  const missing = (t.missing || []).length ? `Still needed from the requester: ${t.missing.join(', ')}` : '';
  const text = [`Hi ${ag.name.split(' ')[0]},`, '', `Ticket ${t.id} has been assigned to you by ${who}.`, '', ...rows.map(([k, v]) => `${(k + ':').padEnd(12)}${v}`), '', 'Summary:', summary, ...(missing ? ['', missing] : []), '', `Open the ticket: ${link}`, '', 'SensAI Desk'].join('\n');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#18132F;max-width:600px">
    <p>Hi ${htmlEsc(ag.name.split(' ')[0])},</p><p>Ticket <b>${htmlEsc(t.id)}</b> has been assigned to you by ${htmlEsc(who)}.</p>
    <table style="border-collapse:collapse;margin:12px 0">${rows.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#6C6689;white-space:nowrap">${htmlEsc(k)}</td><td style="padding:4px 0"><b>${htmlEsc(v)}</b></td></tr>`).join('')}</table>
    <p style="margin:12px 0 4px;color:#6C6689">Summary</p><p style="margin:0">${htmlEsc(summary)}</p>${missing ? `<p style="color:#D9860B">${htmlEsc(missing)}</p>` : ''}
    <p style="margin:20px 0"><a href="${htmlEsc(link)}" style="background:#5B5CF6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open ${htmlEsc(t.id)}</a></p>
    <p style="color:#6C6689;font-size:12px">Or paste this link into your browser: ${htmlEsc(link)}</p><p style="color:#6C6689;font-size:12px">SensAI Desk</p></div>`;
  return { subject: `[${t.id}] Assigned to you: ${t.title}`, text, html };
}
function queueAssignmentEmail(t, ag, who) {
  if (!notifyAssignee() || !ag || ag.name === who) return; // self-assignment needs no email
  if (PLACEHOLDER_DOMAINS.test(ag.email)) { log(t, `Assignment email not sent to ${ag.name}: ${ag.email} is a placeholder address (update it under Users)`, 'Auto-intake'); return; }
  if (!smtpConfigured()) { log(t, `Assignment email not sent to ${ag.name}: outgoing mail is not configured`, 'Auto-intake'); return; }
  const mail = assignmentEmail(t, ag, who);
  setImmediate(async () => {
    try { await sendMail({ to: ag.email, ...mail }); log(t, `Assignment email sent to ${ag.name} (${ag.email})`, 'Auto-intake'); }
    catch (err) { log(t, `Assignment email to ${ag.name} could not be sent: ${String(err.message || err)}`, 'Auto-intake'); }
    store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
  });
}

export const RESOLUTION_CODES = ['Fixed – configuration', 'Fixed – code / transport', 'Fixed – master data', 'Fixed – authorization', 'User guidance / how-to', 'Workaround provided', 'Duplicate of another ticket', 'No response from requester', 'Not an SAP issue', 'Other'];

// Closing needs the case to be updated: resolution code + notes (root cause optional).
function closureError(t, patch) {
  if (!DONE.includes(patch.status) || patch.status === t.status) return null;
  const alreadyResolved = t.status === 'Resolved' && t.closure?.notes;
  const c = patch.closure || {};
  if (alreadyResolved && !c.notes) return null; // Resolved → Closed can reuse the existing resolution
  if (!String(c.notes || '').trim() || String(c.notes).trim().length < 10) return 'Add resolution notes (at least a sentence) before resolving or closing this ticket.';
  if (!RESOLUTION_CODES.includes(c.code)) return 'Choose a resolution code before resolving or closing this ticket.';
  return null;
}

function closureEmail(t, status) {
  const first = (t.requester?.name || '').split(' ')[0] || 'Sir/Madam';
  return [`Dear ${first},`, '', `Your request ${t.id} – ${t.emailSubject || t.title} has been ${status.toLowerCase()}.`, '', 'Resolution:', t.closure.notes, '',
    `If the issue is not fixed, reply to this email within 7 days and keep [${t.id}] in the subject; the ticket will be reopened.`, '', 'Regards,', 'SAP Service Desk'].join('\n');
}
function queueClosureEmail(t, status, who) {
  const msg = { at: Date.now(), dir: 'out', from: who, email: MAILBOX, text: closureEmail(t, status), closure: true };
  t.messages.push(msg);
  if (!smtpConfigured()) { log(t, `Closure email logged for ${t.requester.email} (SMTP not configured)`, who); return; }
  setImmediate(async () => {
    try { await sendMail({ to: t.requester.email, subject: `[${t.id}] ${t.emailSubject || t.title} – ${status}`, text: msg.text }); msg.sent = true; log(t, `Closure email sent to ${t.requester.email}`, who); }
    catch (err) { msg.sendError = String(err.message || err); log(t, `Closure email could not be sent: ${msg.sendError}`, who); }
    store.save(); store.bus.emit('change', { type: 'ticket', id: t.id });
  });
}

export function updateTicketFields(id, patch, who = 'Service Desk') {
  const t = store.ticket(id);
  if (!t) return null;
  const blocked = closureError(t, patch);
  if (blocked) return { error: blocked };
  const closing = DONE.includes(patch.status) && patch.status !== t.status;
  const reopening = patch.status && !DONE.includes(patch.status) && DONE.includes(t.status);
  const statusBefore = t.status;
  if ('assigneeId' in patch) {
    const ag = patch.assigneeId ? store.agent(patch.assigneeId) : null;
    if (patch.assigneeId && (!ag || ag.active === false)) return t; // unknown or deactivated user
    if ((t.assigneeId || '') !== (ag?.id || '')) {
      log(t, ag ? `Assigned to ${ag.name} (${ag.role})` : `Unassigned (was ${t.assignee || '—'})`, who);
      t.assigneeId = ag?.id || ''; t.assignee = ag?.name || '';
      if (ag && t.status === 'New') { t.status = 'Assigned'; log(t, 'Status New → Assigned', who); }
      if (ag) queueAssignmentEmail(t, ag, who); // after the status change so the email shows 'Assigned'
    }
  }
  const allowed = { status: STATUSES, priority: PRIORITIES, module: [...MODULE_CODES, UNKNOWN], category: CATEGORIES };
  if (patch.details && typeof patch.details === 'object') {
    // Agent edits to the ticket record (problem statement, impact, steps, CR fields, requester info).
    const clean = v => Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : typeof v === 'object' && v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : String(v ?? '').trim();
    const d = clean(patch.details);
    t.details = { ...t.details, ...d, description: { ...t.details?.description, ...d.description }, requester: { ...t.details?.requester, ...d.requester }, changeRequest: d.changeRequest ? { ...t.details?.changeRequest, ...d.changeRequest } : t.details?.changeRequest };
    log(t, 'Ticket details edited', who);
  }
  if (typeof patch.title === 'string' && patch.title.trim() && patch.title.trim() !== t.title) { log(t, `Title changed`, who); t.title = patch.title.trim().slice(0, 140); }
  for (const [k, v] of Object.entries(patch)) {
    if (allowed[k] && !allowed[k].includes(v)) continue;
    if (!['status', 'priority', 'module', 'subModule', 'category', 'assignmentGroup'].includes(k)) continue;
    if (t[k] === v) continue;
    log(t, `${{ subModule: 'Component', assignmentGroup: 'Team' }[k] || k[0].toUpperCase() + k.slice(1)} ${t[k] || '—'} → ${v || '—'}${k === 'priority' ? ' (SLA recalculated)' : ''}`, who);
    t[k] = v;
    if (k === 'module') { const m = moduleByCode(v); if (m && m.team !== t.assignmentGroup) { log(t, `Re-routed ${t.assignmentGroup} → ${m.team}`, who); t.assignmentGroup = m.team; } }
    if (k === 'priority') { t.slaDueAt = t.createdAt + SLA_HOURS[v] * 3600e3; t.responseDueAt = t.createdAt + RESPONSE_HOURS[v] * 3600e3; }
    if (k === 'category' && v === 'Change Request' && !t.details?.changeRequest) t.details = { ...t.details, changeRequest: { requested_change: '', business_justification: '', approver: '', target_date: '', complexity: 'Medium' } };
    if (k === 'status' && DONE.includes(v)) t.resolvedAt = t.resolvedAt || Date.now();
  }
  if (closing) {
    const c = patch.closure || {};
    if (c.notes) {
      if (t.closure) (t.closureHistory ||= []).push(t.closure);
      t.closure = { code: c.code, notes: String(c.notes).trim(), rootCause: String(c.rootCause || '').trim(), by: who, at: Date.now(), status: patch.status };
      log(t, `${patch.status} · ${c.code}${t.closure.rootCause ? ' · root cause recorded' : ''}`, who);
    }
    if (c.notify && t.closure) queueClosureEmail(t, patch.status, who);
  }
  if (reopening) { delete t.resolvedAt; log(t, 'Ticket reopened', who); }
  // SLA add-on: pause/resume on Awaiting Info, and re-apply the policy after priority/module/category changes.
  { const n = slaStatusChange(t, statusBefore, t.status); if (n) log(t, n, 'SLA'); }
  if (['priority', 'module', 'category'].some(k => k in patch)) applySla(t);
  store.save();
  store.bus.emit('change', { type: 'ticket', id });
  return t;
}

export async function addMessage(id, { text, kind, actor }) {
  const who = store.agent(actor)?.name || 'Service Desk';
  const t = store.ticket(id);
  if (!t || !text?.trim()) return null;
  const msg = { at: Date.now(), dir: kind === 'note' ? 'note' : 'out', from: who, email: kind === 'note' ? '' : MAILBOX, text: text.trim() };
  let delivery = null;
  if (kind !== 'note') {
    if (smtpConfigured()) {
      try {
        // Ticket ID in the subject lets the requester's reply thread back onto this ticket.
        await sendMail({ to: t.requester.email, subject: `[${t.id}] ${t.emailSubject || t.title}`, text: msg.text });
        msg.sent = true; delivery = 'sent';
      } catch (err) { msg.sendError = String(err.message || err); delivery = 'failed'; }
    } else delivery = 'logged';
  }
  t.messages.push(msg);
  if (kind !== 'note' && delivery !== 'failed') {
    if (!t.firstResponseAt) t.firstResponseAt = msg.at;
    for (const m of t.messages) if (m.draft) { m.draft = false; m.superseded = true; } // an agent has replied; old drafts are no longer pending
  }
  log(t, kind === 'note' ? 'Internal note added'
    : delivery === 'sent' ? `Reply emailed to ${t.requester.email}`
    : delivery === 'failed' ? `Reply to ${t.requester.email} could not be sent: ${msg.sendError}`
    : `Reply logged for ${t.requester.email} (SMTP not configured)`, who);
  store.save();
  store.bus.emit('change', { type: 'ticket', id });
  return { ticket: t, delivery, error: msg.sendError || null };
}
