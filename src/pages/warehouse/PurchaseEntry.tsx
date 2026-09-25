import { useCallback, useEffect, useState } from 'react'
import { inventoryApi, type CityInventory, type ProductCreateInput } from '../../api/inventory'
import { ApiError } from '../../api/http'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { Button, Field, Input, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { toIsoDate } from '../../lib/format'

type Kind = 'normal' | 'expiry'

type DraftLine = {
  key: string
  name: string
  batch_number: string
  /** Normal: purchase total ₹. Expiry: unit ₹. */
  price: number
  quantity: number
  min_price: number
  max_price: number
  expiry_date: string
}

function lid() {
  return Math.random().toString(36).slice(2, 9)
}

export function PurchaseEntry() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const { push } = useToast()
  const canPurchase = apiUser.role === 'admin' || apiUser.role === 'manager' || apiUser.role === 'inventory'

  const [kind, setKind] = useState<Kind>('normal')
  const [cities, setCities] = useState<CityInventory[]>([])
  const [inventoryId, setInventoryId] = useState('')
  const [party, setParty] = useState('')
  const [date, setDate] = useState(toIsoDate(new Date()))
  const [lines, setLines] = useState<DraftLine[]>([
    { key: lid(), name: '', batch_number: '', price: 0, quantity: 1, min_price: 0, max_price: 0, expiry_date: '' },
  ])
  const [busy, setBusy] = useState(false)

  const loadCities = useCallback(async () => {
    try {
      const list = await inventoryApi.listCityInventories()
      setCities(list)
      if (list[0]) setInventoryId(list[0].id)
    } catch {
      /* inventory role can still create without city FK */
    }
  }, [])

  useEffect(() => {
    if (canPurchase) void loadCities()
  }, [canPurchase, loadCities])

  if (loading) return <PageSkeleton />

  if (!canPurchase) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader kicker="Warehouse" title="Purchase in" />
        <p className="mt-4 text-muted">Only Admin, Manager, or Inventory can purchase stock.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        kicker="Warehouse"
        title="Purchase in"
        subtitle={
          kind === 'normal'
            ? 'Normal stock: total price + min/max sale band. Unit = price ÷ qty.'
            : 'Expiry stock (bulk): enter unit price only — no min/max band.'
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${kind === 'normal' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setKind('normal')}
        >
          Normal products
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${kind === 'expiry' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setKind('expiry')}
        >
          Expiry products
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <Field label="Purchase party">
          <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Supplier / factory" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {cities.length > 0 ? (
          <Field label="City (from CEO cities)">
            <Select value={inventoryId} onChange={(e) => setInventoryId(e.target.value)}>
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.city}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-xs text-muted">No cities yet — CEO adds cities on Dashboard / City stock.</p>
        )}

        <p className="text-xs font-medium uppercase tracking-wider text-muted">Lines (bulk)</p>
        {lines.map((line) => (
          <div key={line.key} className="space-y-2 rounded-xl border border-line p-3">
            <Field label="Product name">
              <Input
                value={line.name}
                onChange={(e) => setLines((rows) => rows.map((r) => (r.key === line.key ? { ...r, name: e.target.value } : r)))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Batch no">
                <Input
                  value={line.batch_number}
                  onChange={(e) =>
                    setLines((rows) => rows.map((r) => (r.key === line.key ? { ...r, batch_number: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="Qty">
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((r) => (r.key === line.key ? { ...r, quantity: Number(e.target.value) || 1 } : r)),
                    )
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {kind === 'normal' ? (
                <>
                  <Field label="Total price (₹)">
                    <Input
                      type="number"
                      value={line.price}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.key === line.key ? { ...r, price: Number(e.target.value) || 0 } : r)),
                        )
                      }
                    />
                  </Field>
                  <Field label="Unit (auto)">
                    <Input
                      readOnly
                      value={line.quantity > 0 ? (line.price / line.quantity).toFixed(2) : '0'}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Unit price (₹)">
                    <Input
                      type="number"
                      min={0}
                      value={line.price}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.key === line.key ? { ...r, price: Number(e.target.value) || 0 } : r)),
                        )
                      }
                    />
                  </Field>
                  <Field label="Expiry date">
                    <Input
                      type="date"
                      value={line.expiry_date}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.key === line.key ? { ...r, expiry_date: e.target.value } : r)),
                        )
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            {kind === 'expiry' ? (
              <p className="text-xs text-muted">
                Line total: ₹{(line.price * line.quantity).toFixed(2)}
              </p>
            ) : null}
            {kind === 'normal' ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Min sale price (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={line.min_price}
                    onChange={(e) =>
                      setLines((rows) =>
                        rows.map((r) => (r.key === line.key ? { ...r, min_price: Number(e.target.value) || 0 } : r)),
                      )
                    }
                  />
                </Field>
                <Field label="Max sale price (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={line.max_price}
                    onChange={(e) =>
                      setLines((rows) =>
                        rows.map((r) => (r.key === line.key ? { ...r, max_price: Number(e.target.value) || 0 } : r)),
                      )
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>
        ))}

        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() =>
            setLines((rows) => [
              ...rows,
              { key: lid(), name: '', batch_number: '', price: 0, quantity: 1, min_price: 0, max_price: 0, expiry_date: '' },
            ])
          }
        >
          + Add line
        </Button>

        <Button
          disabled={busy}
          onClick={async () => {
            if (!party.trim()) {
              push('Purchase party required')
              return
            }
            const items: ProductCreateInput[] = lines
              .filter((l) => l.name.trim() && l.batch_number.trim() && l.quantity > 0)
              .map((l) => ({
                name: l.name.trim(),
                purchase_party: party.trim(),
                date,
                batch_number: l.batch_number.trim(),
                // Expiry: UI is unit price → store purchase total = unit × qty
                price: kind === 'expiry' ? Math.round(l.price * l.quantity) : l.price,
                quantity: l.quantity,
                inventory: inventoryId || undefined,
                ...(kind === 'normal'
                  ? { min_price: l.min_price, max_price: l.max_price }
                  : { expiry_date: l.expiry_date || undefined }),
              }))
            if (!items.length) {
              push('Add at least one complete line')
              return
            }
            if (kind === 'expiry') {
              for (const l of lines.filter((x) => x.name.trim())) {
                if (l.price <= 0) {
                  push(`Unit price required for ${l.name}`)
                  return
                }
                if (!l.expiry_date) {
                  push(`Expiry date required for ${l.name}`)
                  return
                }
              }
            }
            if (kind === 'normal') {
              for (const l of lines.filter((x) => x.name.trim())) {
                if (l.min_price > 0 && l.max_price > 0 && l.min_price > l.max_price) {
                  push(`Min cannot exceed max for ${l.name}`)
                  return
                }
              }
            }
            setBusy(true)
            try {
              if (kind === 'normal') {
                const res = await inventoryApi.createProducts(items)
                push(res.message)
                if (res.errors?.length) push(`${res.errors.length} line(s) failed`)
              } else {
                const res = await inventoryApi.createExpiryProducts(items)
                push(res.message)
                if (res.errors?.length) push(`${res.errors.length} line(s) failed`)
              }
              setLines([{ key: lid(), name: '', batch_number: '', price: 0, quantity: 1, min_price: 0, max_price: 0, expiry_date: '' }])
            } catch (err) {
              push(err instanceof ApiError ? err.message : 'Purchase failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : `Save ${kind} purchase`}
        </Button>
      </div>
    </div>
  )
}
