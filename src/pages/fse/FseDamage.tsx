import { useState } from 'react'
import { api, useAppState } from '../../api/store'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { Button, EmptyState, Field, Input, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { fmtDate, phoneOk } from '../../lib/format'
import type { DamageType } from '../../types'

export function FseDamage() {
  const loading = usePageLoad()
  const state = useAppState()
  const { employee } = useSession()
  const { push } = useToast()
  const mine = state.damageReports.filter((d) => d.employee_id === employee.employee_id)
  const [form, setForm] = useState({
    customer_name: '',
    contact_no: '',
    damage_type: 'Damaged' as DamageType,
    product_id: state.products[0]?.product_id ?? '',
    batch_id: '',
    qty: 1,
  })
  const [err, setErr] = useState('')
  const batches = state.batches.filter((b) => b.product_id === form.product_id)

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up mx-auto max-w-lg">
      <PageHeader kicker="Field" title="Damage / non-working" subtitle="Log stock you pick up from a retailer. Warehouse sees the trail." />
      <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
        <Field label="Retailer / customer">
          <Input className="min-h-12" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <Input className="min-h-12" value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select className="min-h-12" value={form.damage_type} onChange={(e) => setForm({ ...form, damage_type: e.target.value as DamageType })}>
            {['Not working', 'Expired', 'Damaged'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Product">
          <Select
            className="min-h-12"
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value, batch_id: '' })}
          >
            {state.products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Batch">
          <Select className="min-h-12" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
            <option value="">Select</option>
            {batches.map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_no}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Qty">
          <Input
            className="min-h-12 text-lg"
            type="number"
            min={1}
            inputMode="numeric"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 1 })}
          />
        </Field>
        {err ? <p className="text-sm text-blush">{err}</p> : null}
        <Button
          size="lg"
          className="w-full min-h-14"
          onClick={async () => {
            if (!form.customer_name.trim()) return setErr('Customer required')
            if (!phoneOk(form.contact_no)) return setErr('Valid 10-digit mobile')
            if (!form.batch_id) return setErr('Pick a batch')
            if (form.qty < 1) return setErr('Qty must be positive')
            setErr('')
            await api.saveDamage({ ...form, employee_id: employee.employee_id })
            push('Damage report filed')
            setForm({ ...form, customer_name: '', contact_no: '', qty: 1 })
          }}
        >
          Submit report
        </Button>
      </div>
      <h2 className="font-display mt-8 mb-3 text-xl">My recent reports</h2>
      {mine.length === 0 ? (
        <EmptyState title="None yet" body="Reports you file will list here." />
      ) : (
        <ul className="space-y-2">
          {mine.map((d) => (
            <li key={d.damage_id} className="rounded-xl border border-line bg-white p-3 text-sm">
              <p className="font-medium">{d.product_detail}</p>
              <p className="text-muted">
                {d.customer_name} · {d.damage_type} · qty {d.qty} · {fmtDate(d.report_date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
