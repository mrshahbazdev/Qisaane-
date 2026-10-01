// Cafe document model + money helpers. All amounts are numbers in the shop's
// currency; fmt() renders them for display/print. Orders live in `sales`:
// status 'open' = running order (not income until checkout), 'paid' = billed,
// voided = cancelled with reason (never deleted).

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 10);

export const fmt = (n, cur = 'Rs') => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const day = iso => (iso || '').slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);

export const ORDER_TYPES = { dine: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery' };

export function emptyStore() {
  return {
    version: 1,
    items: [],        // menu items {id, sku, barcode, name, urduName, category, unit, price, cost, stock, minStock, variants:[{name,price}], trackStock}
    tables: [],       // {id, name, seats}
    sales: [],        // orders {id, number, at, type:'dine'|'takeaway'|'delivery', tableId, tableName, waiter, status:'open'|'paid', lines:[{itemId,name,qty,price,cost,discount,sent}], discount, serviceCharge, total, paid, method, customer, customerId, customerPhone, note, user, voided, voidReason}
    stockMoves: [],   // {id, itemId, qty(+/-), reason, at, note}
    expenses: [],     // {id, at, label, amount, category}
    customers: [],    // {id, name, phone, note} — delivery + khata
    suppliers: [],    // {id, name, phone, note}
    khata: [],        // {id, partyType:'customer'|'supplier', partyId, partyName, at, amount(+ = they owe you / you owe them), kind:'sale'|'payment'|'purchase'|'manual', refId, note}
    purchases: [],    // {id, at, supplier, supplierId, lines:[{itemId,name,qty,cost}], total, paid, note, user}
    returns: [],      // {id, saleId, saleNumber, at, lines:[{itemId,name,qty,price}], refund, method, reason, user}
    zreports: [],     // {id, day, at, expectedCash, countedCash, variance, gross, salesCount, expenses, user, note}
    auditLog: [],
    settings: defaultSettings(),
    updatedAt: Date.now()
  };
}

export function defaultSettings() {
  return {
    shopName: '', shopAddress: '', shopPhone: '',
    currency: 'Rs',
    receiptFooter: 'Shukriya! Phir tashreef laye.',
    serviceChargePct: 0,   // dine-in service charge
    taxPct: 0,             // sales tax on order total
    kotPrint: true,        // auto-print kitchen ticket on send
    users: [],             // {id, name, role:'owner'|'manager'|'waiter'|'counter', pin}
    waiters: [],           // plain name list for order attribution (no PIN needed)
    backupFolder: '', lastBackupAt: '',
    syncFolder: '', syncAuto: true, syncCode: '', hostOn: false,
    uiUrdu: false, receiptUrdu: true,
    firstRunDone: false, consent: null
  };
}

export function newItem(patch = {}) {
  return { id: uid('i'), sku: '', barcode: '', name: '', urduName: '', category: '', unit: 'pcs', price: 0, cost: 0, stock: 0, minStock: 0, variants: [], trackStock: false, ...patch };
}

export function newTable(name, seats = 4) {
  return { id: uid('t'), name, seats: num(seats) || 4 };
}

export function lowStock(store) {
  return (store.items || []).filter(i => i.trackStock !== false && num(i.minStock) > 0 && num(i.stock) <= num(i.minStock));
}

// Reorder suggestion: low-stock items padded up to minStock*2.
export function reorderList(store) {
  return lowStock(store).map(i => ({ ...i, suggest: Math.max(1, num(i.minStock) * 2 - num(i.stock)) }));
}

export function saleLines(lines) {
  let total = 0;
  for (const l of lines) total += num(l.qty) * num(l.price) - num(l.discount);
  return total;
}

// Grand total incl. order-level discount, service charge and tax.
export function orderTotal(o, st) {
  const sub = saleLines(o.lines || []);
  const svc = num(o.serviceCharge != null ? o.serviceCharge : Math.round(sub * num(st?.serviceChargePct) / 100));
  const tax = num(o.tax != null ? o.tax : Math.round((sub - num(o.discount)) * num(st?.taxPct) / 100));
  return Math.max(0, sub - num(o.discount) + svc + tax);
}

export function saleProfit(sale) {
  let p = 0;
  for (const l of (sale.lines || [])) p += (num(l.price) - num(l.cost)) * num(l.qty) - num(l.discount);
  return p - num(sale.discount);
}

// Billed orders only — open orders and voids are not income.
export function liveSales(store) {
  return (store.sales || []).filter(s => !s.voided && s.status !== 'open');
}

export function openOrders(store) {
  return (store.sales || []).filter(s => !s.voided && s.status === 'open');
}

export function orderOnTable(store, tableId) {
  return openOrders(store).find(s => s.tableId === tableId) || null;
}

export function unsentLines(order) {
  return (order.lines || []).filter(l => !l.sent);
}

// Khata (ledger) balance for one party. Positive = receivable from customer /
// payable to supplier depending on partyType.
export function khataBalance(store, partyType, partyId) {
  return (store.khata || [])
    .filter(e => e.partyType === partyType && e.partyId === partyId)
    .reduce((t, e) => t + num(e.amount), 0);
}

export function partyEntries(store, partyType, partyId) {
  return (store.khata || [])
    .filter(e => e.partyType === partyType && e.partyId === partyId)
    .sort((a, b) => (a.at || '').localeCompare(b.at || ''));
}

export function findCustomer(store, nameOrId) {
  return (store.customers || []).find(c => c.id === nameOrId || c.name === nameOrId) || null;
}

// Post a purchase: record + stock moves + weighted-average cost update.
export function postPurchase(store, purchase, user) {
  store.purchases = store.purchases || [];
  store.purchases.push(purchase);
  for (const l of purchase.lines || []) {
    const it = (store.items || []).find(i => i.id === l.itemId);
    if (!it) continue;
    const oldVal = num(it.stock) * num(it.cost);
    const inVal = num(l.qty) * num(l.cost);
    const newStock = num(it.stock) + num(l.qty);
    it.cost = newStock > 0 ? Math.round((oldVal + inVal) / newStock * 100) / 100 : num(l.cost);
    it.stock = newStock;
    store.stockMoves.push({ id: uid('m'), itemId: it.id, qty: num(l.qty), reason: 'purchase', at: purchase.at, note: purchase.supplier || '' });
  }
}

// Post a return: stock back in, refund recorded.
export function postReturn(store, ret, user) {
  store.returns = store.returns || [];
  store.returns.push(ret);
  const sale = (store.sales || []).find(s => s.id === ret.saleId);
  for (const l of ret.lines || []) {
    const it = (store.items || []).find(i => i.id === l.itemId);
    if (it) it.stock = num(it.stock) + num(l.qty);
    store.stockMoves.push({ id: uid('m'), itemId: l.itemId, qty: num(l.qty), reason: 'return', at: ret.at, note: `Order #${ret.saleNumber}` });
  }
  if (sale) sale.refundTotal = num(sale.refundTotal) + num(ret.refund);
}

export function returnsOn(store, dateStr) {
  return (store.returns || []).filter(r => day(r.at) === dateStr);
}

export function expectedCash(store, dateStr, opening = 0) {
  const sales = salesOn(store, dateStr).filter(s => !s.voided && s.status !== 'open' && s.method !== 'credit');
  const cashIn = sales.reduce((t, s) => t + num(s.paid), 0);
  const refunds = returnsOn(store, dateStr).reduce((t, r) => t + num(r.refund), 0);
  const exp = (store.expenses || []).filter(e => day(e.at) === dateStr).reduce((t, e) => t + num(e.amount), 0);
  return num(opening) + cashIn - refunds - exp;
}

export function nextSaleNumber(store) {
  return (store.sales || []).reduce((m, s) => Math.max(m, num(s.number)), 0) + 1;
}

export function salesOn(store, dateStr) {
  return (store.sales || []).filter(s => day(s.at) === dateStr);
}

export function dayTotals(store, dateStr) {
  const sales = salesOn(store, dateStr).filter(s => !s.voided && s.status !== 'open');
  const gross = sales.reduce((t, s) => t + num(s.total), 0);
  const paid = sales.reduce((t, s) => t + num(s.paid), 0);
  const profit = sales.reduce((t, s) => t + saleProfit(s), 0);
  const returns = returnsOn(store, dateStr);
  const refunds = returns.reduce((t, r) => t + num(r.refund), 0);
  const expenses = (store.expenses || []).filter(e => day(e.at) === dateStr);
  const exp = expenses.reduce((t, e) => t + num(e.amount), 0);
  return { sales, gross, paid, profit, returns, refunds, expenses, exp, net: paid - refunds - exp };
}

// Waiter-wise billed sales for a day.
export function waiterSales(store, dateStr) {
  const m = {};
  for (const s of salesOn(store, dateStr).filter(x => !x.voided && x.status !== 'open')) {
    const w = s.waiter || s.user || '—';
    m[w] = m[w] || { count: 0, total: 0 };
    m[w].count++; m[w].total += num(s.total);
  }
  return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
}

// Code39 barcode → SVG rect list. Value is uppercased; unsupported chars → space.
export function code39Bars(value) {
  const P = {
    '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
    '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
    '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
    'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
    'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
    'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
    'O': '110101101001', 'P': '101101101001', 'Q': '101101010011', 'R': '110101011001',
    'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
    'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
    '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
    '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001'
  };
  const text = '*' + String(value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, ' ') + '*';
  const bars = [];
  let x = 0;
  for (const ch of text) {
    const pat = P[ch];
    for (let i = 0; i < pat.length; i++) {
      const w = pat[i] === '1' ? 3 : 1;
      if (i % 2 === 0) bars.push([x, w]);
      x += w;
    }
    x += 1;
  }
  return { bars, width: x };
}

// Fictional sample cafe so the app is usable on first launch (and screenshots).
export function sampleStore() {
  const st = emptyStore();
  const items = [
    ['Doodh patti chai', 'چائے', 'Chai', 'cup', 120, 45],
    ['Green tea (sabz chai)', 'سبز چائے', 'Chai', 'cup', 100, 35],
    ['Kashmiri chai', 'کشمیری چائے', 'Chai', 'cup', 180, 70],
    ['Halwa puri (2 pcs)', 'حلوہ پوری', 'Nashta', 'plate', 250, 140],
    ['Anda paratha', 'انڈا پراٹھا', 'Nashta', 'plate', 180, 90],
    ['Chicken tikka', 'چکن تکہ', 'BBQ', 'plate', 450, 260],
    ['Seekh kebab (4 pcs)', 'سیخ کباب', 'BBQ', 'plate', 380, 210],
    ['Chicken karahi (half)', 'چکن کڑاہی', 'Karahi', 'half', 950, 560],
    ['Zinger burger', 'زنگر برگر', 'Fast food', 'pc', 420, 240],
    ['Club sandwich', 'کلب سینڈوچ', 'Fast food', 'pc', 350, 190],
    ['Fries (large)', 'فرائز', 'Fast food', 'plate', 200, 90],
    ['Cold drink', 'کولڈ ڈرنک', 'Beverages', 'bottle', 100, 70],
    ['Fresh juice', 'فریش جوس', 'Beverages', 'glass', 250, 130],
    ['Mineral water', 'منرل واٹر', 'Beverages', 'bottle', 80, 50],
    ['Gulab jamun (4 pcs)', 'گلاب جامن', 'Desserts', 'plate', 180, 80],
    ['Ice cream scoop', 'آئس کریم', 'Desserts', 'scoop', 150, 70],
  ];
  st.items = items.map(([name, urduName, category, unit, price, cost], i) =>
    newItem({ sku: 'M' + String(i + 1).padStart(2, '0'), name, urduName, category, unit, price, cost, trackStock: false }));
  st.items.find(i => i.name === 'Chicken karahi (half)').variants = [{ name: 'Half', price: 950 }, { name: 'Full', price: 1800 }];
  st.items.find(i => i.name === 'Doodh patti chai').variants = [{ name: 'Cup', price: 120 }, { name: 'Pot (2)', price: 220 }];

  st.tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'].map(n => newTable(n, 4));
  st.tables[0].seats = 2; st.tables[4].seats = 6; st.tables[5].seats = 6;
  st.settings.waiters = ['Ali Raza', 'Bilal Ahmed', 'Sana Khan'];
  st.settings.serviceChargePct = 0; st.settings.taxPct = 0;

  const T = today();
  const mk = (number, hour, mins, lines, opts = {}) => {
    const o = {
      id: uid('s'), number, at: T + 'T' + String(hour).padStart(2, '0') + ':' + String(mins).padStart(2, '0'),
      type: 'takeaway', tableId: null, tableName: '', waiter: '', status: 'paid',
      lines, discount: 0, serviceCharge: 0, tax: 0, customer: '', customerPhone: '',
      note: '', user: 'Counter', method: 'cash', ...opts
    };
    o.total = orderTotal(o, st.settings);
    if (o.status === 'paid' && o.paid == null) o.paid = o.total;
    return o;
  };
  const line = (idx, qty, sent = true) => {
    const it = st.items[idx];
    return { itemId: it.id, name: it.name, urduName: it.urduName, qty, price: it.price, cost: it.cost, discount: 0, sent };
  };
  st.sales = [
    mk(1, 9, 15, [line(0, 3), line(3, 1)]),
    mk(2, 10, 40, [line(8, 1), line(10, 1), line(11, 2)], { waiter: 'Ali Raza' }),
    mk(3, 12, 5, [line(7, 1), line(11, 2)], { type: 'delivery', customer: 'Hamza (DHA)', customerPhone: '03214445566', waiter: 'Bilal Ahmed' }),
    mk(4, 13, 30, [line(5, 2), line(1, 2), line(14, 1)], { type: 'dine', tableId: st.tables[2].id, tableName: 'T3', waiter: 'Ali Raza', method: 'card' }),
    mk(5, 15, 20, [line(9, 2), line(12, 1)], { waiter: 'Sana Khan' }),
    // Open dine-in orders (running tables) — kitchen has the sent lines.
    mk(6, 17, 10, [line(6, 2), line(0, 2), line(11, 3)], { status: 'open', paid: 0, type: 'dine', tableId: st.tables[0].id, tableName: 'T1', waiter: 'Ali Raza' }),
    mk(7, 17, 45, [line(5, 1), line(12, 1), line(15, 1), line(13, 2, false)], { status: 'open', paid: 0, type: 'dine', tableId: st.tables[4].id, tableName: 'T5', waiter: 'Sana Khan' }),
  ];
  st.expenses = [
    { id: uid('e'), at: T + 'T08:30', label: 'Gas cylinder refill', amount: 2400 },
    { id: uid('e'), at: T + 'T11:00', label: 'Vegetable vendor', amount: 1800 },
    { id: uid('e'), at: T + 'T15:20', label: 'Cleaning supplies', amount: 450 },
  ];
  st.stockMoves = [
    { id: uid('m'), itemId: st.items[11].id, qty: 48, reason: 'purchase', at: T + 'T08:45', note: 'Beverage distributor' },
    { id: uid('m'), itemId: st.items[0].id, qty: -1, reason: 'waste', at: T + 'T13:10', note: 'Spilled pot' },
  ];
  st.customers = [
    { id: uid('c'), name: 'Hamza (DHA)', phone: '03214445566', note: 'Delivery regular' },
    { id: uid('c'), name: 'Bakers on 4th St', phone: '04236667788', note: 'Daily karahi order' },
  ];
  st.suppliers = [
    { id: uid('u'), name: 'Fresh Meat Supply', phone: '04235711122', note: 'Daily chicken/meat' },
    { id: uid('u'), name: 'Beverage Distributor', phone: '04237544455', note: '' },
  ];
  st.settings.shopName = 'Cafe Al-Qisaane';
  st.settings.shopAddress = 'Shop 4, Food Street, Lahore';
  st.settings.shopPhone = '0300-1234567';
  return st;
}
