import { useCallback, useEffect, useMemo, useState } from 'react'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'
import { DataTable } from '../../components/ui/DataTable'
import { Button, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Textarea, usePageLoad } from '../../components/ui/primitives'
import { inr } from '../../lib/format'
import { orderStatusLocked, orderStatusRowClass, statusLabel } from '../../lib/orderUi'

export function ReturnOrdersPage() {
  const loading = usePageLoad()
  const { apiUser, uiRole } = useSession()
  const { push } = useToast()
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [returnRemark, setReturnRemark] = useState('')
  const [returnTarget, setReturnTarget] = useState<ApiOrder | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await salesApi.listOrders())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load returns')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const returned = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(rows) ? rows : []
    return list
      .filter((o) => o.status === 'returned')
      .filter((o) => {
        if (!s) return true
        return `${o.id} ${o.customer_name} ${o.firm_name} ${o.created_by_name}`
          .toLowerCase()
          .includes(s)
      })
  }, [rows, q])

  /** Only TL / Manager can mark return — not FSE, not admin/CEO. */
  const canMarkReturn = apiUser.role === 'manager' || apiUser.role === 'tl'

  const markable = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(rows) ? rows : []
    return list
      .filter((o) => o.status === 'delivered' || o.status === 'shipped')
      .filter((o) => {
        if (!s) return true
        return `${o.id} ${o.customer_name} ${o.firm_name}`.toLowerCase().includes(s)
      })
      .slice(0, 40)
  }, [rows, q])

  async function markReturned(order: ApiOrder, remarks: string) {
    if (!canMarkReturn) {
      push('Only TL / Manager can mark return')
      return
    }
    if (!remarks.trim()) {
      push('Return remarks required')
      return
    }
    if (orderStatusLocked(order.status) && order.status === 'returned') {
      push('Already returned — status locked')
      return
    }
    setBusy(true)
    try {
      await salesApi.changeStatus(order.id, 'returned', { return_remarks: remarks.trim() })
      push('Marked returned — status is now locked')
      setReturnTarget(null)
      setReturnRemark('')
      await load()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed'
      push(msg)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        kicker={uiRole}
        title="Return orders"
        subtitle="Returned orders only. After return, status is locked. Mark return: TL / Manager only."
      />
      <Input className="max-w-xs" placeholder="Search party, order, FSE…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <p className="text-sm text-blush">{error}</p> : null}

      <h2 className="font-display text-lg">Returned ({returned.length})</h2>
      <DataTable
        rows={returned}
        rowKey={(o) => o.id}
        rowClassName={(o) => orderStatusRowClass(o.status)}
        empty={<EmptyState title="No returns yet" body="Returned orders appear here." />}
        columns={[
          {
            key: 'id',
            header: 'Order ID',
            cell: (o) => <span className="font-mono text-[10px] text-muted">{o.id}</span>,
          },
          { key: 'party', header: 'Party', cell: (o) => o.firm_name || o.customer_name || '—' },
          { key: 'fse', header: 'FSE', cell: (o) => o.created_by_name || '—' },
          { key: 'val', header: 'Value', cell: (o) => inr(Number(o.total_price)) },
          {
            key: 'st',
            header: 'Status',
            cell: () => <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-800">returned · locked</span>,
          },
        ]}
      />

      {canMarkReturn ? (
        <>
          <h2 className="font-display mt-4 text-lg">Mark return</h2>
          <p className="text-xs text-muted">Shipped / delivered orders — marking return locks the order.</p>
          {markable.length === 0 ? (
            <p className="text-sm text-muted">Nothing eligible to return.</p>
          ) : (
            <ul className="space-y-2">
              {markable.map((o) => (
                <li
                  key={o.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${orderStatusRowClass(o.status)}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{o.firm_name || o.customer_name}</p>
                    <p className="font-mono text-[10px] text-muted">{o.id}</p>
                    <p className="text-[11px] capitalize text-muted">
                      {statusLabel(o.status)} · {inr(Number(o.total_price))}
                    </p>
                  </div>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => setReturnTarget(o)}>
                    Mark returned
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-muted">View only — FSE / Admin cannot mark returns.</p>
      )}

      {returnTarget ? (
        <Modal open title="Return remarks" onClose={() => setReturnTarget(null)}>
          <p className="mb-2 text-sm text-muted">
            {returnTarget.firm_name || returnTarget.customer_name} · why was it returned?
          </p>
          <Field label="Remarks">
            <Textarea rows={3} value={returnRemark} onChange={(e) => setReturnRemark(e.target.value)} />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button disabled={busy} onClick={() => void markReturned(returnTarget, returnRemark)}>
              Confirm return
            </Button>
            <Button variant="ghost" onClick={() => setReturnTarget(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
