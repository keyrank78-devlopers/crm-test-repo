import { useCallback, useEffect, useState } from 'react'
import { opsApi, type AttendanceRow, type LeaveRow } from '../../api/ops'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { Button, Field, Input, PageHeader, PageSkeleton, Textarea, usePageLoad } from '../../components/ui/primitives'
import { toIsoDate } from '../../lib/format'

/** PDF §14 — Working hours + leave apply */
export function HrmsPage() {
  const loading = usePageLoad()
  const { push } = useToast()
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [from, setFrom] = useState(toIsoDate(new Date()))
  const [to, setTo] = useState(toIsoDate(new Date()))
  const [reason, setReason] = useState('')
  const [hrEmail, setHrEmail] = useState('hr@freia.local')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, l] = await Promise.all([opsApi.listAttendance(), opsApi.listLeave()])
      setAttendance(Array.isArray(a) ? a : [])
      setLeaves(Array.isArray(l) ? l : [])
    } catch (err) {
      setAttendance([])
      setLeaves([])
      push(err instanceof ApiError ? err.message : 'Failed')
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  async function punch(action: 'login' | 'logout') {
    setBusy(true)
    try {
      const res = await opsApi.attendance(action)
      push(res.message)
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitLeave() {
    if (!reason.trim()) {
      push('Reason required')
      return
    }
    setBusy(true)
    try {
      const res = await opsApi.createLeave({ from_date: from, to_date: to, reason: reason.trim(), hr_email: hrEmail })
      push(res.message)
      setReason('')
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  const attendanceRows = Array.isArray(attendance) ? attendance : []
  const leaveRows = Array.isArray(leaves) ? leaves : []

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader kicker="HRMS" title="Working hours & leave" subtitle="Login / logout punches. Leave notifies HR email." />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void punch('login')}>
          Login punch
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void punch('logout')}>
          Logout punch
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/50 text-[10px] uppercase text-muted">
              <th className="px-2.5 py-1.5">Date</th>
              <th className="px-2.5 py-1.5">In</th>
              <th className="px-2.5 py-1.5">Out</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRows.slice(0, 14).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-2.5 py-1.5">{r.punch_date}</td>
                <td className="px-2.5 py-1.5 text-xs">{r.login_at ? new Date(r.login_at).toLocaleTimeString() : '—'}</td>
                <td className="px-2.5 py-1.5 text-xs">{r.logout_at ? new Date(r.logout_at).toLocaleTimeString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <p className="font-display text-base">Apply leave</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="HR email">
          <Input type="email" value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} />
        </Field>
        <Field label="Reason">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button disabled={busy} onClick={() => void submitLeave()}>
          Submit leave
        </Button>
      </div>

      <ul className="space-y-1 text-sm">
        {leaveRows.map((l) => (
          <li key={l.id} className="rounded-lg border border-line bg-white px-3 py-2">
            {l.from_date} → {l.to_date} · {l.status}
            <p className="text-xs text-muted">{l.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
