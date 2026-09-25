import { useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { batchStock, isExpiring, productStock } from '../../lib/compute'
import { Button, Card, ExpiryFlag, Field, Input, PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'
import { fmtDate } from '../../lib/format'

export function StockAlerts() {
  const loading = usePageLoad()
  const state = useAppState()
  const [days, setDays] = useState(state.expiryAlertDays)

  const near = useMemo(
    () =>
      state.batches
        .map((b) => ({ b, stock: batchStock(state, b.batch_id), flag: isExpiring(b.expiry_date, days), product: state.products.find((p) => p.product_id === b.product_id)! }))
        .filter((x) => x.stock > 0 && x.flag !== 'ok'),
    [state, days],
  )
  const low = useMemo(
    () => state.products.map((p) => ({ p, stock: productStock(state, p.product_id) })).filter((x) => x.stock <= x.p.low_stock_threshold),
    [state],
  )

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader kicker="Warehouse" title="Alerts" subtitle="Near-expiry (not a hard block) and low stock. Thresholds are configurable." />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label={`Expiry window (days) · currently ${state.expiryAlertDays}`}>
          <Input type="number" min={7} className="w-32" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <Button onClick={() => void api.setExpiryThreshold(days)}>Apply window</Button>
      </Card>
      <h2 className="font-display mb-3 text-xl">Near expiry / expired</h2>
      <div className="mb-8 grid gap-2 md:grid-cols-2">
        {near.map((x) => (
          <Card key={x.b.batch_id} className="p-4">
            <p className="font-medium">{x.product.product_name}</p>
            <p className="text-sm text-muted">
              {x.b.batch_no} · exp {fmtDate(x.b.expiry_date)} · {x.stock} on hand
            </p>
            <div className="mt-2">
              <ExpiryFlag kind={x.flag} />
            </div>
          </Card>
        ))}
      </div>
      <h2 className="font-display mb-3 text-xl">Low stock</h2>
      <div className="grid gap-2 md:grid-cols-2">
        {low.map((x) => (
          <Card key={x.p.product_id} className="p-4">
            <p className="font-medium">{x.p.product_name}</p>
            <p className="text-sm text-muted">
              {x.stock} on hand · threshold {x.p.low_stock_threshold}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                className="w-24"
                type="number"
                defaultValue={x.p.low_stock_threshold}
                onBlur={(e) => void api.setProductThreshold(x.p.product_id, Number(e.target.value))}
              />
              <span className="text-xs text-muted">blur to save threshold</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
