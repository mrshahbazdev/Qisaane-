import { useMemo, useRef, useState } from 'react';
import { fmt, num, uid, nextSaleNumber, saleLines, orderTotal, findCustomer, unsentLines, ORDER_TYPES } from '../lib/model.js';
import { receiptHtml, kotHtml } from '../lib/receiptHtml.js';

// Order screen: menu grid by category + cart, order type (dine-in table /
// takeaway / delivery), waiter attribution, variants, per-line + order
// discount, service charge & tax, KOT print on send, checkout -> receipt.
export default function SalePanel({ store, update, user, editOrder, tableId, onDone }) {
  const editing = editOrder || null;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState(editing ? editing.lines.map(l => ({ ...l })) : []);
  const [discount, setDiscount] = useState(editing ? num(editing.discount) : 0);
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState(editing?.method || 'cash');
  const [type, setType] = useState(editing?.type || (tableId ? 'dine' : 'takeaway'));
  const [tId, setTId] = useState(editing?.tableId || tableId || '');
  const [waiter, setWaiter] = useState(editing?.waiter || '');
  const [customer, setCustomer] = useState(editing?.customer || '');
  const [phone, setPhone] = useState(editing?.customerPhone || '');
  const [note, setNote] = useState(editing?.note || '');
  const [savedSale, setSavedSale] = useState(null);
  const qRef = useRef(null);

  const items = store.items || [];
  const cats = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))].sort(), [items]);
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const n = q.trim().toLowerCase();
    return items.filter(i => `${i.sku} ${i.barcode || ''} ${i.name} ${i.urduName || ''}`.toLowerCase().includes(n)).slice(0, 8);
  }, [q, items]);
  const grid = useMemo(() => items.filter(i => !cat || i.category === cat), [items, cat]);

  const add = (it, v = null) => {
    const name = v ? `${it.name} · ${v.name}` : it.name;
    const price = v ? num(v.price) : num(it.price);
    setCart(c => {
      const ex = c.find(l => l.itemId === it.id && l.price === price && l.name === name && !l.sent);
      if (ex) return c.map(l => l === ex ? { ...l, qty: l.qty + 1 } : l);
      return [...c, { itemId: it.id, name, urduName: it.urduName, qty: 1, price, cost: num(it.cost), unit: it.unit, discount: 0, sent: false }];
    });
    setQ(''); qRef.current?.focus();
  };

  const onSearchKey = e => {
    if (e.key !== 'Enter') return;
    const n = q.trim().toLowerCase();
    const exact = items.find(i => (i.sku || '').toLowerCase() === n || (i.barcode || '').toLowerCase() === n) || matches[0];
    if (exact) add(exact, (exact.variants || [])[0] || null);
  };

  const st = store.settings;
  const sub = saleLines(cart);
  const svc = type === 'dine' ? Math.round(sub * num(st.serviceChargePct) / 100) : 0;
  const tax = Math.round((sub - num(discount)) * num(st.taxPct) / 100);
  const total = Math.max(0, sub - num(discount) + svc + tax);
  const change = paid === '' ? null : num(paid) - total;
  const table = (store.tables || []).find(t => t.id === tId);
  const pendingKot = cart.filter(l => !l.sent);
  const waiters = st.waiters || [];

  const buildOrder = status => ({
    id: editing ? editing.id : uid('s'),
    number: editing ? editing.number : nextSaleNumber(store),
    at: editing ? editing.at : new Date().toISOString().slice(0, 16),
    type, tableId: type === 'dine' ? (tId || null) : null, tableName: type === 'dine' ? (table?.name || '') : '',
    waiter: waiter.trim(), status,
    lines: cart.map(l => ({ itemId: l.itemId, name: l.name, urduName: l.urduName, qty: num(l.qty), price: num(l.price), cost: num(l.cost), discount: num(l.discount), sent: !!l.sent })),
    discount: num(discount), serviceCharge: svc, tax, total,
    paid: status === 'open' ? 0 : (num(paid) || total), method,
    customer: customer.trim(), customerPhone: phone.trim(), note: note.trim(),
    user: (user && user.name) || (editing?.user) || 'counter'
  });

  const persist = (order, label) => update(s => {
    const ix = s.sales.findIndex(x => x.id === order.id);
    if (ix >= 0) s.sales[ix] = order; else s.sales.push(order);
  }, label);

  const sendToKitchen = () => {
    if (!cart.length || !pendingKot.length) return;
    const order = buildOrder('open');
    update(s => {
      const fresh = { ...order, lines: order.lines.map(l => ({ ...l, sent: true })) };
      const ix = s.sales.findIndex(x => x.id === order.id);
      if (ix >= 0) s.sales[ix] = fresh; else s.sales.push(fresh);
    }, `KOT order #${order.number}`);
    if (st.kotPrint !== false) window.api.export.print({ html: kotHtml(order, pendingKot, st) });
    setCart(c => c.map(l => ({ ...l, sent: true })));
  };

  const saveOpen = () => {
    if (!cart.length) return;
    const order = buildOrder('open');
    persist(order, `open order #${order.number}`);
    setSavedSale(order); resetLocal(); onDone?.();
  };

  const checkout = (printAfter) => {
    if (!cart.length) return;
    const order = buildOrder('paid');
    const shortfall = Math.max(0, order.total - num(order.paid));
    if ((order.method === 'credit' || shortfall > 0) && shortfall > 0) {
      let cust = findCustomer(store, order.customer);
      if (!cust && order.customer) cust = { id: uid('c'), name: order.customer, phone: order.customerPhone, note: '', _new: true };
      if (cust) { order.customerId = cust.id; order.customer = cust.name; order._cust = cust._new ? cust : null; order._khata = shortfall; }
    }
    update(s => {
      const ix = s.sales.findIndex(x => x.id === order.id);
      if (ix >= 0) s.sales[ix] = order; else s.sales.push(order);
      if (order._khata != null) {
        if (order._cust) { s.customers = s.customers || []; s.customers.push({ id: order._cust.id, name: order._cust.name, phone: order._cust.phone, note: '' }); }
        s.khata = s.khata || [];
        s.khata.push({ id: uid('k'), partyType: 'customer', partyId: order.customerId, partyName: order.customer, at: order.at, amount: order._khata, kind: 'sale', refId: order.id, note: `Order #${order.number}` });
      }
      for (const l of cart) {
        const it = s.items.find(i => i.id === l.itemId);
        if (it && it.trackStock !== false) it.stock = num(it.stock) - num(l.qty);
        s.stockMoves = s.stockMoves || [];
        if (!l._stMoved || !editing) s.stockMoves.push({ id: uid('m'), itemId: l.itemId, qty: -num(l.qty), reason: 'sale', at: order.at, note: `Order #${order.number}` });
      }
    }, `checkout order #${order.number}`);
    if (printAfter) window.api.export.print({ html: receiptHtml(order, st) });
    setSavedSale(order); resetLocal(); onDone?.();
  };

  const voidOrder = () => {
    if (!editing) return;
    const reason = prompt(`Void order #${editing.number}? Reason (required):`);
    if (!reason) return;
    update(s => {
      const o = s.sales.find(x => x.id === editing.id);
      if (o) { o.voided = true; o.voidReason = reason; o.status = 'paid'; }
    }, `void order #${editing.number}`);
    onDone?.();
  };

  const resetLocal = () => { setCart([]); setDiscount(0); setPaid(''); setCustomer(''); setPhone(''); setNote(''); setTId(''); setWaiter(''); };

  return (
    <div className="editor-wrap">
      <div className="editor">
        <div className="etoolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="medpick" style={{ flex: 1, minWidth: 220 }}>
            <input ref={qRef} className="in" style={{ width: '100%' }} autoFocus
              placeholder="Type item name… (Enter adds first match)" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={onSearchKey} />
            {matches.length > 0 && (
              <div className="medpick-list">
                {matches.map((i, ix) => (
                  <div key={i.id} className={'medpick-item' + (ix === 0 ? ' on' : '')} onClick={() => add(i, (i.variants || [])[0] || null)}>
                    <b>{i.name}</b> {i.urduName ? <span style={{ fontSize: 12 }}>({i.urduName})</span> : ''}
                    <span className="g"> — {fmt(i.price, st.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <select className="in" value={type} onChange={e => setType(e.target.value)}>
            <option value="dine">Dine-in</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option>
          </select>
          {type === 'dine' && (
            <select className="in" value={tId} onChange={e => setTId(e.target.value)}>
              <option value="">Table…</option>
              {(store.tables || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>)}
          <input className="in" style={{ width: 130 }} list="waiterlist" placeholder="Waiter" value={waiter} onChange={e => setWaiter(e.target.value)} />
          <datalist id="waiterlist">{waiters.map(w => <option key={w} value={w} />)}</datalist>
          {type === 'delivery' && <>
            <input className="in" style={{ width: 140 }} placeholder="Customer" value={customer} onChange={e => setCustomer(e.target.value)} />
            <input className="in" style={{ width: 120 }} placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          </>}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className={'chip' + (!cat ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setCat('')}>All</button>
          {cats.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8, marginBottom: 12 }}>
          {grid.map(i => (i.variants || []).length ? (
            <div key={i.id} className="pcard" style={{ padding: 8, cursor: 'default' }}>
              <b style={{ fontSize: 12.5 }}>{i.name}</b>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {i.variants.map(v => <button key={v.name} className="btn small ghost" onClick={() => add(i, v)}>{v.name} {fmt(v.price, st.currency)}</button>)}
              </div>
            </div>
          ) : (
            <button key={i.id} className="pcard" style={{ padding: 8, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }} onClick={() => add(i)}>
              <b style={{ fontSize: 12.5 }}>{i.name}</b>
              <div className="muted" style={{ fontSize: 11 }}>{fmt(i.price, st.currency)}</div>
            </button>
          ))}
        </div>

        <table className="grid">
          <thead><tr><th style={{ width: '38%' }}>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Disc</th><th className="num">Amount</th><th>Sent</th><th></th></tr></thead>
          <tbody>
            {cart.map((l, i) => (
              <tr key={i}>
                <td><b>{l.name}</b>{l.urduName ? <div className="muted" dir="rtl" style={{ fontSize: 11.5 }}>{l.urduName}</div> : ''}</td>
                <td className="num">
                  <button className="icon" onClick={() => setCart(c => c.map((x, ix) => ix === i ? { ...x, qty: Math.max(0.5, num(x.qty) - 1) } : x))}>−</button>
                  <input className="in num" style={{ width: 58 }} type="number" min="0" step="any" value={l.qty}
                    onChange={e => setCart(c => c.map((x, ix) => ix === i ? { ...x, qty: num(e.target.value) } : x))} />
                  <button className="icon" onClick={() => setCart(c => c.map((x, ix) => ix === i ? { ...x, qty: num(x.qty) + 1 } : x))}>+</button>
                </td>
                <td className="num"><input className="in num" style={{ width: 78 }} type="number" min="0" value={l.price}
                  onChange={e => setCart(c => c.map((x, ix) => ix === i ? { ...x, price: num(e.target.value) } : x))} /></td>
                <td className="num"><input className="in num" style={{ width: 62 }} type="number" min="0" value={l.discount || 0}
                  onChange={e => setCart(c => c.map((x, ix) => ix === i ? { ...x, discount: num(e.target.value) } : x))} /></td>
                <td className="num"><b>{fmt(num(l.qty) * num(l.price) - num(l.discount), st.currency)}</b></td>
                <td className="muted" style={{ fontSize: 11 }}>{l.sent ? '✔ kitchen' : 'new'}</td>
                <td><button className="icon" onClick={() => setCart(c => c.filter((_, ix) => ix !== i))}>✕</button></td>
              </tr>
            ))}
            {!cart.length && <tr><td colSpan="7" className="muted" style={{ padding: 26, textAlign: 'center' }}>Order empty — pick items from the menu above.</td></tr>}
          </tbody>
        </table>

        <input className="in" style={{ marginTop: 8, width: '100%' }} placeholder="Order note (e.g. less spicy, no onion) — prints on KOT" value={note} onChange={e => setNote(e.target.value)} />

        <div className="live-totals" style={{ fontSize: 15 }}>
          <span>Subtotal <b>{fmt(sub, st.currency)}</b></span>
          <label className="lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>Discount
            <input className="in num" style={{ width: 84 }} type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
          {svc > 0 && <span>Service <b>{fmt(svc, st.currency)}</b></span>}
          {tax > 0 && <span>Tax <b>{fmt(tax, st.currency)}</b></span>}
          <span style={{ fontSize: 18 }}>Total <b>{fmt(total, st.currency)}</b></span>
          <span className="spacer" />
          <select className="in" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="card">Card</option><option value="credit">Credit / udhaar</option>
          </select>
          <input className="in num" style={{ width: 110 }} type="number" min="0" placeholder={`Paid ${total}`} value={paid} onChange={e => setPaid(e.target.value)} />
          {change !== null && <b style={{ color: change < 0 ? 'var(--danger)' : 'var(--ok)' }}>{change >= 0 ? `Change ${fmt(change, st.currency)}` : `Due ${fmt(-change, st.currency)}`}</b>}
        </div>

        <div className="frow" style={{ marginTop: 14 }}>
          <button className="btn" disabled={!cart.length} onClick={() => checkout(true)}>✔ Checkout + print bill</button>
          <button className="btn ghost" disabled={!cart.length} onClick={() => checkout(false)}>Checkout</button>
          <button className="btn ghost" disabled={!pendingKot.length} title="Prints kitchen ticket for new lines" onClick={sendToKitchen}>🍳 Send to kitchen (KOT)</button>
          <button className="btn ghost" disabled={!cart.length} onClick={saveOpen}>Hold as open order</button>
          {editing && <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={voidOrder}>Void order</button>}
          {editing && <button className="btn ghost" onClick={onDone}>Back to tables</button>}
        </div>
        {savedSale && <div className="muted" style={{ marginTop: 8 }}>Last order #{savedSale.number} — {fmt(savedSale.total, st.currency)}
          <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={() => window.api.export.print({ html: receiptHtml(savedSale, st) })}>reprint</button>
          <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: receiptHtml(savedSale, st), suggestedName: `order-${savedSale.number}.pdf` })}>PDF</button>
        </div>}
      </div>

      <div className="preview" style={{ padding: 18 }}>
        <div className="pcount">Bill preview</div>
        <div className="rxprev" style={{ background: '#fff', margin: '0 auto', width: '72mm', minHeight: 100, padding: '4mm', boxShadow: '0 2px 14px rgba(15,23,42,.18)', fontSize: 11 }}
          dangerouslySetInnerHTML={{ __html: cart.length ? receiptHtml({ number: editing?.number || nextSaleNumber(store), at: new Date().toISOString().slice(0, 16), type, tableName: table?.name, waiter, customer, customerPhone: phone, lines: cart, discount, serviceCharge: svc, tax, total, paid: num(paid) || total, method }, st).replace(/^[\s\S]*?(<style>[\s\S]*?<\/style>)[\s\S]*?<body>/, '$1').replace(/<\/body>[\s\S]*$/, '').replace(/(?<=<style>)[\s\S]*?(?=<\/style>)/, css => css.replace(/\bbody\s*\{/g, '.rxprev{').replace(/\btable\b/g, '.rxprev table').replace(/\bth\s*\{/g, '.rxprev th{').replace(/\btd\s*\{/g, '.rxprev td{').replace(/\bh1\s*\{/g, '.rxprev h1{')) : '<div style="padding:20px;color:#94a3b8;font-size:12px">Add items to see the bill…</div>' }} />
      </div>
    </div>
  );
}
