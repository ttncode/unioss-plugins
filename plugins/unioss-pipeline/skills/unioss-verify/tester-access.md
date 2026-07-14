---
name: unioss tester quick-access
---

# Tester Quick-Access

Local development environment only — these are **not** production secrets. Use to reach the affected screens fast before driving the UI flow.

## Database Setup (Required)

Before starting test, verify that **both projects are configured to use the same database**.

Replace `<virtualbox_direct_domain>` with the current environment in `.walkthrough/.config/unioss.config.json` (for example, `virtualbox_direct_domain`, `staging`, or `production`).

Files:

- `AdminPage/application/config/<virtualbox_direct_domain>/database.php` → `'database' => 'db_unioss_local',`
- `FrontEnd/application/config/<virtualbox_direct_domain>/database.php` → `'database' => 'db_unioss_local',`

## Quick Access Pages

### AdminPage

Login:

- URL: `http://localhost:2380/admin/login`
- Username: `kagi-25` (store 25, change if need verify other store)
- Password: `password`

Logout:

- URL: `http://localhost:2380/admin/admins/logout`

Edit Account:

- URL: `http://localhost:2380/admin/account/my_account`

Switch Role:

- URL: `http://localhost:2380/admin/admins/role/<role_id>`

Store Information Settings:

- URL: `http://localhost:2380/admin/basis2/store/`

Order Status Management:

- URL: `http://localhost:2380/admin/order_status` (status new)
- URL: `http://localhost:2380/admin/order_status/paid` (status paid)
- URL: `http://localhost:2380/admin/order_status/ship_requested` (status ship_requested)
- URL: `http://localhost:2380/admin/order_status/shipped` (status shipped)
- URL: `http://localhost:2380/admin/order_status/donated` (status donated)
- URL: `http://localhost:2380/admin/order_status/cancel` (status cancel)
- URL: `http://localhost:2380/admin/order_status/admincancel` (status admincancel)

Order Search:

- URL: `http://localhost:2380/admin/order_search`

Order Delivery Status:

- URL: `http://localhost:2380/admin/order_delivery_status`

Deal List:

- URL: `http://localhost:2380/admin/deals`

Subledger Invoice:

- URL: `http://localhost:2380/admin/subledger_invoice`

Invoice:

- URL: `http://localhost:2380/admin/invoice/receiving` (receiving invoice)
- URL: `http://localhost:2380/admin/invoice/paying` (paying invoice)

### ECSite

Register Account:

- URL: `http://localhost:2380/storetax/regist/index`

Login:

- URL: `http://localhost:2380/storetax/login`
- Username: `test-ap1584@example.com` (this is an available customer, create new or change to another customer if needed)
- Password: `password`

Logout:

- URL: `http://localhost:2380/storetax/logout`

Top:

- URL: `http://localhost:2380/storetax/top/vm:2500005/st:1?QRhome=true&QR=true&products=vmonly` (default vm=2500005 and st=1, change to another if needed)

Cart List:

- URL: `http://localhost:2380/storetax/cart/vm:2500005/st:1`

## Mailhog

Verify the sent emails.

- URL: `http://localhost:8225`.

## Related Files

- `./unioss-control-data.sql` — Change the database credentials for testing
