import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { salesApi, type ApiOrder } from '../../api/sales'
import { dashboardApi, type DashboardPulse } from '../../api/dashboard'
import { accountsApi } from '../../api/accounts'
import { ApiError, type ApiUser } from '../../api/http'
import { inr, num, toIsoDate } from '../../lib/format'
import { Card, Field, Input, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import { dashboardForDate, teamDummy } from '../../data/ceoDummy'
import { useSession } from '../../context/SessionContext'
import { orderStatusRowClass } from '../../lib/orderUi'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  tl: 'TL',
  fse: 'FSE',
  caller: 'Caller',
  dispatcher: 'Dispatch',
  inventory: 'Warehouse',
}

function MiniStat({
  label,
  value,
  alert,
}: {
  label: string
  value: string
  alert?: boolean
}) {
  return (
    <div className={`rounded-md border border-line bg-white px-2.5 py-2 ${alert ? 'ring-1 ring-blush/25' : ''}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight text-ink">{value}</p>
    </div>
  )
}

function Section({
  title,
  totalLabel = 'Total',
  total,
  action,
  children,
}: {
  title: string
  totalLabel?: string
  total: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base leading-none">{title}</h2>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted">{totalLabel}</p>
          <p className="font-display text-2xl leading-tight text-ink">{total}</p>
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function isCompletePulse(pulse: DashboardPulse | null): pulse is DashboardPulse {
  return !!(
    pulse &&
    pulse.orders &&
    pulse.revenue &&
    pulse.products &&
    pulse.team &&
    pulse.expiry
  )
}

function pulseOrFallback(date: string, pulse: DashboardPulse | null) {
  if (isCompletePulse(pulse)) {
    return {
      orders: {
        delivered: pulse.orders.delivered ?? 0,
        dispatching: pulse.orders.dispatching ?? 0,
        inTransit: pulse.orders.in_transit ?? 0,
        returned: pulse.orders.returned ?? 0,
        total: pulse.orders.total ?? 0,
      },
      revenue: {
        delivered: pulse.revenue.delivered ?? 0,
        dispatching: pulse.revenue.dispatching ?? 0,
        inTransit: pulse.revenue.in_transit ?? 0,
        returned: pulse.revenue.returned ?? 0,
        total: pulse.revenue.total ?? 0,
      },
      products: {
        inStock: pulse.products.in_stock ?? 0,
        purchase: pulse.products.new_purchase ?? 0,
        stockOut: pulse.products.stock_out ?? 0,
        outOfStock: pulse.products.out_of_stock ?? 0,
        total: pulse.products.total ?? 0,
      },
      people: {
        office: pulse.team.managers ?? 0,
        tlManager: pulse.team.tl ?? 0,
        fseCaller: pulse.team.fse_caller ?? 0,
        total: pulse.team.total ?? 0,
      },
      expiry: {
        open: pulse.expiry.open ?? 0,
        pendingValue: pulse.expiry.pending_mrp ?? 0,
        closedThisMonth: pulse.expiry.closed_this_month ?? 0,
        total: pulse.expiry.total_cases ?? 0,
      },
      live: true as const,
    }
  }
  const d = dashboardForDate(date)
  return {
    orders: {
      ...d.orders,
      total: d.orders.delivered + d.orders.dispatching + d.orders.inTransit + d.orders.returned,
    },
    revenue: {
      ...d.revenue,
      total: d.revenue.delivered + d.revenue.dispatching + d.revenue.inTransit + d.revenue.returned,
    },
    products: {
      ...d.products,
      total: d.products.inStock + d.products.purchase + d.products.stockOut + d.products.outOfStock,
    },
    people: {
      ...d.people,
      total: d.people.office + d.people.tlManager + d.people.fseCaller,
    },
    expiry: {
      ...d.expiry,
      total: d.expiry.open + d.expiry.closedThisMonth,
    },
    live: false as const,
  }
}

function orderDay(o: ApiOrder) {
  const raw = o.order_date || o.created_at || ''
  return raw.slice(0, 10)
}

function dailyFromOrders(orders: ApiOrder[], date: string) {
  const list = Array.isArray(orders) ? orders : []
  const day = list.filter((o) => orderDay(o) === date)
  const punched = day.length
  const sales = day.reduce((s, o) => s + Number(o.total_price || 0), 0)
  const delivered = day.filter((o) => o.status === 'delivered').length
  const dispatchTransit = day.filter((o) => o.status === 'dispatcher' || o.status === 'shipped').length
  const returned = day.filter((o) => o.status === 'returned').length
  return { punched, sales, delivered, dispatchTransit, returned }
}

export function AdminDashboard() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [team, setTeam] = useState<ApiUser[]>([])
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(toIsoDate(new Date()))
  const [dateTo, setDateTo] = useState(toIsoDate(new Date()))
  const [pulse, setPulse] = useState<DashboardPulse | null>(null)

  const viewDate = dateTo || dateFrom

  const load = useCallback(async () => {
    setError('')
    try {
      const [orders, pulseRes, users] = await Promise.all([
        salesApi.listOrders(),
        dashboardApi.pulse(viewDate).catch(() => null),
        accountsApi.listUsers().catch(() => [] as ApiUser[]),
      ])
      setRows(Array.isArray(orders) ? orders : [])
      setPulse(isCompletePulse(pulseRes) ? pulseRes : null)
      setTeam(Array.isArray(users) ? users : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    }
  }, [viewDate])

  useEffect(() => {
    void load()
  }, [load])

  const recent = useMemo(() => (Array.isArray(rows) ? rows : []).slice(0, 8), [rows])
  const d = useMemo(() => pulseOrFallback(viewDate, pulse), [viewDate, pulse])
  const daily = useMemo(() => dailyFromOrders(rows, viewDate), [rows, viewDate])

  const teamRows = useMemo(() => {
    const list = Array.isArray(team) ? team : []
    if (list.length) {
      return list
        .filter((u) => u.is_active)
        .slice(0, 12)
        .map((u) => ({
          id: String(u.id),
          name: `${u.first_name} ${u.last_name}`.trim() || u.email,
          role: ROLE_LABEL[u.role] || u.role,
          phone: u.phone_number || '—',
          status: u.is_active ? 'Active' : 'Off',
        }))
    }
    return teamDummy.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      phone: t.phone,
      status: 'Active',
    }))
  }, [team])

  const rangeLabel =
    dateFrom === dateTo ? viewDate : `${dateFrom} → ${dateTo}`

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up space-y-3">
      {/* CEO Hero — PDF §1 */}
      <section className="relative overflow-hidden rounded-xl border border-line bg-pine text-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, #c5d6b8 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, #c4a574 0%, transparent 50%)',
          }}
        />
        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-moss">FREIA Skincare</p>
            <h1 className="font-display mt-1 text-2xl leading-tight sm:text-3xl">Company pulse</h1>
            <p className="mt-1.5 max-w-xl text-sm text-cream/80">
              {d.live
                ? `Live business pulse for ${rangeLabel} · ${num(d.orders.total)} orders · ${inr(d.revenue.total)} revenue`
                : `Sample pulse for ${rangeLabel} · connect pulse API for live totals`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From">
              <Input
                type="date"
                className="w-[9.5rem] border-cream/20 bg-pine/40 py-1.5 text-sm text-cream"
                value={dateFrom}
                onChange={(e) => {
                  const v = e.target.value || toIsoDate(new Date())
                  setDateFrom(v)
                  if (v > dateTo) setDateTo(v)
                }}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                className="w-[9.5rem] border-cream/20 bg-pine/40 py-1.5 text-sm text-cream"
                value={dateTo}
                onChange={(e) => {
                  const v = e.target.value || toIsoDate(new Date())
                  setDateTo(v)
                  if (v < dateFrom) setDateFrom(v)
                }}
              />
            </Field>
            <Link
              to="/approvals"
              className="inline-flex items-center rounded-md bg-cream px-3 py-2 text-xs font-medium text-pine hover:bg-paper"
            >
              Order desk
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-blush">{error}</p> : null}

      {/* Daily activity strip — PDF §1 */}
      <Card className="p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base leading-none">Daily activity</h2>
          <p className="text-[10px] uppercase tracking-wider text-muted">{viewDate}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MiniStat label="Sales (₹)" value={inr(daily.sales || d.revenue.total)} />
          <MiniStat label="Orders punched" value={num(daily.punched || d.orders.total)} />
          <MiniStat label="Delivered" value={num(daily.delivered || d.orders.delivered)} />
          <MiniStat label="Dispatch / in-transit" value={num(daily.dispatchTransit || d.orders.dispatching + d.orders.inTransit)} />
          <MiniStat
            label="Returns"
            value={num(daily.returned || d.orders.returned)}
            alert={(daily.returned || d.orders.returned) > 0}
          />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Orders" total={num(d.orders.total)}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Delivered" value={num(d.orders.delivered)} />
            <MiniStat label="Dispatching" value={num(d.orders.dispatching)} />
            <MiniStat label="In-transit" value={num(d.orders.inTransit)} />
            <MiniStat label="Returned" value={num(d.orders.returned)} alert={d.orders.returned > 0} />
          </div>
        </Section>

        <Section title="Revenue" totalLabel="Revenue total" total={inr(d.revenue.total)}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Delivered" value={inr(d.revenue.delivered)} />
            <MiniStat label="Dispatching" value={inr(d.revenue.dispatching)} />
            <MiniStat label="In-transit" value={inr(d.revenue.inTransit)} />
            <MiniStat label="Returned" value={inr(d.revenue.returned)} alert={d.revenue.returned > 0} />
          </div>
        </Section>

        <Section
          title="Products"
          totalLabel="Total products"
          total={num(d.products.total)}
          action={
            <Link to="/warehouse/ledger" className="text-xs text-pine underline">
              Stock
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="In Stock" value={num(d.products.inStock)} />
            <MiniStat label="New purchase" value={num(d.products.purchase)} />
            <MiniStat label="Stock Out" value={num(d.products.stockOut)} />
            <MiniStat label="Out of Stock" value={num(d.products.outOfStock)} alert={d.products.outOfStock > 0} />
          </div>
        </Section>

        <Section title="Expiry" totalLabel="Total cases" total={num(d.expiry.total)}>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Open" value={num(d.expiry.open)} />
            <MiniStat label="Pending MRP" value={inr(d.expiry.pendingValue)} alert />
            <MiniStat label="Closed this month" value={num(d.expiry.closedThisMonth)} />
          </div>
        </Section>

        <Section
          title="Team"
          totalLabel="Total team"
          total={num(d.people.total || teamRows.length)}
          action={
            <Link to="/admin/employees" className="text-xs text-pine underline">
              Manage
            </Link>
          }
        >
          <div className="mb-2 grid grid-cols-3 gap-2">
            <MiniStat label="Managers" value={num(d.people.office)} />
            <MiniStat label="TL" value={num(d.people.tlManager)} />
            <MiniStat label="FSE/Caller" value={num(d.people.fseCaller)} />
          </div>
        </Section>

        {/* Grandeur-style team list — replaces Cities (PDF §1) */}
        <Card className="p-3">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-base leading-none">Team roster</h2>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                {team.length ? 'Live users' : 'Sample · connect accounts'}
              </p>
            </div>
            <Link to="/admin/inventories" className="text-xs text-muted underline">
              City stock
            </Link>
          </div>
          <div className="overflow-hidden rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/60 text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-2.5 py-1.5 font-medium">Name</th>
                  <th className="px-2.5 py-1.5 font-medium">Role</th>
                  <th className="hidden px-2.5 py-1.5 font-medium sm:table-cell">Phone</th>
                  <th className="px-2.5 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-cream/40">
                    <td className="px-2.5 py-1.5 font-medium text-ink">{t.name}</td>
                    <td className="px-2.5 py-1.5 text-muted">{t.role}</td>
                    <td className="hidden px-2.5 py-1.5 tabular-nums text-muted sm:table-cell">{t.phone}</td>
                    <td className="px-2.5 py-1.5">
                      <span className="rounded bg-moss/40 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {apiUser.role === 'admin' || apiUser.role === 'manager' ? (
            <p className="mt-2 text-[11px] text-muted">Cities are managed under City stock — not on this pulse.</p>
          ) : null}
        </Card>
      </div>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base">Recent orders</h2>
          <Link to="/approvals" className="text-xs text-pine underline">
            Order desk
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted">No orders yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((o) => (
              <li
                key={o.id}
                className={`flex items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm ${orderStatusRowClass(o.status)}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">{o.firm_name || o.customer_name || 'Customer'}</p>
                  <p className="font-mono text-[10px] text-muted">{o.id.slice(0, 8)}…</p>
                  <p className="text-[11px] capitalize text-muted">
                    {o.status.replace(/_/g, ' ')}
                    {o.created_by_name ? ` · ${o.created_by_name}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium">{inr(Number(o.total_price))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
