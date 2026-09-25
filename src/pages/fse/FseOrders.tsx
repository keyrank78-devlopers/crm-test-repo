import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { EmptyState, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import { inr, num, toIsoDate } from '../../lib/format'

function dayKey(o: ApiOrder) {
  return (o.order_date || o.created_at || '').slice(0, 10)
}

function formatDate(o: ApiOrder) {
  const raw = o.order_date || o.created_at || ''
  if (!raw) return '—'
  const d = raw.slice(0, 10)
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function shortId(id: string) {
  if (!id) return '—'
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…`
}

function schemeDate(iso?: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

/** PDF §3 — FSE visibility: order punch, sales, daily & monthly */
export function FseOrders() {
  const loading = usePageLoad()
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')
  const today = toIsoDate(new Date())
  const monthPrefix = today.slice(0, 7)

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await salesApi.listOrders())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load orders')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const list = Array.isArray(rows) ? rows : []
    const day = list.filter((o) => dayKey(o) === today)
    const month = list.filter((o) => dayKey(o).startsWith(monthPrefix))
    const sum = (items: ApiOrder[]) => items.reduce((s, o) => s + Number(o.total_price || 0), 0)
    return {
      dayPunch: day.length,
      daySales: sum(day),
      monthPunch: month.length,
      monthSales: sum(month),
      allPunch: list.length,
      allSales: sum(list),
    }
  }, [rows, today, monthPrefix])

  if (loading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-20 lg:pb-4">
      <PageHeader
        kicker="Field"
        title="My orders"
        subtitle="Punch count, sell rates, scheme and dates — daily & monthly."
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-line bg-white px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Today punch</p>
          <p className="font-display text-lg">{num(stats.dayPunch)}</p>
          <p className="text-[11px] text-muted">{inr(stats.daySales)}</p>
        </div>
        <div className="rounded-md border border-line bg-white px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Month punch</p>
          <p className="font-display text-lg">{num(stats.monthPunch)}</p>
          <p className="text-[11px] text-muted">{inr(stats.monthSales)}</p>
        </div>
        <div className="rounded-md border border-line bg-white px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">All / current</p>
          <p className="font-display text-lg">{num(stats.allPunch)}</p>
          <p className="text-[11px] text-muted">{inr(stats.allSales)}</p>
        </div>
      </div>

      <div className="flex justify-end lg:hidden">
        <Link to="/fse" className="rounded-full bg-pine px-3 py-1.5 text-xs text-cream">
          + New order
        </Link>
      </div>

      {error ? <p className="text-sm text-blush">{error}</p> : null}
      {(Array.isArray(rows) ? rows : []).length === 0 ? (
        <EmptyState title="No orders yet" body="Create an order from New order — it will show here." />
      ) : (
        <ul className="space-y-3">
          {(Array.isArray(rows) ? rows : []).map((o) => {
            const gifts = o.scheme_gifts || []
            const lines = o.items || []
            return (
              <li key={o.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{o.firm_name || o.customer_name || 'Customer'}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatDate(o)}
                      <span className="mx-1">·</span>
                      <span className="font-mono">{shortId(o.id)}</span>
                    </p>
                    <p className="mt-1 text-xs capitalize text-muted">
                      {o.status}
                      {o.payment_terms?.payment_type ? ` · ${o.payment_terms.payment_type}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{inr(Number(o.total_price))}</p>
                    {o.payment_terms ? (
                      <p className="mt-0.5 text-[11px] text-muted">
                        Paid {inr(Number(o.payment_terms.paid_amount || 0))}
                      </p>
                    ) : null}
                  </div>
                </div>

                {lines.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-line bg-zinc-50 px-2.5 py-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Sold at
                    </p>
                    <ul className="space-y-1">
                      {lines.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate">
                            {i.product_name || 'Product'}
                            <span className="text-muted"> × {i.quantity}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            @ ₹{Number(i.price).toFixed(2)}
                            <span className="ml-1.5 font-medium">{inr(Number(i.amount))}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">Qty {o.quantity} · no line detail</p>
                )}

                {gifts.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-800">
                      Scheme
                    </p>
                    {gifts.map((g) => (
                      <p key={g.id || g.scheme_id || g.gift_name} className="text-xs text-violet-950">
                        {g.scheme_name || 'Scheme'} · {g.gift_qty}× {g.gift_name}
                        {g.attached_at ? (
                          <span className="text-violet-700/80"> · {schemeDate(g.attached_at)}</span>
                        ) : null}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted">No scheme on this order</p>
                )}

                {o.has_expiry_claim ? (
                  <p className="mt-2 text-xs text-amber-800">
                    Expiry claim left ₹{o.expiry_claim_remaining}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
