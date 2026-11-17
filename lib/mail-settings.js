// Mail settings edited from the Settings page: read (passwords never returned), test, save to .env, apply live.
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { imapConfig, imapClient, startImap, stopImap, imapState } from './imap.js';
import { startGraph, stopGraph, graphConfigured } from './graph.js';
import { resetTransport } from './mailer.js';
import { setMailbox } from './pipeline.js';

const ENV_FILE = path.resolve('.env');
const env = k => process.env[k] ?? '';

export function inboundMode() {
  if (process.env.IMAP_ENABLED === 'false') return 'off';
  return (process.env.MAIL_INBOUND || (graphConfigured() ? 'graph' : 'imap')).toLowerCase();
}
export function startInbound() {
  stopImap(); stopGraph();
  const mode = inboundMode();
  if (mode === 'graph') startGraph();
  else if (mode === 'imap') startImap();
  return mode;
}

// What the browser may see. Passwords are reported only as "set / not set".
export function getMailSettings() {
  return {
    mailbox: env('SUPPORT_MAILBOX'),
    inbound: inboundMode(),
    graphAvailable: graphConfigured(),
    imap: {
      host: env('EMAIL_IMAP_HOST'), port: Number(env('EMAIL_IMAP_PORT')) || 993, user: env('EMAIL_IMAP_USER'),
      hasPassword: Boolean(env('EMAIL_IMAP_PASS')), folder: env('EMAIL_IMAP_FOLDER') || 'INBOX',
      pollSeconds: Math.round((Number(env('EMAIL_POLL_INTERVAL_MS')) || 60000) / 1000),
      status: imapState.status, lastPoll: imapState.lastPoll, lastError: imapState.lastError, received: imapState.received,
    },
    smtp: {
      host: env('EMAIL_HOST'), port: Number(env('EMAIL_PORT')) || 465, user: env('EMAIL_USER'),
      hasPassword: Boolean(env('EMAIL_PASS')), fromName: parseFrom(env('EMAIL_FROM')).name || 'SAP Service Desk',
      autoAck: env('AUTO_ACK') === 'true',
      notifyAssignee: env('NOTIFY_ASSIGNEE') !== 'false',
    },
  };
}
function parseFrom(v) { const m = String(v).replace(/^"+|"+$/g, '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/); return m ? { name: m[1], email: m[2] } : { name: '', email: v }; }

const isHost = v => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v);
const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const isPort = v => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 65536;

// Merge submitted form values with what is saved (blank password = keep the saved one).
function resolveImap(f = {}) {
  return { host: String(f.host ?? env('EMAIL_IMAP_HOST')).trim(), port: Number(f.port ?? env('EMAIL_IMAP_PORT')) || 993, user: String(f.user ?? env('EMAIL_IMAP_USER')).trim(), pass: f.password ? String(f.password) : env('EMAIL_IMAP_PASS'), folder: String(f.folder || env('EMAIL_IMAP_FOLDER') || 'INBOX').trim() };
}
function resolveSmtp(f = {}) {
  return { host: String(f.host ?? env('EMAIL_HOST')).trim(), port: Number(f.port ?? env('EMAIL_PORT')) || 465, user: String(f.user ?? env('EMAIL_USER')).trim(), pass: f.password ? String(f.password) : env('EMAIL_PASS') };
}

export async function testImap(form) {
  const c = resolveImap(form);
  if (!c.host || !c.user || !c.pass) return { ok: false, message: 'Enter server, username and password first.' };
  const client = imapClient(c); client.on('error', () => {});
  try {
    await client.connect();
    const st = await client.status(c.folder, { messages: true, unseen: true });
    await client.logout();
    return { ok: true, message: `Connected. ${c.folder} has ${st.messages} messages (${st.unseen} unread).` };
  } catch (e) {
    const m = e.authenticationFailed ? 'Username or password was rejected.' : /ETIMEDOUT|ECONNREFUSED|ENOTFOUND/.test(e.code || e.message) ? `Could not reach ${c.host}:${c.port}. Check the server name, port, or whether your network blocks mail ports.` : (e.responseText || e.message);
    return { ok: false, message: m };
  }
}
export async function testSmtp(form) {
  const c = resolveSmtp(form);
  if (!c.host || !c.user || !c.pass) return { ok: false, message: 'Enter server, username and password first.' };
  const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, requireTLS: c.port === 587, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15000, greetingTimeout: 15000 });
  try { await t.verify(); return { ok: true, message: 'Login accepted. No email was sent.' }; }
  catch (e) { return { ok: false, message: /ETIMEDOUT|ECONNREFUSED|ENOTFOUND/.test(e.code || e.message) ? `Could not reach ${c.host}:${c.port}. Check the server name, port, or whether your network blocks mail ports.` : (e.response || e.message) }; }
  finally { t.close(); }
}

// Write keys into .env in place (or append), keeping comments and other settings untouched.
function writeEnv(values) {
  let text = ''; try { text = fs.readFileSync(ENV_FILE, 'utf8'); } catch { /* new file */ }
  const fmt = v => /[\s#"'<>]/.test(v) ? `"${String(v).replace(/"/g, '\\"')}"` : String(v);
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    const line = `${k}=${fmt(v)}`;
    text = re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, '\n') + line + '\n';
    process.env[k] = String(v);
  }
  fs.writeFileSync(ENV_FILE, text);
}

export function saveMailSettings(body = {}) {
  const errors = [];
  const out = {};
  if (body.imap) {
    const f = body.imap;
    if (f.host && !isHost(f.host)) errors.push('Incoming server name looks wrong, e.g. imap.secureserver.net');
    if (f.port && !isPort(f.port)) errors.push('Incoming port must be a number, usually 993');
    if (f.user && !isEmail(f.user)) errors.push('Incoming username should be the full email address');
    if (f.pollSeconds && (Number(f.pollSeconds) < 15 || Number(f.pollSeconds) > 3600)) errors.push('Check interval must be between 15 and 3600 seconds');
    Object.assign(out, { EMAIL_IMAP_HOST: f.host, EMAIL_IMAP_PORT: f.port, EMAIL_IMAP_USER: f.user, EMAIL_IMAP_FOLDER: f.folder || 'INBOX', EMAIL_POLL_INTERVAL_MS: f.pollSeconds ? Number(f.pollSeconds) * 1000 : undefined });
    if (f.password) out.EMAIL_IMAP_PASS = f.password;
    if (f.user) out.SUPPORT_MAILBOX = f.user;
  }
  if (body.inbound) {
    if (!['imap', 'graph', 'off'].includes(body.inbound)) errors.push('Unknown mailbox reading mode');
    else { out.MAIL_INBOUND = body.inbound; out.IMAP_ENABLED = body.inbound === 'off' ? 'false' : 'true'; }
  }
  if (body.smtp) {
    const f = body.smtp;
    if (f.host && !isHost(f.host)) errors.push('Outgoing server name looks wrong, e.g. smtpout.secureserver.net');
    if (f.port && !isPort(f.port)) errors.push('Outgoing port must be a number, usually 465 or 587');
    if (f.user && !isEmail(f.user)) errors.push('Outgoing username should be the full email address');
    Object.assign(out, { EMAIL_HOST: f.host, EMAIL_PORT: f.port, EMAIL_USER: f.user });
    if (f.password) out.EMAIL_PASS = f.password;
    if (f.user || f.fromName !== undefined) out.EMAIL_FROM = `${(f.fromName || 'SAP Service Desk').replace(/[<>"]/g, '')} <${f.user || parseFrom(env('EMAIL_FROM')).email || env('EMAIL_USER')}>`;
    if (typeof f.autoAck === 'boolean') out.AUTO_ACK = f.autoAck ? 'true' : 'false';
    if (typeof f.notifyAssignee === 'boolean') out.NOTIFY_ASSIGNEE = f.notifyAssignee ? 'true' : 'false';
  }
  if (errors.length) return { ok: false, errors };
  const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
  writeEnv(clean);
  if (clean.SUPPORT_MAILBOX) setMailbox(clean.SUPPORT_MAILBOX);
  if (body.smtp) resetTransport();
  if (body.imap || body.inbound) startInbound();
  return { ok: true, settings: getMailSettings() };
}
