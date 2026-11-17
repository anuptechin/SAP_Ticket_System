// Stores email attachments (including screenshots pasted into the body) on disk next to the database.
// Files are served only to signed-in users. Risky types are always downloaded, never rendered.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve('data', 'attachments');
const MAX_FILE = 15 * 1024 * 1024;   // 15 MB per file
const MAX_EMAIL = 40 * 1024 * 1024;  // 40 MB per email
const MIN_INLINE_IMAGE = 4 * 1024;   // tiny inline images are usually signature logos

const safeName = n => String(n || 'attachment').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'attachment';
const dirFor = emailId => path.join(ROOT, String(emailId).replace(/[^A-Za-z0-9-]/g, ''));

// items: [{ name|filename, contentType, content: Buffer, inline }] → metadata (no content) for the email/ticket
export function saveAttachments(emailId, items = []) {
  const out = []; let total = 0;
  for (const it of items) {
    const content = Buffer.isBuffer(it.content) ? it.content : null;
    const name = safeName(it.name || it.filename);
    const type = String(it.contentType || 'application/octet-stream').toLowerCase();
    const size = content ? content.length : Number(it.size) || 0;
    const isImage = type.startsWith('image/');
    if (it.inline && isImage && size < MIN_INLINE_IMAGE) continue; // skip signature logos / spacer images
    const meta = { id: crypto.randomBytes(6).toString('hex'), name, contentType: type, size, inline: Boolean(it.inline), image: isImage && type !== 'image/svg+xml', emailId };
    if (!content) { out.push({ ...meta, stored: false }); continue; }
    if (size > MAX_FILE || total + size > MAX_EMAIL) { out.push({ ...meta, stored: false, skipped: 'too large' }); continue; }
    fs.mkdirSync(dirFor(emailId), { recursive: true });
    fs.writeFileSync(path.join(dirFor(emailId), meta.id), content);
    total += size;
    out.push({ ...meta, stored: true });
  }
  return out;
}

// Only images, PDFs and plain text open in the browser; everything else downloads.
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain)$/;
export function sendAttachment(res, att) {
  const file = path.join(dirFor(att.emailId), String(att.id).replace(/[^a-f0-9]/g, ''));
  if (!att.stored || !fs.existsSync(file)) return res.status(404).json({ error: 'This file was not stored (older email or too large).' });
  const inline = INLINE_SAFE.test(att.contentType);
  res.setHeader('Content-Type', inline ? att.contentType : 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(att.name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(file).pipe(res);
}
