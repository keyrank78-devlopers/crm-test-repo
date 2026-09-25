import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../api/store'
import { useSession } from '../../context/SessionContext'
import { performanceFor, teamMemberIds } from '../../lib/compute'
import { inr, num, toIsoDate } from '../../lib/format'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'

export function LeaderPerformance() {
  const loading = usePageLoad()
  const state = useAppState()
  const { employee } = useSession()
  const nav = useNavigate()
  const ids = teamMemberIds(state, employee.employee_id)
  const from = toIsoDate(new Date(Date.now() - 30 * 86400000))
  const to = toIsoDate(new Date())

  const rows = useMemo(() => {
    return performanceFor(state, ids, from, to)
      .map((p) => ({ ...p, emp: state.employees.find((e) => e.employee_id === p.employee_id)! }))
      .filter((r) => r.employee_id !== employee.employee_id)
      .sort((a, b) => b.total_sale - a.total_sale)
  }, [state, ids, from, to, employee.employee_id])

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader kicker={employee.employee_name} title="Team performance" subtitle="FSE vs office split, reorders and return % for your people only." />
      <DataTable
        rows={rows}
        rowKey={(r) => r.employee_id}
        columns={[
          {
            key: 'n',
            header: 'Name',
            cell: (r) => (
              <button type="button" className="text-pine underline" onClick={() => nav(`/leader/member/${r.employee_id}`)}>
                {r.emp.employee_name}
              </button>
            ),
          },
          { key: 'role', header: 'Role', cell: (r) => r.emp.role },
          { key: 'o', header: 'Orders', cell: (r) => num(r.total_order), sort: (a, b) => a.total_order - b.total_order },
          { key: 's', header: 'Sale', cell: (r) => inr(r.total_sale), sort: (a, b) => a.total_sale - b.total_sale },
          { key: 'fse', header: 'FSE sale', cell: (r) => `${r.fse_total_order} · ${inr(r.fse_sale)}` },
          { key: 'off', header: 'Office sale', cell: (r) => `${r.office_staff_total_order} · ${inr(r.office_staff_sale)}` },
          { key: 'reo', header: 'Reorder', cell: (r) => String(r.no_reorder) },
          { key: 'ret', header: 'Return', cell: (r) => `${r.no_return} (${r.return_pct}%)` },
        ]}
      />
    </div>
  )
}
