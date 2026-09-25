import { useCallback, useEffect, useMemo, useState } from 'react'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { DataTable } from '../../components/ui/DataTable'
import { Button, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { inr } from '../../lib/format'
import { orderDetailDummy } from '../../data/ceoDummy'
import { downloadCsv, orderStatusBlocksAdvance, orderStatusLocked, orderStatusRowClass, statusLabel } from '../../lib/orderUi'
import { PaymentLedger } from '../../components/orders/PaymentLedger'

const CHAIN = ['confirmed', 'dispatcher', 'shipped', 'delivered', 'returned', 'cancelled'] as const

const NEXT: Record<string, string | null> = {
  confirmed: 'dispatcher',
  dispatcher: 'shipped',
  shipped: 'delivered',
  delivered: null,
  pending: 'confirmed',
  awaiting_expiry_claim: null,
  cancelled: null,
  returned: null,
}

export function OrderApprovals() {
  const loading = usePageLoad()
  const { apiUser, uiRole } = useSession()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'awaiting' | 'all'>('all')
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<ApiOrder | null>(null)
  const [busy, setBusy] = useState(false)

  /** Status / return changes: TL + Manager only (not admin/CEO, not FSE). */
  const canChangeStatus = apiUser.role === 'manager' || apiUser.role === 'tl'

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await salesApi.listOrders())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load orders')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(rows) ? rows : []
    return list
      .filter((o) => {
        if (filter === 'awaiting') return o.status === 'confirmed' || o.status === 'dispatcher' || o.status === 'shipped'
        return true
      })
      .filter((o) => {
        if (!s) return true
        return `${o.id} ${o.customer_name} ${o.firm_name} ${o.created_by_name} ${o.tl_name} ${o.payment_terms?.payment_type}`
          .toLowerCase()
          .includes(s)
      })
  }, [rows, q, filter])

  async function openOrder(order: ApiOrder) {
    setOpen(order)
    try {
      const detail = (await salesApi.getOrder(order.id)) as ApiOrder
      if (detail?.id) setOpen({ ...order, ...detail })
    } catch {
      /* list row is enough */
    }
  }

  async function advance(order: ApiOrder, status: string) {
    if (!canChangeStatus) {
      push('Only TL / Manager can change order status')
      return
    }
    if (orderStatusLocked(order.status)) {
      push('Status locked after returned / cancelled')
      return
    }
    if (order.status === 'delivered' && status !== 'returned') {
      push('After delivered, only return is allowed')
      return
    }
    setBusy(true)
    try {
      const res = await salesApi.changeStatus(order.id, status)
      push(res.message)
      await load()
      if (open?.id === order.id && res.order) setOpen(res.order)
      else if (open?.id === order.id) setOpen({ ...order, status })
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Status update failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  const kicker =
    uiRole === 'Sales Manager' ? 'Sales Manager' : uiRole === 'Admin' ? 'Admin' : apiUser.role === 'tl' ? 'Team Leader' : 'Orders'

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={kicker}
        title="Order desk"
        subtitle={
          apiUser.role === 'tl'
            ? 'Your FSE orders only. Chain: confirmed → shipped → delivered.'
            : 'All orders. After payment → confirmed → dispatcher → shipped → delivered.'
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Order, party, FSE…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${filter === 'awaiting' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setFilter('awaiting')}
        >
          In chain
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${filter === 'all' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setFilter('all')}
        >
          All orders
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            downloadCsv(
              `orders-${new Date().toISOString().slice(0, 10)}.csv`,
              ['Order ID', 'Party', 'FSE', 'TL', 'Payment', 'Value', 'Status'],
              filtered.map((o) => [
                o.id,
                o.firm_name || o.customer_name || '',
                o.created_by_name || '',
                o.tl_name || '',
                o.payment_terms?.payment_type || '',
                o.total_price,
                o.status,
              ]),
            )
          }
        >
          Download sheet
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-blush">{error}</p> : null}
      <DataTable
        rows={filtered}
        rowKey={(o) => o.id}
        rowClassName={(o) => orderStatusRowClass(o.status)}
        empty={<EmptyState title="No orders in this view" body="When FSE finishes payment terms, orders appear here." />}
        columns={[
          {
            key: 'id',
            header: 'Order ID',
            cell: (o) => (
              <button type="button" className="break-all text-left font-mono text-xs text-pine underline" onClick={() => setOpen(o)}>
                {o.id}
              </button>
            ),
          },
          {
            key: 'party',
            header: 'Party',
            cell: (o) => (
              <span>
                {o.firm_name || o.customer_name || '—'}
                <span className="block text-xs text-muted">{o.customer_detail?.city || o.customer_detail?.phone}</span>
              </span>
            ),
          },
          { key: 'fse', header: 'FSE', cell: (o) => o.created_by_name || '—' },
          { key: 'tl', header: 'TL', cell: (o) => o.tl_name || '—' },
          {
            key: 'pay',
            header: 'Pay',
            cell: (o) => (
              <span>
                {o.payment_terms?.payment_type || '—'}
                {o.payment_terms?.paid_amount != null ? (
                  <span className="block text-xs text-muted">
                    paid ₹{o.payment_terms.paid_amount} · pending ₹{o.payment_terms.pending_amount}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'v',
            header: 'Value',
            cell: (o) => inr(Number(o.total_price)),
            sort: (a, b) => Number(a.total_price) - Number(b.total_price),
          },
          {
            key: 'st',
            header: 'Status',
            cell: (o) => <span className="rounded-full bg-cream px-2 py-0.5 text-xs capitalize">{statusLabel(o.status)}</span>,
          },
          {
            key: 'a',
            header: '',
            cell: (o) => {
              const next = NEXT[o.status]
              const locked = orderStatusLocked(o.status)
              return (
                <div className="flex flex-wrap gap-1">
                  {canChangeStatus && next && !orderStatusBlocksAdvance(o.status) ? (
                    <Button size="sm" disabled={busy} onClick={() => void advance(o, next)}>
                      → {statusLabel(next)}
                    </Button>
                  ) : null}
                  {canChangeStatus && o.status === 'delivered' ? (
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void advance(o, 'returned')}>
                      Return
                    </Button>
                  ) : null}
                  {locked ? (
                    <span className="self-center text-[10px] text-muted">locked</span>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => void openOrder(o)}>
                    Open
                  </Button>
                </div>
              )
            },
          },
        ]}
      />

      <Modal open={!!open} onClose={() => setOpen(null)} title="Full order" wide>
        {open ? (
          <div className={`space-y-3 rounded-lg border p-2 text-sm ${orderStatusRowClass(open.status)}`}>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-cream/40 p-2.5 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-muted">Order ID</p>
                <p className="font-mono text-[10px] leading-tight text-muted">{open.id}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Customer</p>
                <p className="truncate text-sm font-medium leading-tight">
                  {open.customer_detail?.firm_name ||
                    open.customer_detail?.name ||
                    open.firm_name ||
                    open.customer_name ||
                    '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">FSE</p>
                <p className="truncate text-sm font-medium leading-tight">{open.created_by_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Delivery Partner</p>
                <p className="text-sm font-medium leading-tight">{orderDetailDummy.deliveryPartner}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Date punched</p>
                <p className="text-sm font-medium leading-tight">{orderDetailDummy.datePunched}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Status</p>
                <p className="text-sm font-medium capitalize leading-tight">{statusLabel(open.status)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <span>
                Total <span className="font-medium">{inr(Number(open.total_price))}</span>
                {open.payment_terms?.payment_type ? ` · ${open.payment_terms.payment_type}` : ''}
              </span>
              {open.payment_terms ? (
                <span>
                  Paid <span className="font-medium text-pine">{inr(Number(open.payment_terms.paid_amount || 0))}</span>
                  {' · '}
                  Pending{' '}
                  <span className="font-medium text-blush">{inr(Number(open.payment_terms.pending_amount || 0))}</span>
                </span>
              ) : null}
              {open.tl_name ? <span className="text-muted">TL {open.tl_name}</span> : null}
            </div>

            {open.payment_terms ? (
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Part payments</p>
                <PaymentLedger
                  orderId={open.id}
                  canRecord={apiUser.role === 'admin' || apiUser.role === 'manager' || apiUser.role === 'tl' || apiUser.role === 'fse' || apiUser.role === 'caller'}
                  onBalanceChange={(bal) => {
                    setOpen((prev) =>
                      prev
                        ? {
                            ...prev,
                            payment_terms: {
                              payment_type: bal.payment_type || prev.payment_terms?.payment_type || '',
                              total_amount: bal.total_amount,
                              advance_payment_cash: bal.advance_payment_cash || '0',
                              advance_payment_credits: bal.advance_payment_credits || '0',
                              paid_amount: bal.paid_amount,
                              pending_amount: bal.pending_amount,
                              payment_status: bal.payment_status || prev.payment_terms?.payment_status || 'pending',
                              receipt_count: bal.receipt_count,
                              upi_id: bal.upi_id,
                            },
                          }
                        : prev,
                    )
                    void load()
                  }}
                />
              </div>
            ) : null}

            {open.customer_detail ? (
              <div className="rounded-lg border border-line p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted">Customer detail</p>
                <p className="font-medium">{open.customer_detail.firm_name || open.customer_detail.name}</p>
                <p className="text-xs text-muted">
                  {open.customer_detail.phone}
                  {open.customer_detail.optional_phone ? ` / ${open.customer_detail.optional_phone}` : ''}
                </p>
                <p className="text-xs text-muted">
                  {[
                    open.customer_detail.landmark,
                    open.customer_detail.tehsil,
                    open.customer_detail.city,
                    open.customer_detail.district,
                    open.customer_detail.state,
                    open.customer_detail.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Sale lines</p>
              <ul className="space-y-1">
                {(open.items || []).map((i) => (
                  <li key={i.id} className="flex justify-between rounded-lg border border-line px-2.5 py-1.5">
                    <span>
                      {i.product_name || i.product}
                      <span className="block text-[11px] text-muted">
                        × {i.quantity} @ ₹{i.price}
                        {Number(i.claim_applied) > 0 ? ` · expiry ₹${i.claim_applied}` : ''}
                      </span>
                    </span>
                    <span>{inr(Number(i.amount))}</span>
                  </li>
                ))}
                {!open.items?.length ? <li className="text-xs text-muted">No sale lines</li> : null}
              </ul>
            </div>

            {open.has_expiry_claim ? (
              <p className="text-[11px] text-muted">
                Expiry total ₹{open.expiry_claim_total} · used ₹{open.expiry_claim_used} · left ₹
                {open.expiry_claim_remaining}
              </p>
            ) : null}

            {open.scheme_gifts?.length ? (
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Scheme gifts</p>
                <ul className="space-y-1">
                  {open.scheme_gifts.map((g, i) => (
                    <li key={g.id || `${g.scheme_id}-${i}`} className="rounded-lg border border-line px-2.5 py-1.5 text-sm">
                      {g.gift_qty}× {g.gift_name}
                      {g.scheme_name ? <span className="text-xs text-muted"> · {g.scheme_name}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {open.order_remarks ? <p className="text-[11px] text-muted">Remark: {open.order_remarks}</p> : null}

            {!canChangeStatus ? (
              <p className="text-xs text-muted">View only — TL / Manager change status.</p>
            ) : orderStatusLocked(open.status) ? (
              <p className="text-xs font-medium text-muted">Status locked — cannot change after returned / cancelled.</p>
            ) : open.status === 'delivered' ? (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void advance(open, 'returned')}>
                Mark returned (then locks)
              </Button>
            ) : (
              <>
                <Field label="Move status">
                  <Select
                    value={open.status}
                    onChange={(e) => void advance(open, e.target.value)}
                    disabled={busy}
                  >
                    {[open.status, ...CHAIN.filter((s) => s !== open.status)].map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {NEXT[open.status] ? (
                  <Button size="sm" disabled={busy} onClick={() => void advance(open, NEXT[open.status]!)}>
                    Advance → {statusLabel(NEXT[open.status]!)}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
