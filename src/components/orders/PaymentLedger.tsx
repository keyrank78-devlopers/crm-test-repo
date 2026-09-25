import { useCallback, useEffect, useRef, useState } from 'react'
import { salesApi, type PaymentBalance, type PaymentReceiptRow } from '../../api/sales'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { Button, Field, Input, Select } from '../ui/primitives'
import { inr } from '../../lib/format'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

type Props = {
  orderId: string
  /** When false, history is shown but record form is hidden */
  canRecord?: boolean
  onBalanceChange?: (balance: PaymentBalance) => void
}

export function PaymentLedger({ orderId, canRecord = true, onBalanceChange }: Props) {
  const { push } = useToast()
  const onBalRef = useRef(onBalanceChange)
  onBalRef.current = onBalanceChange
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState<PaymentBalance | null>(null)
  const [history, setHistory] = useState<PaymentReceiptRow[]>([])
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const res = await salesApi.getPayment(orderId)
      setBalance(res.balance)
      setHistory(res.history || [])
      onBalRef.current?.(res.balance)
      const pending = Number(res.balance?.pending_amount || 0)
      if (pending > 0) setAmount(String(pending))
      else setAmount('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payment history')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    const n = Number(amount)
    if (!n || n <= 0) {
      push('Enter a payment amount', 'err')
      return
    }
    setBusy(true)
    try {
      const res = await salesApi.recordPayment(orderId, {
        amount: n,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        received_at: receivedAt || undefined,
      })
      setBalance(res.balance)
      setHistory(res.history || [])
      onBalRef.current?.(res.balance)
      setReference('')
      setNotes('')
      const pending = Number(res.balance.pending_amount || 0)
      setAmount(pending > 0 ? String(pending) : '')
      push(res.message || 'Payment recorded')
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Could not record payment', 'err')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-muted">Loading payment history…</p>
  }

  if (error) {
    return <p className="text-sm text-blush">{error}</p>
  }

  if (!balance?.payment_type) {
    return <p className="text-xs text-muted">No payment terms set yet.</p>
  }

  const pending = Number(balance.pending_amount || 0)
  const paid = Number(balance.paid_amount || 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-cream/40 p-2.5 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Total</p>
          <p className="font-medium">{inr(Number(balance.total_amount || 0))}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Paid</p>
          <p className="font-medium text-pine">{inr(paid)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Pending</p>
          <p className="font-medium text-blush">{inr(pending)}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted">
        {balance.payment_type}
        {balance.receipt_count != null ? ` · ${balance.receipt_count} receipt${balance.receipt_count === 1 ? '' : 's'}` : ''}
      </p>

      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Payment history</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted">No receipts yet — record the first part below.</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {history.map((r) => (
              <li key={r.id} className="rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{inr(Number(r.amount))}</span>
                  <span className="text-xs capitalize text-muted">{r.method}</span>
                </div>
                <p className="text-[11px] text-muted">
                  {r.received_at || '—'}
                  {r.reference ? ` · ${r.reference}` : ''}
                  {r.recorded_by ? ` · ${r.recorded_by}` : ''}
                </p>
                {r.notes ? <p className="text-[11px] text-muted">{r.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canRecord && pending > 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-line p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted">Record part payment</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount (₹)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </Field>
            <Field label="Reference">
              <Input
                value={reference}
                placeholder="UTR / cheque no."
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Record payment'}
          </Button>
        </div>
      ) : null}

      {pending <= 0 ? <p className="text-xs font-medium text-pine">Fully paid</p> : null}
    </div>
  )
}
