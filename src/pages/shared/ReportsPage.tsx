import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { Card, Field, Input, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { inr, num, toIsoDate } from '../../lib/format'
import { useSession } from '../../context/SessionContext'

type Period = 'daily' | 'monthly' | 'range'

function dayKey(o: ApiOrder) {
  return (o.order_date || o.created_at || '').slice(0, 10)
}

/** PDF §5–6 — Manager / TL reports: team, returns, sales, daily/monthly/period */
export function ReportsPage() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [period, setPeriod] = useState<Period>('daily')
  const [from, setFrom] = useState(toIsoDate(new Date()))
  const [to, setTo] = useState(toIsoDate(new Date()))
  const [person, setPerson] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setOrders(await salesApi.listOrders())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const scoped = useMemo(() => {
    let list = Array.isArray(orders) ? orders : []
    const today = toIsoDate(new Date())
    const month = today.slice(0, 7)
    if (period === 'daily') list = list.filter((o) => dayKey(o) === from)
    else if (period === 'monthly') list = list.filter((o) => dayKey(o).startsWith(from.slice(0, 7) || month))
    else list = list.filter((o) => {
      const d = dayKey(o)
      return d >= from && d <= to
    })
    if (person) {
      list = list.filter((o) => (o.created_by_name || '') === person || String(o.created_by_name) === person)
    }
    return list
  }, [orders, period, from, to, person])

  const stats = useMemo(() => {
    const sales = scoped.reduce((s, o) => s + Number(o.total_price || 0), 0)
    const returned = scoped.filter((o) => o.status === 'returned')
    const punched = scoped.length
    const byPerson: Record<string, { name: string; punch: number; sales: number; returns: number }> = {}
    for (const o of scoped) {
      const name = o.created_by_name || 'Unknown'
      if (!byPerson[name]) byPerson[name] = { name, punch: 0, sales: 0, returns: 0 }
      byPerson[name].punch += 1
      byPerson[name].sales += Number(o.total_price || 0)
      if (o.status === 'returned') byPerson[name].returns += 1
    }
    return { sales, punched, returns: returned.length, byPerson: Object.values(byPerson) }
  }, [scoped])

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <PageHeader
        kicker={apiUser.role === 'tl' ? 'TL' : 'Manager'}
        title="Reports"
        subtitle="Team orders, sales, returns — daily, monthly, or selected period."
        actions={
          <Link to="/returns" className="text-xs text-pine underline">
            Returns
          </Link>
        }
      />
      {error ? <p className="text-sm text-blush">{error}</p> : null}

      <Card className="grid gap-3 p-3 sm:grid-cols-4">
        <Field label="Period">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="range">Selected period</option>
          </Select>
        </Field>
        <Field label={period === 'monthly' ? 'Month (any day)' : 'From'}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        {period === 'range' ? (
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Person">
          <Select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">All team</option>
            {Array.from(new Set((Array.isArray(orders) ? orders : []).map((o) => o.created_by_name).filter(Boolean) as string[])).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Orders punched</p>
          <p className="font-display text-2xl">{num(stats.punched)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Sales amount</p>
          <p className="font-display text-2xl">{inr(stats.sales)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Returns</p>
          <p className="font-display text-2xl">{num(stats.returns)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">People</p>
          <p className="font-display text-2xl">{num(stats.byPerson.length)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-3 py-2">
          <h2 className="font-display text-base">Person-wise</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/50 text-[10px] uppercase tracking-wider text-muted">
              <th className="px-3 py-1.5">Name</th>
              <th className="px-3 py-1.5">Punch</th>
              <th className="px-3 py-1.5">Sales</th>
              <th className="px-3 py-1.5">Returns</th>
            </tr>
          </thead>
          <tbody>
            {stats.byPerson.map((p) => (
              <tr key={p.name} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-3 py-1.5">{p.punch}</td>
                <td className="px-3 py-1.5">{inr(p.sales)}</td>
                <td className="px-3 py-1.5">{p.returns}</td>
              </tr>
            ))}
            {!stats.byPerson.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted">
                  No data for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
