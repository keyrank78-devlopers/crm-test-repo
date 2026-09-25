import { useCallback, useEffect, useMemo, useState } from 'react'
import { schemeApi, type SchemeOrder } from '../../api/scheme'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'
import { DataTable } from '../../components/ui/DataTable'
import { Button, EmptyState, Input, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import { orderStatusBlocksAdvance, orderStatusLocked, orderStatusRowClass, statusLabel } from '../../lib/orderUi'

const NEXT: Record<string, string | null> = {
  confirmed: 'dispatcher',
  dispatcher: 'shipped',
  shipped: 'delivered',
  delivered: null,
  returned: null,
  cancelled: null,
}

export function SchemeOrdersPage() {
  const loading = usePageLoad()
  const { apiUser, uiRole } = useSession()
  const { push } = useToast()
  const [rows, setRows] = useState<SchemeOrder[]>([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const canChangeStatus = apiUser.role === 'manager' || apiUser.role === 'tl'

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await schemeApi.listSchemeOrders())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load scheme orders')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : []
    const s = q.toLowerCase()
    if (!s) return list
    return list.filter((o) =>
      `${o.scheme_order_no} ${o.sale_order_id} ${o.scheme_name} ${o.customer_name} ${o.firm_name} ${o.gift_name} ${o.fse_name} ${o.status}`
        .toLowerCase()
        .includes(s),
    )
  }, [rows, q])

  async function advance(row: SchemeOrder, status: string) {
    if (!canChangeStatus) {
      push('Only TL / Manager can change scheme order status')
      return
    }
    if (orderStatusLocked(row.status)) {
      push('Status locked after returned / cancelled')
      return
    }
    if (row.status === 'delivered' && status !== 'returned') {
      push('After delivered, only return is allowed')
      return
    }
    setBusy(true)
    try {
      await schemeApi.changeSchemeOrderStatus(row.id, status)
      push(`Scheme order → ${statusLabel(status)}`)
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Status update failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up space-y-3">
      <PageHeader
        kicker={uiRole}
        title="Scheme orders"
        subtitle="Gift / scheme deliveries created when a scheme is applied on a sale order."
      />
      <Input className="max-w-xs" placeholder="Search scheme order, party, gift…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <p className="text-sm text-blush">{error}</p> : null}
      {!canChangeStatus ? (
        <p className="text-xs text-muted">View only — TL / Manager move status.</p>
      ) : null}

      <DataTable
        rows={filtered}
        rowKey={(o) => o.id}
        rowClassName={(o) => orderStatusRowClass(o.status)}
        empty={<EmptyState title="No scheme orders" body="When FSE applies a scheme, it appears here." />}
        columns={[
          {
            key: 'no',
            header: 'Scheme order',
            cell: (o) => (
              <span className="font-mono text-[10px]">{o.scheme_order_no || o.id.slice(0, 8)}</span>
            ),
          },
          {
            key: 'sale',
            header: 'Sale order',
            cell: (o) => <span className="font-mono text-[10px] text-muted">{o.sale_order_id?.slice(0, 8)}…</span>,
          },
          {
            key: 'party',
            header: 'Party',
            cell: (o) => o.firm_name || o.customer_name || '—',
          },
          {
            key: 'gift',
            header: 'Gift',
            cell: (o) => (
              <span>
                {o.gift_qty}× {o.gift_name}
                <span className="block text-[11px] text-muted">{o.scheme_name}</span>
              </span>
            ),
          },
          { key: 'fse', header: 'FSE', cell: (o) => o.fse_name || '—' },
          {
            key: 'st',
            header: 'Status',
            cell: (o) => <span className="text-xs capitalize">{statusLabel(o.status)}</span>,
          },
          {
            key: 'a',
            header: '',
            cell: (o) => {
              const next = NEXT[o.status]
              if (!canChangeStatus) return null
              return (
                <div className="flex flex-wrap gap-1">
                  {next && !orderStatusBlocksAdvance(o.status) ? (
                    <Button size="sm" disabled={busy} onClick={() => void advance(o, next)}>
                      → {statusLabel(next)}
                    </Button>
                  ) : null}
                  {o.status === 'delivered' ? (
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void advance(o, 'returned')}>
                      Return
                    </Button>
                  ) : null}
                </div>
              )
            },
          },
        ]}
      />
    </div>
  )
}
