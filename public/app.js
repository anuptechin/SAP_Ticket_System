/* SensAI Desk — front end (vanilla JS, no build step) */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = 36e5, D = 864e5;
const DONE = ['Resolved', 'Closed'];
const PL = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const DEC = { create_ticket: 'Ticket created', update_existing: 'Ticket updated', mark_duplicate: 'Duplicate linked', request_clarification: 'Clarification', ignore: 'Ignored', reject: 'Rejected', processing: 'Processing…' };
const CAT_COLOR = { 'Incident': '#F0564F', 'Change Request': '#5B5CF6', 'Service Request': '#10B489', 'Query': '#A5A1BE', 'Follow-up': '#22B8E0', 'Not SAP-related': '#D9860B', 'Irrelevant': '#C9C5DC' };

const IC = {
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  tix: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/>',
  map: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  lab: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', ref: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  mag: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  log: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rep: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  flow: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  clip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
};
const ico = (k, a = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a}>${IC[k]}</svg>`;

let META = null, S = { health: {}, tickets: [], emails: [], agents: [] };
const UI = { view: 'dashboard', openId: null, iSel: null, iFilter: 'all', tQ: '', tGroup: 'all', tMod: 'all', tCat: 'all', tPrio: 'all', tAsg: 'all', tStatus: 'open', tMode: 'table', tSort: { key: 'created', dir: 'desc' }, cmp: 'reply',labResults: null, labBusy: false };
try { Object.assign(UI, JSON.parse(localStorage.getItem('sapai-ui') || '{}'), { openId: null, labResults: null, labBusy: false }); } catch { /* ignore */ }
UI.me = null; // set from the signed-in session at start-up
const saveUI = () => { try { localStorage.setItem('sapai-ui', JSON.stringify({ tMode: UI.tMode, tSort: UI.tSort })); } catch { /* ignore */ } };
if (!UI.tSort || !UI.tSort.key) UI.tSort = { key: 'created', dir: 'desc' };

/* ---------- API ---------- */
async function api(method, url, body, raw) {
  const r = await fetch(url, { method, headers: raw ? { 'Content-Type': 'text/plain' } : body ? { 'Content-Type': 'application/json' } : {}, body: raw ? body : body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.href = '/?next=' + encodeURIComponent(location.hash); throw new Error('Signed out'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
async function refresh() { S = await api('GET', '/api/state'); UI.me = S.me?.id; if (UI.view === 'audit') { if ($('.toolbar')?.contains(document.activeElement)) { renderNav(); return; } AUDIT = null; } if (UI.view === 'setup' && !$('.settings :focus')) MAILCFG = null; if (UI.view === 'setup' && $('.settings :focus')) { renderNav(); return; } render(); }

/* ---------- helpers ---------- */
function toast(msg, bad) { const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.innerHTML = '<i></i>' + esc(msg); $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4200); }
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function avatar(name) {
  if (/service desk|claude/i.test(name)) return `<span class="av" style="background:var(--grad)">${ico('spark', 'width="14" height="14"')}</span>`;
  const ini = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const h = hue(name); return `<span class="av" style="background:linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 40) % 360} 75% 60%))">${esc(ini)}</span>`;
}
const fmt = t => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
function ago(t) { const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; return Math.round(h / 24) + 'd ago'; }
function dur(ms) { const a = Math.abs(ms), h = Math.floor(a / H), m = Math.floor(a % H / 6e4); return h >= 48 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + m + 'm' : m + 'm'; }
const mod = code => META.modules.find(m => m.code === code);
const grp = code => META.groups.find(g => g.id === mod(code)?.group);
const mcolor = code => grp(code)?.color || '#9A94B9';
const modChip = code => `<span class="modchip" title="${esc(mod(code)?.name || 'Unclassified')}"><i style="background:${mcolor(code)}"></i>${esc(code || 'UNKNOWN')}</span>`;
const prioPill = p => `<span class="prio prio-${p}" title="${PL[p]}"><i></i>${p}</span>`;
const stCls = s => s === 'New' ? 'st-new' : /Awaiting/.test(s) ? 'st-wait' : DONE.includes(s) ? 'st-done' : 'st-work';
const statusPill = s => `<span class="pill ${stCls(s)}">${esc(s)}</span>`;
const decPill = d => `<span class="dec dec-${d}">${esc(DEC[d] || d)}</span>`;
const engPill = () => '';
function slaChip(t) {
  if (DONE.includes(t.status)) return `<span class="sla sla-done">${(t.resolvedAt || t.updatedAt) <= t.slaDueAt ? 'Met SLA' : 'Missed SLA'}</span>`;
  const left = t.slaDueAt - Date.now(), total = t.slaDueAt - t.createdAt;
  const st = left < 0 ? 'breached' : left < total * .25 ? 'risk' : 'ok';
  return `<span class="sla sla-${st}">${left < 0 ? 'Breached ' + dur(left) : 'Due in ' + dur(left)}</span>`;
}
const openTickets = () => S.tickets.filter(t => !DONE.includes(t.status));
const agentById = id => (S.agents || []).find(x => x.id === id);
function assigneeOptions(t) {
  const fits = ag => ag.modules.includes('ALL') || ag.modules.includes(t.module) || ag.team === t.assignmentGroup;
  const opt = ag => `<option value="${ag.id}" ${ag.id === t.assigneeId ? 'selected' : ''}>${esc(ag.name)} · ${esc(ag.role)}${(S.tickets || []).length ? ' (' + S.tickets.filter(x => x.assigneeId === ag.id && !DONE.includes(x.status)).length + ' open)' : ''}</option>`;
  const act = S.agents.filter(ag => ag.active !== false);
  const good = act.filter(fits), rest = act.filter(ag => !fits(ag));
  return `<option value="" ${!t.assigneeId ? 'selected' : ''}>Unassigned</option>` +
    (good.length ? `<optgroup label="Suggested for ${esc(t.module)}">${good.map(opt).join('')}</optgroup>` : '') +
    (rest.length ? `<optgroup label="Other agents">${rest.map(opt).join('')}</optgroup>` : '');
}
/* ---------- charts ---------- */
function donut(items, label) {
  const tot = items.reduce((a, b) => a + b.v, 0) || 1, r = 56, C = 2 * Math.PI * r; let off = 0;
  const segs = items.filter(i => i.v).map(it => { const len = it.v / tot * C; const s = `<circle cx="75" cy="75" r="${r}" fill="none" stroke="${it.c}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`; off += len; return s; }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 150 150" role="img" aria-label="${esc(label)}"><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="18"/>${segs}<text x="75" y="72" text-anchor="middle" style="font-family:var(--font-d);font-size:26px;font-weight:700;fill:var(--fg)">${items.reduce((a, b) => a + b.v, 0)}</text><text x="75" y="92" text-anchor="middle" style="font-size:11px;fill:var(--muted)">${esc(label)}</text></svg>
  <div class="dlist">${items.map(it => `<div><i style="background:${it.c}"></i>${esc(it.l)}<b>${it.v}</b></div>`).join('')}</div></div>`;
}
function hbars(items) {
  const max = Math.max(1, ...items.map(i => i.v));
  return `<div class="hbars">${items.map(i => `<div class="hbar" ${i.act || ''}><span class="l">${esc(i.l)}</span><span class="tr"><i style="width:${i.v / max * 100}%;background:${i.c || 'var(--grad)'}"></i></span><span class="c">${i.v}</span></div>`).join('')}</div>`;
}

/* ---------- parsed-email panel (compact, neutral) ---------- */
function renderAnalysis(a, meta, error) {
  if (!a) return '';
  const m = mod(a.primary_module), g = grp(a.primary_module), e = a.entities || {};
  const ents = ENT_LABELS.filter(([k]) => (e[k] || []).length).map(([k, l]) => `<div class="ent"><span>${l}</span><div class="vals">${e[k].map(v => `<span class="tok ${k === 'error_messages' ? 'err' : ''}">${esc(v)}</span>`).join('')}</div></div>`).join('');
  return `<div class="ana">
    ${error ? `<div class="note warn">Automatic parsing was unavailable, so basic rules were used (${esc(error.message)}).</div>` : ''}
    <div class="bigmod"><span class="sq" style="background:${g?.color || '#9A94B9'}">${esc(a.primary_module)}</span>
      <div style="min-width:0"><b>${esc(m?.name || 'Module not identified')}${a.sub_module ? ' · ' + esc(a.sub_module) : ''}</b><span>${esc(a.category)} · ${a.priority} ${PL[a.priority] || ''} · ${esc(DEC[a.decision] || a.decision)}${a.related_ticket_id ? ' ' + esc(a.related_ticket_id) : ''}</span></div></div>
    ${a.summary ? `<p class="why" style="margin:0">${esc(a.summary)}</p>` : ''}
    ${ents ? `<div class="ents">${ents}</div>` : ''}
    ${(a.missing_information || []).length ? `<div class="note warn"><b>Still needed:</b> ${a.missing_information.map(esc).join(' · ')}</div>` : ''}
  </div>`;
}

/* ---------- nav / routing ---------- */
// Views kept in the app but not shown in the menu or search (still reachable by URL, e.g. #lab).
const HIDDEN_VIEWS = ['lab'];
const VIEWS = {
  dashboard: ['Overview', 'dash', 'Live picture of email intake and SAP tickets'],
  inbox: ['Inbox', 'inbox', 'Every email received and what happened to it'],
  tickets: ['Tickets', 'tix', 'Structured tickets created from email conversations'],
  modules: ['SAP Module Map', 'map', 'How tickets are categorised across SAP modules and components'],
  lab: ['Parse test', 'lab', 'Check how an email would be categorised — nothing is saved'],
  users: ['Users', 'users', 'Who can work on tickets and what they handle'], audit: ['Audit log', 'log', 'Who did what, and when — visible to admins only'], addons: ['Add-on modules', 'box', 'Optional modules, switched on by your license'],
  setup: ['Settings', 'gear', 'Ticket parsing and mail settings'],
};
function renderNav() {
  const proc = S.emails.filter(e => e.status === 'processing').length;
  const clar = S.emails.filter(e => e.analysis?.decision === 'request_clarification').length;
  const cnt = { inbox: proc ? [proc, 'hot'] : clar ? [clar, ''] : null, tickets: [openTickets().length, ''] };
  $('#nav').innerHTML = '<div class="nav-label">Workspace</div>' + Object.entries(VIEWS).filter(([k]) => !HIDDEN_VIEWS.includes(k) && (!['audit', 'setup', 'addons'].includes(k) || meIsAdmin())).map(([k, [l, i]]) =>
    (k === 'users' ? '<div class="nav-label">Admin</div>' : '') + `<a href="#${k}" class="${UI.view === k ? 'on' : ''}" title="${l}">${ico(i)}<span class="nl">${l}</span>${cnt[k] && cnt[k][0] ? `<span class="cnt ${cnt[k][1]}">${cnt[k][0]}</span>` : ''}</a>`).join('');
  const h = S.health;
  $('#engineCard').innerHTML = `<div class="row"><span class="dot ${h.engine === 'claude' && h.imap?.status !== 'error' ? '' : 'off'}"></span>${h.imap?.enabled ? (h.imap.status === 'error' ? 'Mailbox not reachable' : 'Mailbox connected') : 'Mailbox not connected'}</div><b>${esc(h.mailbox || '')}</b><span style="color:var(--side-muted)">${(S.settings?.analysisMode || 'basic') === 'detailed' ? 'Detailed' : 'Basic'} parsing · ${h.engine === 'claude' ? 'automatic' : 'rules only'}</span>`;
}
function render() {
  if (!META) return;
  renderNav(); renderMe(); renderLicenseBanner();
  const [t, , sub] = VIEWS[UI.view];
  $('#vTitle').textContent = t; $('#vSub').textContent = sub;
  // While someone is typing in the ticket filters, refresh only the results so the box keeps focus and text.
  const typingInTickets = UI.view === 'tickets' && $('#tQ') && $('.toolbar')?.contains(document.activeElement);
  if (typingInTickets) tBody();
  else if (UI.view !== 'lab' || !$('#labForm')) { ({ dashboard: vDash, inbox: vInbox, tickets: vTickets, modules: vModules, lab: vLab, users: vUsers, audit: vAudit, addons: vAddons, setup: vSetup })[UI.view](); wireDrops(); }
  if (UI.openId && UI.editRecord !== UI.openId) drawTicket(); // don't wipe an edit in progress
}
function go() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('ticket-')) { UI.openId = h.slice(7); if (!VIEWS[UI.view]) UI.view = 'tickets'; render(); return; }
  UI.view = VIEWS[h] ? h : 'dashboard'; UI.openId = null; $('#drawerHost').innerHTML = ''; render();
}

/* ---------- DASHBOARD ---------- */
function vDash() {
  if (!S.emails.length) {
    $('#view').innerHTML = `<div class="hero"><div class="eyebrow" style="color:rgba(255,255,255,.8)">Ready</div><h2>Send an email to the support mailbox and watch it become a ticket.</h2>
      <p>Nothing has arrived yet. Run the ${META.samples.length} sample emails — they cover MM, SD, FI, CO, PP, EWM, HCM, PI/PO, EDI, Security, ABAP, Fiori, BW, MDG, plus a vague request, an advert and a non-SAP question — or send your own.</p>
      <div class="hstats" style="gap:10px"><button class="btn" data-act="runSamples">${ico('spark')}Run all sample emails</button><button class="btn" data-act="compose">${ico('mail')}Write my own</button></div></div>
      <div class="card"><div class="empty"><b>No tickets yet</b>Tickets appear here live as emails are processed.</div></div>`;
    return;
  }
  const open = openTickets(), proc = S.emails.filter(e => e.status === 'processed');
  const auto = proc.filter(e => e.analysis && e.analysis.decision !== 'request_clarification').length;
  const byMod = {}; S.tickets.forEach(t => byMod[t.module] = (byMod[t.module] || 0) + 1);
  const cats = {}; proc.forEach(e => { const c = e.analysis?.category; if (c) cats[c] = (cats[c] || 0) + 1; });
  const byGroup = META.groups.map(g => ({ l: g.name, v: S.tickets.filter(t => mod(t.module)?.group === g.id).length, c: g.color }));
  const breached = open.filter(t => t.slaDueAt < Date.now()).length;
  $('#view').innerHTML = `
  <div class="hero">
    <div class="hact"><button class="btn btn-sm" data-act="compose">${ico('mail')}Send test email</button><button class="btn btn-sm" data-act="runSamples">${ico('spark')}Run samples</button></div>
    <div class="eyebrow" style="color:rgba(255,255,255,.8)">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <h2>${proc.length} email${proc.length === 1 ? '' : 's'} read, ${S.tickets.length} ticket${S.tickets.length === 1 ? '' : 's'} across ${Object.keys(byMod).filter(k => k !== 'UNKNOWN').length} SAP modules.</h2>
    <p>${breached ? `${breached} open ticket${breached > 1 ? 's have' : ' has'} breached SLA. ` : ''}${proc.filter(e => ['ignore', 'reject'].includes(e.analysis?.decision)).length} emails were filtered out as not being SAP support requests.</p>
    <div class="hstats"><div><b>${open.filter(t => t.priority === 'P1').length}</b><span>Open P1</span></div><div><b>${open.filter(t => t.category === 'Incident').length}</b><span>Open incidents</span></div><div><b>${open.filter(t => t.category === 'Change Request').length}</b><span>Change requests</span></div><div><b>${open.filter(t => t.status === 'Awaiting Info').length}</b><span>Awaiting info</span></div></div>
  </div>
  <div class="grid g-kpi">
    <div class="card kpi"><div class="eyebrow">Emails processed</div><div class="v">${proc.length}</div><div class="s">${S.emails.length - proc.length ? (S.emails.length - proc.length) + ' processing now' : 'all caught up'}</div></div>
    <div class="card kpi k2"><div class="eyebrow">Open tickets</div><div class="v">${open.length}</div><div class="s">${breached} breached SLA</div></div>
    <div class="card kpi k4"><div class="eyebrow">Handled without triage</div><div class="v">${proc.length ? Math.round(auto / proc.length * 100) : 0}%</div><div class="s">decided automatically</div></div>
    <div class="card kpi k3"><div class="eyebrow">Awaiting info</div><div class="v">${open.filter(t => t.status === 'Awaiting Info').length}</div><div class="s">waiting on the requester</div></div>
    <div class="card kpi"><div class="eyebrow">Unassigned</div><div class="v">${open.filter(t => !t.assigneeId).length}</div><div class="s">open tickets with no agent</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-h"><h3>Tickets by SAP module</h3><span class="muted" style="font-size:12px">click a bar to filter</span><div class="r"><a class="btn btn-sm btn-ghost" href="#modules">Module map</a></div></div><div class="card-b">${hbars(Object.entries(byMod).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v, c: mcolor(l), act: `data-fmod="${esc(l)}"` })))}</div></div>
    <div class="card"><div class="card-h"><h3>What arrived</h3><span class="muted" style="font-size:12px">by category</span></div><div class="card-b">${donut(Object.keys(CAT_COLOR).map(k => ({ l: k, v: cats[k] || 0, c: CAT_COLOR[k] })).filter(x => x.v), 'emails')}</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-h"><h3>Latest emails</h3><div class="r"><a class="btn btn-sm btn-ghost" href="#inbox">Open inbox</a></div></div><div class="card-b"><div class="feed">${S.emails.slice().reverse().slice(0, 8).map(feedRow).join('')}</div></div></div>
    <div class="card"><div class="card-h"><h3>By business area</h3></div><div class="card-b">${hbars(byGroup.map(g => ({ ...g, l: g.l.split(' ')[0] })))}</div></div>
  </div>`;
}
function feedRow(e) {
  const a = e.analysis;
  return `<div class="fitem" data-mail="${e.id}">${e.status === 'processing' ? '<span class="spin"></span>' : modChip(a?.primary_module)}<div style="min-width:0"><div class="tt">${esc(e.subject)}</div><div class="mt"><span>${esc(e.from.name)}</span><span>${ago(e.receivedAt)}</span>${e.ticketId ? `<span class="idl">${e.ticketId}</span>` : ''}</div></div>${decPill(e.status === 'processing' ? 'processing' : a?.decision)}</div>`;
}

/* ---------- INBOX ---------- */
function vInbox() {
  const L = S.emails.slice().reverse();
  const F = UI.iFilter === 'all' ? L : L.filter(e => (e.status === 'processing' ? 'processing' : e.analysis?.decision) === UI.iFilter);
  if (!UI.iSel || !S.emails.find(e => e.id === UI.iSel)) UI.iSel = F[0]?.id;
  const cnt = d => L.filter(e => (e.status === 'processing' ? 'processing' : e.analysis?.decision) === d).length;
  $('#view').innerHTML = !L.length ? `<div class="card"><div class="empty"><b>The inbox is empty</b>Emails appear here the moment they arrive — from the simulator, the webhook, an .eml upload or IMAP.<br><button class="btn btn-grad" data-act="compose">${ico('mail')}Send test email</button></div></div>` : `
  <div class="chips"><button class="chip ${UI.iFilter === 'all' ? 'on' : ''}" data-if="all">All<span class="n">${L.length}</span></button>${Object.keys(DEC).filter(cnt).map(d => `<button class="chip ${UI.iFilter === d ? 'on' : ''}" data-if="${d}">${DEC[d]}<span class="n">${cnt(d)}</span></button>`).join('')}</div>
  <div class="inbox">
    <div class="card"><div class="ilist">${F.map(e => `<div class="iitem ${e.id === UI.iSel ? 'on' : ''}" data-sel="${e.id}"><div class="r1">${avatar(e.from.name)}<b>${esc(e.from.name)}</b><span class="tm">${ago(e.receivedAt)}</span></div><div class="sj">${esc(e.subject)}</div><div class="r3">${e.status === 'processing' ? '<span class="spin"></span>' + decPill('processing') : `${modChip(e.analysis?.primary_module)}${decPill(e.analysis?.decision)}${e.ticketId ? `<span class="idl">${e.ticketId}</span>` : ''}${engPill(e.meta)}`}<span class="scn" style="margin-left:auto">${esc(e.source)}</span></div></div>`).join('') || '<div class="empty"><b>Nothing here</b>No emails with this outcome.</div>'}</div></div>
    <div class="card" id="iDet"></div>
  </div>`;
  if (L.length) iDetail();
}
function iDetail() {
  const e = S.emails.find(x => x.id === UI.iSel); const el = $('#iDet'); if (!el) return;
  if (!e) { el.innerHTML = '<div class="empty"><b>Select an email</b></div>'; return; }
  el.innerHTML = `<div class="det-h"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono muted">${e.id}</span><span class="scn">${esc(e.source)}</span>${e.status === 'processing' ? decPill('processing') : decPill(e.analysis.decision)}<span class="muted" style="margin-left:auto;font-size:12px">${fmt(e.receivedAt)}</span></div>
    <h3>${esc(e.subject)}</h3>
    <div class="mailmeta"><span>From</span><div>${esc(e.from.name)} &lt;${esc(e.from.email)}&gt;</div><span>To</span><div>${esc(e.to)}</div>${e.cc ? `<span>Cc</span><div>${esc(e.cc)}</div>` : ''}</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${e.ticketId ? `<button class="btn btn-sm btn-grad" data-open="${e.ticketId}">Open ${e.ticketId}</button>` : ''}<button class="btn btn-sm" data-reprocess="${e.id}" ${e.status === 'processing' ? 'disabled' : ''}>${ico('ref')}Process again</button></div></div>
  <div style="padding:16px 20px">${e.status === 'processing' ? `<div class="ana"><div class="hd"><span class="spin"></span>Processing the email…</div><div class="shimmer" style="height:60px"></div><div class="shimmer" style="height:120px"></div></div>` : renderAnalysis(e.analysis, e.meta, e.error)}</div>
  ${(e.attachments || []).length ? `<div style="padding:0 20px 16px"><div class="eyebrow" style="margin-bottom:8px">Attachments · ${e.attachments.length}</div>${filesBlock(e.id, e.attachments)}</div>` : ''}
  <div style="padding:0 20px 20px"><div class="eyebrow" style="margin-bottom:8px">Original email</div><div class="bubble"><div class="bd">${esc(e.body)}</div></div></div>`;
}

/* ---------- TICKETS ---------- */
function filtered() {
  const q = UI.tQ.toLowerCase();
  return S.tickets.filter(t => {
    if (UI.tStatus === 'open' && DONE.includes(t.status)) return false;
    if (UI.tStatus === 'done' && !DONE.includes(t.status)) return false;
    if (UI.tGroup !== 'all' && mod(t.module)?.group !== UI.tGroup) return false;
    if (UI.tMod !== 'all' && t.module !== UI.tMod) return false;
    if (UI.tCat !== 'all' && t.category !== UI.tCat) return false;
    if (UI.tPrio !== 'all' && t.priority !== UI.tPrio) return false;
    if (UI.tAsg === 'me' && t.assigneeId !== UI.me) return false;
    if (UI.tAsg === 'none' && t.assigneeId) return false;
    if (!['all', 'me', 'none'].includes(UI.tAsg) && t.assigneeId !== UI.tAsg) return false;
    if (q && !matchAll(ticketHaystack(t), q)) return false;
    return true;
  }).sort(ticketSorter());
}
// ---- column sorting: click a header to sort, click again to reverse. Default: newest ticket first. ----
const SORT_COLS = [['created', 'ID'], ['title', 'Request'], ['module', 'Module'], ['component', 'Component'], ['category', 'Category'], ['priority', 'Priority'], ['status', 'Status'], ['assignee', 'Assigned to'], ['sla', 'SLA']];
const FIRST_DIR = { created: 'desc' }; // first click on ID shows newest first; other columns start A→Z / most urgent first
function ticketSorter() {
  const { key, dir } = UI.tSort, sign = dir === 'asc' ? 1 : -1;
  const text = v => String(v || '').toLowerCase();
  const statusRank = s => { const i = (META.statuses || []).indexOf(s); return i < 0 ? 99 : i; };
  const slaLeft = t => DONE.includes(t.status) ? Infinity : t.slaDueAt - Date.now(); // resolved/closed tickets sort after open ones
  const val = {
    created: t => t.createdAt || Number(String(t.id).replace(/\D/g, '')),
    title: t => text(t.title), module: t => text(t.module), component: t => text(t.subModule), category: t => text(t.category),
    priority: t => t.priority, status: t => statusRank(t.status), assignee: t => t.assignee ? text(t.assignee) : '￿', sla: slaLeft,
  }[key] || (t => t.createdAt);
  return (a, b) => {
    const x = val(a), y = val(b);
    const c = x === y ? 0 : x === Infinity ? 1 : y === Infinity ? -1 : x < y ? -1 : 1;
    return (key === 'sla' && (x === Infinity || y === Infinity) ? c : c * sign) || (b.createdAt - a.createdAt); // ties: newest first
  };
}
function sortHeader(key, label) {
  const on = UI.tSort.key === key, dir = on ? UI.tSort.dir : null;
  return `<th class="sortable${on ? ' on' : ''}" aria-sort="${on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" data-tsort="${key}" title="Sort by ${label.toLowerCase()}">${label}<span class="arr">${on ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>`;
}
function vTickets() {
  const opt = (v, list, lab) => `<option value="all">${lab}</option>` + list.map(([k, l]) => `<option value="${esc(k)}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  $('#view').innerHTML = `
  <div class="chips"><button class="chip ${UI.tGroup === 'all' ? 'on' : ''}" data-tg="all">All areas<span class="n">${S.tickets.length}</span></button>${META.groups.map(g => { const n = S.tickets.filter(t => mod(t.module)?.group === g.id).length; return n ? `<button class="chip ${UI.tGroup === g.id ? 'on' : ''}" data-tg="${g.id}"><i style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block"></i>${esc(g.name)}<span class="n">${n}</span></button>` : ''; }).join('')}</div>
  <div class="toolbar">
    <input class="in" id="tQ" type="search" placeholder="Search ID, title, t-code, document…" value="${esc(UI.tQ)}">
    <select class="in" id="tMod">${opt(UI.tMod, META.modules.map(m => [m.code, m.code + ' · ' + m.name]).concat([['UNKNOWN', 'UNKNOWN']]), 'All modules')}</select>
    <select class="in" id="tCat">${opt(UI.tCat, ['Incident', 'Change Request', 'Service Request', 'Query'].map(c => [c, c]), 'All categories')}</select>
    <select class="in" id="tPrio">${opt(UI.tPrio, ['P1', 'P2', 'P3', 'P4'].map(p => [p, p + ' · ' + PL[p]]), 'All priorities')}</select>
    <select class="in" id="tAsg"><option value="all">Anyone</option><option value="me" ${UI.tAsg === 'me' ? 'selected' : ''}>Assigned to me</option><option value="none" ${UI.tAsg === 'none' ? 'selected' : ''}>Unassigned</option>${S.agents.map(ag => `<option value="${ag.id}" ${UI.tAsg === ag.id ? 'selected' : ''}>${esc(ag.name)}</option>`).join('')}</select>
    <div class="seg"><button class="${UI.tStatus === 'open' ? 'on' : ''}" data-ts="open">Open</button><button class="${UI.tStatus === 'done' ? 'on' : ''}" data-ts="done">Resolved</button><button class="${UI.tStatus === 'all' ? 'on' : ''}" data-ts="all">All</button></div>
    <span class="sp"></span>
    <div class="seg"><button class="${UI.tMode === 'table' ? 'on' : ''}" data-mode="table">Table</button><button class="${UI.tMode === 'board' ? 'on' : ''}" data-mode="board">Board</button></div>
  </div><div id="tBody"></div>`;
  tBody();
}
function tBody() {
  const L = filtered(); const el = $('#tBody'); if (!el) return;
  if (!S.tickets.length) { el.innerHTML = `<div class="card"><div class="empty"><b>No tickets yet</b>Send an email to the support mailbox and the first ticket appears here.<br><button class="btn btn-grad" data-act="compose">${ico('mail')}Send test email</button></div></div>`; return; }
  if (UI.tMode === 'board') {
    el.innerHTML = `<div class="board">${META.statuses.map(c => { const it = L.filter(t => t.status === c); return `<div class="col" data-col="${c}"><h4>${statusPill(c)}<span>${it.length}</span></h4>${it.map(t => `<div class="kc" draggable="true" data-drag="${t.id}" data-open="${t.id}"><div class="r"><span class="idl">${t.id}</span><span class="sp"></span>${prioPill(t.priority)}</div><div class="tt">${esc(t.title)}</div><div class="r">${modChip(t.module)}<span class="muted" style="font-size:11.5px">${esc(t.subModule || '')}</span></div><div class="r"><span class="cat">${esc(t.category)}</span><span class="sp"></span>${slaChip(t)}</div><div class="r">${t.assignee ? avatar(t.assignee) + '<span style="font-size:11.5px;font-weight:600">' + esc(t.assignee) + '</span>' : '<span class="muted" style="font-size:11.5px">Unassigned</span>'}</div></div>`).join('')}</div>`; }).join('')}</div>`;
    return;
  }
  el.innerHTML = `<div class="card"><div class="tblw"><table class="tbl"><thead><tr>${SORT_COLS.map(([key, label]) => sortHeader(key, label)).join('')}</tr></thead><tbody>
  ${L.map(t => `<tr data-open="${t.id}"><td><span class="idl">${t.id}</span></td><td><div class="tt">${esc(t.title)}</div><div class="sm">${esc(t.requester.name)}${t.details?.requester?.department ? ' · ' + esc(t.details.requester.department) : ''} · ${ago(t.createdAt)}${(t.attachments || []).length ? ' · ' + t.attachments.length + ' attachment' + (t.attachments.length > 1 ? 's' : '') : ''}</div></td><td>${modChip(t.module)}</td><td class="sm">${esc(t.subModule || '—')}</td><td><span class="cat">${esc(t.category)}</span></td><td>${prioPill(t.priority)}</td><td>${statusPill(t.status)}</td><td><div class="who">${t.assignee ? avatar(t.assignee) : ''}<div class="t"><b>${esc(t.assignee || 'Unassigned')}</b><span>${esc(t.assignmentGroup)}</span></div></div></td><td>${slaChip(t)}</td></tr>`).join('')}
  </tbody></table></div>${L.length ? '' : '<div class="empty"><b>No tickets match</b>Clear a filter or search for something else.</div>'}</div>`;
}

/* ---------- MODULE MAP ---------- */
function vModules() {
  $('#view').innerHTML = `<div class="note">Every email is classified into one of <b>${META.modules.length} SAP modules</b> in ${META.groups.length} business areas, picks the component within the module, and notes secondary modules when an issue spans several. Click a module to see its tickets.</div>` +
  META.groups.map(g => {
    const mods = META.modules.filter(m => m.group === g.id);
    const total = S.tickets.filter(t => mod(t.module)?.group === g.id).length;
    return `<section class="mgroup"><h3><i style="background:${g.color}"></i>${esc(g.name)}<span>${total} ticket${total === 1 ? '' : 's'}</span></h3><div class="mgrid">${mods.map(m => {
      const ts = S.tickets.filter(t => t.module === m.code);
      const comp = {}; ts.forEach(t => { const k = t.subModule || 'Other'; comp[k] = (comp[k] || 0) + 1; });
      const rows = m.components.map(c => [c, comp[c] || 0]).concat(Object.entries(comp).filter(([k]) => !m.components.includes(k)));
      const max = Math.max(1, ...rows.map(r => r[1]));
      return `<div class="card mcard" style="--mc:${g.color}" data-fmod="${esc(m.code)}"><div class="top"><span class="code">${esc(m.code)}</span><span class="cnt">${ts.length}</span></div><div class="nm">${esc(m.name)} · ${esc(m.team)}</div>
        <div class="comp">${rows.slice(0, 6).map(([c, n]) => `<div><span title="${esc(c)}">${esc(c)}</span><em><i style="width:${n / max * 100}%"></i></em><b>${n || ''}</b></div>`).join('')}</div>
        ${m.tcodes.length ? `<div class="tc">${m.tcodes.slice(0, 6).map(esc).join(' · ')}</div>` : ''}</div>`;
    }).join('')}</div></section>`;
  }).join('');
}

/* ---------- PARSE TEST (nothing is saved) ---------- */
function vLab() {
  $('#view').innerHTML = `<div class="lab">
    <div class="card"><div class="card-h"><h3>Email</h3></div><div class="card-b">
      <form id="labForm" style="display:flex;flex-direction:column;gap:12px">
        <div><div class="eyebrow" style="margin-bottom:6px">Load a sample</div><div class="samples">${META.samples.map(s => `<button type="button" data-lsample="${s.key}">${esc(s.label)}</button>`).join('')}</div></div>
        <div class="drop" id="labDrop">Drop an <b>.eml</b> file here, or <u>choose one</u><input type="file" id="labFile" accept=".eml,message/rfc822,text/plain" hidden></div>
        <label class="f">From<input class="in" id="lFrom" required placeholder="Name <name@company.com>"></label>
        <div class="fgrid"><label class="f">To<input class="in" id="lTo" value="${esc(S.health.mailbox)}"></label><label class="f">Cc<input class="in" id="lCc"></label></div>
        <label class="f">Subject<input class="in" id="lSubj" required></label>
        <label class="f">Body<textarea class="in" id="lBody" required style="min-height:200px"></textarea></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-grad" type="submit">Parse</button><button class="btn" type="button" data-act="labCreate">${ico('mail')}Create ticket from it</button></div>
      </form></div></div>
    <div id="labOut"></div></div>`;
  labOut();
}
function labOut() {
  const el = $('#labOut'); if (!el) return;
  if (UI.labBusy) { el.innerHTML = `<div class="card"><div class="card-b"><div class="ana"><div class="hd"><span class="spin"></span>Parsing…</div><div class="shimmer" style="height:60px"></div><div class="shimmer" style="height:120px"></div></div></div></div>`; return; }
  if (!UI.labResults) { el.innerHTML = `<div class="card"><div class="empty"><b>Pick a sample or paste an email</b>See how it would be categorised. Nothing is saved.</div></div>`; return; }
  const r = UI.labResults[0];
  el.innerHTML = `<div class="card"><div class="card-b">${r.error ? `<div class="note bad">${esc(r.error)}</div>` : `<div style="font-weight:600;margin-bottom:10px">${esc(r.parsed.title || '')}</div>` + renderAnalysis(sanitizeView(r.parsed), r.meta, null)}</div></div>`;
}
const sanitizeView = p => ({ ...p, entities: p.entities || {} });
function labEmail() { return { from: $('#lFrom').value.trim(), to: $('#lTo').value.trim(), cc: $('#lCc').value.trim(), subject: $('#lSubj').value.trim(), body: $('#lBody').value }; }
function fillLab(s) { $('#lFrom').value = s.from; $('#lTo').value = s.to; $('#lCc').value = s.cc || ''; $('#lSubj').value = s.subject; $('#lBody').value = s.body; }
async function runLab() {
  const email = labEmail();
  if (!email.from || !email.subject || !email.body.trim()) { toast('Fill in From, Subject and Body first', true); return; }
  UI.labBusy = true; UI.labResults = null; labOut();
  const r = await api('POST', '/api/parse', email).catch(err => ({ error: err.message }));
  UI.labBusy = false; UI.labResults = [r]; labOut();
}

/* ---------- USERS (admin) ---------- */
const meIsAdmin = () => agentById(UI.me)?.access === 'admin';
const TEAMS = () => [...new Set(['SAP Service Desk', ...META.modules.map(m => m.team), ...(S.agents || []).map(a => a.team)])];
function vUsers() {
  const L = (S.agents || []).slice().sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
  const admin = meIsAdmin();
  const open = id => S.tickets.filter(t => t.assigneeId === id && !DONE.includes(t.status)).length;
  $('#view').innerHTML = `
  <div class="toolbar"><span class="muted">${L.filter(a => a.active !== false).length}${S.license?.maxUsers ? ` of ${S.license.maxUsers} licensed users active` : ' active'} · ${L.filter(a => a.active === false).length} inactive</span><span class="sp"></span>
    ${admin ? `<button class="btn btn-grad" data-act="addUser">${ico('plus')}Add user</button>` : `<span class="note" style="padding:6px 10px">View only — ask an admin to make changes</span>`}</div>
  <div class="card"><div class="tblw"><table class="tbl users"><thead><tr><th>User</th><th>Role & team</th><th>Modules</th><th>Access</th><th>Password</th><th>Open tickets</th><th>Status</th><th></th></tr></thead><tbody>
  ${L.map(a => `<tr class="${a.active === false ? 'inactive' : ''}" style="cursor:default">
    <td><div class="who">${avatar(a.name)}<div class="t"><b>${esc(a.name)}</b><span>${esc(a.email)}</span></div></div></td>
    <td><div style="font-weight:600;font-size:13px">${esc(a.role)}</div><div class="sm">${esc(a.team)}</div></td>
    <td><div class="chips">${a.modules.includes('ALL') ? '<span class="mod">All modules</span>' : a.modules.map(c => modChip(c)).join('')}</div></td>
    <td><span class="pill ${a.access === 'admin' ? 'st-work' : 'st-new'}">${a.access === 'admin' ? 'Admin' : 'Agent'}</span></td>
    <td>${a.hasPassword ? '<span class="pill st-done">Set</span>' : '<span class="muted small">Not set</span>'}</td>
    <td class="num">${open(a.id)}</td>
    <td><span class="pill ${a.active === false ? 'st-wait' : 'st-done'}">${a.active === false ? 'Inactive' : 'Active'}</span></td>
    <td style="text-align:right;white-space:nowrap">${admin ? `<button class="btn btn-sm" data-edituser="${a.id}">Edit</button> <button class="btn btn-sm btn-ghost" data-toggleuser="${a.id}">${a.active === false ? 'Reactivate' : 'Deactivate'}</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
function userModal(a) {
  const isNew = !a; a = a || { name: '', email: '', role: '', team: 'SAP Service Desk', modules: [], access: 'agent' };
  const all = a.modules.includes('ALL');
  modal(`<form id="userForm" data-id="${a.id || ''}">
    <div class="mh"><div><h3>${isNew ? 'Add user' : 'Edit ' + esc(a.name)}</h3><p>${isNew ? 'They can be assigned tickets and selected under “Working as”.' : esc(a.email)}</p></div><button type="button" class="btn btn-sm btn-ghost x" data-act="closeModal" aria-label="Close">${ico('x')}</button></div>
    <div class="mb">
      <div class="fgrid">
        <label class="f">Full name<input class="in" id="uName" value="${esc(a.name)}" required></label>
        <label class="f">Email<input class="in" id="uEmail" type="email" value="${esc(a.email)}" required></label>
        <label class="f">Role<input class="in" id="uRole" value="${esc(a.role)}" list="roleList" placeholder="e.g. SAP MM Consultant" required>
          <datalist id="roleList">${[...new Set((S.agents || []).map(x => x.role))].map(r => `<option value="${esc(r)}">`).join('')}</datalist></label>
        <label class="f">Team<select class="in" id="uTeam">${TEAMS().map(t => `<option ${t === a.team ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="f">${isNew ? 'Password' : 'New password'} <span class="muted" style="font-weight:500">${isNew ? 'optional · min 8 characters' : a.hasPassword ? 'leave blank to keep' : 'not set yet · min 8 characters'}</span><input class="in" id="uPass" type="password" autocomplete="new-password" minlength="8"></label>
        <label class="f">Access<select class="in" id="uAccess"><option value="agent" ${a.access !== 'admin' ? 'selected' : ''}>Agent — works on tickets</option><option value="admin" ${a.access === 'admin' ? 'selected' : ''}>Admin — also manages users and settings</option></select></label>
      </div>
      <div><div class="eyebrow" style="margin-bottom:8px">SAP modules handled <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">— used to suggest the right person when assigning</span></div>
        <label class="switch" style="margin-bottom:10px"><input type="checkbox" id="uAll" ${all ? 'checked' : ''}><span></span>All modules</label>
        <div class="modpick" id="uMods" ${all ? 'hidden' : ''}>${META.groups.map(g => `<div><div class="muted small" style="margin:4px 0">${esc(g.name)}</div><div class="chips">${META.modules.filter(m => m.group === g.id).map(m => `<label class="mp"><input type="checkbox" value="${esc(m.code)}" ${a.modules.includes(m.code) ? 'checked' : ''}><span>${esc(m.code)}</span></label>`).join('')}</div></div>`).join('')}</div>
      </div>
      <div id="uErr"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn btn-grad" type="submit">${isNew ? 'Add user' : 'Save changes'}</button></div>
    </div></form>`, 'small');
  $('#uAll').onchange = e => { $('#uMods').hidden = e.target.checked; };
  $('#uName').focus();
}
async function saveUser(form) {
  const id = form.dataset.id;
  const body = { name: $('#uName').value, email: $('#uEmail').value, role: $('#uRole').value, team: $('#uTeam').value, access: $('#uAccess').value,
    modules: $('#uAll').checked ? ['ALL'] : $$('#uMods input:checked').map(i => i.value) };
  if ($('#uPass').value) body.password = $('#uPass').value;
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const a = await api(id ? 'PATCH' : 'POST', id ? `/api/agents/${id}` : '/api/agents', body);
    closeModal(); toast(id ? `${a.name} updated` : `${a.name} added`); await refresh();
  } catch (err) { $('#uErr').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; btn.disabled = false; }
}
async function toggleUser(id) {
  const a = agentById(id); if (!a) return;
  const deactivating = a.active !== false;
  const openN = S.tickets.filter(t => t.assigneeId === id && !DONE.includes(t.status)).length;
  if (deactivating) {
    modal(`<div class="mh"><div><h3>Deactivate ${esc(a.name)}?</h3><p>They will no longer appear in assignee or “Working as” lists. Past tickets keep their name.</p></div></div>
      <div class="mb">${openN ? `<div class="note warn">${openN} open ticket${openN > 1 ? 's are' : ' is'} still assigned to ${esc(a.name)}. Reassign them from the Tickets page (filter “Assigned to”).</div>` : ''}
      <div id="uErr"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="closeModal">Cancel</button><button class="btn btn-grad" data-confirmdeact="${id}">Deactivate</button></div></div>`, 'small');
    return;
  }
  try { await api('PATCH', `/api/agents/${id}`, { active: true }); toast(`${a.name} reactivated`); await refresh(); } catch (err) { toast(err.message, true); }
}

/* ---------- AUDIT LOG (admin only) ---------- */
let AUDIT = null;
async function vAudit() {
  const el = $('#view');
  if (!meIsAdmin()) { el.innerHTML = '<div class="card"><div class="empty"><b>Admins only</b>Ask an admin if you need it.</div></div>'; return; }
  if (!AUDIT) {
    el.innerHTML = '<div class="card"><div class="card-b"><div class="shimmer" style="height:200px"></div></div></div>';
    try { AUDIT = await api('GET', `/api/audit?actor=${encodeURIComponent(UI.me)}`); } catch (err) { el.innerHTML = `<div class="note bad">${esc(err.message)}</div>`; return; }
    if (UI.view !== 'audit') return;
  }
  const f = UI.audit || (UI.audit = { area: 'all', who: 'all', days: '7', q: '' });
  const people = [...new Set(AUDIT.map(x => x.who))].sort();
  const since = f.days === 'all' ? 0 : Date.now() - Number(f.days) * 864e5;
  const q = f.q.toLowerCase().trim();
  const L = AUDIT.filter(x => (f.area === 'all' || x.area === f.area) && (f.who === 'all' || x.who === f.who) && x.at >= since &&
    (!q || matchAll([x.who, x.area, x.action, x.target, x.detail].join(' ').toLowerCase(), q)));
  const count = a => AUDIT.filter(x => x.area === a && x.at >= since).length;
  el.innerHTML = `
  <div class="toolbar">
    <div class="seg">${['all', 'Tickets', 'Users', 'Settings', 'Sign-in'].map(a => `<button class="${f.area === a ? 'on' : ''}" data-aarea="${a}">${a === 'all' ? 'All' : a}${a === 'all' ? '' : ` <span class="muted">${count(a)}</span>`}</button>`).join('')}</div>
    <select class="in" id="aWho"><option value="all">All users</option>${people.map(p => `<option ${f.who === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
    <select class="in" id="aDays">${[['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']].map(([v, l]) => `<option value="${v}" ${f.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input class="in" id="aQ" type="search" placeholder="Search actions, tickets, details…" value="${esc(f.q)}">
    <span class="sp"></span>
    <button class="btn btn-sm" data-act="auditReload">${ico('ref')}Refresh</button>
  </div>
  <div class="card"><div class="tblw"><table class="tbl audit"><thead><tr><th>When</th><th>Who</th><th>Area</th><th>Action</th><th>Item</th></tr></thead><tbody>
  ${L.slice(0, 500).map(x => `<tr style="cursor:default"><td class="sm num" title="${esc(new Date(x.at).toLocaleString('en-IN'))}">${fmt(x.at)}</td>
    <td><div class="who">${avatar(x.who)}<div class="t"><b>${esc(x.who)}</b></div></div></td>
    <td><span class="pill ${x.area === 'Tickets' ? 'st-new' : x.area === 'Users' ? 'st-work' : x.area === 'Sign-in' ? 'st-done' : 'st-wait'}">${esc(x.area)}</span></td>
    <td><div style="font-weight:600;font-size:13px">${esc(x.action)}</div></td>
    <td>${x.area === 'Tickets' ? `<a class="idl" href="#ticket-${esc(x.target)}" data-open="${esc(x.target)}">${esc(x.target)}</a><div class="sm tt">${esc(x.detail || '')}</div>` : `${x.target ? `<b style="font-size:13px">${esc(x.target)}</b>` : ''}<div class="sm">${esc(x.detail || '')}</div>`}</td></tr>`).join('')}
  </tbody></table></div>${L.length ? (L.length > 500 ? `<div class="muted small" style="padding:10px 14px">Showing the latest 500 of ${L.length} entries. Narrow the filters to see older ones.</div>` : '') : '<div class="empty"><b>No entries</b>Nothing matches these filters.</div>'}</div>`;
}

/* ---------- SETTINGS ---------- */
let MAILCFG = null;
async function vSetup() {
  const el = $('#view');
  if (!MAILCFG) { el.innerHTML = '<div class="card"><div class="card-b"><div class="shimmer" style="height:160px"></div></div></div>'; try { MAILCFG = await api('GET', '/api/settings/mail'); } catch (err) { el.innerHTML = `<div class="note bad">${esc(err.message)}</div>`; return; } }
  if (UI.view !== 'setup') return;
  const m = MAILCFG, i = m.imap, s = m.smtp, mode = S.settings?.analysisMode || 'basic';
  const stat = i.status === 'connected' ? ['st-done', 'Connected'] : i.status === 'error' ? ['st-wait', 'Not reachable'] : i.status === 'polling' || i.status === 'starting' ? ['st-new', 'Checking…'] : ['st-new', 'Off'];
  const pw = (id, has) => `<input class="in" id="${id}" type="password" autocomplete="new-password" placeholder="${has ? '•••••••• (saved — leave blank to keep)' : 'Password'}">`;
  el.innerHTML = `<div class="settings">${meIsAdmin() ? '' : '<div class="note">View only — ask an admin to change settings.</div>'}
${licenseCard()}  <section class="card set">
    <div class="set-h"><div><h3>Ticket parsing</h3><p>How much is extracted from each incoming email.</p></div></div>
    <div class="set-b">
      <div class="choice">
        <button class="${mode === 'basic' ? 'on' : ''}" data-setmode="basic"><b>Basic</b><span>Module, component, category, priority, SAP objects and a short summary. Recommended: lowest processing.</span></button>
        <button class="${mode === 'detailed' ? 'on' : ''}" data-setmode="detailed"><b>Detailed</b><span>Also writes a full ticket record (requester details, steps, impact) and suggested replies. About 4× more processing.</span></button>
      </div>
    </div>
  </section>

  <section class="card set">
    <div class="set-h"><div><h3>Sign-in</h3><p>How people sign in to the desk.</p></div></div>
    <div class="set-b"><div class="choice">
      <button class="${(S.settings?.authMode || 'passwordless') === 'passwordless' ? 'on' : ''}" data-setauth="passwordless"><b>Passwordless (pilot)</b><span>Any active user signs in with their work email. Quick for a pilot, not for production.</span></button>
      <button class="${S.settings?.authMode === 'password' ? 'on' : ''}" data-setauth="password"><b>Password required</b><span>Users sign in with email and password. Set passwords on the Users page first, at least for one admin.</span></button>
    </div></div>
  </section>

  <form class="card set" id="imapForm" autocomplete="off">
    <div class="set-h"><div><h3>Incoming mail (IMAP)</h3><p>The mailbox that receives support emails. New emails become tickets automatically.</p></div><span class="pill ${stat[0]}">${stat[1]}</span></div>
    <div class="set-b">
      ${m.graphAvailable ? `<label class="f">Read mail using<select class="in" id="inMode"><option value="imap" ${m.inbound === 'imap' ? 'selected' : ''}>IMAP (settings below)</option><option value="graph" ${m.inbound === 'graph' ? 'selected' : ''}>Microsoft 365</option><option value="off" ${m.inbound === 'off' ? 'selected' : ''}>Off (paused)</option></select></label>` : ''}
      <div class="fgrid">
        <label class="f">Email address / username<input class="in" id="imUser" value="${esc(i.user)}" placeholder="support@yourdomain.com"></label>
        <label class="f">Password${pw('imPass', i.hasPassword)}</label>
        <label class="f">Server<input class="in" id="imHost" value="${esc(i.host)}" placeholder="imap.secureserver.net"></label>
        <div class="fgrid tight"><label class="f">Port<input class="in" id="imPort" type="number" value="${i.port}"></label><label class="f">Check every (sec)<input class="in" id="imPoll" type="number" min="15" max="3600" value="${i.pollSeconds}"></label></div>
      </div>
      ${i.lastError && i.status === 'error' ? `<div class="note warn">${/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH/.test(i.lastError) ? 'Cannot reach the mail server. Check the server name and port, or whether this network blocks mail ports.' : /auth|login|credential|password/i.test(i.lastError) ? 'The mail server rejected the username or password.' : esc(i.lastError)}</div>` : i.lastPoll ? `<div class="muted small">Last checked ${ago(i.lastPoll)} · ${i.received} email${i.received === 1 ? '' : 's'} received since start</div>` : ''}
      <div id="imMsg"></div>
      <div class="set-f"><button type="button" class="btn" data-mailtest="imap">Test connection</button><button class="btn btn-grad" type="submit">Save</button></div>
    </div>
  </form>

  <form class="card set" id="smtpForm" autocomplete="off">
    <div class="set-h"><div><h3>Outgoing mail (SMTP)</h3><p>Used for acknowledgements, replies and closure emails.</p></div><span class="pill ${s.host && s.hasPassword ? 'st-done' : 'st-new'}">${s.host && s.hasPassword ? 'Configured' : 'Not set'}</span></div>
    <div class="set-b">
      <div class="fgrid">
        <label class="f">Email address / username<input class="in" id="smUser" value="${esc(s.user)}" placeholder="support@yourdomain.com"></label>
        <label class="f">Password${pw('smPass', s.hasPassword)}</label>
        <label class="f">Server<input class="in" id="smHost" value="${esc(s.host)}" placeholder="smtpout.secureserver.net"></label>
        <div class="fgrid tight"><label class="f">Port<input class="in" id="smPort" type="number" value="${s.port}"></label><label class="f">Sender name<input class="in" id="smName" value="${esc(s.fromName)}"></label></div>
      </div>
      <label class="switch"><input type="checkbox" id="smAck" ${s.autoAck ? 'checked' : ''}><span></span>Send an acknowledgement with the ticket number when a ticket is created</label>
      <label class="switch"><input type="checkbox" id="smNotify" ${s.notifyAssignee ? 'checked' : ''}><span></span>Email the agent when a ticket is assigned to them (with a link to the ticket)</label>
      <div id="smMsg"></div>
      <div class="set-f"><button type="button" class="btn" data-mailtest="smtp">Test connection</button><button class="btn btn-grad" type="submit">Save</button></div>
    </div>
  </form>

  <details class="card set">
    <summary class="set-h"><div><h3>Import emails from files</h3><p>Upload .eml files exported from Outlook.</p></div></summary>
    <div class="set-b"><div class="drop" id="emlDrop">${ico('up', 'width="22" height="22"')}<div style="margin-top:6px">Drop .eml files here, or <u>choose files</u></div><input type="file" id="emlFile" accept=".eml,message/rfc822" multiple hidden></div></div>
  </details>
  </div>`;
  wireDrops();
}
const imapValues = () => ({ user: $('#imUser').value.trim(), password: $('#imPass').value, host: $('#imHost').value.trim(), port: Number($('#imPort').value), pollSeconds: Number($('#imPoll').value), folder: 'INBOX' });
const smtpValues = () => ({ user: $('#smUser').value.trim(), password: $('#smPass').value, host: $('#smHost').value.trim(), port: Number($('#smPort').value), fromName: $('#smName').value.trim(), autoAck: $('#smAck').checked, notifyAssignee: $('#smNotify').checked });
const showMsg = (sel, ok, text) => { $(sel).innerHTML = `<div class="note ${ok ? 'ok' : 'bad'}">${esc(text)}</div>`; };
async function testMail(kind, btn) {
  const sel = kind === 'smtp' ? '#smMsg' : '#imMsg';
  btn.disabled = true; const label = btn.textContent; btn.innerHTML = '<span class="spin"></span> Testing…';
  try { const r = await api('POST', '/api/settings/mail/test', { kind, values: kind === 'smtp' ? smtpValues() : imapValues() }); showMsg(sel, r.ok, r.message); }
  catch (err) { showMsg(sel, false, err.message); }
  btn.disabled = false; btn.textContent = label;
}
async function saveMail(kind, form) {
  const sel = kind === 'smtp' ? '#smMsg' : '#imMsg';
  const body = kind === 'smtp' ? { smtp: smtpValues() } : { imap: imapValues(), ...($('#inMode') ? { inbound: $('#inMode').value } : {}) };
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try { MAILCFG = await api('POST', '/api/settings/mail', body); toast(kind === 'smtp' ? 'Outgoing mail settings saved' : 'Incoming mail settings saved — checking the mailbox now'); vSetup(); }
  catch (err) { showMsg(sel, false, err.message); btn.disabled = false; }
}

/* ---------- TICKET DRAWER ---------- */
function openTicket(id) { UI.openId = id; history.replaceState(null, '', '#ticket-' + id); drawTicket(); }
function closeDrawer() { UI.openId = null; UI.editRecord = null; $('#drawerHost').innerHTML = ''; history.replaceState(null, '', '#' + UI.view); }
function drawTicket() {
  const t = S.tickets.find(x => x.id === UI.openId); if (!t) return;
  const keep = $('#cmpText')?.value, sc = $('.db')?.scrollTop;
  const a = { title: t.title, summary: t.summary, primary_module: t.module, sub_module: t.subModule, secondary_modules: t.secondaryModules || [], business_process: t.process, category: t.category, decision: 'create_ticket', priority: t.priority, impact: t.impact, urgency: t.urgency, priority_reason: t.priorityReason, entities: t.entities, missing_information: t.missing, suggested_next_steps: t.nextSteps, reasoning: t.reasoning, confidence: t.confidence, sentiment: t.sentiment };
  const srcEmail = S.emails.find(e => e.id === t.emailIds[0]);
  const msgs = t.messages.slice().sort((x, y) => x.at - y.at);
  const modOpts = META.groups.map(g => `<optgroup label="${esc(g.name)}">${META.modules.filter(m => m.group === g.id).map(m => `<option value="${m.code}" ${m.code === t.module ? 'selected' : ''}>${m.code} · ${esc(m.name)}</option>`).join('')}</optgroup>`).join('') + `<option value="UNKNOWN" ${t.module === 'UNKNOWN' ? 'selected' : ''}>UNKNOWN</option>`;
  const comps = mod(t.module)?.components || [];
  $('#drawerHost').innerHTML = `<div class="scrim" data-act="closeDrawer"></div>
  <aside class="drawer" role="dialog" aria-label="Ticket ${t.id}">
    <div class="dh"><div class="top"><span class="idl" style="font-size:14px">${t.id}</span>${modChip(t.module)}<span class="cat">${esc(t.category)}</span>${prioPill(t.priority)}${statusPill(t.status)}<span style="margin-left:auto;display:flex;gap:6px"><button class="btn btn-sm" data-copy="${t.id}">${ico('copy')}Copy ID</button><button class="btn btn-sm btn-ghost" data-act="closeDrawer" aria-label="Close">${ico('x')}</button></span></div>
      <h2>${esc(t.title)}</h2>
      <div class="stepper">${META.statuses.map(s => `<button data-status="${esc(s)}" class="${s === t.status ? 'cur' : ''}">${esc(s)}</button>`).join('')}</div>
      <div class="ctrlbar">
        <label class="f"><span>SAP module</span><select class="in" data-field="module">${modOpts}</select></label>
        <label class="f"><span>Component</span><select class="in" data-field="subModule">${[...new Set([t.subModule, ...comps].filter(Boolean))].map(c => `<option ${c === t.subModule ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="f"><span>Priority</span><select class="in prio-sel prio-sel-${t.priority}" data-field="priority">${['P1', 'P2', 'P3', 'P4'].map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p} · ${PL[p]}</option>`).join('')}</select></label>
        <label class="f"><span>Assignee</span><select class="in" data-assign>${assigneeOptions(t)}</select></label>
        ${t.assigneeId !== UI.me ? `<button class="btn btn-sm" data-act="assignMe">Assign to me</button>` : ''}
      </div></div>
    <div class="db">
      <div class="colL">
        ${resolutionCard(t)}
        ${t.missing?.length && !DONE.includes(t.status) ? `<div class="note warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>Waiting for:</b> ${t.missing.map(esc).join(' · ')}</span><button class="btn btn-sm" data-act="askInfo">${ico('mail')}Ask the requester</button></div>` : ''}
        ${UI.editRecord === t.id ? recordEdit(t) : recordView(t)}
        <div class="card"><div class="card-h"><h3>Conversation</h3><span class="muted" style="font-size:12px">${t.messages.length} messages${t.watchers.length ? ' · watchers: ' + t.watchers.map(w => esc(w.name)).join(', ') : ''}</span></div><div class="card-b"><div class="thread">${msgs.map(m => `<div class="msg ${m.dir}">${avatar(m.from)}<div class="bubble"><div class="h"><b>${esc(m.from)}</b><span class="tag">${{ in: m.duplicate ? 'Duplicate report' : 'Inbound email', out: m.closure ? (m.sent ? 'Closure email sent' : m.sendError ? 'Closure email not sent' : 'Closure email') : 'Reply sent', note: 'Internal note', auto: m.sent ? (m.ack ? 'Acknowledgement sent' : m.auto ? 'Sent automatically' : 'Sent') : m.draft ? (m.ack ? 'Acknowledgement · not sent yet' : 'Suggested reply · not sent yet') : m.superseded ? 'Older draft · not sent' : m.sendError ? 'Not sent: ' + esc(m.sendError) : 'Suggested reply' }[m.dir]}</span><span class="muted mono">${esc(m.email || '')}</span><span class="tm">${fmt(m.at)}</span></div><div class="bd" ${m.superseded ? 'style="opacity:.55"' : ''}>${esc(m.text)}</div>${m.dir === 'auto' && m.draft ? `<div style="margin-top:8px"><button class="btn btn-sm btn-grad" data-act="useDraft">${ico('mail')}Review &amp; send</button></div>` : ''}</div></div>`).join('')}</div></div></div>
        <div class="composer"><div class="seg"><button class="${UI.cmp === 'reply' ? 'on' : ''}" data-cmp="reply">Reply to requester</button><button class="${UI.cmp === 'note' ? 'on' : ''}" data-cmp="note">Internal note</button></div>
          <textarea class="in" id="cmpText" placeholder="${UI.cmp === 'note' ? 'Visible only to the support team…' : 'Reply to ' + esc(t.requester.email) + ' (logged on the ticket; connect SMTP to send for real)'}"></textarea>
          <div class="ft"><span class="muted" style="font-size:12px">${UI.cmp === 'reply' ? 'To: ' + esc(t.requester.email) : 'Internal'}</span><span class="sp"></span>${UI.cmp === 'reply' && t.messages.find(m => m.draft) ? `<button class="btn btn-sm" data-act="useDraft">${ico('spark')}Use suggested reply</button>` : ''}<button class="btn btn-sm btn-grad" data-act="sendMsg">${UI.cmp === 'note' ? 'Add note' : 'Send'}</button></div></div>
      </div>
      <div class="colR">
        ${slaCard(t)}
        ${requesterCard(t)}
        <div class="card"><div class="card-h"><h3>Classification</h3></div><div class="card-b"><div class="kv">
          <span>Category</span><select class="in" data-field="category">${['Incident', 'Change Request', 'Service Request', 'Query'].map(c => `<option ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <span>Group</span><span>${esc(t.assignmentGroup)}</span>
          <span>Process</span><span>${esc(t.process || '—')}</span>
          <span>Impact</span><span>${esc(t.impact || '—')} · urgency ${esc(t.urgency || '—')}</span>
          <span>Source</span><span>${esc(srcEmail?.source || '—')} · ${esc(srcEmail?.id || '')}</span>
          <span>Created</span><span class="num">${fmt(t.createdAt)}</span>
        </div></div></div>
        <details class="card"><summary class="card-h" style="cursor:pointer;padding-bottom:16px"><h3>Activity</h3><span class="muted" style="font-size:12px">${t.activity.length} entries</span></summary><div class="card-b"><div class="act">${t.activity.slice().reverse().map(x => `<div><span></span><span><b>${esc(/claude|rules/i.test(x.who) ? 'Auto-intake' : x.who)}</b> ${esc(x.text)}<br><span class="tm">${fmt(x.at)}</span></span></div>`).join('')}</div></div></details>
      </div>
    </div>
  </aside>`;
  wireTicketUpload();
  if (keep) $('#cmpText').value = keep;
  if (sc) $('.db').scrollTop = sc;
}

/* ---------- ticket record ---------- */
const ENT_LABELS = [['systems', 'System / client'], ['transaction_codes', 'Transaction codes'], ['error_messages', 'Error messages'], ['document_numbers', 'Documents'], ['company_codes', 'Company codes'], ['plants', 'Plants'], ['other_org_units', 'Other org units'], ['materials', 'Materials'], ['business_partners', 'Vendors / customers'], ['programs_jobs_interfaces', 'Programs / jobs / interfaces'], ['sap_user_ids', 'SAP user IDs']];
const fld = (label, val, wide) => `<div class="rf${wide ? ' wide' : ''}"><span>${label}</span><div>${val ? esc(val) : '<i class="muted">Not provided</i>'}</div></div>`;
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB';
function recordView(t) {
  const d = t.details || {}, ds = d.description || {}, cr = d.changeRequest, e = t.entities || {};
  const has = v => Array.isArray(v) ? v.length : v && !/^(not stated|not applicable|n\/a)$/i.test(String(v).trim());
  const ents = ENT_LABELS.filter(([k]) => (e[k] || []).length).map(([k, l]) => `<div class="ent"><span>${l}</span><div class="vals">${e[k].map(v => `<span class="tok ${k === 'error_messages' ? 'err' : ''}">${esc(v)}</span>`).join('')}</div></div>`).join('');
  const extra = [['Error / result', ds.actual_result, true], ['Expected', ds.expected_result], ['Business impact', ds.business_impact], ['Affected users', ds.affected_users], ['Since', ds.first_occurred], ['Workaround', ds.workaround, true]]
    .filter(([, v]) => has(v) && v !== ds.problem_statement).map(([l, v, w]) => fld(l, v, w)).join('');
  const crf = cr ? [['Requested change', cr.requested_change, true], ['Justification', cr.business_justification, true], ['Approver', cr.approver], ['Target date', cr.target_date], ['Complexity', cr.complexity]].filter(([, v]) => has(v)).map(([l, v, w]) => fld(l, v, w)).join('') : '';
  return `<div class="card rec"><div class="card-h"><h3>Summary</h3><div class="r"><button class="btn btn-sm btn-ghost" data-act="editRecord">Edit</button></div></div>
  <div class="card-b" style="display:flex;flex-direction:column;gap:14px">
    <p class="ps">${esc(ds.problem_statement || t.summary)}</p>
    ${extra ? `<div class="rgrid">${extra}</div>` : ''}
    ${has(ds.steps_to_reproduce) ? `<div><div class="eyebrow">Steps</div><ol class="lst" style="margin-top:4px">${ds.steps_to_reproduce.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${crf ? `<div class="crbox"><div class="eyebrow" style="margin-bottom:8px">Change request</div><div class="rgrid">${crf}</div></div>` : ''}
    ${ents ? `<div class="ents">${ents}</div>` : ''}
    <div><div class="eyebrow" style="margin-bottom:8px">Screenshots &amp; files${(t.attachments || []).length ? ` · ${t.attachments.length}` : ''}</div>${filesBlock(t.id, t.attachments, { upload: true })}</div>
  </div></div>`;
}
function recordEdit(t) {
  const d = t.details || {}, ds = d.description || {}, cr = d.changeRequest;
  const ta = (id, v, rows = 2) => `<textarea class="in" id="${id}" rows="${rows}" style="min-height:0">${esc(v || '')}</textarea>`;
  return `<form class="card rec" id="recForm"><div class="card-h"><h3>Edit ticket record</h3><div class="r"><button type="button" class="btn btn-sm" data-act="cancelRecord">Cancel</button><button class="btn btn-sm btn-grad" type="submit">Save</button></div></div>
  <div class="card-b" style="display:flex;flex-direction:column;gap:12px">
    <label class="f">Title<input class="in" id="rTitle" value="${esc(t.title)}"></label>
    <label class="f">Problem statement${ta('rPs', ds.problem_statement || t.summary, 3)}</label>
    <div class="fgrid">
      <label class="f full">Actual result (exact error)${ta('rAct', ds.actual_result)}</label>
      <label class="f">Expected result${ta('rExp', ds.expected_result)}</label>
      <label class="f">Business impact${ta('rImp', ds.business_impact)}</label>
      <label class="f">Affected users<input class="in" id="rUsers" value="${esc(ds.affected_users || '')}"></label>
      <label class="f">First occurred<input class="in" id="rFirst" value="${esc(ds.first_occurred || '')}"></label>
      <label class="f full">Workaround${ta('rWork', ds.workaround)}</label>
      <label class="f full">Steps to reproduce (one per line)${ta('rSteps', (ds.steps_to_reproduce || []).join('\n'), 4)}</label>
    </div>
    ${cr ? `<div class="crbox"><div class="eyebrow" style="margin-bottom:8px">Change request</div><div class="fgrid">
      <label class="f full">Requested change${ta('rCrChange', cr.requested_change)}</label>
      <label class="f full">Business justification${ta('rCrJust', cr.business_justification)}</label>
      <label class="f">Approver<input class="in" id="rCrAppr" value="${esc(cr.approver)}"></label>
      <label class="f">Target date<input class="in" id="rCrDate" value="${esc(cr.target_date)}"></label>
      <label class="f">Complexity<select class="in" id="rCrCx">${['Low', 'Medium', 'High', 'Not applicable'].map(x => `<option ${x === cr.complexity ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    </div></div>` : ''}
    <div class="eyebrow">Requester</div>
    <div class="fgrid">
      <label class="f">Designation<input class="in" id="rqDes" value="${esc(d.requester?.designation || '')}"></label>
      <label class="f">Department<input class="in" id="rqDept" value="${esc(d.requester?.department || '')}"></label>
      <label class="f">Phone<input class="in" id="rqPhone" value="${esc(d.requester?.phone || '')}"></label>
      <label class="f">Location / plant<input class="in" id="rqLoc" value="${esc(d.requester?.location || '')}"></label>
    </div>
  </div></form>`;
}
function readRecordForm() {
  const v = id => $('#' + id)?.value ?? '';
  const details = {
    description: { problem_statement: v('rPs'), actual_result: v('rAct'), expected_result: v('rExp'), business_impact: v('rImp'), affected_users: v('rUsers'), first_occurred: v('rFirst'), workaround: v('rWork'), steps_to_reproduce: v('rSteps').split('\n') },
    requester: { designation: v('rqDes'), department: v('rqDept'), phone: v('rqPhone'), location: v('rqLoc') },
  };
  if ($('#rCrChange')) details.changeRequest = { requested_change: v('rCrChange'), business_justification: v('rCrJust'), approver: v('rCrAppr'), target_date: v('rCrDate'), complexity: v('rCrCx') };
  return { title: v('rTitle'), details };
}
function requesterCard(t) {
  const r = { ...t.details?.requester, name: t.details?.requester?.name || t.requester.name, email: t.requester.email };
  const line = [r.designation, r.department, r.company].filter(Boolean).join(' · ');
  const rows = [['Phone', r.phone], ['Location', r.location], ['Watchers', (t.watchers || []).map(w => w.name).join(', ')]].filter(([, v]) => v);
  return `<div class="card"><div class="card-h"><h3>Requester</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
    <div class="who">${avatar(r.name)}<div class="t"><b>${esc(r.name)}</b><span>${esc(r.email)}</span></div></div>
    ${line ? `<div class="muted" style="font-size:12.5px">${esc(line)}</div>` : ''}
    ${rows.length ? `<div class="kv">${rows.map(([l, v]) => `<span>${l}</span><span>${esc(v)}</span>`).join('')}</div>` : ''}
  </div></div>`;
}
function slaCard(t) {
  const now = Date.now();
  const resp = t.firstResponseAt ? (t.firstResponseAt <= t.responseDueAt ? `<span class="sla sla-done">Responded ${fmt(t.firstResponseAt)}</span>` : `<span class="sla sla-breached">Responded late, ${fmt(t.firstResponseAt)}</span>`)
    : t.responseDueAt ? (now > t.responseDueAt ? `<span class="sla sla-breached">Response overdue ${dur(now - t.responseDueAt)}</span>` : `<span class="sla sla-ok">Respond within ${dur(t.responseDueAt - now)}</span>`) : '<span class="muted">—</span>';
  return `<div class="card"><div class="card-h"><h3>Service level</h3><span class="muted" style="font-size:12px">${t.priority} · ${PL[t.priority]}</span></div><div class="card-b"><div class="kv">
    <span>First response</span><div>${resp}${t.responseDueAt ? `<div class="muted" style="font-size:11.5px">due ${fmt(t.responseDueAt)}</div>` : ''}</div>
    <span>Resolution</span><div>${slaChip(t)}<div class="muted" style="font-size:11.5px">${META.sla[t.priority]}h target · due ${fmt(t.slaDueAt)}</div></div>
  </div></div></div>`;
}

/* ---------- closure confirmation ---------- */
const isClosing = (t, to) => DONE.includes(to) && to !== t.status;
// Every status change goes through here so Resolved / Closed always get the confirmation step.
async function changeStatus(id, to) {
  const t = S.tickets.find(x => x.id === id); if (!t || t.status === to) return;
  if (isClosing(t, to)) { closeDialog(t, to); return; }
  try { await api('PATCH', `/api/tickets/${id}`, { status: to }); toast(`${id} → ${to}`); } catch (err) { toast(err.message, true); }
}
function closeDialog(t, to) {
  const c = t.closure || {};
  const reuse = t.status === 'Resolved' && to === 'Closed' && c.notes;
  const checks = [];
  if ((t.missing || []).length) checks.push(`Information still marked as missing: ${t.missing.map(esc).join(', ')}`);
  if (!t.assigneeId) checks.push('No agent is assigned to this ticket');
  if (!t.messages.some(m => m.dir === 'out' && !m.closure)) checks.push('No reply has been sent to the requester yet');
  if (t.category === 'Change Request' && t.status === 'Awaiting Approval') checks.push('This change request is still awaiting approval');
  modal(`<form id="closeForm" data-id="${t.id}" data-to="${to}">
    <div class="mh"><div><h3>${to === 'Closed' ? 'Close' : 'Resolve'} ${t.id}?</h3><p>${esc(t.title)}</p></div><button type="button" class="btn btn-sm btn-ghost x" data-act="closeModal" aria-label="Cancel">${ico('x')}</button></div>
    <div class="mb">
      <div class="note"><b>Before ${to === 'Closed' ? 'closing' : 'resolving'}, update the case:</b>
        <ol class="lst" style="margin-top:6px"><li>Choose how it was resolved and describe what was done, so the next agent can reuse the fix.</li><li>Record the root cause if it is known.</li><li>Make sure the requester knows. Keep the email option below ticked to send them the resolution.</li></ol></div>
      ${checks.length ? `<div class="note warn"><b>Please check:</b><ul class="lst" style="margin-top:4px">${checks.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <label class="f">Resolution code<select class="in" id="clCode" required><option value="">Choose…</option>${META.resolutionCodes.map(x => `<option ${x === c.code ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label class="f">Resolution notes <span class="muted" style="font-weight:500">required: what was done to fix it</span><textarea class="in" id="clNotes" required minlength="10" placeholder="e.g. Maintained payment method T for vendor 200345 in company code 1000 (FK02) and re-ran F110 proposal; invoices now selected.">${esc(reuse ? c.notes : '')}</textarea></label>
      <label class="f">Root cause <span class="muted" style="font-weight:500">optional</span><textarea class="in" id="clRoot" style="min-height:60px" placeholder="e.g. New vendor created without payment method in the company code data.">${esc(reuse ? c.rootCause || '' : '')}</textarea></label>
      <label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;cursor:pointer"><input type="checkbox" id="clNotify" ${reuse ? '' : 'checked'} style="margin-top:3px;accent-color:var(--g-b)"><span>Email the resolution to <b>${esc(t.requester.email)}</b>${S.health.smtp ? '' : ' <span class="muted">(email sending is not configured; it will only be logged)</span>'}</span></label>
      <div id="clErr"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn btn-grad" type="submit">${ico('check')}Confirm &amp; ${to === 'Closed' ? 'close' : 'resolve'}</button></div>
    </div></form>`, 'small');
  $('#clCode').focus();
}
async function submitClose(form) {
  const id = form.dataset.id, to = form.dataset.to;
  const closure = { code: $('#clCode').value, notes: $('#clNotes').value.trim(), rootCause: $('#clRoot').value.trim(), notify: $('#clNotify').checked };
  if (!closure.code) { $('#clErr').innerHTML = '<div class="note bad">Choose a resolution code.</div>'; return; }
  if (closure.notes.length < 10) { $('#clErr').innerHTML = '<div class="note bad">Describe what was done to resolve it (at least a sentence).</div>'; $('#clNotes').focus(); return; }
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try {
    await api('PATCH', `/api/tickets/${id}`, { status: to, closure });
    closeModal(); toast(`${id} ${to.toLowerCase()}${closure.notify ? ' · requester notified' : ''}`);
  } catch (err) { $('#clErr').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; btn.disabled = false; }
}
function resolutionCard(t) {
  const c = t.closure; if (!c) return '';
  return `<div class="card rescard"><div class="card-h"><h3>${DONE.includes(t.status) ? esc(t.status) : 'Previous resolution'}</h3><span class="pill st-done">${esc(c.code)}</span><span class="muted" style="font-size:12px;margin-left:auto">${esc(c.by)} · ${fmt(c.at)}</span></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:10px"><p class="ps" style="margin:0">${esc(c.notes)}</p>${c.rootCause ? `<div class="rf wide"><span>Root cause</span><div>${esc(c.rootCause)}</div></div>` : ''}</div></div>`;
}

/* ---------- attachments: thumbnails, files, uploads, requester link ---------- */
const attUrl = (owner, a) => owner.startsWith('EM-') ? `/api/emails/${encodeURIComponent(owner)}/attachments/${a.id}` : `/api/tickets/${encodeURIComponent(owner)}/attachments/${a.id}`;
function filesBlock(owner, list, opts = {}) {
  const L = list || [];
  const imgs = L.filter(a => a.image && a.stored !== false), files = L.filter(a => !(a.image && a.stored !== false));
  const by = a => a.source === 'requester' ? ' · from requester' : a.uploadedBy ? ` · ${esc(a.uploadedBy)}` : a.inline ? ' · pasted in email' : '';
  return `<div class="files">
    ${imgs.length ? `<div class="thumbs">${imgs.map(a => `<button type="button" class="thumb" data-lightbox="${esc(attUrl(owner, a))}" data-name="${esc(a.name)}" title="${esc(a.name)}"><img src="${esc(attUrl(owner, a))}" alt="${esc(a.name)}" loading="lazy"><span>${esc(a.name)}</span></button>`).join('')}</div>` : ''}
    ${files.length ? `<div class="chips">${files.map(a => a.stored === false
      ? `<span class="att" title="${a.skipped ? 'Not stored: ' + esc(a.skipped) : 'Only the name was recorded for this older email'}">${ico('clip')}${esc(a.name)}<span class="muted">${kb(a.size)} · not stored</span></span>`
      : `<a class="att" href="${esc(attUrl(owner, a))}" target="_blank" rel="noopener">${ico('clip')}${esc(a.name)}<span class="muted">${kb(a.size)}${by(a)}</span></a>`).join('')}</div>` : ''}
    ${opts.upload ? `<div class="drop small" id="tDrop" tabindex="0" role="button">${ico('up', 'width="18" height="18"')}<span>Drop files or screenshots here, or <u>choose files</u> · paste a screenshot with Ctrl+V</span><input type="file" id="tFile" multiple hidden></div>
      <div class="uplink"><span>Requester can add files with a private link</span><button type="button" class="btn btn-sm" data-act="copyUpload">${ico('copy')}Copy upload link</button></div>` : ''}
  </div>`;
}
function lightbox(src, name) {
  modal(`<div class="lb"><div class="lb-h"><b>${esc(name)}</b><span class="sp"></span><a class="btn btn-sm" href="${esc(src)}" target="_blank" rel="noopener">Open full size</a><button type="button" class="btn btn-sm btn-ghost" data-act="closeModal" aria-label="Close">${ico('x')}</button></div><img src="${esc(src)}" alt="${esc(name)}"></div>`, 'lbx');
}
async function uploadToTicket(id, files) {
  for (const f of files) {
    const name = f.name && f.name !== 'image.png' ? f.name : `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    try {
      const r = await fetch(`/api/tickets/${encodeURIComponent(id)}/attachments`, { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(name) }, body: f });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { location.href = '/?next=' + encodeURIComponent(location.hash); return; }
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      toast(`${name} added to ${id}`);
    } catch (err) { toast(`${name}: ${err.message}`, true); }
  }
}
function wireTicketUpload() {
  const z = $('#tDrop'), inp = $('#tFile'); if (!z || !inp || z.dataset.wired) return;
  z.dataset.wired = '1';
  z.onclick = () => inp.click();
  z.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
  inp.onchange = () => { uploadToTicket(UI.openId, [...inp.files]); inp.value = ''; };
  z.ondragover = e => { e.preventDefault(); z.classList.add('over'); };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('over'); uploadToTicket(UI.openId, [...e.dataTransfer.files]); };
}
// Ctrl+V a screenshot while a ticket is open (and not typing in a text box) → attach it
document.addEventListener('paste', e => {
  if (!UI.openId || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); uploadToTicket(UI.openId, fs); }
});

/* ---------- signed-in user ---------- */
function renderMe() {
  const host = $('#userChip'); if (!host || !S.me) return;
  host.innerHTML = `<button type="button" class="uchip" data-act="userMenu" aria-haspopup="true">${avatar(S.me.name)}<span><b>${esc(S.me.name)}</b><small>${esc(S.me.role)}${S.me.access === 'admin' ? ' · Admin' : ''}</small></span></button>`;
  const rb = $('#resetBtn'); if (rb) rb.hidden = S.me.access !== 'admin';
}
function userMenu() {
  modal(`<div class="mh"><div style="display:flex;gap:12px;align-items:center">${avatar(S.me.name)}<div><h3>${esc(S.me.name)}</h3><p>${esc(S.me.email)} · ${esc(S.me.role)} · ${S.me.access === 'admin' ? 'Admin' : 'Agent'}</p></div></div><button type="button" class="btn btn-sm btn-ghost x" data-act="closeModal" aria-label="Close">${ico('x')}</button></div>
    <div class="mb"><button class="btn btn-grad" data-act="signOut" style="justify-content:center">Sign out</button></div>`, 'small');
}

/* ---------- license ---------- */
function licenseCard() {
  const L = S.license || { state: 'none' };
  const pill = { valid: L.expiringSoon ? ['st-wait', `Expires in ${L.daysLeft} day${L.daysLeft === 1 ? '' : 's'}`] : ['st-done', 'Active'], expired: ['st-wait', 'Expired'], invalid: ['st-wait', 'Invalid key'], notyet: ['st-wait', 'Not valid yet'], none: ['st-new', 'No license'] }[L.state] || ['st-new', L.state];
  const seats = L.maxUsers ? Math.min(100, Math.round(L.activeUsers / L.maxUsers * 100)) : 0;
  return `<section class="card set">
    <div class="set-h"><div><h3>License</h3><p>Your SensAI Desk license key, its validity and the number of users it allows.</p></div><span class="pill ${pill[0]}">${pill[1]}</span></div>
    <div class="set-b">
      ${L.customer ? `<div class="lic">
        <div><span>Licensed to</span><b>${esc(L.customer)}</b></div>
        <div><span>Type</span><b>${L.type === 'demo' ? 'Demo' : 'Annual'}</b></div>
        <div><span>Valid until</span><b>${new Date(L.expires).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b><small>${L.state === 'valid' ? `${L.daysLeft} day${L.daysLeft === 1 ? '' : 's'} left` : ''}</small></div>
        <div><span>Users</span><b class="${L.overLimit ? 'over' : ''}">${L.activeUsers} of ${L.maxUsers}</b><em class="bar"><i style="width:${seats}%"></i></em><small>active users, admins included</small></div>
      </div>` : ''}
      ${L.customer ? `<div class="licaddons"><span>Add-on modules</span><div>${addonChips()}</div></div>` : ''}
      ${L.state !== 'valid' && L.message ? `<div class="note warn">${esc(L.message)} ${L.state === 'none' || L.state === 'expired' ? 'Until a valid key is entered, only admins can sign in. Incoming emails are still turned into tickets.' : ''}</div>` : ''}
      ${L.overLimit ? `<div class="note warn">${L.activeUsers} users are active but the license allows ${L.maxUsers}. Disable users on the Users page, or apply a key with more users.</div>` : ''}
      <form id="licForm" style="display:flex;flex-direction:column;gap:10px">
        <label class="f">${L.customer ? 'Replace with a new key' : 'License key'}<textarea class="in mono" id="licKey" rows="3" placeholder="SDK1.…" spellcheck="false" style="min-height:0;font-size:12px"></textarea></label>
        <div id="licMsg"></div>
        <div class="set-f">${L.id ? `<span class="muted small" style="margin-right:auto">Key ID ${esc(L.id)}</span>` : ''}<button class="btn btn-grad" type="submit">Apply key</button></div>
      </form>
    </div>
  </section>

`;
}
async function applyLicense(form) {
  const key = $('#licKey').value.trim();
  if (!key) { $('#licMsg').innerHTML = '<div class="note bad">Paste the license key first.</div>'; return; }
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try {
    S.license = await api('POST', '/api/license', { key });
    toast(`License applied: ${S.license.type === 'demo' ? 'Demo' : 'Annual'}, ${S.license.maxUsers} users, ${S.license.daysLeft} days`);
    render();
  } catch (err) { $('#licMsg').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; btn.disabled = false; }
}
function renderLicenseBanner() {
  const el = $('#licBanner'); if (!el) return;
  const L = S.license || {}, admin = S.me?.access === 'admin';
  let msg = '';
  if (L.state && L.state !== 'valid') msg = admin ? `${L.state === 'none' ? 'No license key has been entered' : L.state === 'expired' ? 'The license has expired' : 'The license key is not valid'}. Only admins can sign in until a key is applied in <a href="#setup">Settings → License</a>.` : '';
  else if (L.expiringSoon) msg = `The ${L.type === 'demo' ? 'demo' : 'annual'} license expires in <b>${L.daysLeft} day${L.daysLeft === 1 ? '' : 's'}</b>.${admin ? ' Apply a new key in <a href="#setup">Settings → License</a>.' : ' Please tell your admin.'}`;
  el.innerHTML = msg ? `<div class="licbar ${L.state === 'valid' ? 'soon' : 'bad'}">${msg}</div>` : '';
}

/* ---------- ADD-ON MODULES (admin) ---------- */
const licensedAddons = () => (S.license?.state === 'valid' ? S.license.addons || [] : []);
function vAddons() {
  const on = licensedAddons();
  const cat = META.addons || [];
  $('#view').innerHTML = `
  <div class="note">Add-on modules extend SensAI Desk. Each one is switched on by your license key. ${on.length ? `Your license includes <b>${on.length}</b> of ${cat.length}.` : 'Your current license includes none.'} To add a module, ask your SensAI Desk provider for a key that includes it, then apply it in <a href="#setup">Settings → License</a>.</div>
  <div class="addons">${cat.map(a => { const lic = on.includes(a.id); return `
    <article class="card addon ${lic ? 'addon-on' : 'locked'}">
      <div class="ah"><span class="ai">${ico(IC[a.icon] ? a.icon : 'spark')}</span><div><h3>${esc(a.name)}</h3><p>${esc(a.tagline)}</p></div>
        <span class="pill ${lic ? 'st-done' : 'st-new'}">${lic ? 'Licensed' : `${ico('lock', 'width="12" height="12"')} Locked`}</span></div>
      <ul>${a.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="af">${lic ? 'Included in your license. This module is switched on as soon as it is released in an update.' : 'Available with an add-on license.'}</div>
    </article>`; }).join('')}</div>`;
}
function addonChips() {
  const on = licensedAddons(), cat = META.addons || [];
  return on.length ? on.map(id => `<span class="pill st-done">${esc(cat.find(a => a.id === id)?.name || id)}</span>`).join(' ') : '<span class="muted small">None — see <a href="#addons">Add-on modules</a></span>';
}

/* ---------- MODALS ---------- */
const modal = (html, cls = '') => { $('#modalHost').innerHTML = `<div class="modal ${cls}"><div class="scrim" data-act="closeModal"></div><div class="mbox">${html}</div></div>`; };
const closeModal = () => { $('#modalHost').innerHTML = ''; };
function compose(key) {
  const s = META.samples.find(x => x.key === key) || META.samples[0];
  modal(`<div class="mh"><div><h3>Send a test email to the desk</h3><p>It goes through the same pipeline as webhook, .eml and IMAP mail.</p></div><button class="btn btn-sm btn-ghost x" data-act="closeModal" aria-label="Close">${ico('x')}</button></div>
  <div class="mb" id="cBody">
    <div><div class="eyebrow" style="margin-bottom:6px">Samples across SAP modules</div><div class="samples">${META.samples.map(x => `<button type="button" class="${x.key === s.key ? 'on' : ''}" data-csample="${x.key}">${esc(x.label)}<span>${esc(x.hint)}</span></button>`).join('')}</div></div>
    <form id="cForm" class="fgrid">
      <label class="f">From<input class="in" id="cFrom" value="${esc(s.from)}" required></label>
      <label class="f">To<input class="in" id="cTo" value="${esc(s.to)}"></label>
      <label class="f">Cc<input class="in" id="cCc" value="${esc(s.cc)}"></label>
      <label class="f">Subject<input class="in" id="cSubj" value="${esc(s.subject)}" required></label>
      <label class="f full">Body (include earlier quoted messages to test thread understanding)<textarea class="in" id="cBodyTxt" style="min-height:180px" required>${esc(s.body)}</textarea></label>
      <div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn btn-grad" type="submit">${ico('spark')}Send to ${esc(S.health.mailbox)}</button></div>
    </form>
  </div>`);
}
async function sendCompose() {
  const email = { from: $('#cFrom').value, to: $('#cTo').value, cc: $('#cCc').value, subject: $('#cSubj').value, body: $('#cBodyTxt').value };
  const steps = ['Email received by the support mailbox', 'Reads the whole conversation', 'Classifies SAP module, component and category', 'Extracts t-codes, errors, documents and org units', 'Checks open tickets for updates and duplicates', 'Decides: create, update, clarify or ignore'];
  $('#cBody').innerHTML = `<div class="pipe">${steps.map(s => `<div class="pstep"><span class="d">${ico('check')}</span><b>${esc(s)}</b></div>`).join('')}</div><div id="cRes"></div>`;
  const ps = $$('.pstep'); let i = 0;
  const tick = setInterval(() => { if (i < ps.length - 1) ps[i++].classList.add('on'); }, 700);
  try {
    const e = await api('POST', '/api/emails', email);
    clearInterval(tick); ps.forEach(p => p.classList.add('on'));
    $('#cRes').innerHTML = `<div style="margin-top:14px">${renderAnalysis(e.analysis, e.meta, e.error)}</div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">${e.ticketId ? `<button class="btn btn-grad" data-open="${e.ticketId}">Open ${e.ticketId}</button>` : ''}<button class="btn" data-act="compose">Send another</button></div>`;
  } catch (err) { clearInterval(tick); $('#cRes').innerHTML = `<div class="note bad" style="margin-top:14px">${esc(err.message)}</div>`; }
}
async function runSamples() {
  if (UI.running) return; UI.running = true;
  toast(`Sending ${META.samples.length} sample emails — watch them arrive live`);
  location.hash = 'inbox';
  let ok = 0;
  for (const s of META.samples) {
    try { await api('POST', '/api/emails', { from: s.from, to: s.to, cc: s.cc, subject: s.subject, body: s.body, source: 'sample' }); ok++; }
    catch (err) { toast(`${s.label}: ${err.message}`, true); }
  }
  UI.running = false; toast(`Processed ${ok} of ${META.samples.length} sample emails`);
}
/* ---------- global search (Ctrl+K, "/", top-bar box) ---------- */
// Everything searchable about a ticket, flattened to one lowercase string.
function ticketHaystack(t) {
  const d = t.details || {}, ds = d.description || {}, r = d.requester || {}, cr = d.changeRequest || {};
  return [t.id, t.title, t.summary, t.category, t.status, t.priority, PL[t.priority], t.module, mod(t.module)?.name, t.subModule, t.process,
    t.assignmentGroup, t.assignee, t.requester?.name, t.requester?.email, r.designation, r.department, r.company, r.location,
    ds.problem_statement, ds.actual_result, ds.expected_result, ds.business_impact, ds.first_occurred, ...(ds.steps_to_reproduce || []),
    cr.requested_change, cr.business_justification, cr.approver, ...(t.missing || []), ...(t.attachments || []).map(a => a.name),
    ...Object.values(t.entities || {}).flat(), ...(t.messages || []).map(m => m.text)].filter(Boolean).join(' • ').toLowerCase();
}
const emailHaystack = e => [e.id, e.subject, e.from?.name, e.from?.email, e.to, e.cc, e.body, e.ticketId, e.analysis?.primary_module, e.analysis?.category, DEC[e.analysis?.decision]].filter(Boolean).join(' • ').toLowerCase();
// All words must match (AND), in any order: "migo 1100" finds tickets mentioning both.
const matchAll = (hay, q) => q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));

function palette(initial = '') {
  modal(`<div class="palbox"><div class="palin">${ico('mag', 'width="18" height="18"')}<input id="palQ" placeholder="Search tickets, emails, t-codes, people, modules…" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><div class="pres" id="palR"></div><div class="palft"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span>Multiple words must all match · e.g. <b>migo 1100</b>, <b>rahul p1</b>, <b>status 51</b></span></div></div>`, 'pal');
  const q = $('#palQ'); q.value = initial; q.focus();
  let sel = 0;
  const ACTIONS = [
    { l: 'Send a test email', act: 'compose', kw: 'send test email compose new simulate' },
    { l: 'Run all sample emails', act: 'runSamples', kw: 'run samples demo seed' },
    ...Object.entries(VIEWS).filter(([k]) => !HIDDEN_VIEWS.includes(k) && (!['audit', 'setup', 'addons'].includes(k) || meIsAdmin())).map(([k, [l]]) => ({ l: 'Go to ' + l, href: '#' + k, kw: 'go open view ' + l.toLowerCase() + ' ' + k })),
  ];
  const run = () => {
    const s = q.value.toLowerCase().trim();
    const T = (s ? S.tickets.filter(t => matchAll(ticketHaystack(t), s)) : S.tickets.slice()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    const E = s ? S.emails.filter(e => matchAll(emailHaystack(e), s)).sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 5) : [];
    const M = s ? META.modules.filter(m => matchAll([m.code, m.name, m.team, ...m.components, ...m.tcodes].join(' ').toLowerCase(), s)).slice(0, 4) : [];
    const A = s ? (S.agents || []).filter(ag => matchAll([ag.name, ag.role, ag.team, ag.email, ...ag.modules].join(' ').toLowerCase(), s)).slice(0, 3) : [];
    const X = ACTIONS.filter(x => !s || matchAll((x.l + ' ' + x.kw).toLowerCase(), s)).slice(0, s ? 3 : 4);
    const sec = (title, items) => items ? `<div class="eyebrow pres-h">${title}</div>${items}` : '';
    const html =
      sec(s ? `Tickets · ${T.length}${T.length === 8 ? '+' : ''}` : 'Recently updated tickets', T.map(t => `<button data-open="${t.id}"><span class="idl">${t.id}</span>${modChip(t.module)}<span class="tt">${esc(t.title)}<small>${esc(t.requester?.name || '')}${t.assignee ? ' → ' + esc(t.assignee) : ''}</small></span>${prioPill(t.priority)}${statusPill(t.status)}</button>`).join('')) +
      sec('Emails', E.map(e => `<button data-mail="${e.id}">${ico('mail', 'width="15" height="15"')}<span class="tt">${esc(e.subject)}<small>${esc(e.from.name)} · ${ago(e.receivedAt)}</small></span>${e.analysis ? decPill(e.analysis.decision) : ''}</button>`).join('')) +
      sec('SAP modules', M.map(m => `<button data-fmod="${esc(m.code)}">${modChip(m.code)}<span class="tt">${esc(m.name)}<small>${esc(m.team)} · ${S.tickets.filter(t => t.module === m.code).length} tickets</small></span></button>`).join('')) +
      sec('Agents', A.map(ag => `<button data-fagent="${ag.id}">${avatar(ag.name)}<span class="tt">${esc(ag.name)}<small>${esc(ag.role)} · ${S.tickets.filter(t => t.assigneeId === ag.id && !DONE.includes(t.status)).length} open</small></span></button>`).join('')) +
      sec('Actions', X.map(x => x.href ? `<button data-go="${x.href}">${ico('up', 'width="15" height="15" style="transform:rotate(90deg)"')}<span class="tt">${esc(x.l)}</span></button>` : `<button data-act="${x.act}">${ico('spark', 'width="15" height="15"')}<span class="tt">${esc(x.l)}</span></button>`).join(''));
    $('#palR').innerHTML = html.includes('<button') ? html : `<div class="empty"><b>No matches for “${esc(q.value)}”</b>Try a ticket number, t-code, PO number, person or module.</div>`;
    sel = 0; mark();
  };
  const items = () => $$('#palR button');
  const mark = () => items().forEach((b, i) => b.classList.toggle('on', i === sel));
  q.oninput = run; run();
  q.onkeydown = ev => {
    const n = items().length;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = (sel + 1) % Math.max(1, n); mark(); items()[sel]?.scrollIntoView({ block: 'nearest' }); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = (sel - 1 + n) % Math.max(1, n); mark(); items()[sel]?.scrollIntoView({ block: 'nearest' }); }
    else if (ev.key === 'Enter') { ev.preventDefault(); items()[sel]?.click(); }
  };
}
async function uploadEml(files) {
  for (const f of files) {
    try { const e = await api('POST', '/api/inbound/eml', await f.text(), true); toast(`${f.name}: ${DEC[e.analysis.decision]}${e.ticketId ? ' · ' + e.ticketId : ''}`); }
    catch (err) { toast(`${f.name}: ${err.message}`, true); }
  }
}
function bindDrop(zoneSel, inputSel, onFiles) {
  const z = $(zoneSel), inp = $(inputSel); if (!z) return;
  z.onclick = () => inp.click();
  inp.onchange = () => { onFiles([...inp.files]); inp.value = ''; };
  z.ondragover = e => { e.preventDefault(); z.classList.add('over'); };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('over'); onFiles([...e.dataTransfer.files]); };
}

/* ---------- events ---------- */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act],[data-open],[data-mail],[data-if],[data-sel],[data-tg],[data-ts],[data-mode],[data-tsort],[data-fmod],[data-status],[data-cmp],[data-csample],[data-lsample],[data-reprocess],[data-copy],[data-fagent],[data-go],[data-setmode],[data-mailtest],[data-edituser],[data-toggleuser],[data-confirmdeact],[data-aarea],[data-lightbox],[data-setauth]');
  if (!el) return; const d = el.dataset;
  if (d.open) { closeModal(); openTicket(d.open); return; }
  if (d.mail) { closeModal(); UI.iSel = d.mail; UI.iFilter = 'all'; if (UI.openId) closeDrawer(); if (UI.view !== 'inbox') location.hash = 'inbox'; else render(); return; }
  if (d.if) { UI.iFilter = d.if; UI.iSel = null; vInbox(); return; }
  if (d.sel) { UI.iSel = d.sel; $$('.iitem').forEach(x => x.classList.toggle('on', x.dataset.sel === d.sel)); iDetail(); return; }
  if (d.tg) { UI.tGroup = d.tg; UI.tMod = 'all'; vTickets(); return; }
  if (d.ts) { UI.tStatus = d.ts; vTickets(); return; }
  if (d.mode) { UI.tMode = d.mode; saveUI(); vTickets(); return; }
  if (d.tsort) { const s = UI.tSort; UI.tSort = s.key === d.tsort ? { key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: d.tsort, dir: FIRST_DIR[d.tsort] || 'asc' }; saveUI(); tBody(); return; }
  if (d.setauth) { try { S.settings = await api('POST', '/api/settings', { authMode: d.setauth }); toast(d.setauth === 'password' ? 'Passwords are now required to sign in' : 'Passwordless sign-in is on'); render(); } catch (err) { toast(err.message, true); } return; }
  if (d.lightbox) { lightbox(d.lightbox, d.name); return; }
  if (d.aarea) { UI.audit.area = d.aarea; vAudit(); return; }
  if (d.edituser) { userModal(agentById(d.edituser)); return; }
  if (d.toggleuser) { toggleUser(d.toggleuser); return; }
  if (d.confirmdeact) { try { await api('PATCH', `/api/agents/${d.confirmdeact}`, { active: false }); closeModal(); toast(`${agentById(d.confirmdeact)?.name} deactivated`); await refresh(); } catch (err) { $('#uErr').innerHTML = `<div class="note bad">${esc(err.message)}</div>`; } return; }
  if (d.mailtest) { testMail(d.mailtest, el); return; }
  if (d.setmode) { try { S.settings = await api('POST', '/api/settings', { analysisMode: d.setmode }); toast(d.setmode === 'detailed' ? 'Detailed parsing on — more processing per email' : 'Basic parsing on'); render(); } catch (err) { toast(err.message, true); } return; }
  if (d.fagent) { closeModal(); Object.assign(UI, { tAsg: d.fagent, tMod: 'all', tGroup: 'all', tStatus: 'all', tQ: '' }); if (UI.view === 'tickets') vTickets(); else location.hash = 'tickets'; return; }
  if (d.go) { closeModal(); location.hash = d.go; return; }
  if (d.fmod) { closeModal(); UI.tMod = d.fmod; UI.tGroup = 'all'; UI.tStatus = 'all'; location.hash = 'tickets'; if (UI.view === 'tickets') vTickets(); return; }
  if (d.cmp) { UI.cmp = d.cmp; drawTicket(); return; }
  if (d.csample) { compose(d.csample); return; }
  if (d.lsample) { fillLab(META.samples.find(s => s.key === d.lsample)); $$('[data-lsample]').forEach(b => b.classList.toggle('on', b === el)); return; }
  if (d.copy) { navigator.clipboard?.writeText(d.copy).then(() => toast('Copied ' + d.copy), () => toast(d.copy)); return; }
  if (d.reprocess) { el.disabled = true; try { const e = await api('POST', `/api/emails/${d.reprocess}/reprocess`); UI.iSel = e.id; toast('Re-run: ' + DEC[e.analysis.decision]); } catch (err) { toast(err.message, true); } return; }
  if (d.status) { await changeStatus(UI.openId, d.status); return; }
  switch (d.act) {
    case 'closeDrawer': closeDrawer(); break;
    case 'closeModal': closeModal(); break;
    case 'compose': compose(); break;
    case 'palette': palette(); break;
    case 'runSamples': closeModal(); runSamples(); break;
    case 'userMenu': userMenu(); break;
    case 'signOut': await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/'; break;
    case 'copyUpload': { try { const { link } = await api('GET', `/api/tickets/${UI.openId}/upload-link`); try { await navigator.clipboard.writeText(link); toast('Upload link copied — paste it into an email to the requester'); } catch { modal(`<div class="mh"><div><h3>Requester upload link</h3><p>Copy this and send it to the requester.</p></div><button class="btn btn-sm btn-ghost x" data-act="closeModal">${ico('x')}</button></div><div class="mb"><input class="in mono" value="${esc(link)}" readonly onclick="this.select()"></div>`, 'small'); } } catch (err) { toast(err.message, true); } break; }
    case 'auditReload': AUDIT = null; vAudit(); break;
    case 'addUser': userModal(null); break;
    case 'assignMe': try { await api('PATCH', `/api/tickets/${UI.openId}`, { assigneeId: UI.me }); toast('Assigned to you'); } catch (err) { toast(err.message, true); } break;
    case 'editRecord': UI.editRecord = UI.openId; drawTicket(); $('#rTitle')?.focus(); break;
    case 'cancelRecord': UI.editRecord = null; drawTicket(); break;
    case 'askInfo': {
      const t = S.tickets.find(x => x.id === UI.openId); UI.cmp = 'reply'; drawTicket();
      const first = (t.details?.requester?.name || t.requester.name).split(' ')[0];
      const qs = (t.questions?.length ? t.questions : t.missing.map(m => 'Please share the ' + m.toLowerCase() + '.'));
      $('#cmpText').value = [`Hello ${first},`, '', `Thank you for reporting this. To continue working on ${t.id}, could you please share:`, ...qs.map(q => '• ' + q), '', 'Just reply to this email; your answer is added to the ticket automatically.', '', 'SAP Service Desk'].join('\n');
      $('#cmpText').focus(); $('#cmpText').scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
    }
    case 'useDraft': { const t = S.tickets.find(x => x.id === UI.openId); if (UI.cmp !== 'reply') { UI.cmp = 'reply'; drawTicket(); } $('#cmpText').value = t.messages.filter(m => m.draft).pop()?.text || ''; $('#cmpText').focus(); $('#cmpText').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Draft loaded — edit if needed, then click Send'); break; }
    case 'sendMsg': {
      const text = $('#cmpText').value.trim(); if (!text) { toast('Write a message first', true); return; }
      el.disabled = true;
      try {
        const r = await api('POST', `/api/tickets/${UI.openId}/messages`, { text, kind: UI.cmp });
        $('#cmpText').value = '';
        if (UI.cmp === 'note') toast('Note added');
        else if (r.delivery === 'sent') toast('Reply emailed to the requester');
        else if (r.delivery === 'failed') toast('Reply saved but not sent: ' + r.error, true);
        else toast('Reply logged on the ticket (SMTP not configured)');
      } catch (err) { toast(err.message, true); }
      el.disabled = false;
      break;
    }
    case 'labCreate': {
      const e = labEmail(); if (!e.from || !e.subject || !e.body.trim()) { toast('Fill in From, Subject and Body first', true); return; }
      el.disabled = true; try { const r = await api('POST', '/api/emails', { ...e, source: 'parse-lab' }); toast(`${DEC[r.analysis.decision]}${r.ticketId ? ' · ' + r.ticketId : ''}`); if (r.ticketId) openTicket(r.ticketId); } catch (err) { toast(err.message, true); } el.disabled = false; break;
    }
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.id === 'tMod') { UI.tMod = el.value; tBody(); return; }
  if (el.id === 'tCat') { UI.tCat = el.value; tBody(); return; }
  if (el.id === 'tPrio') { UI.tPrio = el.value; tBody(); return; }
  if (el.id === 'aWho') { UI.audit.who = el.value; vAudit(); return; }
  if (el.id === 'aDays') { UI.audit.days = el.value; vAudit(); return; }
  if (el.id === 'tAsg') { UI.tAsg = el.value; tBody(); return; }
  if (el.id === 'meSel-retired') { UI.me = el.value; try { localStorage.setItem('sapai-me', UI.me); } catch { /* ignore */ } toast('Working as ' + (agentById(UI.me)?.name || UI.me)); render(); return; }
  if ('assign' in el.dataset && UI.openId) { try { await api('PATCH', `/api/tickets/${UI.openId}`, { assigneeId: el.value }); toast(el.value ? 'Assigned to ' + agentById(el.value)?.name : 'Unassigned'); } catch (err) { toast(err.message, true); } return; }
  if (el.dataset.field && UI.openId) {
    const patch = { [el.dataset.field]: el.value };
    if (el.dataset.field === 'module') patch.subModule = mod(el.value)?.components[0] || '';
    const label = { module: 'Module', subModule: 'Component', priority: 'Priority', category: 'Category' }[el.dataset.field] || 'Saved';
    try { await api('PATCH', `/api/tickets/${UI.openId}`, patch); toast(`${label} → ${el.value}${el.dataset.field === 'module' ? ' · re-routed to ' + (mod(el.value)?.team || '') : el.dataset.field === 'priority' ? ' · SLA recalculated' : ''}`); } catch (err) { toast(err.message, true); }
  }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'aQ') { UI.audit.q = ev.target.value; clearTimeout(UI.aqT); UI.aqT = setTimeout(() => { vAudit(); const i = $('#aQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } if (ev.target.id === 'tQ') { UI.tQ = ev.target.value; tBody(); } });
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.id === 'cForm') sendCompose();
  if (ev.target.id === 'labForm') runLab();
  if (ev.target.id === 'licForm') { applyLicense(ev.target); return; }
  if (ev.target.id === 'userForm') { saveUser(ev.target); return; }
  if (ev.target.id === 'imapForm') { saveMail('imap', ev.target); return; }
  if (ev.target.id === 'smtpForm') { saveMail('smtp', ev.target); return; }
  if (ev.target.id === 'closeForm') { submitClose(ev.target); return; }
  if (ev.target.id === 'recForm') {
    const body = readRecordForm(), id = UI.openId;
    api('PATCH', `/api/tickets/${id}`, body).then(t => { S.tickets = S.tickets.map(x => x.id === id ? t : x); UI.editRecord = null; drawTicket(); toast('Ticket record saved'); }).catch(err => toast(err.message, true));
  }
});
document.addEventListener('dragstart', ev => { const k = ev.target.closest('[data-drag]'); if (k) ev.dataTransfer.setData('text/plain', k.dataset.drag); });
document.addEventListener('dragover', ev => { const c = ev.target.closest('.col'); if (c) { ev.preventDefault(); $$('.col.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', async ev => {
  const c = ev.target.closest('.col'); if (!c) return; ev.preventDefault(); c.classList.remove('over');
  const id = ev.dataTransfer.getData('text/plain'); if (!id) return;
  await changeStatus(id, c.dataset.col);
});
document.addEventListener('keydown', ev => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'b' && !typing) { ev.preventDefault(); toggleSide(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); ev.stopPropagation(); if (!$('#palQ')) palette(); else $('#palQ').select(); return; }
  if (ev.key === '/' && !typing && !$('#modalHost').innerHTML) { ev.preventDefault(); palette(); return; }
  if (ev.key === 'Escape') { if ($('#modalHost').innerHTML) closeModal(); else if (UI.openId) closeDrawer(); }
});
const ts = $('#topSearch');
if (ts) {
  // open on a normal click (not mousedown) so the same click can't land on the overlay and close it again
  ts.addEventListener('click', ev => { ev.preventDefault(); if (!$('#palQ')) palette(); });
  ts.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); palette(); } });
  ts.closest('.topsearch')?.addEventListener('click', ev => { if (ev.target !== ts && !$('#palQ')) palette(); });
}
// collapsible left pane (remembered per browser)
function toggleSide(force) {
  const app = $('.app'); const on = typeof force === 'boolean' ? force : !app.classList.contains('collapsed');
  app.classList.toggle('collapsed', on);
  const b = $('#sideToggle'); if (b) { b.title = on ? 'Expand menu (Ctrl+B)' : 'Collapse menu (Ctrl+B)'; b.setAttribute('aria-label', b.title); }
  try { localStorage.setItem('sapai-side', on ? '1' : '0'); } catch { /* ignore */ }
}
$('#sideToggle').onclick = () => toggleSide();
try { if (localStorage.getItem('sapai-side') === '1') toggleSide(true); } catch { /* ignore */ }
$('#themeBtn').onclick = () => { const r = document.documentElement; const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('sapai-theme', r.dataset.theme); } catch { /* ignore */ } };
let armed = 0;
$('#resetBtn').onclick = async e => {
  if (Date.now() - armed > 3000) { armed = Date.now(); e.target.textContent = 'Click again'; setTimeout(() => e.target.textContent = 'Clear data', 3000); return; }
  e.target.textContent = 'Clear data'; await api('POST', '/api/reset'); toast('All tickets and emails cleared');
};
window.addEventListener('hashchange', go);

// Drop zones live inside views, so they are wired after each render.
function wireDrops() {
  bindDrop('#emlDrop', '#emlFile', uploadEml);
  bindDrop('#labDrop', '#labFile', async files => {
    const f = files[0]; if (!f) return;
    try { const e = await api('POST', '/api/eml/parse', await f.text(), true); fillLab({ ...e, from: `${e.from.name} <${e.from.email}>` }); toast('Loaded ' + f.name); } catch (err) { toast(err.message, true); }
  });
}

/* ---------- live updates ---------- */
let rt = null;
function connectEvents() {
  const es = new EventSource('/api/events');
  es.onopen = () => { $('#livePill').innerHTML = '<span class="dot"></span>Live'; };
  es.onmessage = () => { clearTimeout(rt); rt = setTimeout(refresh, 200); };
  es.onerror = () => { $('#livePill').innerHTML = '<span class="dot off"></span>Reconnecting'; };
}

/* ---------- boot ---------- */
(async () => {
  try { const th = localStorage.getItem('sapai-theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* ignore */ }
  try {
    [META, S] = await Promise.all([api('GET', '/api/meta'), api('GET', '/api/state')]);
    UI.me = S.me?.id;
  } catch (err) {
    $('#view').innerHTML = `<div class="note bad">Could not reach the server: ${esc(err.message)}. Start it with <span class="mono">npm start</span>.</div>`; return;
  }
  go(); connectEvents();
  setInterval(() => { if (['dashboard', 'tickets'].includes(UI.view) && !$('#modalHost').innerHTML) render(); }, 60000);
})();
})();
