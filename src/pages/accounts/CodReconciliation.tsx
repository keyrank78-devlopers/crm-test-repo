import { useEffect, useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { amountPending } from '../../lib/compute'
import { DataTable } from '../../components/ui/DataTable'
import { Button, Card, EmptyState, Field, Input, Kpi, Modal, PageHeader, PageSkeleton, PaymentBadge, StatusBadge, usePageLoad } from '../../components/ui/primitives'
import { fmtDate, inr, inrDec, toIsoDate } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import type { Order, Payment } from '../../types'

export function CodReconciliation() {
  const loading = usePageLoad()
  const state = useAppState()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [courier, setCourier] = useState('')
  const [payFor, setPayFor] = useState<{ order: Order; payment: Payment } | null>(null)

  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return state.payments
      .map((p) => {
        const order = state.orders.find((o) => o.order_id === p.order_id)!
        const dispatch = state.dispatches.find((d) => d.order_id === p.order_id)
        const customer = state.customers.find((c) => c.customer_id === order.customer_id)
        return { p, order, dispatch, customer, pending: amountPending(p) }
      })
      .filter((r) => r.order.payment_mode === 'COD' || r.order.payment_mode === 'Advance+COD' || r.order.payment_mode === 'Credit')
      .filter((r) => !courier || r.dispatch?.courier_name === courier)
      .filter((r) => !s || `${r.order.order_no} ${r.customer?.customer_name} ${r.dispatch?.docket_nos.join(' ')}`.toLowerCase().includes(s))
  }, [state, q, courier])

  const byCourier = useMemo(() => {
    const map = new Map<string, { orders: number; pending: number; received: number; returned: number }>()
    for (const r of rows) {
      const name = r.dispatch?.courier_name ?? 'Unassigned'
      const cur = map.get(name) ?? { orders: 0, pending: 0, received: 0, returned: 0 }
      cur.orders += 1
      cur.pending += r.pending
      cur.received += r.p.amount_received
      cur.returned += r.p.returned_value
      map.set(name, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].pending - a[1].pending)
  }, [rows])

  const totals = byCourier.reduce(
    (s, [, v]) => ({ pending: s.pending + v.pending, received: s.received + v.received, returned: s.returned + v.returned, orders: s.orders + v.orders }),
    { pending: 0, received: 0, returned: 0, orders: 0 },
  )
  const couriers = [...new Set(state.dispatches.map((d) => d.courier_name))]

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader kicker="Accounts" title="COD reconciliation" subtitle="Pending is always COD − received − returned. Courier totals recompute as you mark money in." />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Kpi label="COD orders" value={String(totals.orders)} />
        <Kpi label="Pending" value={inr(totals.pending)} alert={totals.pending > 0} />
        <Kpi label="Received" value={inr(totals.received)} />
        <Kpi label="Returned value" value={inr(totals.returned)} />
      </div>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {byCourier.map(([name, v]) => (
          <Card key={name} className={`p-4 ${courier === name ? 'ring-1 ring-pine' : ''}`}>
            <button type="button" className="w-full text-left" onClick={() => setCourier(courier === name ? '' : name)}>
              <p className="text-xs uppercase tracking-wider text-muted">{name}</p>
              <p className="font-display mt-1 text-xl">{inr(v.pending)} pending</p>
              <p className="text-xs text-muted">
                {v.orders} orders · in {inr(v.received)} · ret {inr(v.returned)}
              </p>
            </button>
          </Card>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <Input className="max-w-sm" placeholder="Order, customer, AWB" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-xl border border-line px-3 text-sm" value={courier} onChange={(e) => setCourier(e.target.value)}>
          <option value="">All couriers</option>
          {couriers.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.p.payment_id}
        empty={<EmptyState title="No COD rows" body="Prepaid and cash orders stay off this sheet." />}
        columns={[
          { key: 'o', header: 'Order', cell: (r) => r.order.order_no, sort: (a, b) => a.order.order_no.localeCompare(b.order.order_no) },
          { key: 'd', header: 'Date', cell: (r) => fmtDate(r.order.order_date), sort: (a, b) => a.order.order_date.localeCompare(b.order.order_date) },
          { key: 'c', header: 'Customer', cell: (r) => r.customer?.firm_name || r.customer?.customer_name },
          { key: 'cr', header: 'Courier', cell: (r) => r.dispatch?.courier_name ?? '—' },
          { key: 'awb', header: 'AWB', cell: (r) => r.dispatch?.docket_nos.join(', ') ?? '—' },
          { key: 'st', header: 'Delivery', cell: (r) => <StatusBadge status={r.order.delivery_status} /> },
          { key: 'cod', header: 'COD', cell: (r) => inrDec(r.p.cod_amount), sort: (a, b) => a.p.cod_amount - b.p.cod_amount },
          { key: 'rec', header: 'Received', cell: (r) => inrDec(r.p.amount_received) },
          { key: 'pen', header: 'Pending', cell: (r) => inrDec(r.pending), sort: (a, b) => a.pending - b.pending },
          { key: 'ret', header: 'Returned ₹', cell: (r) => inrDec(r.p.returned_value) },
          {
            key: 'a',
            header: '',
            cell: (r) =>
              r.pending > 0 ? (
                <Button size="sm" onClick={() => setPayFor({ order: r.order, payment: r.p })}>
                  Mark received
                </Button>
              ) : (
                <PaymentBadge mode="COD" />
              ),
          },
        ]}
      />
      <MarkReceivedModal
        row={payFor}
        onClose={() => setPayFor(null)}
        onSave={async (amt, date, cheque) => {
          await api.markPaymentReceived(payFor!.order.order_id, amt, date, cheque)
          push('Payment recorded — totals refreshed')
          setPayFor(null)
        }}
      />
    </div>
  )
}

function MarkReceivedModal({
  row,
  onClose,
  onSave,
}: {
  row: { order: Order; payment: Payment } | null
  onClose: () => void
  onSave: (amount: number, date: string, cheque: string) => Promise<void>
}) {
  const pending = row ? amountPending(row.payment) : 0
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(toIsoDate(new Date()))
  const [cheque, setCheque] = useState('')

  useEffect(() => {
    if (row) {
      setAmount(amountPending(row.payment))
      setDate(toIsoDate(new Date()))
      setCheque('')
    }
  }, [row])

  return (
    <Modal open={!!row} onClose={onClose} title={row ? `Receive · ${row.order.order_no}` : ''}>
      {row ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pending {inrDec(pending)}</p>
          <Field label="Amount received">
            <Input type="number" min={0.01} max={pending} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Received date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Cheque / UPI / ref">
            <Input value={cheque} onChange={(e) => setCheque(e.target.value)} />
          </Field>
          <Button
            className="w-full"
            onClick={() => {
              if (amount <= 0) return
              void onSave(amount, date, cheque)
            }}
          >
            Confirm
          </Button>
        </div>
      ) : null}
    </Modal>
  )
}
