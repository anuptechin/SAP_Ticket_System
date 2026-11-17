// Read the support mailbox through Microsoft Graph (app-only OAuth, client credentials).
// Used instead of IMAP when GRAPH_MAIL_TENANT_ID / CLIENT_ID / CLIENT_SECRET are set.
// Needs the Entra ID app permission Mail.ReadWrite (to mark mail as read) or Mail.Read, with admin consent.
// Safety: only mail received after the server started (plus IMAP_BACKFILL_HOURS) is processed; nothing is deleted.
// Mail is NOT marked as read unless GRAPH_MARK_READ=true (the mailbox may be shared with people).
import { processEmail, MAILBOX } from './pipeline.js';
import { imapState } from './imap.js';

const cfg = () => ({
  tenant: process.env.GRAPH_MAIL_TENANT_ID,
  clientId: process.env.GRAPH_MAIL_CLIENT_ID,
  secret: process.env.GRAPH_MAIL_CLIENT_SECRET,
  mailbox: process.env.GRAPH_MAILBOX || MAILBOX,
  everyMs: Math.max(15000, Number(process.env.EMAIL_POLL_INTERVAL_MS) || 60000),
  backfillHours: Number(process.env.IMAP_BACKFILL_HOURS) || 0,
  enabled: process.env.IMAP_ENABLED !== 'false',
});
export const graphConfigured = () => { const c = cfg(); return Boolean(c.tenant && c.clientId && c.secret); };

let token = null, tokenExp = 0;
async function getToken(c) {
  if (token && Date.now() < tokenExp - 60000) return token;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Sign-in to Microsoft failed: ${j.error_description?.split('\r\n')[0] || j.error || r.status}`);
  token = j.access_token; tokenExp = Date.now() + j.expires_in * 1000;
  return token;
}
async function graph(c, method, path, body) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getToken(c)}`, 'Content-Type': 'application/json', Prefer: 'outlook.body-content-type="text"' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error?.message || `Graph ${r.status}`); e.status = r.status; e.code = j.error?.code; throw e; }
  return j;
}

const addr = a => a?.emailAddress ? `${a.emailAddress.name || ''} <${a.emailAddress.address}>` : '';
function toEmail(m) {
  return {
    from: { name: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown', email: (m.from?.emailAddress?.address || 'unknown@unknown').toLowerCase() },
    to: (m.toRecipients || []).map(addr).join(', '),
    cc: (m.ccRecipients || []).map(addr).join(', '),
    subject: m.subject || '(no subject)',
    body: m.body?.content || m.bodyPreview || '',
  };
}

// Read-only connectivity check: sign in and count unread inbox mail.
export async function testGraph() {
  const c = cfg();
  const box = await graph(c, 'GET', `/users/${encodeURIComponent(c.mailbox)}/mailFolders/inbox?$select=totalItemCount,unreadItemCount`);
  return { mailbox: c.mailbox, total: box.totalItemCount, unread: box.unreadItemCount };
}

let graphGen = 0;
export function stopGraph() { graphGen++; }
export function startGraph() {
  const gen = ++graphGen;
  const c = cfg();
  if (!graphConfigured() || !c.enabled) return false;
  // Pick up mail by arrival time, not by unread status: in a shared mailbox Outlook may mark mail read before we poll.
  let watermark = Date.now() - c.backfillHours * 3600e3;
  const since = watermark;
  const seen = new Set(); // message IDs already processed (mail arriving in the same second as the watermark)
  let canMarkRead = process.env.GRAPH_MARK_READ === 'true'; // off by default so people using the mailbox are not affected
  const self = c.mailbox.toLowerCase();
  Object.assign(imapState, { enabled: true, mode: 'graph', status: 'starting', host: 'Microsoft Graph', user: c.mailbox, since });

  const poll = async () => {
    if (gen !== graphGen) return;
    try {
      imapState.status = 'polling';
      const filter = encodeURIComponent(`receivedDateTime ge ${new Date(watermark).toISOString()}`);
      const list = await graph(c, 'GET', `/users/${encodeURIComponent(c.mailbox)}/mailFolders/inbox/messages?$filter=${filter}&$orderby=receivedDateTime asc&$top=50&$select=id,subject,from,toRecipients,ccRecipients,body,bodyPreview,receivedDateTime,hasAttachments`);
      for (const m of list.value || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        watermark = Math.max(watermark, new Date(m.receivedDateTime).getTime());
        if ((m.from?.emailAddress?.address || '').toLowerCase() === self) continue; // never process our own outgoing replies
        if (canMarkRead) {
          try { await graph(c, 'PATCH', `/users/${encodeURIComponent(c.mailbox)}/messages/${m.id}`, { isRead: true }); }
          catch (err) { if (err.status === 403) { canMarkRead = false; console.warn('[graph] no Mail.ReadWrite permission — mail will stay unread'); } else throw err; }
        }
        const email = toEmail(m);
        // Always ask: Graph reports hasAttachments=false when the only files are screenshots pasted into the body.
        try {
          const att = await graph(c, 'GET', `/users/${encodeURIComponent(c.mailbox)}/messages/${m.id}/attachments`);
          email.attachments = (att.value || []).filter(x => x['@odata.type'] === '#microsoft.graph.fileAttachment').map((x, i) => ({
            name: x.name || `attachment-${i + 1}`, contentType: x.contentType, size: x.size, inline: Boolean(x.isInline),
            content: x.contentBytes ? Buffer.from(x.contentBytes, 'base64') : null,
          }));
        } catch (err) { console.warn('[graph] attachments not read:', err.message); }
        try { await processEmail(email, 'graph'); imapState.received++; }
        catch (err) { console.error('[graph] could not process message:', err.message); }
      }
      if (seen.size > 5000) { const keep = [...seen].slice(-1000); seen.clear(); keep.forEach(id => seen.add(id)); }
      Object.assign(imapState, { status: 'connected', lastPoll: Date.now(), lastError: null });
    } catch (err) {
      Object.assign(imapState, { status: 'error', lastPoll: Date.now(), lastError: err.message });
      console.error('[graph]', err.message);
    } finally {
      if (gen === graphGen) setTimeout(poll, c.everyMs);
    }
  };
  poll();
  return true;
}
