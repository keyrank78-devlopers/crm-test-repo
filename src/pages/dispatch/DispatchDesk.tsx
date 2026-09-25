import { useCallback, useEffect, useMemo, useState } from 'react'
import { dispatcherApi, type DispatchRow, type WaitingOrder } from '../../api/dispatcher'
import { schemeApi, type SchemeOrder } from '../../api/scheme'
import { salesApi, type ApiOrder } from '../../api/sales'
import { ApiError } from '../../api/http'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Select,
  usePageLoad,
} from '../../components/ui/primitives'
import { inr } from '../../lib/format'
import { orderStatusRowClass, statusLabel } from '../../lib/orderUi'

type DeskTab = 'waiting' | 'dispatched' | 'return'

type WaitingItem = {
  id: string
  kind: 'sale' | 'scheme'
  title: string
  subtitle: string
  meta: string
  sale?: WaitingOrder
  scheme?: SchemeOrder
}

export function DispatchDesk() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const { push } = useToast()
  const [tab, setTab] = useState<DeskTab>('waiting')
  const [waitingSale, setWaitingSale] = useState<WaitingOrder[]>([])
  const [dispatches, setDispatches] = useState<DispatchRow[]>([])
  const [schemeOrders, setSchemeOrders] = useState<SchemeOrder[]>([])
  const [returnedSales, setReturnedSales] = useState<ApiOrder[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forItem, setForItem] = useState<WaitingItem | null>(null)
  const [detail, setDetail] = useState<WaitingItem | null>(null)
  const [courier, setCourier] = useState<'shadowfax' | 'delhivery' | 'india_post'>('shadowfax')
  const [awb, setAwb] = useState('')
  const [manual, setManual] = useState<DispatchRow | null>(null)
  const [manualStatus, setManualStatus] = useState('delivered')

  const load = useCallback(async () => {
    setError('')
    try {
      const [desk, schemes, orders] = await Promise.all([
        dispatcherApi.desk(),
        schemeApi.listSchemeOrders().catch(() => [] as SchemeOrder[]),
        salesApi.listOrders().catch(() => [] as ApiOrder[]),
      ])
      setWaitingSale(Array.isArray(desk?.waiting) ? desk.waiting : [])
      setDispatches(Array.isArray(desk?.dispatches) ? desk.dispatches : [])
      setSchemeOrders(Array.isArray(schemes) ? schemes : [])
      setReturnedSales((Array.isArray(orders) ? orders : []).filter((o) => o.status === 'returned'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dispatch desk')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const waitingItems = useMemo(() => {
    const sales = Array.isArray(waitingSale) ? waitingSale : []
    const schemes = Array.isArray(schemeOrders) ? schemeOrders : []
    const sale: WaitingItem[] = sales.map((o) => ({
      id: o.id,
      kind: 'sale',
      title: o.firm_name || o.customer_name || 'Sale order',
      subtitle: `Sale · ${inr(Number(o.total_price))}`,
      meta: o.created_by,
      sale: o,
    }))
    const scheme: WaitingItem[] = schemes
      .filter((o) => o.status === 'dispatcher')
      .map((o) => ({
        id: o.id,
        kind: 'scheme',
        title: o.firm_name || o.customer_name || 'Scheme order',
        subtitle: `Scheme · ${o.gift_qty}× ${o.gift_name}`,
        meta: o.scheme_name || o.scheme_order_no || o.fse_name || '',
        scheme: o,
      }))
    return [...sale, ...scheme]
  }, [waitingSale, schemeOrders])

  const returnedSchemes = useMemo(
    () => (Array.isArray(schemeOrders) ? schemeOrders : []).filter((o) => o.status === 'returned'),
    [schemeOrders],
  )

  if (loading) return <PageSkeleton />

  const tabs: { id: DeskTab; label: string; count: number }[] = [
    { id: 'waiting', label: 'Waiting', count: waitingItems.length },
    { id: 'dispatched', label: 'Dispatched', count: dispatches.length },
    { id: 'return', label: 'Return', count: returnedSales.length + returnedSchemes.length },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Dispatch"
        title="Dispatch desk"
        subtitle="Sale + scheme orders. Enter AWB for waiting items."
        actions={
          apiUser.role === 'admin' || apiUser.role === 'manager' || apiUser.role === 'dispatcher' ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const res = await dispatcherApi.syncDelhivery()
                  push(res.message)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Sync failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Sync Delhivery
            </Button>
          ) : null
        }
      />
      {error ? <p className="text-sm text-blush">{error}</p> : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Side panel */}
        <aside className="w-full shrink-0 lg:w-44">
          <nav className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 lg:flex-col">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap ${
                  tab === t.id ? 'bg-pine text-cream' : 'text-muted hover:bg-cream hover:text-ink'
                }`}
              >
                <span>{t.label}</span>
                <span className={`rounded px-1.5 text-[10px] ${tab === t.id ? 'bg-cream/20' : 'bg-cream'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          {tab === 'waiting' ? (
            waitingItems.length === 0 ? (
              <EmptyState title="Nothing waiting" body="Move sale or scheme orders to dispatcher status." />
            ) : (
              <ul className="space-y-2">
                {waitingItems.map((item) => (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(item)}>
                      <p className="font-medium leading-tight">
                        {item.title}
                        <span className="ml-2 rounded bg-cream px-1.5 py-0.5 text-[10px] uppercase text-muted">
                          {item.kind}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] text-muted">{item.id}</p>
                      <p className="text-xs text-muted">
                        {item.subtitle}
                        {item.meta ? ` · ${item.meta}` : ''}
                      </p>
                    </button>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(item)}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setForItem(item)
                          setAwb('')
                          setCourier('shadowfax')
                        }}
                      >
                        Enter AWB
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'dispatched' ? (
            dispatches.length === 0 ? (
              <p className="text-sm text-muted">No AWBs yet.</p>
            ) : (
              <ul className="space-y-2">
                {dispatches.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {d.firm_name || d.customer_name} · {d.courier}
                      </p>
                      <p className="font-mono text-xs">{d.awb_code}</p>
                      <p className="text-xs text-muted capitalize">
                        {d.status.replace(/_/g, ' ')} · order {d.order_status}
                      </p>
                    </div>
                    {d.courier === 'india_post' || d.status !== 'delivered' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setManual(d)
                          setManualStatus(d.status)
                        }}
                      >
                        Update
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'return' ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Sale returns</h3>
              {returnedSales.length === 0 ? (
                <p className="text-sm text-muted">No returned sale orders.</p>
              ) : (
                <ul className="space-y-2">
                  {returnedSales.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-xl border p-3 text-sm ${orderStatusRowClass(o.status)}`}
                    >
                      <p className="font-medium">{o.firm_name || o.customer_name}</p>
                      <p className="font-mono text-[10px] text-muted">{o.id}</p>
                      <p className="text-xs text-muted">
                        {inr(Number(o.total_price))} · {statusLabel(o.status)} · locked
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="pt-2 text-xs font-medium uppercase tracking-wider text-muted">Scheme returns</h3>
              {returnedSchemes.length === 0 ? (
                <p className="text-sm text-muted">No returned scheme orders.</p>
              ) : (
                <ul className="space-y-2">
                  {returnedSchemes.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-xl border p-3 text-sm ${orderStatusRowClass(o.status)}`}
                    >
                      <p className="font-medium">
                        {o.firm_name || o.customer_name}
                        <span className="ml-2 rounded bg-cream px-1.5 text-[10px]">scheme</span>
                      </p>
                      <p className="text-xs text-muted">
                        {o.gift_qty}× {o.gift_name} · {o.scheme_name}
                      </p>
                      <p className="font-mono text-[10px] text-muted">{o.scheme_order_no || o.id}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.kind === 'scheme' ? 'Scheme order' : 'Sale order'}>
        {detail ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{detail.title}</p>
            <p className="font-mono text-[10px] text-muted break-all">{detail.id}</p>
            <p className="text-muted">{detail.subtitle}</p>
            {detail.meta ? <p className="text-xs text-muted">{detail.meta}</p> : null}
            {detail.kind === 'scheme' && detail.scheme ? (
              <div className="rounded-lg border border-line bg-cream/40 p-2.5 text-xs">
                <p>
                  Gift: {detail.scheme.gift_qty}× {detail.scheme.gift_name}
                </p>
                <p>Scheme: {detail.scheme.scheme_name || '—'}</p>
                <p>FSE: {detail.scheme.fse_name || '—'}</p>
                <p>Sale order: {detail.scheme.sale_order_id}</p>
                <p className="capitalize">Status: {statusLabel(detail.scheme.status)}</p>
              </div>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setForItem(detail)
                setDetail(null)
                setAwb('')
                setCourier('shadowfax')
              }}
            >
              Enter AWB
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!forItem} onClose={() => setForItem(null)} title="Enter AWB">
        {forItem ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {forItem.title}
              <span className="ml-2 rounded bg-cream px-1.5 text-[10px] uppercase">{forItem.kind}</span>
            </p>
            <p className="break-all font-mono text-xs text-muted">{forItem.id}</p>
            <Field label="Courier">
              <Select value={courier} onChange={(e) => setCourier(e.target.value as typeof courier)}>
                <option value="shadowfax">Shadowfax</option>
                <option value="delhivery">Delhivery</option>
                <option value="india_post">India Post</option>
              </Select>
            </Field>
            <Field label="AWB / code">
              <Input value={awb} onChange={(e) => setAwb(e.target.value)} />
            </Field>
            <Button
              disabled={busy || !awb.trim()}
              onClick={async () => {
                setBusy(true)
                try {
                  await dispatcherApi.create({
                    ...(forItem.kind === 'scheme'
                      ? { scheme_order_id: forItem.id }
                      : { order_id: forItem.id }),
                    courier,
                    awb_code: awb.trim(),
                  })
                  push('Dispatch saved')
                  setForItem(null)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!manual} onClose={() => setManual(null)} title="Update status">
        {manual ? (
          <div className="space-y-3">
            <p className="text-sm">
              {manual.courier} · {manual.awb_code}
            </p>
            <Field label="Status">
              <Select value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
                {['booked', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await dispatcherApi.updateStatus(manual.id, manualStatus)
                  push('Updated')
                  setManual(null)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
