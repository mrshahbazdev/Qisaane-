# Qisaane

Offline cafe & restaurant POS — table map, dine-in / takeaway / delivery orders, kitchen order tickets (KOT), bilingual (English/Urdu) receipts, day book and Z-report. No account, no subscription, no internet.

## Features

- **Table map** — free/occupied at a glance, running bill per table, one tap to add items or checkout
- **Order screen** — menu grid by category + instant search, item variants (half/full, cup/pot), per-line and order discounts, service charge + tax, order notes
- **Kitchen Order Ticket** — "Send to kitchen" prints only new lines on a 72mm KOT with table/waiter/order#
- **Order types** — dine-in (table + waiter), takeaway, delivery (customer + phone)
- **Checkout** — cash/card/credit with change & udhaar; 72mm bilingual bill print + PDF
- **Voids & returns** — void an order with a reason (never deleted), per-line returns with stock back
- **Menu manager** — name + Urdu name, categories, prices, variants, optional stock tracking, CSV import, barcode/price labels
- **Purchases & stock** — supplier purchases update stock and weighted-average cost; waste/damage moves logged
- **Khata / parties** — customer udhaar ledger with statement print + WhatsApp reminder link; supplier payable
- **Day book & Z-report** — sales + expenses per date, register close with expected vs counted cash, printable Z
- **Reports** — date-range sales, by payment method / order type / waiter, gross profit, top items, CSV export
- **Users & PIN** — admin/counter roles, PINs hashed (scrypt), idle auto-lock; waiter name list for order attribution
- **Second counter** — optional LAN host mode: another PC opens the app in a browser with an access code
- **Backups** — encrypted JSON snapshots, daily auto-backup to a chosen folder/USB, restore points

## Data safety

- `qisaane.db` — SQLCipher-encrypted SQLite (WAL, foreign keys), key wrapped by OS DPAPI/Keychain
- Strict CSP, `connect-src 'none'` in packaged builds — the renderer cannot reach the network

## Run

```bash
npm install
npm run dev        # electron + vite
npm run dist:win   # Windows .appx build
```
