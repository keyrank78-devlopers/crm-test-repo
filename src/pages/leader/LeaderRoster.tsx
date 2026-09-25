import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useAppState } from '../../api/store'
import { useSession } from '../../context/SessionContext'
import { teamMemberIds } from '../../lib/compute'
import { toIsoDate } from '../../lib/format'
import { Button, Card, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import type { AttendanceMark } from '../../types'

const MARKS: AttendanceMark[] = ['Present', 'Absent', 'Half day', 'Leave']

export function LeaderRoster() {
  const loading = usePageLoad()
  const state = useAppState()
  const { employee } = useSession()
  const nav = useNavigate()
  const today = toIsoDate(new Date())
  const ids = teamMemberIds(state, employee.employee_id)
  const members = state.employees.filter((e) => ids.includes(e.employee_id) && e.employee_id !== employee.employee_id)

  const marks = useMemo(() => {
    const m = new Map<string, AttendanceMark>()
    state.attendance.filter((a) => a.report_date === today).forEach((a) => m.set(a.employee_id, a.attendance))
    return m
  }, [state.attendance, today])

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader kicker={`${employee.city_area} team`} title="Roster & attendance" subtitle="Toggle today's attendance. Names drill into that person's orders." />
      <div className="grid gap-3 md:grid-cols-2">
        {members.map((m) => (
          <Card key={m.employee_id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl">{m.employee_name}</p>
                <p className="text-sm text-muted">
                  {m.role} · {m.city_area}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => nav(`/leader/member/${m.employee_id}`)}>
                Orders
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {MARKS.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  onClick={() => void api.setAttendance(m.employee_id, today, mark)}
                  className={`rounded-full px-3 py-1.5 text-xs ${marks.get(m.employee_id) === mark ? 'bg-pine text-cream' : 'bg-cream text-muted'}`}
                >
                  {mark}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
