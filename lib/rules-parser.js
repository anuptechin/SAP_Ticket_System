// Offline fallback: transparent keyword rules that return the same JSON shape as the Claude parser.
// Used when no API key is configured or the Claude call fails, so the demo always works.
import { MODULES, UNKNOWN, moduleByCode } from './taxonomy.js';

const IGNORE = ['unsubscribe', 'newsletter', 'webinar', '% off', 'exclusive offer', 'job opening', 'we are hiring', 'happy diwali', 'festive greetings', 'lunch', 'birthday', 'limited period'];
const KNOWN_TCODES = new Set(MODULES.flatMap(m => m.tcodes.map(t => t.toUpperCase())));
const TYPE_KW = {
  'Incident': [/\berror\b/, /not working/, /unable to/, /\bcannot\b|can't|can not/, /\bfail/, /\bdump\b/, /\bstuck\b/, /\bblocked\b/, /\bissue\b/, /mismatch/, /\bslow\b/, /\bdown\b/, /wrong/],
  'Change Request': [/change request|\bcr\b/, /enhancement/, /new (field|report|output|form|storage|workflow|approver|column)/, /\badd (a |an |new |the )?(field|column|approver|qr|logo|check)/, /\bmodif/, /\bdevelop/, /requirement/, /configure (a )?new/, /automat/],
  'Service Request': [/\baccess\b/, /\brole\b/, /password/, /\bunlock/, /create (a )?user|new user/, /\btransport\b/, /upload/],
  'Query': [/how (to|do|can|should)/, /\bquery\b/, /what is/, /is it possible/, /\?\s*$/m],
};

function splitThread(body) {
  const re = /\n(?=(?:-{2,}\s*(?:Original Message|Forwarded message)\s*-{2,}|On .{5,90} wrote:|From:\s.+\n(?:Sent|Date):))/i;
  return String(body).split(re).map(s => s.trim()).filter(Boolean);
}
const uniq = a => [...new Set(a.filter(Boolean))];
const grab = (rx, text, g = 1) => uniq([...text.matchAll(rx)].map(m => m[g].trim()));

export function parseWithRules(email, ctx) {
  const started = Date.now();
  const full = `${email.subject}\n${email.body}`;
  const low = full.toLowerCase();
  const parts = splitThread(email.body);
  const latest = parts[0] || '';
  const mb = (ctx.mailbox || '').toLowerCase();
  let scenario = 'Direct';
  if (/^\s*(re|aw)\s*:/i.test(email.subject)) scenario = 'Reply';
  if (/^\s*(fw|fwd)\s*:/i.test(email.subject) || /forwarded message/i.test(email.body)) scenario = 'Forwarded';
  if ((email.cc || '').toLowerCase().includes(mb) && !(email.to || '').toLowerCase().includes(mb)) scenario = 'CC';

  // module scores
  const scores = MODULES.map(m => ({ m, s: m.kw.reduce((n, k) => n + (new RegExp(k, 'i').test(low) ? 1 : 0), 0) + m.tcodes.reduce((n, t) => n + (new RegExp(`\\b${t.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(full) ? 2 : 0), 0) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  const primary = scores[0]?.m;
  const sapSignal = scores.reduce((a, b) => a + b.s, 0) + (/\bsap\b/i.test(full) ? 1 : 0);

  const tyScore = Object.fromEntries(Object.entries(TYPE_KW).map(([k, rx]) => [k, rx.reduce((n, r) => n + (r.test(low) ? 1 : 0), 0)]));
  let [category, ts] = Object.entries(tyScore).sort((a, b) => b[1] - a[1])[0];

  const ign = IGNORE.find(k => low.includes(k));
  const courtesy = latest.length < 90 && /^(hi[^\n]*\n+)?\s*(thanks|thank you|noted|received|ok|okay|great)\b/i.test(latest.trim());

  let decision = 'create_ticket', related = ctx.referencedTicket?.id || '';
  if (related) { category = 'Follow-up'; decision = 'update_existing'; }
  else if ((ign && sapSignal < 2) || courtesy) { category = 'Irrelevant'; decision = 'ignore'; }
  else if (sapSignal === 0) { category = tyScore.Query > 0 ? 'Not SAP-related' : 'Irrelevant'; decision = tyScore.Query > 0 ? 'reject' : 'ignore'; }
  else if (!primary || ts === 0) { decision = 'request_clarification'; if (ts === 0) category = 'Incident'; }

  // duplicate check against open tickets
  if (decision === 'create_ticket' && primary) {
    const tok = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
    const st = tok(email.subject.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, ''));
    for (const t of ctx.openTickets) {
      if (t.module !== primary.code) continue;
      const tt = tok(t.title); let i = 0; st.forEach(w => { if (tt.has(w)) i++; });
      if (st.size >= 3 && i / Math.min(st.size, tt.size || 1) >= 0.5 && t.requester.email !== email.from.email) { decision = 'mark_duplicate'; related = t.id; break; }
    }
  }

  let priority = 'P3';
  if (/production (is )?down|all users|cannot (bill|invoice|dispatch|pay)|plant (stopped|halted)|\bcritical\b|payments? (are )?due today|month[- ]end close|dispatch (is )?(held|stopped)/i.test(low)) priority = 'P1';
  else if (/urgent|asap|blocking|\bblocked\b|on hold|\bheld\b|high priority/i.test(low)) priority = 'P2';
  else if (category === 'Query' || /whenever possible|low priority|nice to have/i.test(low)) priority = 'P4';
  if (category === 'Change Request' && priority === 'P1') priority = 'P2';

  const tcodes = uniq([...full.matchAll(/\b([A-Z]{2,4}\d{2,3}[A-Z]?|[A-Z]{4,}_[A-Z0-9_]+|\/[A-Z0-9]+\/[A-Z0-9_]+)\b/g)].map(m => m[1]).filter(t => KNOWN_TCODES.has(t) || /^(ME|MB|VA|VF|VL|FB|KS|MD|CO|SM|ST|SU|PA|QA|IW|WE|LT)\d/.test(t)));
  const entities = {
    transaction_codes: tcodes,
    error_messages: uniq([...grab(/"([^"\n]{8,160})"/g, full), ...grab(/error[:\s]+([A-Z][^.\n]{8,120})/g, full)]).slice(0, 4),
    document_numbers: grab(/\b((?:45|12|80|90|49|50|10)\d{8}|DEVK\d{6})\b/g, full),
    company_codes: grab(/company code\s*(\d{4})/gi, full),
    plants: grab(/plant\s*(\d{4})/gi, full),
    other_org_units: uniq([...grab(/sales org(?:anization)?\s*(\d{4})/gi, full).map(x => 'Sales org ' + x), ...grab(/storage location\s*(\d{4})/gi, full).map(x => 'SLoc ' + x)]),
    materials: grab(/material\s+([A-Z0-9-]{4,})/g, full),
    business_partners: grab(/(?:vendor|customer|supplier)\s+(\d{5,10})/gi, full),
    programs_jobs_interfaces: grab(/\b(Z[A-Z][A-Z0-9_]{3,})\b/g, full),
    sap_user_ids: grab(/user(?:\s?id)?\s+([A-Z]{3,}\d{0,3})\b/g, full),
    systems: grab(/\b(PRD|QAS|DEV|ECP|ECQ)\b/g, full),
  };

  const missing = [];
  if (category === 'Incident') {
    if (!entities.transaction_codes.length && !entities.programs_jobs_interfaces.length) missing.push('Transaction code or program');
    if (!entities.error_messages.length && !/error|message|dump/i.test(full)) missing.push('Exact error message');
    if (!entities.company_codes.length && !entities.plants.length && !entities.other_org_units.length) missing.push('Company code / plant');
    if (!entities.document_numbers.length && !/steps|while|when i|trying to/i.test(full)) missing.push('Document number or steps to reproduce');
  } else if (category === 'Change Request') {
    if (!/because|reason|justif|required for|needed for|audit|compliance|so that/i.test(full)) missing.push('Business justification');
    if (!/approv|sign[- ]?off|\bhod\b|head/i.test(full)) missing.push('Approver');
    if (!/\bby \d|before|go-?live|deadline|month[- ]end|next week|\bq[1-4]\b/i.test(full)) missing.push('Expected go-live date');
  } else if (category === 'Service Request') {
    if (!entities.sap_user_ids.length && !/user ?id/i.test(full)) missing.push('SAP user ID');
    if (!/approv/i.test(full)) missing.push('Approver');
  }
  if (decision === 'request_clarification') missing.push('SAP module / transaction', 'Description of the problem');

  const clean = latest.replace(/^(hi|hello|dear)[^\n]*\n/i, '').replace(/\n(regards|thanks|best|thank you)[\s\S]*$/i, '').replace(/\s+/g, ' ').trim();
  const summary = (clean.match(/[^.!?]+[.!?]?/g) || [clean]).slice(0, 2).join(' ').slice(0, 300) + (parts.length > 1 ? ` (Thread of ${parts.length} messages.)` : '');
  const first = email.from.name.split(' ')[0] || 'there';
  const comp = primary ? (primary.components.find(c => c.split(/\W+/).some(w => w.length > 3 && low.includes(w.toLowerCase()))) || primary.components[0]) : '';
  const process = { fin: 'Record-to-Report', log: 'Order-to-Cash / Procure-to-Pay', hr: 'Hire-to-Retire', tech: 'Platform', int: 'Integration', ana: 'Analytics', cx: 'Master Data' }[primary?.group] || '';

  return {
    parsed: {
      is_sap_related: sapSignal > 0,
      category, decision, related_ticket_id: related,
      title: email.subject.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').replace(/\[[^\]]*\]\s*/g, '').slice(0, 90),
      summary,
      primary_module: primary?.code || UNKNOWN,
      sub_module: comp,
      secondary_modules: scores.slice(1, 3).filter(x => x.s >= 2).map(x => x.m.code),
      business_process: process,
      priority,
      impact: priority === 'P1' ? 'Multiple departments' : priority === 'P2' ? 'Single department' : 'Single user',
      urgency: { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }[priority],
      priority_reason: 'Keyword rules on urgency and business-impact phrases.',
      entities,
      conversation: { scenario, message_count: parts.length, participants: uniq([email.from.email]), latest_status: decision === 'update_existing' ? 'Requester replied with more information' : 'New request' },
      missing_information: missing,
      clarification_questions: missing.map(m => `Please share the ${m.toLowerCase()}.`),
      suggested_next_steps: primary ? [`Assign to ${moduleByCode(primary.code).team}`, 'Reproduce in the quality system'] : [],
      sentiment: priority === 'P1' ? 'Concerned' : 'Calm',
      confidence: Math.min(0.9, 0.45 + 0.08 * Math.min(scores[0]?.s || 0, 4) + 0.06 * Math.min(ts, 2)),
      reasoning: primary ? `Matched ${scores[0].s} ${primary.code} keyword/t-code signals; ${category.toLowerCase()} wording detected.` : 'No SAP module signals found.',
      reply_to_requester: decision === 'ignore' ? '' : decision === 'reject'
        ? `Hello ${first},\n\nThis mailbox handles SAP application support only. Please contact the owning function for this query.\n\nSAP Service Desk`
        : `Hello ${first},\n\n${decision === 'create_ticket' ? 'Your request is logged as {TICKET_ID}.' : 'Thank you, we have noted this.'}${missing.length ? ' To proceed, please share: ' + missing.join(', ') + '.' : ' The team will update you shortly.'}\n\nSAP Service Desk`,
      requester_details: {
        name: email.from.name, designation: '', department: '', company: '',
        phone: ((full.match(/(?:tel|phone|mob(?:ile)?)[:.\s]*([+\d][\d\s()+-]{7,})/i) || [])[1] || '').trim(), location: '',
      },
      description: {
        problem_statement: summary, steps_to_reproduce: [], expected_result: '',
        actual_result: entities.error_messages.join('; '),
        business_impact: (full.match(/[^.\n]*(held|blocked|waiting|due today|stopped|cannot)[^.\n]*/i) || [''])[0].trim(),
        affected_users: 'Not stated', first_occurred: ((full.match(/since [^.\n,]{3,40}/i) || [''])[0]).trim(), workaround: '',
      },
      change_request: category === 'Change Request'
        ? { requested_change: summary, business_justification: (full.match(/[^.\n]*(because|required for|needed for|so that|compliance)[^.\n]*/i) || [''])[0].trim(), approver: (full.match(/[^.\n]*approv[^.\n]*/i) || [''])[0].trim(), target_date: '', complexity: 'Medium' }
        : { requested_change: '', business_justification: '', approver: '', target_date: '', complexity: 'Not applicable' },
    },
    meta: { engine: 'rules', model: 'offline-rules', latencyMs: Date.now() - started, usage: null },
  };
}
