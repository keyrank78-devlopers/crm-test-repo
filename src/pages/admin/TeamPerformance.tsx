import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../api/store'
import { performanceFor } from '../../lib/compute'
import { inr, num, toIsoDate } from '../../lib/format'
import { DataTable } from '../../components/ui/DataTable'
import { Card, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'

export function TeamPerformance() {
  const loading = usePageLoad()
  const state = useAppState()
  const nav = useNavigate()
  const to = toIsoDate(new Date())
  const from = toIsoDate(new Date(Date.now() - 30 * 86400000))
  const [range, setRange] = useState({ from, to })
  const leaders = state.employees.filter((e) => e.role === 'Team Leader')

  const rows = useMemo(() => {
    return performanceFor(state, null, range.from, range.to)
      .map((p) => {
        const emp = state.employees.find((e) => e.employee_id === p.employee_id)!
        const leader = emp.team_leader_id ? state.employees.find((e) => e.employee_id === emp.team_leader_id) : emp.role === 'Team Leader' ? emp : undefined
        return { ...p, emp, leaderName: leader?.employee_name ?? '—', city: emp.city_area }
      })
      .filter((r) => ['FSE', 'Office Staff', 'TSR', 'ASM', 'Team Leader'].includes(r.emp.role))
      .sort((a, b) => b.total_sale - a.total_sale)
  }, [state, range])

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Leaderboard"
        title="Team / city / name"
        subtitle="Mirrors the old Team Leader report. Totals recompute from the live order book."
        actions={
          <div className="flex gap-2">
            <input type="date" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <input type="date" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {leaders.map((l) => (
          <Card key={l.employee_id} className="px-4 py-3">
            <p className="text-xs text-muted">{l.city_area}</p>
            <p className="font-medium">{l.employee_name}</p>
          </Card>
        ))}
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.employee_id}
        columns={[
          { key: 'tl', header: 'Team leader', cell: (r) => r.leaderName, sort: (a, b) => a.leaderName.localeCompare(b.leaderName) },
          { key: 'city', header: 'City-area', cell: (r) => r.city },
          { key: 'name', header: 'Name', cell: (r) => (
            <button type="button" className="text-pine underline" onClick={() => nav(`/leader/member/${r.employee_id}`)}>
              {r.emp.employee_name}
            </button>
          ) },
          { key: 'orders', header: 'Total orders', cell: (r) => num(r.total_order), sort: (a, b) => a.total_order - b.total_order },
          { key: 'sale', header: 'Total sale', cell: (r) => inr(r.total_sale), sort: (a, b) => a.total_sale - b.total_sale },
          { key: 'del', header: 'Delivered', cell: (r) => `${r.no_delivered} · ${inr(r.amount_delivered)}` },
          { key: 'ret', header: 'Return', cell: (r) => `${r.no_return} · ${inr(r.amount_return)}` },
          { key: 'reo', header: 'Reorder', cell: (r) => String(r.no_reorder) },
          { key: 'pct', header: 'Return %', cell: (r) => `${r.return_pct}%`, sort: (a, b) => a.return_pct - b.return_pct },
        ]}
      />
    </div>
  )
}
