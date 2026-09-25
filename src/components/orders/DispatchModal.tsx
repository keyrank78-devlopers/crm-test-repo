import { useEffect, useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { Button, Field, Modal, Select, StatusBadge } from '../ui/primitives'
import { useToast } from '../../context/ToastContext'
import type { Order } from '../../types'
import { courierOptionsForPin } from '../../lib/compute'

export function DispatchModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const state = useAppState()
  const { push } = useToast()
  const existing = state.dispatches.find((d) => d.order_id === order?.order_id)
  const customer = state.customers.find((c) => c.customer_id === order?.customer_id)
  const options = useMemo(() => courierOptionsForPin(customer?.pin_code ?? ''), [customer?.pin_code])
  const suggested = order?.preferred_courier && options.includes(order.preferred_courier as 'Shadowfax' | 'India Post')
    ? order.preferred_courier
    : options[0] ?? 'India Post'
  const [courier, setCourier] = useState(existing?.courier_name || suggested)
  const [dockets, setDockets] = useState(existing?.docket_nos.join('\n') ?? '')
  const [busy, setBusy] = useState(false)
  const liveOrder = state.orders.find((o) => o.order_id === order?.order_id) ?? order
  const liveDispatch = state.dispatches.find((d) => d.order_id === order?.order_id)

  useEffect(() => {
    if (!order) return
    const c = state.customers.find((x) => x.customer_id === order.customer_id)
    const opts = courierOptionsForPin(c?.pin_code ?? '')
    const ex = state.dispatches.find((d) => d.order_id === order.order_id)
    const pref =
      order.preferred_courier && opts.includes(order.preferred_courier as 'Shadowfax' | 'India Post')
        ? order.preferred_courier
        : opts[0] ?? 'India Post'
    setCourier(ex?.courier_name && opts.includes(ex.courier_name as 'Shadowfax' | 'India Post') ? ex.courier_name : pref)
    setDockets(ex?.docket_nos.join('\n') ?? '')
  }, [order, state.customers, state.dispatches])

  if (!order || !liveOrder) return null

  const awbLabel = courier === 'India Post' ? 'India Post tracking number' : 'Shadowfax AWB'
  const hasAwb = Boolean(liveDispatch?.docket_nos?.length)

  return (
    <Modal open onClose={onClose} title={`Dispatch · ${order.order_no}`}>
      <p className="mb-3 text-sm text-muted">
        PIN <span className="font-medium text-ink">{customer?.pin_code || '—'}</span> · available{' '}
        <span className="font-medium text-ink">{options.join(' / ')}</span>. Enter AWB to move order to At Hub.
      </p>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted">Current status</span>
        <StatusBadge status={liveOrder.delivery_status} />
      </div>
      <Field label="Courier">
        <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={awbLabel} hint="One per line">
        <textarea
          className="mt-1 w-full rounded-xl border border-line p-3 text-sm"
          rows={4}
          value={dockets}
          onChange={(e) => setDockets(e.target.value)}
          placeholder={courier === 'India Post' ? 'India Post tracking…' : 'Shadowfax AWB…'}
        />
      </Field>
      {existing?.docket_nos.length ? (
        <p className="mt-2 text-xs text-muted">Already on file: {existing.docket_nos.join(', ')}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {hasAwb ? (
          <Button
            variant="ghost"
            disabled={busy || liveOrder.delivery_status === 'Delivered'}
            onClick={async () => {
              setBusy(true)
              try {
                const updated = await api.syncCourierStatus(order.order_id)
                push(
                  updated.delivery_status === 'Delivered'
                    ? `Status · Delivered (Done)`
                    : `Status → ${updated.delivery_status}`,
                )
              } catch (e) {
                push(e instanceof Error ? e.message : 'Could not fetch status', 'err')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Fetching…' : 'Fetch status'}
          </Button>
        ) : null}
        <Button
          disabled={busy}
          onClick={async () => {
            const nos = dockets
              .split(/\n|,/)
              .map((s) => s.trim())
              .filter(Boolean)
            if (!nos.length) {
              push('Enter at least one AWB', 'err')
              return
            }
            setBusy(true)
            try {
              await api.attachDockets(order.order_id, courier, nos)
              push(`AWB saved · ${courier} · order → At Hub`)
            } catch (e) {
              push(e instanceof Error ? e.message : 'Could not save AWB', 'err')
            } finally {
              setBusy(false)
            }
          }}
        >
          Save AWB & dispatch
        </Button>
      </div>
    </Modal>
  )
}
