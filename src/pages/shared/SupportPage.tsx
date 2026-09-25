import { useCallback, useEffect, useState } from 'react'
import { opsApi } from '../../api/ops'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { Button, Field, Input, PageHeader, PageSkeleton, Textarea, usePageLoad } from '../../components/ui/primitives'

/** PDF §13 — Customer Support */
export function SupportPage() {
  const loading = usePageLoad()
  const { push } = useToast()
  const [rows, setRows] = useState<Awaited<ReturnType<typeof opsApi.listSupport>>>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [enquiry, setEnquiry] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await opsApi.listSupport()
      setRows(Array.isArray(list) ? list : [])
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!name.trim() || !phone.trim() || !enquiry.trim()) {
      push('Name, number and enquiry required')
      return
    }
    setBusy(true)
    try {
      await opsApi.createSupport({
        name: name.trim(),
        phone: phone.trim(),
        enquiry: enquiry.trim(),
        feedback: feedback.trim() || undefined,
      })
      push('Enquiry saved')
      setName('')
      setPhone('')
      setEnquiry('')
      setFeedback('')
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader kicker="Support" title="Customer support" subtitle="Name · Number · Enquiry · Feedback" />
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Number">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Enquiry">
          <Textarea rows={3} value={enquiry} onChange={(e) => setEnquiry(e.target.value)} />
        </Field>
        <Field label="Feedback">
          <Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
        <Button disabled={busy} onClick={() => void save()}>
          Save enquiry
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <p className="font-medium">
              {r.name} · {r.phone}
            </p>
            <p className="text-muted">{r.enquiry}</p>
            {r.feedback ? <p className="text-xs text-pine">{r.feedback}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
