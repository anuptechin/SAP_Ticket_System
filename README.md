# SensAI Desk — SAP Service Desk

An email-native service desk for SAP support. It reads the support mailbox, understands each email thread, and opens a structured ticket in the right SAP module (FI, CO, MM, SD, PP, EWM, HCM, Basis, Security, ABAP, PI/PO, CPI, EDI, BW, MDG and more). Each ticket is routed to the right team and agent, and comes with SLAs, screenshots, closure notes and an audit trail.

## Run it

Double-click **start.bat** (installs dependencies on first run, starts the desk in the background and opens it in your browser). Double-click **stop.bat** to stop it. The server log is in `dataserver.log`.

Or from a terminal:

```powershell
npm install
copy .env.example .env     # then fill in your values
npm start                  # → http://localhost (PORT in .env)
```

Open the site and sign in with the work email of a user on the **Users** page. The first seeded admin is `sneha.kulkarni@company.in`; replace the seeded users with your own.

Optional friendly address on one machine: add `127.0.0.1 sensaidesk.com` to `C:\Windows\System32\drivers\etc\hosts` (as administrator) and set `APP_URL=http://sensaidesk.com`.

## What it does

| Area | What you get |
|---|---|
| **Sign-in** | Landing page at `/`, desk at `/app`. Passwordless for pilots; switch to **Password required** in Settings once passwords are set on the Users page. Passwords are stored as scrypt hashes, sessions are HttpOnly cookies, and sign-in is rate-limited. |
| **Email intake** | Microsoft 365 (Graph, app-only), any IMAP mailbox (GoDaddy, Gmail…), webhook `POST /api/inbound`, or `.eml` upload. Only new mail is processed; nothing is deleted. |
| **Parsing** | Module, component, category, priority, SAP objects (t-codes, POs, plants, errors) and a summary. **Basic** mode (default) keeps processing low; **Detailed** adds a full ticket record. Without an API key, offline rules are used. |
| **Tickets** | Table and drag-and-drop board, module/priority/assignee control bar, two SLA clocks, replies and notes, requester replies thread onto the ticket, vague requests become *Awaiting Info*. |
| **Screenshots & files** | Attachments and screenshots pasted into emails are stored with the ticket (thumbnails, full-size view, download). Agents can drop or paste files onto a ticket. Each acknowledgement email has a private **upload link** so requesters can add files without signing in. |
| **Emails sent** | Acknowledgement with the ticket number (optional), assignment email to the agent with a link to the ticket, replies, and closure email. Placeholder addresses (`@company.in`, `@example.*`) are never emailed. |
| **Closure** | Resolving or closing requires a resolution code and notes (root cause optional) and can email the requester. |
| **Users** (admin) | Add, edit, disable users; Admin/Agent access; SAP modules per person; set passwords. |
| **Audit log** (admin) | Ticket actions, user changes, settings changes, sign-ins. Passwords are never logged. |
| **Settings** (admin) | Parsing level, sign-in method, IMAP and SMTP with *Test connection*. Saved to `.env` and applied without a restart. |

## License

The desk needs a license key (**Settings → License**, admins only). Keys are signed with a private key that only the vendor holds; the app can check keys but cannot create them, so keys cannot be forged or edited.

- **Demo**: a number of days. **Annual**: 365 days, or a custom length.
- **Users**: the number of active users allowed, admins included. Disabled users do not count.
- Without a valid key only admins can sign in (to enter a key); incoming emails still become tickets. A banner warns 3 days (demo) or 30 days (annual) before expiry.

Issuing keys (vendor machine only):

```powershell
npm run license -- keygen                                   # once: main signing key   keys/license-private.pem
npm run license -- keygen-recovery                          # once: recovery key       keys/license-recovery.pem  → store offline
npm run license -- demo   --days 30 --users 10 --customer "Acme Ltd"
npm run license -- annual           --users 50 --customer "Acme Ltd"
npm run license -- annual ... --use recovery                # sign with the recovery key (automatic if the main key is missing)
npm run license -- list                                     # every key issued (keys/issued-licenses.csv)
npm run license -- inspect SDK1....                         # show what a key contains
```

The app trusts both the main and the recovery key. If the main private key is lost, restore the recovery key from its offline copy and keep issuing keys; installed desks need no update. `keys/` is never committed: back up `license-private.pem` and `issued-licenses.csv`, and keep `license-recovery.pem` offline only.

**Issuing a key from another computer:** clone the repo, `npm install`, copy the backed-up `.pem` into `keys/`, run `npm run license -- annual ...`, and paste the key into Settings → License on production.

## Configuration (`.env`)

See `.env.example`. The main keys:

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`: email parsing (leave empty to use the offline rules)
- `SUPPORT_MAILBOX`, `MAIL_INBOUND` = `imap` | `graph` | `off`
- `EMAIL_IMAP_HOST / PORT / USER / PASS`, `EMAIL_POLL_INTERVAL_MS`
- `GRAPH_MAIL_TENANT_ID / CLIENT_ID / CLIENT_SECRET` (Microsoft 365)
- `EMAIL_HOST / PORT / USER / PASS / FROM` (SMTP), `AUTO_ACK`, `NOTIFY_ASSIGNEE`
- `PORT`, `APP_URL`, `APP_TIMEZONE`, `INBOUND_TOKEN`

`npm run test-mail` checks the mailbox and SMTP logins without sending anything.

## Files

```
server.js              routes, sign-in guard, attachments, upload links
lib/auth.js            sessions, passwordless/password sign-in, password hashing
lib/pipeline.js        email → ticket: create / update / duplicate / clarify, emails sent
lib/claude-parser.js   parsing prompts and schemas (basic + detailed)
lib/rules-parser.js    offline fallback
lib/attachments.js     stored files and safe serving
lib/imap.js, graph.js  mailbox readers · lib/mailer.js SMTP · lib/mail-settings.js Settings page
lib/store.js           JSON-file database, users, settings, audit
public/login.html      landing + sign-in · public/index.html + app.js the desk · public/upload.html requester upload
data/                  database and attachments (not in git)
```

## Before production

This is a pilot build. Before wider use: run it on a server the team can reach (with HTTPS), switch sign-in to **Password required** or connect Microsoft 365 single sign-on, and move from the JSON file to a real database.
