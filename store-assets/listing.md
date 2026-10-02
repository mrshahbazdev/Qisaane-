# Qisaane — Store listing copy

## Short description (200)
Offline cafe & restaurant POS — table map, dine-in/takeaway/delivery orders, kitchen tickets, bilingual receipts, day book & Z-report. No account, no internet.

## Description
Qisaane is a fully offline point-of-sale register for cafes, restaurants and small food businesses. It runs entirely on your own computer — no account, no subscription, no internet required. Your data is stored locally in an encrypted database and never leaves your PCs unless you choose to share it.

Open tables from a live table map, take dine-in, takeaway or delivery orders, and send kitchen order tickets (KOT) to the kitchen printer — only new lines are printed. Item variants (half/full, cup/pot), per-line discounts, service charge and tax are all supported, and receipts print bilingually (English + Urdu) on standard 72mm/80mm thermal paper.

Every day closes with a day book and Z-report: sales by payment method and order type, waiter-wise sales, expenses, and net cash. Voids and returns are recorded (never deleted) for a clean audit trail.

Optional LAN sync lets a second computer on the same Wi-Fi/LAN work as a till — off by default, enabled only when you turn it on. PIN logins separate owner, manager and counter staff. Works completely offline for everything else.

## Features (max 200 chars each)
- Table map with live open bills — dine-in, takeaway & delivery orders
- Kitchen order tickets (KOT) — only new lines print to the kitchen
- Bilingual receipts (English + Urdu) on 72mm/80mm thermal paper
- Item variants, per-line discounts, service charge & tax
- Day book & Z-report — sales by method, waiter-wise, expenses, net cash
- Fully offline & encrypted — optional LAN till sync, PIN staff logins

## Search terms / keywords (max 7)
pos
restaurant
cafe
billing
kitchen ticket
receipt
urdu

## Copyright
© 2026 Muhammad Shahbaz

## Developed by
Muhammad Shahbaz

## Additional license terms
(none)

## Privacy / support
Support: mrshahbaznns@gmail.com
Qisaane works fully offline. Menu, orders, tables and expenses are stored only on this computer — encrypted at rest. Optional LAN sharing (off by default) sends data only to devices on your own Wi-Fi/LAN. No analytics, no ads, no internet connection used.

## Testing notes for evaluators
Qisaane is an offline desktop POS. On first run a consent screen appears; choose "I accept — explore sample data" to load a sample cafe (Cafe Al-Qisaane) with a menu, 8 tables, running and paid orders so everything can be tried: open a table, send a kitchen ticket, check out, print the bill, check the day book. LAN sharing, encrypted-at-rest, is opt-in only (Settings → Local connection). No account or internet is required. LAN sync uses the local network only (privateNetworkClientServer) when the user enables it in Settings; all data stays on the local network — nothing is uploaded anywhere. runFullTrust is required by Electron to print receipts and read/write the encrypted local database.
