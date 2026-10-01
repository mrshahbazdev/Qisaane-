import { fmt, num, saleLines, orderTotal, ORDER_TYPES } from './model.js';

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const BASE = `body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; width: 64mm; }
h1 { font-size: 14px; text-align: center; margin: 0; }
.sub { text-align: center; font-size: 9.5px; color: #444; margin: 1px 0; }
.hr { border-top: 1px dashed #000; margin: 5px 0; }
table { width: 100%; border-collapse: collapse; }
th { font-size: 9px; text-align: left; border-bottom: 1px solid #000; padding: 1px 0; }
td { padding: 1.5px 0; vertical-align: top; }
.nm { width: 55%; }
.en { font-size: 8.5px; color: #555; }
.q, .p, .t { text-align: right; font-variant-numeric: tabular-nums; }
.tot { font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; margin-top: 3px; }
.meta { display: flex; justify-content: space-between; font-size: 10px; }
.foot { text-align: center; font-size: 10px; margin-top: 6px; }
.rtl { direction: rtl; font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Segoe UI', sans-serif; }`;

const head = () => `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: 72mm auto; margin: 4mm; }${BASE}</style></head><body>`;

const metaLine = (o, st) => `<div class="meta"><span>Order #${o.number || '—'} · ${esc(ORDER_TYPES[o.type] || 'Takeaway')}</span><span>${esc((o.at || '').replace('T', ' ').slice(0, 16))}</span></div>
  ${o.tableName ? `<div class="meta"><b>Table: ${esc(o.tableName)}</b>${o.waiter ? `<span>Waiter: ${esc(o.waiter)}</span>` : ''}</div>` : (o.waiter ? `<div class="meta"><span>Waiter: ${esc(o.waiter)}</span></div>` : '')}
  ${o.customer ? `<div class="meta"><span>Customer: ${esc(o.customer)}</span>${o.customerPhone ? `<span>${esc(o.customerPhone)}</span>` : ''}</div>` : ''}`;

// 72mm customer receipt, also printable to A4/PDF. Bilingual item names.
export function receiptHtml(sale, st) {
  const cur = st.currency || 'Rs';
  const useUrdu = st.receiptUrdu !== false;
  const rows = (sale.lines || []).map(l => `
    <tr>
      <td class="nm">${esc(useUrdu && l.urduName ? l.urduName : l.name)}${useUrdu && l.urduName ? `<div class="en">${esc(l.name)}</div>` : ''}</td>
      <td class="q">${num(l.qty)}</td>
      <td class="p">${num(l.price).toLocaleString()}</td>
      <td class="t">${(num(l.qty) * num(l.price) - num(l.discount)).toLocaleString()}${num(l.discount) ? `<div class="en">-${num(l.discount).toLocaleString()} disc</div>` : ''}</td>
    </tr>`).join('');
  const sub = saleLines(sale.lines || []);
  const total = sale.total != null ? num(sale.total) : orderTotal(sale, st);
  const change = num(sale.paid) - total;
  return `${head()}
  <h1>${esc(st.shopName || 'Cafe')}</h1>
  ${st.shopAddress ? `<div class="sub">${esc(st.shopAddress)}</div>` : ''}
  ${st.shopPhone ? `<div class="sub">${esc(st.shopPhone)}</div>` : ''}
  <div class="hr"></div>
  ${metaLine(sale, st)}
  <div class="hr"></div>
  <table><thead><tr><th>Item / جنس</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="hr"></div>
  <div class="meta"><span>Subtotal</span><span>${fmt(sub, cur)}</span></div>
  ${num(sale.discount) ? `<div class="meta"><span>Discount / رعایت</span><span>-${fmt(sale.discount, cur)}</span></div>` : ''}
  ${num(sale.serviceCharge) ? `<div class="meta"><span>Service charge</span><span>${fmt(sale.serviceCharge, cur)}</span></div>` : ''}
  ${num(sale.tax) ? `<div class="meta"><span>Tax / ٹیکس</span><span>${fmt(sale.tax, cur)}</span></div>` : ''}
  <div class="tot"><span>Total / کل</span><span>${fmt(total, cur)}</span></div>
  <div class="meta"><span>Paid (${esc(sale.method || 'cash')}) / ادا شدہ</span><span>${fmt(sale.paid, cur)}</span></div>
  ${change > 0 ? `<div class="meta"><span>Change / واپسی</span><span>${fmt(change, cur)}</span></div>` : ''}
  ${change < 0 ? `<div class="meta"><span>Balance due / بقایا</span><span>${fmt(-change, cur)}</span></div>` : ''}
  <div class="hr"></div>
  <div class="foot rtl">${esc(st.receiptFooter || '')}</div>
  <div class="foot" style="font-size:8.5px;color:#666">Qisaane</div>
</body></html>`;
}

// Kitchen Order Ticket — only the lines passed (normally the newly sent ones).
export function kotHtml(order, lines, st) {
  const rows = (lines || []).map(l => `
    <tr><td class="q" style="font-size:15px;font-weight:800;width:14%">${num(l.qty)}×</td>
    <td class="nm" style="font-size:13px;font-weight:700">${esc(l.name)}${l.urduName ? `<div class="en" style="font-size:10px">${esc(l.urduName)}</div>` : ''}</td></tr>`).join('');
  return `${head()}
  <h1>KITCHEN ORDER</h1>
  <div class="sub">${esc(st.shopName || 'Cafe')}</div>
  <div class="hr"></div>
  <div class="meta"><b style="font-size:14px">${esc(ORDER_TYPES[order.type] || 'Order')} ${order.tableName ? '· ' + esc(order.tableName) : ''}</b><span>#${order.number || '—'}</span></div>
  <div class="meta"><span>${esc((order.at || '').replace('T', ' ').slice(0, 16))}</span><span>${esc(order.waiter || order.user || '')}</span></div>
  ${order.customer ? `<div class="meta"><span>${esc(order.customer)}</span></div>` : ''}
  ${order.note ? `<div class="meta"><span style="font-weight:700">Note: ${esc(order.note)}</span></div>` : ''}
  <div class="hr"></div>
  <table><tbody>${rows}</tbody></table>
  <div class="hr"></div>
  <div class="foot" style="font-size:8.5px;color:#666">Qisaane KOT</div>
</body></html>`;
}
