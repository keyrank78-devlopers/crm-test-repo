import { useCallback, useEffect, useMemo, useState } from 'react'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'
import { Button, EmptyState, Field, Input, PageHeader, PageSkeleton, Textarea, usePageLoad } from '../../components/ui/primitives'
import { inr, num, toIsoDate } from '../../lib/format'
import { statusLabel } from '../../lib/orderUi'

type Tab = 'follow-up' | 'confirm' | 'not-confirm'

export function CallQueue() {
  const loading = usePageLoad()
  const { push } = useToast()
  const { apiUser } = useSession()
  const [rows, setRows] = useState<ApiOrder[]>([])
  const [tab, setTab] = useState<Tab>('confirm')
  const [q, setQ] = useState('')
  const [note, setNote] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await salesApi.listOrders())
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed to load')
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(rows) ? rows : []
    return list
      .filter((o) => {
        if (tab === 'confirm') return o.status === 'pending'
        if (tab === 'not-confirm') return o.status === 'cancelled'
        return ['confirmed', 'shipped', 'returned', 'delivered', 'dispatcher'].includes(o.status)
      })
      .filter((o) => {
        if (!s) return true
        return `${o.id} ${o.customer_name} ${o.firm_name} ${o.created_by_name}`.toLowerCase().includes(s)
      })
  }, [rows, tab, q])

  async function act(order: ApiOrder, status: 'confirmed' | 'cancelled') {
    setBusy(order.id)
    try {
      await salesApi.changeStatus(order.id, status)
      push(status === 'confirmed' ? 'Order confirmed' : 'Marked not confirm')
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy('')
    }
  }

  async function logFollowup(order: ApiOrder, followup_status: string) {
    setBusy(order.id)
    try {
      await salesApi.changeStatus(order.id, order.status, {
        followup_status,
        followup_note: note[order.id] || '',
      })
      push('Follow-up logged')
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusy('')
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        kicker="Caller"
        title="Call queue"
        subtitle="Punched orders → confirm / not confirm → Manager/TL dispatch. Follow-up tab for call outcomes."
      />
      <Input placeholder="Search party, order" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2">
        {(
          [
            ['confirm', 'Confirm'],
            ['not-confirm', 'Not confirm'],
            ['follow-up', 'Follow-up'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-pine text-cream' : 'bg-cream'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        {apiUser.first_name} · {num(filtered.length)} · {toIsoDate(new Date())}
      </p>
      {filtered.length === 0 ? (
        <EmptyState title="Queue clear" body="Nothing in this tab." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((o) => (
            <li key={o.id} className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{o.firm_name || o.customer_name || 'Customer'}</p>
                  <p className="font-mono text-[10px] text-muted">{o.id}</p>
                  <p className="text-xs text-muted">
                    {statusLabel(o.status)}
                    {o.created_by_name ? ` · ${o.created_by_name}` : ''}
                  </p>
                </div>
                <span className="text-sm font-medium">{inr(Number(o.total_price))}</span>
              </div>
              {tab === 'confirm' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" disabled={!!busy} onClick={() => void act(o, 'confirmed')}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(o, 'cancelled')}>
                    Not confirm
                  </Button>
                </div>
              ) : null}
              {tab === 'follow-up' ? (
                <div className="mt-2 space-y-2">
                  <Field label="Call note">
                    <Textarea
                      rows={2}
                      value={note[o.id] || ''}
                      onChange={(e) => setNote((n) => ({ ...n, [o.id]: e.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {['follow-up', 'confirm', 'not confirm'].map((f) => (
                      <Button key={f} size="sm" variant="ghost" disabled={!!busy} onClick={() => void logFollowup(o, f)}>
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
