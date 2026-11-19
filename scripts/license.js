// Vendor tool: create the signing key (once) and issue license keys.
//
//   npm run license -- keygen                                  create keys/license-private.pem (KEEP SECRET) and put the public key in lib/license.js
//   npm run license -- demo   --days 30  --users 10 --customer "Acme Ltd"
//   npm run license -- annual            --users 50 --customer "Acme Ltd"        (365 days)
//   npm run license -- annual --days 730 --users 50 --customer "Acme Ltd"        (custom length)
//   npm run license -- inspect SDK1....                         show what a key contains
//
// The private key never goes into git (keys/ is in .gitignore). Back it up: without it you cannot issue new keys.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_DIR = path.resolve('keys');
const PRIV = path.join(KEY_DIR, 'license-private.pem');
const LIB = path.resolve('lib', 'license.js');
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const cmd = args[0];

if (cmd === 'keygen') {
  if (fs.existsSync(PRIV) && !args.includes('--force')) { console.log(`A signing key already exists at ${PRIV}.\nNew keys would make every license you issued invalid. Use --force only if you really mean it.`); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const pub = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  const src = fs.readFileSync(LIB, 'utf8');
  const start = src.indexOf('export const PUBLIC_KEY = `'), end = src.indexOf('`;', start);
  fs.writeFileSync(LIB, src.slice(0, start) + 'export const PUBLIC_KEY = `' + pub + src.slice(end));
  console.log(`Signing key created: ${PRIV}\nKeep this file secret and back it up. The public key was written into lib/license.js.`);
  process.exit(0);
}

if (cmd === 'demo' || cmd === 'annual') {
  if (!fs.existsSync(PRIV)) { console.log('No signing key yet. Run: npm run license -- keygen'); process.exit(1); }
  const days = Number(opt('days', cmd === 'demo' ? 30 : 365));
  const users = Number(opt('users', cmd === 'demo' ? 5 : 25));
  const customer = String(opt('customer', 'Customer')).trim();
  if (!(days > 0 && days <= 3650) || !(users > 0 && users <= 10000)) { console.log('Use --days 1-3650 and --users 1-10000.'); process.exit(1); }
  const issued = Date.now();
  const payload = { id: 'LIC-' + crypto.randomBytes(4).toString('hex').toUpperCase(), customer, type: cmd, maxUsers: users, issued, expires: issued + days * 864e5 };
  const head = 'SDK1.' + b64u(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(head), crypto.createPrivateKey(fs.readFileSync(PRIV)));
  console.log(`\n${cmd === 'demo' ? 'Demo' : 'Annual'} license for ${customer}: ${users} users, ${days} days, valid until ${new Date(payload.expires).toDateString()} (${payload.id})\n`);
  console.log(head + '.' + b64u(sig) + '\n');
  process.exit(0);
}

if (cmd === 'inspect') {
  const parts = String(args[1] || '').trim().split('.');
  try { const p = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); console.log({ ...p, issued: new Date(p.issued).toString(), expires: new Date(p.expires).toString() }); }
  catch { console.log('Not a readable license key.'); }
  process.exit(0);
}

console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
