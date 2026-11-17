// npm run test-mail — checks the mailbox settings in .env without sending or changing anything.
// IMAP: logs in and counts messages. SMTP: logs in (no email is sent). Graph: signs in and reads the inbox size.
import '../lib/env.js';
import nodemailer from 'nodemailer';
import { imapConfig, imapClient } from '../lib/imap.js';
import { graphConfigured, testGraph } from '../lib/graph.js';

const mode = (process.env.MAIL_INBOUND || (graphConfigured() ? 'graph' : 'imap')).toLowerCase();
console.log(`\nSupport mailbox: ${process.env.SUPPORT_MAILBOX || '(SUPPORT_MAILBOX not set)'}`);
console.log(`Inbound mode:    ${mode}\n`);

if (mode === 'imap') {
  const c = imapConfig();
  if (!c.host || !c.user || !c.pass) console.log('IMAP  ✗ EMAIL_IMAP_HOST / USER / PASS missing in .env');
  else {
    const client = imapClient(c);
    client.on('error', () => {});
    try {
      await client.connect();
      const st = await client.status(c.folder, { messages: true, unseen: true });
      console.log(`IMAP  ✓ ${c.user} @ ${c.host}:${c.port} — ${c.folder}: ${st.messages} messages, ${st.unseen} unread`);
      await client.logout();
    } catch (e) { console.log(`IMAP  ✗ ${c.user} @ ${c.host}:${c.port} — ${e.authenticationFailed ? 'wrong username or password' : ''} ${e.responseText || e.message}`); }
  }
} else if (mode === 'graph') {
  try { const g = await testGraph(); console.log(`Graph ✓ ${g.mailbox}: ${g.total} messages, ${g.unread} unread`); }
  catch (e) { console.log(`Graph ✗ ${e.message}`); }
}

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const port = Number(process.env.EMAIL_PORT) || 587;
  const t = nodemailer.createTransport({ host: process.env.EMAIL_HOST, port, secure: port === 465, requireTLS: port === 587, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, connectionTimeout: 15000 });
  try { await t.verify(); console.log(`SMTP  ✓ ${process.env.EMAIL_USER} @ ${process.env.EMAIL_HOST}:${port} — login accepted (nothing sent)`); }
  catch (e) { console.log(`SMTP  ✗ ${process.env.EMAIL_USER} @ ${process.env.EMAIL_HOST}:${port} — ${e.response || e.message}`); }
} else console.log('SMTP  – not configured (replies are logged on the ticket only)');
console.log('');
process.exit(0);
