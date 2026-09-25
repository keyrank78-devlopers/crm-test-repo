import { useCallback, useEffect, useMemo, useState } from 'react'
import { customersApi, type ApiCustomer } from '../../api/customers'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { DataTable } from '../../components/ui/DataTable'
import { Badge, EmptyState, Input, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import { inr, inrDec } from '../../lib/format'
import { orderStatusRowClass, statusLabel } from '../../lib/orderUi'

function levelLabel(n: number) {
  if (n <= 0) return 'New'
  if (n === 1) return 'L1'
  if (n === 2) return 'L2'
  if (n === 3) return 'L3'
  return `L${n}`
}

export function CustomerDesk() {
  const loading = usePageLoad()
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<ApiCustomer[]>([])
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [c, o] = await Promise.all([customersApi.list(), salesApi.listOrders().catch(() => [] as ApiOrder[])])
      setCustomers(c)
      setOrders(o)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = Array.isArray(customers) ? customers : []
    const list = !s
      ? base
      : base.filter((c) =>
          `${c.name} ${c.firm_name} ${c.phone} ${c.city} ${c.district} ${c.pincode}`
            .toLowerCase()
            .includes(s),
        )
    return list.slice(0, 60)
  }, [customers, q])

  const customer = selectedId ? (Array.isArray(customers) ? customers : []).find((c) => c.id === selectedId) : undefined

  const customerOrders = useMemo(() => {
    if (!customer) return []
    const list = Array.isArray(orders) ? orders : []
    return list
      .filter((o) => o.customer === customer.id)
      .sort((a, b) => String(b.created_at || b.order_date || '').localeCompare(String(a.created_at || a.order_date || '')))
  }, [orders, customer])

  const payments = useMemo(() => {
    let received = 0
    let pending = 0
    let returned = 0
    for (const o of customerOrders) {
      if (o.payment_terms) {
        received += Number(o.payment_terms.paid_amount || 0)
        pending += Number(o.payment_terms.pending_amount || 0)
      }
      if (o.status === 'returned') returned += Number(o.total_price) || 0
    }
    return { received, pending, returned }
  }, [customerOrders])

  const orderCount = customerOrders.length
  const level = customer ? levelLabel(customer.level ?? orderCount) : 'New'

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="CRM"
        title="Customer 360"
        subtitle="Live customers from API — level, orders, payments in one place."
      />
      {error ? <p className="mb-3 text-sm text-blush">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <Input
            className="mb-3"
            placeholder="Search name, firm, mobile, city, PIN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="max-h-[70vh] space-y-1 overflow-auto rounded-2xl border border-line bg-white p-2">
            {matches.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">
                {customers.length === 0 ? 'No customers from API yet' : 'No customers match'}
              </li>
            ) : (
              matches.map((c) => {
                const n = orders.filter((o) => o.customer === c.id).length
                const active = selectedId === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                        active ? 'bg-pine text-cream' : 'hover:bg-cream'
                      }`}
                    >
                      <span className="block text-sm font-medium">{c.firm_name || c.name}</span>
                      <span className={`mt-0.5 block text-xs ${active ? 'text-cream/75' : 'text-muted'}`}>
                        {c.phone || 'No phone'} · {c.city} · {n} orders · {levelLabel(c.level ?? n)}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        {!customer ? (
          <EmptyState title="Select a customer" body="Pick someone from the list to open their 360 view." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-pine/20 bg-pine/5 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Party</p>
              <p className="font-display mt-1 text-2xl text-pine">{customer.firm_name || customer.name}</p>
              <p className="mt-1 text-sm text-muted">
                {customer.name}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
              <p className="mt-1 text-sm text-muted">
                {[customer.landmark, customer.tehsil, customer.city, customer.district, customer.state, customer.pincode]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-pine/10 text-pine ring-pine/25">{level}</Badge>
                <Badge className="bg-cream text-ink ring-line">{orderCount} orders</Badge>
                <Badge className="bg-cream text-ink ring-line">{customer.customer_type}</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">Received</p>
                <p className="font-display text-xl">{inrDec(payments.received)}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">Pending</p>
                <p className="font-display text-xl">{inrDec(payments.pending)}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">Returned value</p>
                <p className="font-display text-xl">{inrDec(payments.returned)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Orders</p>
              <DataTable
                rows={customerOrders}
                rowKey={(o) => o.id}
                rowClassName={(o) => orderStatusRowClass(o.status)}
                empty={<EmptyState title="No orders" body="This party has not ordered yet." />}
                columns={[
                  {
                    key: 'no',
                    header: 'Order',
                    cell: (o) => <span className="font-mono text-[10px]">{o.id.slice(0, 8)}…</span>,
                  },
                  {
                    key: 'd',
                    header: 'Date',
                    cell: (o) => (o.order_date || o.created_at || '—').toString().slice(0, 10),
                  },
                  { key: 'v', header: 'Value', cell: (o) => inr(Number(o.total_price)) },
                  { key: 'p', header: 'Pay', cell: (o) => o.payment_terms?.payment_type || o.payment_type || '—' },
                  {
                    key: 's',
                    header: 'Status',
                    cell: (o) => <span className="text-xs capitalize">{statusLabel(o.status)}</span>,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
