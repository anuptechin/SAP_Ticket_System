// Vendor tool: signing keys and license keys.
//
//   npm run license -- keygen                       create the main signing key  keys/license-private.pem   (keep secret, back it up)
//   npm run license -- keygen-recovery              create the recovery key      keys/license-recovery.pem  (move it OFF this computer)
//   npm run license -- demo   --days 30 --users 10 --customer "Acme Ltd"
//   npm run license -- annual           --users 50 --customer "Acme Ltd"           (365 days; --days for another length)
//   npm run license -- annual ... --use recovery    sign with the recovery key (automatic when the main key is missing)
//   npm run license -- list                         every key issued from this computer (keys/issued-licenses.csv)
//   npm run license -- inspect SDK1....             show what a key contains
//
// keys/ is in .gitignore and must never be committed. Every key issued is also appended to keys/issued-licenses.csv.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_DIR = path.resolve('keys');
const FILES = { primary: path.join(KEY_DIR, 'license-private.pem'), recovery: path.join(KEY_DIR, 'license-recovery.pem') };
const CONST = { primary: 'PRIMARY_PUBLIC_KEY', recovery: 'RECOVERY_PUBLIC_KEY' };
const LEDGER = path.join(KEY_DIR, 'issued-licenses.csv');
const LIB = path.resolve('lib', 'license.js');
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const cmd = args[0];
const csv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

function writePublicKey(which, pem) {
  const src = fs.readFileSync(LIB, 'utf8');
  const marker = `const ${CONST[which]} = \``;
  const start = src.indexOf(marker), end = src.indexOf('`;', start + marker.length);
  if (start < 0 || end < 0) throw new Error(`Could not find ${CONST[which]} in lib/license.js`);
  fs.writeFileSync(LIB, src.slice(0, start) + marker + pem + src.slice(end));
}
function keygen(which) {
  const file = FILES[which];
  if (fs.existsSync(file) && !args.includes('--force')) {
    console.log(`A ${which} signing key already exists at ${file}.\nReplacing it makes every license signed with it invalid once the app is updated. Add --force only if you really mean it.`);
    process.exit(1);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  writePublicKey(which, publicKey.export({ type: 'spki', format: 'pem' }).trim());
  console.log(`${which === 'primary' ? 'Main' : 'Recovery'} signing key created: ${file}`);
  console.log('Its public half was written into lib/license.js. Commit that file and update production so installs trust this key.');
  if (which === 'recovery') console.log('\nNOW: copy license-recovery.pem to an offline place (password manager / encrypted USB),\nthen delete it from this computer, so one crash cannot lose both keys.');
  process.exit(0);
}

if (cmd === 'keygen') keygen('primary');
if (cmd === 'keygen-recovery') keygen('recovery');

if (cmd === 'demo' || cmd === 'annual') {
  let use = opt('use', 'primary');
  if (!FILES[use]) { console.log('--use must be primary or recovery'); process.exit(1); }
  if (use === 'primary' && !fs.existsSync(FILES.primary) && fs.existsSync(FILES.recovery)) { use = 'recovery'; console.log('Main signing key not found; signing with the recovery key.'); }
  if (!fs.existsSync(FILES[use])) { console.log(`No ${use} signing key in ${KEY_DIR}. Restore it from your backup, or run: npm run license -- keygen`); process.exit(1); }
  const days = Number(opt('days', cmd === 'demo' ? 30 : 365));
  const users = Number(opt('users', cmd === 'demo' ? 5 : 25));
  const customer = String(opt('customer', 'Customer')).trim();
  if (!(days > 0 && days <= 3650) || !(users > 0 && users <= 10000)) { console.log('Use --days 1-3650 and --users 1-10000.'); process.exit(1); }
  const issued = Date.now();
  const payload = { id: 'LIC-' + crypto.randomBytes(4).toString('hex').toUpperCase(), customer, type: cmd, maxUsers: users, issued, expires: issued + days * 864e5 };
  const head = 'SDK1.' + b64u(JSON.stringify(payload));
  const key = head + '.' + b64u(crypto.sign(null, Buffer.from(head), crypto.createPrivateKey(fs.readFileSync(FILES[use]))));
  // ledger: so a key can always be found and re-sent later
  const isNew = !fs.existsSync(LEDGER);
  fs.appendFileSync(LEDGER, (isNew ? 'issued,id,customer,type,users,days,expires,signed_with,key\n' : '') +
    [new Date(issued).toISOString(), payload.id, customer, cmd, users, days, new Date(payload.expires).toISOString().slice(0, 10), use, key].map(csv).join(',') + '\n');
  console.log(`\n${cmd === 'demo' ? 'Demo' : 'Annual'} license for ${customer}: ${users} users, ${days} days, valid until ${new Date(payload.expires).toDateString()} (${payload.id}, signed with ${use} key)\n`);
  console.log(key + '\n');
  console.log(`Recorded in ${LEDGER}`);
  process.exit(0);
}

if (cmd === 'list') {
  if (!fs.existsSync(LEDGER)) { console.log('No keys issued from this computer yet.'); process.exit(0); }
  const rows = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').slice(1).map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
  console.log('\nissued       id            type    users  expires      signed with  customer');
  for (const r of rows) console.log(`${r[0].slice(0, 10)}   ${r[1].padEnd(13)} ${r[3].padEnd(7)} ${String(r[4]).padStart(5)}  ${r[6]}   ${r[7].padEnd(11)}  ${r[2]}`);
  console.log(`\n${rows.length} key(s). Full keys are in ${LEDGER}`);
  process.exit(0);
}

if (cmd === 'inspect') {
  const parts = String(args[1] || '').trim().split('.');
  try { const p = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); console.log({ ...p, issued: new Date(p.issued).toString(), expires: new Date(p.expires).toString() }); }
  catch { console.log('Not a readable license key.'); }
  process.exit(0);
}

console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
