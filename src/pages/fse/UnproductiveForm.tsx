import { useState } from 'react'
import { salesApi } from '../../api/sales'
import { ApiError } from '../../api/http'
import { Button, Field, Input, PageHeader, PageSkeleton, Textarea, usePageLoad } from '../../components/ui/primitives'
import { useToast } from '../../context/ToastContext'
import { toIsoDate } from '../../lib/format'

/** PDF §3 — Unproductive Form for FSE and Caller */
export function UnproductiveForm() {
  const loading = usePageLoad()
  const { push } = useToast()
  const [firm, setFirm] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [remarks, setRemarks] = useState('')
  const [visitDate, setVisitDate] = useState(toIsoDate(new Date()))
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!firm.trim() || !name.trim() || !phone.trim() || !remarks.trim() || !visitDate) {
      push('Firm, name, phone, remarks and date are required')
      return
    }
    setBusy(true)
    try {
      const res = await salesApi.createUnproductive({
        firm_name: firm.trim(),
        contact_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        address: address.trim() || undefined,
        remarks: remarks.trim(),
        visit_date: visitDate,
      })
      push(res.message)
      setFirm('')
      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
      setRemarks('')
      setVisitDate(toIsoDate(new Date()))
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        kicker="Field"
        title="Unproductive visit"
        subtitle="Log a visit with no order punched."
      />
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <Field label="Firm name">
          <Input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="Shop / firm" />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact person" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Date">
            <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
        </Field>
        <Field label="Address">
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </Field>
        <Field label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Why no order" />
        </Field>
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Save visit'}
        </Button>
      </div>
    </div>
  )
}
