import { useCallback, useEffect, useMemo, useState } from 'react'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { DataTable } from '../../components/ui/DataTable'
import { Button, EmptyState, Input, Modal, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { inr } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'
import { orderDetailDummy } from '../../data/ceoDummy'
import { downloadCsv, orderStatusLocked, orderStatusRowClass, statusLabel } from '../../lib/orderUi'
import { PaymentLedger } from '../../components/orders/PaymentLedger'

export function SalesRegister({ employeeId, title }: { employeeId?: string; title?: string }) {
  const loading = usePageLoad(200)
  const { apiUser } = useSession()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<ApiOrder | null>(null)
  const [busy, setBusy] = useState(false)
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
    return list.filter((o) => {
      if (employeeId && String(o.user) !== String(employeeId) && o.created_by_name !== employeeId) return false
      if (status && o.status !== status) return false
      if (!s) return true
      return `${o.id} ${o.customer_name} ${o.firm_name} ${o.created_by_name} ${o.payment_terms?.payment_type}`
        .toLowerCase()
        .includes(s)
    })
  }, [rows, q, status, employeeId])

  async function setOrderStatus(order: ApiOrder, next: string) {
    if (!canChangeStatus) {
      push('Only TL / Manager can change order status')
      return
    }
    if (orderStatusLocked(order.status)) {
      push('Status locked after returned / cancelled')
      return
    }
    if (order.status === 'delivered' && next !== 'returned') {
      push('After delivered, only return is allowed')
      return
    }
    setBusy(true)
    try {
      const res = await salesApi.changeStatus(order.id, next)
      push(res.message)
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Register"
        title={title ?? 'Sales register'}
        subtitle={
          apiUser.role === 'tl'
            ? `${filtered.length} orders from your FSEs.`
            : `${rows.length} orders visible · admin/manager see all.`
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search order, customer, FSE" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
                  {['pending', 'awaiting_expiry_claim', 'confirmed', 'dispatcher', 'shipped', 'delivered', 'returned', 'cancelled'].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            downloadCsv(
              `sales-register-${new Date().toISOString().slice(0, 10)}.csv`,
              ['Order ID', 'Party', 'FSE', 'Payment', 'Value', 'Status'],
              filtered.map((o) => [
                o.id,
                o.firm_name || o.customer_name || '',
                o.created_by_name || '',
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
        pageSize={40}
        rowClassName={(o) => orderStatusRowClass(o.status)}
        empty={<EmptyState title="No orders match" body="Widen the filters or clear search." />}
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
            key: 'cust',
            header: 'Customer',
            cell: (o) => (
              <span>
                {o.firm_name || o.customer_name}
                <span className="block text-xs text-muted">{o.customer_detail?.city}</span>
              </span>
            ),
          },
          { key: 'emp', header: 'By', cell: (o) => o.created_by_name || '—' },
          { key: 'tl', header: 'TL', cell: (o) => o.tl_name || '—' },
          { key: 'pay', header: 'Pay', cell: (o) => o.payment_terms?.payment_type || '—' },
          {
            key: 'paid',
            header: 'Paid',
            cell: (o) => (o.payment_terms ? inr(Number(o.payment_terms.paid_amount || 0)) : '—'),
          },
          {
            key: 'pend',
            header: 'Pending',
            cell: (o) => (o.payment_terms ? inr(Number(o.payment_terms.pending_amount || 0)) : '—'),
          },
          {
            key: 'val',
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
            key: 'act',
            header: '',
            cell: (o) => (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setOpen(o)}>
                  Open
                </Button>
                {canChangeStatus && !orderStatusLocked(o.status) && o.status === 'confirmed' ? (
                  <Button size="sm" disabled={busy} onClick={() => void setOrderStatus(o, 'shipped')}>
                    Ship
                  </Button>
                ) : null}
                {canChangeStatus && !orderStatusLocked(o.status) && o.status === 'shipped' ? (
                  <Button size="sm" disabled={busy} onClick={() => void setOrderStatus(o, 'delivered')}>
                    Deliver
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <Modal open={!!open} onClose={() => setOpen(null)} title="Order detail" wide>
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
                  {open.firm_name || open.customer_name || '—'}
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
            <p className="text-xs">
              {inr(Number(open.total_price))}
              {open.payment_terms?.payment_type ? ` · ${open.payment_terms.payment_type}` : ''}
              {open.tl_name ? ` · TL ${open.tl_name}` : ''}
            </p>
            {open.payment_terms ? (
              <PaymentLedger
                orderId={open.id}
                canRecord={
                  apiUser.role === 'admin' ||
                  apiUser.role === 'manager' ||
                  apiUser.role === 'tl' ||
                  apiUser.role === 'fse' ||
                  apiUser.role === 'caller'
                }
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
            ) : null}
            <ul className="space-y-1">
              {(open.items || []).map((i) => (
                <li key={i.id} className="flex justify-between rounded-lg border border-line px-2.5 py-1.5">
                  <span>
                    {i.product_name} × {i.quantity}
                  </span>
                  <span>{inr(Number(i.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
