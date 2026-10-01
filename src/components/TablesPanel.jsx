import { fmt, num, openOrders, orderOnTable, saleLines } from '../lib/model.js';
import { receiptHtml } from '../lib/receiptHtml.js';

// Table map: free/occupied at a glance, running bill total, open or checkout.
export default function TablesPanel({ store, update, go }) {
  const open = openOrders(store);
  const takeawayOpen = open.filter(o => o.type !== 'dine');

  return (
    <div className="panel" style={{ maxWidth: 1150 }}>
      <div className="toolbar">
        <h2 className="ptitle" style={{ margin: 0 }}>Table map</h2>
        <span className="muted">{open.filter(o => o.type === 'dine').length} occupied / {(store.tables || []).length} tables</span>
        <span className="spacer" />
        <button className="btn" onClick={() => go('sale', {})}>+ Quick order (takeaway)</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {(store.tables || []).map(t => {
          const o = orderOnTable(store, t.id);
          const amt = o ? saleLines(o.lines) - num(o.discount) + num(o.serviceCharge) + num(o.tax) : 0;
          const unsent = o ? (o.lines || []).filter(l => !l.sent).length : 0;
          return (
            <button key={t.id} onClick={() => go('sale', { orderId: o?.id, tableId: t.id })}
              className="pcard" style={{ textAlign: 'left', cursor: 'pointer', padding: 14, border: o ? '2px solid var(--danger)' : '1px solid var(--border)', background: o ? '#fff7f7' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ fontSize: 17 }}>{t.name}</b>
                <span className="muted" style={{ fontSize: 11 }}>{t.seats} seats</span>
              </div>
              {o ? (
                <>
                  <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>Occupied</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>#{o.number} · {o.waiter || '—'} · {(o.at || '').slice(11, 16)}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{fmt(amt, store.settings.currency)}</div>
                  {unsent > 0 && <div className="muted" style={{ fontSize: 10.5, color: 'var(--warn)' }}>{unsent} line(s) not sent to kitchen</div>}
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>Tap to add items / checkout →</div>
                </>
              ) : (
                <>
                  <div style={{ color: 'var(--ok)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>Free</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Tap to open order</div>
                </>
              )}
            </button>
          );
        })}
        {!(store.tables || []).length && <div className="muted" style={{ padding: 20 }}>No tables — add them in Settings → Tables.</div>}
      </div>

      {takeawayOpen.length > 0 && <>
        <h2 className="ptitle" style={{ marginTop: 18 }}>Open takeaway / delivery orders</h2>
        <table className="grid">
          <thead><tr><th>#</th><th>Type</th><th>Customer</th><th>Waiter</th><th>Time</th><th className="num">Bill</th><th></th></tr></thead>
          <tbody>
            {takeawayOpen.map(o => (
              <tr key={o.id}>
                <td>#{o.number}</td>
                <td className="muted">{o.type === 'delivery' ? 'Delivery' : 'Takeaway'}</td>
                <td>{o.customer || '—'} {o.customerPhone ? <span className="muted" style={{ fontSize: 11 }}>{o.customerPhone}</span> : ''}</td>
                <td className="muted">{o.waiter || '—'}</td>
                <td className="muted">{(o.at || '').slice(11, 16)}</td>
                <td className="num"><b>{fmt(saleLines(o.lines) - num(o.discount) + num(o.serviceCharge) + num(o.tax), store.settings.currency)}</b></td>
                <td className="acts">
                  <button className="btn small" onClick={() => go('sale', { orderId: o.id })}>Open</button>
                  <button className="icon" title="Print bill" onClick={() => window.api.export.print({ html: receiptHtml(o, store.settings) })}>🖨</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}
