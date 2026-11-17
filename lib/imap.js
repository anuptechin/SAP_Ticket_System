// Poll a mailbox over IMAP (GoDaddy, Gmail, cPanel, Zoho…) and feed new mail into the pipeline.
// Used when MAIL_INBOUND=imap, or when Graph is not configured. Needs EMAIL_IMAP_HOST/PORT/USER/PASS.
// Safety: only mail that arrived after the server started is processed (plus IMAP_BACKFILL_HOURS, default 0),
// nothing is deleted, and mail is left unread unless IMAP_MARK_READ=true.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { processEmail } from './pipeline.js';

const env = (...keys) => keys.map(k => process.env[k]).find(v => v != null && v !== '');
export const imapConfig = () => ({
  host: env('EMAIL_IMAP_HOST', 'IMAP_HOST'),
  port: Number(env('EMAIL_IMAP_PORT', 'IMAP_PORT')) || 993,
  user: env('EMAIL_IMAP_USER', 'IMAP_USER'),
  pass: env('EMAIL_IMAP_PASS', 'IMAP_PASS'),
  folder: env('EMAIL_IMAP_FOLDER', 'IMAP_FOLDER') || 'INBOX',
  everyMs: Math.max(15000, Number(env('EMAIL_POLL_INTERVAL_MS')) || (Number(env('IMAP_POLL_SECONDS')) || 60) * 1000),
  backfillHours: Number(env('IMAP_BACKFILL_HOURS')) || 0,
  enabled: env('IMAP_ENABLED') !== 'false',
});

let imapGen = 0;
export function stopImap() { imapGen++; Object.assign(imapState, { enabled: false, status: 'off', lastError: null }); }
export const imapState = { enabled: false, mode: 'imap', status: 'off', host: null, user: null, lastPoll: null, lastError: null, received: 0, since: null };

function toEmail(parsed) {
  const f = parsed.from?.value?.[0] || {};
  return {
    from: { name: f.name || f.address || 'Unknown', email: (f.address || 'unknown@unknown').toLowerCase() },
    to: parsed.to?.text || '',
    cc: parsed.cc?.text || '',
    subject: parsed.subject || '(no subject)',
    body: parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : ''),
    // keep the file contents, including screenshots pasted into the body (inline images)
    attachments: (parsed.attachments || []).map((a, i) => ({
      name: a.filename || (String(a.contentType).startsWith('image/') ? `screenshot-${i + 1}.${String(a.contentType).split('/')[1].replace('jpeg', 'jpg')}` : `attachment-${i + 1}`),
      contentType: a.contentType, size: a.size, content: a.content, inline: a.contentDisposition === 'inline' || Boolean(a.related),
    })),
  };
}
export async function parseEml(raw) { return toEmail(await simpleParser(raw)); }

export const imapClient = c => new ImapFlow({ host: c.host, port: c.port, secure: c.port === 993, auth: { user: c.user, pass: c.pass }, logger: false });

export function startImap() {
  const gen = ++imapGen;
  const c = imapConfig();
  if (!c.host || !c.user || !c.pass || !c.enabled) return false;
  // New mail is picked up by arrival time, read or unread (webmail/Outlook may open it before we poll).
  const since = Date.now() - c.backfillHours * 3600e3;
  const done = new Set();                            // UIDs already handled
  const markRead = process.env.IMAP_MARK_READ === 'true'; // off by default: people may share this mailbox
  const self = c.user.toLowerCase();
  Object.assign(imapState, { enabled: true, mode: 'imap', status: 'starting', host: c.host, user: c.user, since });

  const poll = async () => {
    if (gen !== imapGen) return; // settings changed: this loop is retired
    const client = imapClient(c);
    client.on('error', err => { imapState.lastError = String(err.message || err); });
    try {
      imapState.status = 'polling';
      await client.connect();
      const lock = await client.getMailboxLock(c.folder);
      const found = [];
      try {
        const sinceDay = new Date(since); sinceDay.setHours(0, 0, 0, 0); // IMAP SINCE is day-granular; filter precisely below
        const fresh = [];
        for await (const msg of client.fetch({ since: sinceDay }, { uid: true, internalDate: true })) {
          if (!done.has(msg.uid) && new Date(msg.internalDate).getTime() >= since) fresh.push(msg.uid);
        }
        if (fresh.length) {
          for await (const msg of client.fetch(fresh.join(','), { source: true, uid: true }, { uid: true })) found.push({ uid: msg.uid, source: msg.source });
          if (markRead) await client.messageFlagsAdd(fresh.join(','), ['\\Seen'], { uid: true });
        }
      } finally { lock.release(); }
      await client.logout();
      for (const m of found.sort((x, y) => x.uid - y.uid)) {
        done.add(m.uid);
        const email = toEmail(await simpleParser(m.source));
        if (email.from.email === self) continue; // our own replies / acknowledgements
        try { await processEmail(email, 'imap'); imapState.received++; }
        catch (err) { console.error('[imap] could not process message:', err.message); }
      }
      Object.assign(imapState, { status: 'connected', lastPoll: Date.now(), lastError: null });
    } catch (err) {
      Object.assign(imapState, { status: 'error', lastPoll: Date.now(), lastError: String(err.responseText || err.message || err) });
      console.error('[imap]', imapState.lastError);
      try { await client.logout(); } catch { /* ignore */ }
    } finally {
      if (gen === imapGen) setTimeout(poll, c.everyMs);
    }
  };
  poll();
  return true;
}
