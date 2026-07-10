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
