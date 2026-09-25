import { useCallback, useEffect, useState } from 'react'
import { salesApi, type ApiOrder } from '../../api/sales'
import { opsApi } from '../../api/ops'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { Button, Field, PageHeader, PageSkeleton, Select, Textarea, usePageLoad } from '../../components/ui/primitives'
import { inr } from '../../lib/format'

const TEMPLATES = [
  { value: 'standard', label: 'Standard tax invoice' },
  { value: 'retail', label: 'Retail / cash memo' },
  { value: 'credit', label: 'Credit note' },
  { value: 'proforma', label: 'Proforma' },
]

/** PDF §10 — Invoice creation (3–4 options) */
export function InvoicePage() {
  const loading = usePageLoad()
  const { push } = useToast()
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [rows, setRows] = useState<Awaited<ReturnType<typeof opsApi.listInvoices>>>([])
  const [orderId, setOrderId] = useState('')
  const [template, setTemplate] = useState('standard')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [o, inv] = await Promise.all([salesApi.listOrders(), opsApi.listInvoices()])
      const orderList = Array.isArray(o) ? o : []
      const invList = Array.isArray(inv) ? inv : []
      setOrders(orderList.slice(0, 80))
      setRows(invList)
      if (!orderId && orderList[0]) setOrderId(orderList[0].id)
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    }
  }, [push, orderId])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    if (!orderId) {
      push('Select an order')
      return
    }
    setBusy(true)
    try {
      const res = await opsApi.createInvoice({ order_id: orderId, template, notes })
      push(`${res.message} · ${res.invoice.invoice_no}`)
      setNotes('')
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader kicker="Accounts" title="Invoices" subtitle="Create invoice from order — pick one of four templates." />
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <Field label="Order">
          <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Select order</option>
            {(Array.isArray(orders) ? orders : []).map((o) => (
              <option key={o.id} value={o.id}>
                {(o.firm_name || o.customer_name || 'Order').slice(0, 28)} · {inr(Number(o.total_price))} · {o.status}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice type">
          <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button disabled={busy} onClick={() => void create()}>
          {busy ? 'Creating…' : 'Create invoice'}
        </Button>
      </div>
      <ul className="space-y-2">
        {(Array.isArray(rows) ? rows : []).map((r) => (
          <li key={r.id} className="flex justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{r.invoice_no}</p>
              <p className="text-xs text-muted">
                {r.template_label} · {r.order_id.slice(0, 8)}…
              </p>
            </div>
            <span>{inr(Number(r.amount))}</span>
          </li>
        ))}
        {!rows.length ? <p className="text-sm text-muted">No invoices yet.</p> : null}
      </ul>
    </div>
  )
}
