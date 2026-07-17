# SCOPE.md — accepted examples

These are real, accepted output. Match their structure, level of detail, and tone exactly — **except the title/filename prefix**: these were written before this skill lived in the pipeline, into a flat `_plan/` folder, so their `#[IID]` titles have no `AP`/`FE` prefix. Now that `SCOPE.md` lives in `.walkthrough/<PREFIX>#[IID]/`, use the full prefix in both filename and `# <PREFIX>#[IID] - SCOPE` title, matching every other artifact in that tree (e.g. `# AP#1584 - SCOPE`).

## Multi-app, per-app grouping (#1584)

```markdown
# #1584 - SCOPE

### 1. Objectives:

- Remove residual `administrators` logic from the product and producer information query.

### 2. Content:

- Remove the unused main admin information (address, tel, fax, email) and its `administrators` linkage from the product and producer information query.

### 3. Scope:

**Affected Features**

AdminPage

- Order status
- Order delivery status
- Order detail
- VM API
- Mail notification

FrontEnd

- Order
- Payment (GMO, Paygent)
- Mail notification

**Affected URLs:**

AdminPage

- `/order_status/*` - Order status list
- `/order_delivery_status/*` - Order delivery status list
- `/order_detail/show_thankyou_letter/{order_code}` - Export thank-you letter
- `/order_detail/show_donation_deduction_certificate/{order_code}` - Export donation deduction certificate
- `/order_detail/show_onestop/{order_code}` - Export one-stop
- `/order_detail/show_tax_shipping_details/{order_code}` - Export tax shipping detail
- `/order_detail/{order_code}` - Update order status
- `/order_detail/product/{order_product_code}` - Update order detail status
- `/order_detail/d_product/{order_product_code}` - Update order delivery detail status
- `/order_detail/show_product_delivery_note/{order_product_code}` - Export delivery note

- `/vms/order/{vm_id}` - VM order -> Send mail to Producer
- `/vms/order_sales/{vm_id}` - VM order sales -> Send mail to Producer
- `/vms/printing_success/{vm_id}` - VM printing success
- `/vms/complete_tickets/{vm_id}` - VM complete tickets

FrontEnd

- `/order/confirm/vm:{vm_id}/st:{store_id}` - Order confirmation
- `/order/cancel/vm:{vm_id}/st:{store_id}` - Credit card cancel
- `/order/payment_processing/vm:{vm_id}/st:{store_id}` - Payment processing
- `/order/complete/vm:{vm_id}/st:{store_id}` - Order completion
```

**Why this one is right:** the ticket touched `common-models`, so BOTH AdminPage and FrontEnd got their own Affected Features + Affected URLs blocks (see Common mistakes in SKILL.md). Content bullet stays at the business level — no mention of the specific query file or the exact removed columns' variable names.

## Single-app, no grouping needed (#1585)

```markdown
# #1585 - SCOPE

### 1. Objectives:

- Remove residual `administrators` logic from API `/vms/order`, `/vms/order_sales` to get the CC site admin emails.

### 2. Content:

- Update the logic to get the CC site admin emails from `administrators` to `admins`.
- Move `send_order_mail_in_orders_helper()` into `Vm_mail_notification_service::send_order_mail()` and update all call sites (`Order_detail.php`, `Vms.php`, `Vms_model.php`) to call the library.

### 3. Scope:

**Affected Features**

AdminPage

- VM API
- Order status
- Order delivery status
- Order detail

**Affected URLs:**

AdminPage

- `/vms/order/{vm_id}` - VM order -> Send mail to Producer
- `/vms/order_sales/{vm_id}` - VM order sales -> Send mail to Producer
- `/vms/printing_success/{vm_id}` - VM printing success -> Send order-received mail to Producer
- `/vms/complete_tickets/{vm_id}` - VM complete tickets -> Send order-status mail
- `/order_detail/{order_code}` - Update order status
- `/order_detail/product/{order_product_code}` - Update order detail status
- `/order_detail/d_product/{order_product_code}` - Update order delivery detail status
```

**Why this one is right:** only AdminPage was ever touched, so the app-grouping headings are still present (consistent with the multi-app example) but only one app appears. The second Content bullet names the moved function/class — that's still acceptable because it IS the change (a refactor ticket, not a business-logic ticket); it stays one level above "here's the diff": it says what moved and why, not the line-by-line code.

## Single flat list, brand-new feature (#1816)

```markdown
# #1816 - SCOPE

### 1. Objectives:

- Implement a new inbound API endpoint that allows TSM (Ticket System Management) to sync a batch of ticket status to UNIOSS.
- Store ticket data received from TSM in a dedicated `order_detail_tickets` table, linked to the matching `order_details` record via `product_code`.
- API Authentication via a shared API key in header `X-Api-Key` that is configurable per environment.

### 2. Content:

- Create the `order_detail_tickets` table via migration.
- Add config per environment for TSM settings.
- Add a new route `POST /api/products/ticket/upsert_status` to allow TSM to sync a batch of ticket status to UNIOSS.
- Authenticate via shared API key in header `X-Api-Key` that is configurable per environment.

### 3. Scope:

**Affected Features**

- New: TSM → UNIOSS inbound ticket status sync API

**Affected URLs:**

- `POST /api/products/ticket/upsert_status`
```

**Why this one is right:** a brand-new, isolated endpoint has no existing feature/URL to nest under an app heading — the flat list (no `AdminPage`/`FrontEnd` sub-heading) is correct here, not an omission.

## The Content bullet: good vs bad

Content bullets describe the change **for a PM/QC reader**, not for the next coder. Symbol/file names are only acceptable when the ticket IS the refactor (the reader needs to know a name moved) — never as a substitute for describing the business effect.

❌ Too implementation-level (this is what belongs in `CHANGES.md`, not `SCOPE.md`):

```
- Add `Users_model::get_site_admin_emails()` in `common-models`, using `admins` instead of `administrators` and shared for both apps.
- Remove `Admins_model::get_site_admin_mail_list()` and `Vms_model::get_vm_store_admin_mails_by_store_id()` in AdminPage; repoint their callers directly to the `Users_model::get_site_admin_emails()`.
```

✅ Business-level, still precise:

```
- Update the logic to get the site admin emails from `administrators` to `admins`.
```
