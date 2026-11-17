// Parses an email conversation into a structured SAP ticket using the Claude API.
import Anthropic from '@anthropic-ai/sdk';
import { MODULES, MODULE_CODES, UNKNOWN, CATEGORIES, DECISIONS, PRIORITIES, taxonomyForPrompt } from './taxonomy.js';

export const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const MODEL = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Request options differ by model generation:
// - `effort` is rejected by Haiku 4.5 / Sonnet 4.5 and older.
// - server-side refusal `fallbacks` exist only for the newest frontier models.
export function capabilities(model) {
  const legacy = /haiku-4-5|sonnet-4-5|opus-4-1|opus-4-0|sonnet-4-0|claude-3/.test(model);
  return {
    effort: legacy ? null : (process.env.CLAUDE_EFFORT || 'medium'),
    fallbacks: /^claude-(fable-5-[12]|opus-5-5|opus-5|sonnet-5-5)$/.test(model),
  };
}
export const EFFORT = capabilities(MODEL).effort;
export const MODEL_CHOICES = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'];

let client = null;
export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export class ParseError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

const str = { type: 'string' };
const strArr = { type: 'array', items: { type: 'string' } };

// Compact on purpose: strict structured output compiles the schema into a grammar with a size limit,
// so SAP entities are one tagged list and the ticket record is one flat object. expandParsed() turns
// this into the richer shape the rest of the app uses.
const ENTITY_KINDS = {
  tcode: 'transaction_codes', error: 'error_messages', document: 'document_numbers', company_code: 'company_codes',
  plant: 'plants', org_unit: 'other_org_units', material: 'materials', partner: 'business_partners',
  program: 'programs_jobs_interfaces', user_id: 'sap_user_ids', system: 'systems',
};
const RECORD_FIELDS = ['requester_designation', 'requester_department', 'requester_company', 'requester_phone', 'requester_location',
  'problem_statement', 'expected_result', 'actual_result', 'business_impact', 'affected_users', 'first_occurred', 'workaround',
  'cr_requested_change', 'cr_justification', 'cr_approver', 'cr_target_date', 'cr_complexity'];

export const TICKET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_sap_related', 'category', 'decision', 'related_ticket_id', 'title', 'summary',
    'primary_module', 'sub_module', 'secondary_modules', 'business_process',
    'priority', 'impact', 'urgency', 'entities', 'scenario', 'message_count', 'record',
    'missing_information', 'suggested_next_steps', 'sentiment', 'confidence', 'reasoning', 'reply_to_requester'],
  properties: {
    is_sap_related: { type: 'boolean' },
    category: { type: 'string', enum: CATEGORIES },
    decision: { type: 'string', enum: DECISIONS },
    related_ticket_id: { type: 'string', description: 'Existing ticket ID this email belongs to or duplicates, e.g. SAP-1004. Empty string if none.' },
    title: { type: 'string', description: 'Concise ticket title, max ~90 characters, naming the SAP object/transaction and the symptom.' },
    summary: { type: 'string', description: '2-4 sentence neutral summary of the whole conversation, including the latest status.' },
    primary_module: { type: 'string', enum: [...MODULE_CODES, UNKNOWN] },
    sub_module: { type: 'string', description: 'The component within the primary module (pick from the taxonomy list when one fits).' },
    secondary_modules: { ...strArr, description: 'Other module codes from the taxonomy that the issue touches, e.g. ["FI"].' },
    business_process: { type: 'string', description: 'e.g. Procure-to-Pay, Order-to-Cash, Record-to-Report, Plan-to-Produce, Hire-to-Retire, Integration, Platform.' },
    priority: { type: 'string', enum: PRIORITIES },
    impact: { type: 'string', description: 'One of: Enterprise-wide, Multiple departments, Single department, Single user' },
    urgency: { type: 'string', description: 'One of: Critical, High, Medium, Low' },
    entities: {
      type: 'array', description: 'Every SAP object mentioned, literally as written.',
      items: { type: 'object', additionalProperties: false, required: ['kind', 'value'], properties: { kind: { type: 'string', enum: Object.keys(ENTITY_KINDS) }, value: str } },
    },
    scenario: { type: 'string', enum: ['Direct', 'CC', 'Forwarded', 'Reply'] },
    message_count: { type: 'integer' },
    record: {
      type: 'object', additionalProperties: false, required: [...RECORD_FIELDS, 'steps_to_reproduce'],
      description: 'Consultant-ready ticket record. Empty string when not stated; never invent.',
      properties: { ...Object.fromEntries(RECORD_FIELDS.map(k => [k, str])), steps_to_reproduce: strArr },
    },
    missing_information: { ...strArr, description: 'Details a support consultant still needs, phrased as short labels.' },
    suggested_next_steps: strArr,
    sentiment: { type: 'string', description: 'One of: Calm, Concerned, Frustrated, Escalated' },
    confidence: { type: 'number', description: '0 to 1 — confidence in the module and category classification.' },
    reasoning: { type: 'string', description: 'Why this module, category, priority and decision were chosen (include the priority rationale).' },
    reply_to_requester: { type: 'string', description: 'Plain-text email from the SAP Service Desk: acknowledgement with next steps, or the clarification questions. Empty string for ignore.' },
  },
};

// Compact model output -> the shape used by the pipeline, rules engine and UI.
export function expandParsed(p) {
  const entities = Object.fromEntries(Object.values(ENTITY_KINDS).map(k => [k, []]));
  for (const e of p.entities || []) { const k = ENTITY_KINDS[e.kind]; if (k && e.value && !entities[k].includes(e.value)) entities[k].push(e.value); }
  const r = p.record || {};
  return {
    ...p, entities,
    priority_reason: '',
    clarification_questions: [],
    conversation: { scenario: p.scenario, message_count: p.message_count, participants: [], latest_status: '' },
    requester_details: { name: '', designation: r.requester_designation, department: r.requester_department, company: r.requester_company, phone: r.requester_phone, location: r.requester_location },
    description: { problem_statement: r.problem_statement, steps_to_reproduce: r.steps_to_reproduce || [], expected_result: r.expected_result, actual_result: r.actual_result, business_impact: r.business_impact, affected_users: r.affected_users, first_occurred: r.first_occurred, workaround: r.workaround },
    change_request: { requested_change: r.cr_requested_change, business_justification: r.cr_justification, approver: r.cr_approver, target_date: r.cr_target_date, complexity: r.cr_complexity || 'Not applicable' },
  };
}

// Stable system prompt (cached). Volatile data goes in the user message.
const SYSTEM_PROMPT = `You are the intake analyst of a corporate SAP Application Support desk. Every email that reaches the support mailbox is given to you — sent directly, with the mailbox in CC on an existing conversation, forwarded, or as a reply to an existing ticket.

Your job: read the WHOLE conversation (earlier quoted messages included), work out what is actually being asked, and return one structured ticket analysis as JSON matching the schema.

## SAP module taxonomy
Classify into exactly one primary module from this list (plus secondary modules when the issue genuinely spans several). Use UNKNOWN only when the email is SAP-related but gives no clue at all.

${taxonomyForPrompt()}

Classification guidance:
- Decide by the business object and transaction that is failing, not by the department of the sender. A payroll posting failing in FI is HCM primary, FI secondary.
- An IDoc stuck in status 51 is EDI unless the root cause is clearly functional (then the functional module primary, EDI secondary). A PI/PO channel or mapping error is PI/PO. A CPI iFlow error is CPI.
- Missing authorization (SU53, "no authority") is SEC. A short dump in a Z-program is ABAP. Slowness/system availability is BASIS.
- Business partner / customer / vendor master creation and changes go to MDG when governance or duplicates are involved, otherwise to the functional module (FI for vendor bank data, SD for customer sales data).

## Categories
- Incident: something that worked is broken, failing, erroring or blocked.
- Change Request: new or changed functionality, configuration, report, form, field or workflow.
- Service Request: access, roles, password/unlock, transports, data uploads, standard admin tasks.
- Query: how-to or process question about SAP.
- Follow-up: a courtesy reply or status chase on an existing ticket that adds no new facts. When a reply adds real details to a ticket (especially one in Awaiting Info), use the category of the underlying request instead (Incident, Change Request, Service Request or Query) together with decision update_existing.
- Not SAP-related: a genuine business query with no SAP system involvement (travel policy, commercial quotation, HR policy).
- Irrelevant: greetings, thanks-only, advertisements, newsletters, job postings, personal messages.

## Decisions
- create_ticket: a new valid SAP request.
- update_existing: the email references or clearly continues an open ticket (ticket ID in subject/body, or same thread). Set related_ticket_id.
- mark_duplicate: a different person reports the same open issue. Set related_ticket_id.
- request_clarification: SAP-related but too vague to act on (no symptom, no module). The desk opens the ticket in "Awaiting Info"; your reply asks the clarification questions.
- A reply WITHOUT a ticket ID from a sender who has an open ticket on the same topic (often in Awaiting Info) is update_existing for that ticket.
- ignore: Irrelevant.
- reject: Not SAP-related.

## Priority (impact × urgency)
- P1: production down, many users or a plant/billing/dispatch/payment run stopped, statutory deadline today, month-end close blocked.
- P2: a business process is blocked for a team, urgent workaround needed, single site affected.
- P3: normal incidents with a workaround, standard change and service requests.
- P4: queries, cosmetic issues, nice-to-have changes.
Never inflate priority because of the sender's tone alone; explain the choice in reasoning.

## Extraction
Extract every SAP entity literally as written: transaction codes, exact error message text, document numbers (PO, sales order, delivery, invoice, IDoc, transport), company codes, plants, sales orgs/storage locations/purchasing orgs, materials, vendors/customers, Z-programs/jobs/interfaces/channels, SAP user IDs, systems/clients. Use empty arrays when nothing is present — never invent values.
List in missing_information only what the REQUESTER must still supply before a consultant can start work — not things the consultant can look up in SAP themselves (configuration, valuation class, account assignments, master data settings). For incidents typically: transaction code, exact error message, org unit (company code/plant), document number or steps to reproduce, since when. For change requests: business justification, approver, expected date. For service requests: user ID, approver.

## Ticket details
- record.requester_*: from the sender and the email signature (designation, department, company, phone, office/plant). Empty strings for anything not present.
- record (problem fields): write a consultant-ready problem record. problem_statement names the transaction/object, org unit and symptom. steps_to_reproduce only when stated or clearly implied. actual_result quotes the exact error. business_impact says who or what is blocked and the consequence (dispatch held, payments due, month-end blocked). affected_users and first_occurred as stated. Use empty strings or empty arrays when the email does not say — never invent.
- record.cr_*: fill only for Change Requests (requested change, justification, approver, target date, your complexity estimate Low/Medium/High). For every other category use empty strings and cr_complexity "Not applicable".
- entities: one item per SAP object. kind = tcode, error (exact message text), document, company_code, plant, org_unit (sales org, storage location, purchasing org), material, partner (vendor/customer), program (Z-program, job, interface, channel), user_id, system (PRD/QAS/client).
- The email may list attachments (screenshots, logs). Mention them in the summary when they are relevant evidence.

## Reply
Write reply_to_requester as the service desk, addressed to the original requester by first name, in plain text without markdown. For create_ticket, write "{TICKET_ID}" where the ticket number goes; it is filled in later. Ask the clarification questions if information is missing. Keep it under 120 words.`;

// ================= BASIC MODE (default) =================
// Just enough to create and route a ticket. ~5-8x fewer output tokens than detailed mode.
export const BASIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_sap_related', 'category', 'decision', 'related_ticket_id', 'title', 'summary', 'primary_module', 'sub_module', 'priority', 'entities', 'missing_information', 'confidence'],
  properties: {
    is_sap_related: { type: 'boolean' },
    category: { type: 'string', enum: CATEGORIES },
    decision: { type: 'string', enum: DECISIONS },
    related_ticket_id: str,
    title: { type: 'string', description: 'Max ~80 characters.' },
    summary: { type: 'string', description: '1-2 short sentences.' },
    primary_module: { type: 'string', enum: [...MODULE_CODES, UNKNOWN] },
    sub_module: str,
    priority: { type: 'string', enum: PRIORITIES },
    entities: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'value'], properties: { kind: { type: 'string', enum: Object.keys(ENTITY_KINDS) }, value: str } } },
    missing_information: { ...strArr, description: 'At most 3 short labels; only what the requester must still provide.' },
    confidence: { type: 'number' },
  },
};

const BASIC_PROMPT = `You classify emails sent to an SAP support mailbox into tickets. Read the whole thread and return the JSON.

Modules (code — name: components):
${MODULES.map(m => `${m.code} — ${m.name}: ${m.components.join('; ')}`).join('\n')}
Use UNKNOWN only if SAP-related with no clue. Classify by the failing object/transaction, not the sender's department. IDoc errors = EDI, PI/PO channel = PI/PO, authorization = SEC, Z-program dump = ABAP, slowness/system down = BASIS.

category: Incident (broken/failing) | Change Request (new/changed function) | Service Request (access, role, password, transport) | Query (how-to) | Follow-up (reply with no new facts) | Not SAP-related | Irrelevant (greeting, ad, newsletter, job post, personal).
decision: create_ticket | update_existing (references or continues an open ticket, incl. a reply from the same requester on the same topic; set related_ticket_id) | mark_duplicate (someone else reports an open issue; set related_ticket_id) | request_clarification (SAP-related but too vague) | ignore (Irrelevant) | reject (Not SAP-related).
priority: P1 production/plant/billing/payment run stopped or many users | P2 a team's process blocked | P3 normal | P4 query or cosmetic. Ignore the sender's own priority label unless the impact supports it.
entities: SAP objects literally as written (tcode, error, document, company_code, plant, org_unit, material, partner, program, user_id, system). Never invent values.
Keep title, summary and missing_information short.`;

function expandBasic(p) {
  const full = expandParsed({ ...p, record: {}, secondary_modules: [], business_process: '', reasoning: '', reply_to_requester: '', suggested_next_steps: [], sentiment: 'Calm' });
  const urg = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }[p.priority] || 'Medium';
  full.urgency = urg;
  full.impact = { P1: 'Multiple departments', P2: 'Single department' }[p.priority] || 'Single user';
  full.description = { ...full.description, problem_statement: p.summary || '', actual_result: full.entities.error_messages.join('; ') };
  full.change_request = { requested_change: '', business_justification: '', approver: '', target_date: '', complexity: 'Not applicable' };
  return full;
}

const BODY_LIMIT = 8000; // characters; very long threads are cut and the cut is marked
function buildUserContent(email, ctx, mode = 'detailed') {
  if (mode === 'basic') {
    const mine = ctx.openTickets.filter(t => t.requester?.email === email.from.email);
    const others = ctx.openTickets.filter(t => t.requester?.email !== email.from.email);
    const open = [...mine, ...others].slice(0, 15).map(t => `${t.id}|${t.module}|${t.status}|${t.requester.email}|${String(t.title).slice(0, 70)}`).join('\n') || '(none)';
    const body = email.body.length > BODY_LIMIT ? email.body.slice(0, BODY_LIMIT) + `\n[… ${email.body.length - BODY_LIMIT} more characters of older thread not shown]` : email.body;
    const ref = ctx.referencedTicket ? `\nReferenced ticket: ${ctx.referencedTicket.id} (${ctx.referencedTicket.module}, ${ctx.referencedTicket.status}) ${ctx.referencedTicket.title}` : '';
    return `From: ${email.from.name} <${email.from.email}>
To: ${email.to || ''}${email.cc ? '\nCc: ' + email.cc : ''}
Subject: ${email.subject}${(email.attachments || []).length ? '\nAttachments: ' + email.attachments.map(a => a.name).join(', ') : ''}

${body}

Open tickets (id|module|status|requester|title):
${open}${ref}`;
  }
  return buildDetailedContent(email, ctx);
}

function buildDetailedContent(email, ctx) {
  const open = ctx.openTickets.length
    ? ctx.openTickets.map(t => `${t.id} | ${t.module} / ${t.subModule || '-'} | ${t.status} | requester ${t.requester.email} | ${t.title}`).join('\n')
    : '(none)';
  const ref = ctx.referencedTicket
    ? `\n<referenced_ticket>\n${ctx.referencedTicket.id}: ${ctx.referencedTicket.title}\nStatus: ${ctx.referencedTicket.status}\nModule: ${ctx.referencedTicket.module}\nSummary: ${ctx.referencedTicket.summary}\nStill missing: ${(ctx.referencedTicket.missing || []).join('; ') || 'nothing'}\n</referenced_ticket>`
    : '';
  return `Support mailbox: ${ctx.mailbox}

<email>
From: ${email.from.name} <${email.from.email}>
To: ${email.to || ''}
Cc: ${email.cc || ''}
Subject: ${email.subject}
Received: ${new Date(email.receivedAt).toLocaleString('en-IN', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' })} (${TZ})
Attachments: ${(email.attachments || []).length ? email.attachments.map(a => `${a.name} (${a.contentType || 'file'}, ${Math.round((a.size || 0) / 1024)} KB)`).join('; ') : 'none'}

${email.body}
</email>

<open_tickets>
${open}
</open_tickets>${ref}

Analyse this email and return the JSON.`;
}

export async function parseWithClaude(email, ctx, opts = {}) {
  const model = opts.model || MODEL;
  const mode = opts.mode === 'detailed' ? 'detailed' : 'basic';
  const caps = capabilities(model);
  const effort = caps.effort ? (mode === 'basic' ? (process.env.CLAUDE_EFFORT_BASIC || 'low') : caps.effort) : null;
  const started = Date.now();
  let response;
  try {
    const params = {
      model,
      max_tokens: mode === 'basic' ? 4000 : 16000,
      output_config: { format: { type: 'json_schema', schema: mode === 'basic' ? BASIC_SCHEMA : TICKET_SCHEMA }, ...(effort ? { effort } : {}) },
      system: [{ type: 'text', text: mode === 'basic' ? BASIC_PROMPT : SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserContent(email, ctx, mode) }],
    };
    if (caps.fallbacks) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default'; // if a safety classifier declines, re-run server-side on the recommended fallback model
    }
    response = await getClient().beta.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ParseError('Claude API key was rejected. Check ANTHROPIC_API_KEY in .env.', 'auth');
    if (err instanceof Anthropic.PermissionDeniedError) throw new ParseError('This API key has no access to ' + model + '.', 'permission');
    if (err instanceof Anthropic.NotFoundError) throw new ParseError('Model ' + model + ' was not found. Check ANTHROPIC_MODEL in .env.', 'model');
    if (err instanceof Anthropic.RateLimitError) throw new ParseError('Claude API rate limit reached. Retry shortly.', 'rate_limit');
    if (err instanceof Anthropic.BadRequestError) throw new ParseError('Claude API rejected the request: ' + err.message, 'bad_request');
    if (err instanceof Anthropic.APIConnectionError) throw new ParseError('Could not reach the Claude API (network).', 'network');
    if (err instanceof Anthropic.APIError) throw new ParseError(`Claude API error ${err.status}: ${err.message}`, 'api');
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new ParseError('Claude declined to analyse this email' + (response.stop_details?.category ? ` (${response.stop_details.category})` : '') + '.', 'refusal');
  }
  if (response.stop_reason === 'max_tokens') throw new ParseError('Claude response was cut off (max_tokens).', 'truncated');

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let parsed;
  try { const raw = JSON.parse(text); parsed = mode === 'basic' ? expandBasic(raw) : expandParsed(raw); } catch { throw new ParseError('Claude returned output that is not valid JSON.', 'json'); }

  const u = response.usage || {};
  return {
    parsed,
    meta: {
      engine: 'claude',
      model: response.model,
      effort,
      mode,
      latencyMs: Date.now() - started,
      usage: {
        input: u.input_tokens || 0,
        output: u.output_tokens || 0,
        cacheRead: u.cache_read_input_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0,
      },
    },
  };
}
