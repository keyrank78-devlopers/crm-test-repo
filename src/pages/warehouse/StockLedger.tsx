import { useCallback, useEffect, useMemo, useState } from 'react'
import { inventoryApi, type ApiExpiryProduct, type ApiProduct } from '../../api/inventory'
import { ApiError } from '../../api/http'
import { DataTable } from '../../components/ui/DataTable'
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  usePageLoad,
} from '../../components/ui/primitives'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { downloadCsv } from '../../lib/orderUi'
import { downloadExport } from '../../api/dashboard'

type EditTarget =
  | { kind: 'normal'; product: ApiProduct }
  | { kind: 'expiry'; product: ApiExpiryProduct }

export function StockLedger() {
  const loading = usePageLoad()
  const { push } = useToast()
  const { apiUser } = useSession()
  const canView =
    apiUser.role === 'admin' ||
    apiUser.role === 'manager' ||
    apiUser.role === 'inventory' ||
    apiUser.role === 'tl' ||
    apiUser.role === 'fse'
  const canEdit = apiUser.role === 'admin' || apiUser.role === 'manager' || apiUser.role === 'inventory'

  const [tab, setTab] = useState<'normal' | 'expiry'>('normal')
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [expiry, setExpiry] = useState<ApiExpiryProduct[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [batch, setBatch] = useState('')
  const [party, setParty] = useState('')
  const [qty, setQty] = useState(0)
  const [price, setPrice] = useState(0)
  const [unit, setUnit] = useState(0)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [expiryDate, setExpiryDate] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, e] = await Promise.all([inventoryApi.listProducts(), inventoryApi.listExpiryProducts()])
      setProducts(Array.isArray(p) ? p : [])
      setExpiry(Array.isArray(e) ? e : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stock')
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  function openEdit(target: EditTarget) {
    const p = target.product
    setEdit(target)
    setName(p.name)
    setBatch(p.batch_number)
    setParty(p.purchase_party)
    setQty(p.quantity)
    setPrice(Number(p.price) || 0)
    setUnit(Number(p.single_unit_price) || 0)
    setMinPrice(Number(p.min_price || 0))
    setMaxPrice(Number(p.max_price || 0))
    setExpiryDate(target.kind === 'expiry' ? (p as ApiExpiryProduct).expiry_date?.slice(0, 10) || '' : '')
  }

  async function saveEdit() {
    if (!edit) return
    setBusy(true)
    try {
      // Backend recalculates unit from purchase ₹ / qty when either is sent
      const purchaseTotal = unit > 0 && qty > 0 ? Math.round(unit * qty) : price
      if (edit.kind === 'normal') {
        await inventoryApi.updateProduct(edit.product.id, {
          name: name.trim(),
          batch_number: batch.trim(),
          purchase_party: party.trim(),
          quantity: qty,
          price: purchaseTotal,
          min_price: minPrice || undefined,
          max_price: maxPrice || undefined,
        })
      } else {
        await inventoryApi.updateExpiryProduct(edit.product.id, {
          name: name.trim(),
          batch_number: batch.trim(),
          purchase_party: party.trim(),
          quantity: qty,
          price: purchaseTotal,
          single_unit_price: unit,
          expiry_date: expiryDate || undefined,
        })
      }
      push('Product updated')
      setEdit(null)
      await load()
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const normalRows = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(products) ? products : []
    return list.filter((p) => !s || `${p.name} ${p.batch_number}`.toLowerCase().includes(s))
  }, [products, q])

  const expiryRows = useMemo(() => {
    const s = q.toLowerCase()
    const list = Array.isArray(expiry) ? expiry : []
    return list.filter((p) => !s || `${p.name} ${p.batch_number}`.toLowerCase().includes(s))
  }, [expiry, q])

  if (loading) return <PageSkeleton />

  if (!canView) {
    return (
      <div>
        <PageHeader kicker="Warehouse" title="Current stock" />
        <p className="mt-4 text-muted">Not authorized.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Warehouse"
        title="Current stock"
        subtitle="Live quantities for normal and expiry products. Edit to correct stock."
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'normal' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setTab('normal')}
        >
          Normal ({products.length})
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'expiry' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setTab('expiry')}
        >
          Expiry ({expiry.length})
        </button>
        <Input className="ml-auto w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              await downloadExport(
                inventoryApi.exportPath(tab === 'normal' ? 'normal' : 'expiry'),
                `stock-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            } catch {
              if (tab === 'normal') {
                downloadCsv(
                  `stock-normal-${new Date().toISOString().slice(0, 10)}.csv`,
                  ['Name', 'Batch', 'Party', 'Qty', 'Unit ₹', 'Purchase ₹', 'Min', 'Max'],
                  normalRows.map((p) => [
                    p.name,
                    p.batch_number,
                    p.purchase_party,
                    p.quantity,
                    p.single_unit_price,
                    p.price,
                    p.min_price ?? '',
                    p.max_price ?? '',
                  ]),
                )
              } else {
                downloadCsv(
                  `stock-expiry-${new Date().toISOString().slice(0, 10)}.csv`,
                  ['Name', 'Batch', 'Party', 'Qty', 'Unit ₹', 'Expiry'],
                  expiryRows.map((p) => [
                    p.name,
                    p.batch_number,
                    p.purchase_party,
                    p.quantity,
                    p.single_unit_price,
                    p.expiry_date ?? '',
                  ]),
                )
              }
            }
          }}
        >
          Download sheet
        </Button>
      </div>

      {error ? <p className="text-sm text-blush">{error}</p> : null}

      {tab === 'normal' ? (
        normalRows.length === 0 ? (
          <EmptyState title="No normal stock" body="Use Purchase in to add products." />
        ) : (
          <DataTable
            rows={normalRows}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Product', cell: (r) => r.name, sort: (a, b) => a.name.localeCompare(b.name) },
              { key: 'batch', header: 'Batch', cell: (r) => r.batch_number },
              { key: 'qty', header: 'Qty', cell: (r) => r.quantity },
              { key: 'unit', header: 'Unit ₹', cell: (r) => String(r.single_unit_price) },
              {
                key: 'band',
                header: 'Min–Max',
                cell: (r) => {
                  const min = Number(r.min_price || 0)
                  const max = Number(r.max_price || 0)
                  if (!min && !max) return '—'
                  return `₹${min}–₹${max}`
                },
              },
              { key: 'party', header: 'Party', cell: (r) => r.purchase_party },
              ...(canEdit
                ? [
                    {
                      key: 'edit',
                      header: '',
                      cell: (r: ApiProduct) => (
                        <button
                          type="button"
                          className="text-sm text-pine underline"
                          onClick={() => openEdit({ kind: 'normal', product: r })}
                        >
                          Edit
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )
      ) : expiryRows.length === 0 ? (
        <EmptyState title="No expiry stock" body="Purchase expiry products from Purchase in." />
      ) : (
        <DataTable
          rows={expiryRows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Product', cell: (r) => r.name, sort: (a, b) => a.name.localeCompare(b.name) },
            { key: 'batch', header: 'Batch', cell: (r) => r.batch_number },
            { key: 'qty', header: 'Qty', cell: (r) => r.quantity },
            { key: 'exp', header: 'Expiry', cell: (r) => r.expiry_date ?? '—' },
            { key: 'unit', header: 'Unit ₹', cell: (r) => String(r.single_unit_price) },
            ...(canEdit
              ? [
                  {
                    key: 'edit',
                    header: '',
                    cell: (r: ApiExpiryProduct) => (
                      <button
                        type="button"
                        className="text-sm text-pine underline"
                        onClick={() => openEdit({ kind: 'expiry', product: r })}
                      >
                        Edit
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.kind === 'expiry' ? 'Edit expiry product' : 'Edit product'}>
        <div className="space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batch">
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
            </Field>
            <Field label="Party">
              <Input value={party} onChange={(e) => setParty(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Purchase ₹">
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label="Unit ₹">
            <Input type="number" value={unit} onChange={(e) => setUnit(Number(e.target.value) || 0)} />
          </Field>
          {edit?.kind === 'normal' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min price (FSE)">
                <Input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Max price (FSE)">
                <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value) || 0)} />
              </Field>
            </div>
          ) : (
            <Field label="Expiry date">
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </Field>
          )}
          <div className="flex gap-2 pt-2">
            <Button disabled={busy || !name.trim()} onClick={() => void saveEdit()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
