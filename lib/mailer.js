// Optional SMTP sending for replies typed in the ticket screen (EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS / EMAIL_FROM).
// Nothing is ever sent automatically: only when an agent clicks "Send" on a ticket.
import nodemailer from 'nodemailer';

let transport = null;
export function resetTransport() { try { transport?.close(); } catch { /* ignore */ } transport = null; }
export const smtpConfigured = () => Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
export const smtpInfo = () => smtpConfigured() ? { host: process.env.EMAIL_HOST, from: fromAddress() } : null;
const fromAddress = () => (process.env.EMAIL_FROM || process.env.EMAIL_USER || '').replace(/^"+|"+$/g, '');

function getTransport() {
  if (!transport) {
    const port = Number(process.env.EMAIL_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, port, secure: port === 465, requireTLS: port === 587,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text, html, inReplyTo }) {
  const info = await getTransport().sendMail({
    from: fromAddress(), to, subject, text, ...(html ? { html } : {}),
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  });
  return info.messageId;
}
