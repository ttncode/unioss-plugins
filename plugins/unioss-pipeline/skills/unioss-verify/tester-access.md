---
name: unioss tester quick-access
---

# Tester Quick-Access

Local development environment only — these are **not** production secrets. Use to reach the affected screens fast before driving the UI flow.

## 1. Point at the production-clone DB

Confirm both database configs target the local clone:

- `AdminPage/application/config/development/database.php` → `'database' => 'db_unioss_local',`
- `FrontEnd/application/config/development/database.php` → `'database' => 'db_unioss_local',`

## 2. Normalize control data

Apply the control-data SQL to set known credentials (e.g. resets passwords to `password`):

```bash
unioss_control_data.sql   # import into the local DB before logging in
```

## 3. AdminPage login

- URL: `http://localhost:2380/admin/login`
- Username: `kagi-25`
- Password: `password`

## 4. ECSite (storefront) entry

- Top: `http://localhost:2380/storetax/top/vm:2500005/st:1?QRhome=true&QR=true&products=vmonly`

Verify user-facing screens against `_docs/ECSITE_SCREENS.md`.

## 5. ECSite customer login (email-verification flows)

- Login: `http://localhost:2380/storetax/login`
- Credentials are **ticket/seed-specific** — e.g. `test-ap1584@example.com` / `password` for ticket 1584. Use the account the ticket/investigation names, not a hardcoded one.

Resolve the stable URLs from config instead of hardcoding:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_TESTER_ECSITE_LOGIN  → http://localhost:2380/storetax/login
# $US_TESTER_MAILHOG       → http://localhost:8225
```

## 6. Verify emails via Mailhog

- Inbox: `http://localhost:8225` (open `/#` for the message list).
- After triggering an email action in the UI, open Mailhog, find the message, and assert subject/recipient/body against the acceptance criteria.
