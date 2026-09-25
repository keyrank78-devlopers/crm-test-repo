import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Customer, Dispatch, Order } from '../../types'
import { Input } from '../ui/primitives'

export function GlobalSearch({
  open,
  onClose,
  customers,
  orders,
  dispatches,
}: {
  open: boolean
  onClose: () => void
  customers: Customer[]
  orders: Order[]
  dispatches: Dispatch[]
}) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const s = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (s.length < 2) return { customers: [] as Customer[], orders: [] as Order[], dockets: [] as { order: Order; awb: string }[] }
    const custList = Array.isArray(customers) ? customers : []
    const orderList = Array.isArray(orders) ? orders : []
    const dispatchList = Array.isArray(dispatches) ? dispatches : []
    const cust = custList
      .filter((c) => [c.customer_name, c.firm_name, c.contact_no_1, c.village_city].join(' ').toLowerCase().includes(s))
      .slice(0, 6)
    const ords = orderList.filter((o) => o.order_no.toLowerCase().includes(s) || o.order_id.toLowerCase().includes(s)).slice(0, 8)
    const dockets: { order: Order; awb: string }[] = []
    const byOrder = new Map(orderList.map((o) => [o.order_id, o]))
    for (const d of dispatchList) {
      for (const awb of d.docket_nos || []) {
        if (awb.toLowerCase().includes(s)) {
          const o = byOrder.get(d.order_id)
          if (o) dockets.push({ order: o, awb })
        }
      }
      if (dockets.length >= 8) break
    }
    return { customers: cust, orders: ords, dockets }
  }, [s, customers, orders, dispatches])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 p-4" onClick={onClose}>
      <div className="mx-auto mt-16 max-w-xl rounded-2xl bg-paper p-4 shadow-card" onClick={(e) => e.stopPropagation()}>
        <Input autoFocus placeholder="Customers, order nos, AWB / docket…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
        <div className="mt-3 max-h-[60vh] space-y-3 overflow-auto text-sm">
          {s.length < 2 ? <p className="text-muted">Type at least 2 characters. Shortcut: Ctrl+K</p> : null}
          {results.customers.length > 0 && (
            <section>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Customers</p>
              {results.customers.map((c) => (
                <p key={c.customer_id} className="rounded-lg px-2 py-1.5 hover:bg-cream">
                  {c.firm_name || c.customer_name} · {c.village_city} · {c.contact_no_1}
                </p>
              ))}
            </section>
          )}
          {results.orders.length > 0 && (
            <section>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Orders</p>
              {results.orders.map((o) => (
                <button
                  type="button"
                  key={o.order_id}
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-cream"
                  onClick={() => {
                    nav('/admin/orders')
                    onClose()
                  }}
                >
                  {o.order_no} · {o.delivery_status}
                </button>
              ))}
            </section>
          )}
          {results.dockets.length > 0 && (
            <section>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Dockets</p>
              {results.dockets.map((d) => (
                <p key={d.awb} className="rounded-lg px-2 py-1.5 hover:bg-cream">
                  {d.awb} → {d.order.order_no}
                </p>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
