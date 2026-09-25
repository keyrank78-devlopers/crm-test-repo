import { useCallback, useEffect, useState } from 'react'
import { schemeApi, type ApiScheme, type SchemeKind, type SchemeInput, type SchemeInventoryItem } from '../../api/scheme'
import { inventoryApi, type ApiProduct } from '../../api/inventory'
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
  Textarea,
  usePageLoad,
} from '../../components/ui/primitives'
import { DataTable } from '../../components/ui/DataTable'

const KINDS: { value: SchemeKind; label: string }[] = [
  { value: 'amount', label: 'Amount based' },
  { value: 'product', label: 'Product based' },
  { value: 'slab', label: 'Slab based' },
  { value: 'new_party', label: 'New party' },
  { value: 'target', label: 'Target / time' },
  { value: 'dual_stockist', label: 'Dual — stockist' },
  { value: 'dual_retail', label: 'Dual — retail' },
]

type Draft = {
  id?: string
  name: string
  kind: SchemeKind
  min_amount: number
  product: string
  product_qty: number
  gift_name: string
  gift_qty: number
  gift_value: number
  gift_inventory: string
  photo_preview: string
  photo_file: File | null
  target_amount: number
  duration_days: number
  remarks: string
  is_active: boolean
}

function emptyDraft(): Draft {
  return {
    name: '',
    kind: 'amount',
    min_amount: 500,
    product: '',
    product_qty: 0,
    gift_name: '',
    gift_qty: 1,
    gift_value: 0,
    gift_inventory: '',
    photo_preview: '',
    photo_file: null,
    target_amount: 0,
    duration_days: 0,
    remarks: '',
    is_active: true,
  }
}

export function SchemesPage() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const { push } = useToast()
  const canEdit = apiUser.role === 'admin' || apiUser.role === 'manager'
  const [rows, setRows] = useState<ApiScheme[]>([])
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [invItems, setInvItems] = useState<SchemeInventoryItem[]>([])
  const [tab, setTab] = useState<'schemes' | 'inventory'>('schemes')
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [invName, setInvName] = useState('')
  const [invQty, setInvQty] = useState(0)
  const [invValue, setInvValue] = useState(0)
  const [stockFor, setStockFor] = useState<SchemeInventoryItem | null>(null)
  const [stockQty, setStockQty] = useState(0)

  const load = useCallback(async () => {
    setError('')
    try {
      const [s, p, inv] = await Promise.all([
        schemeApi.list(),
        inventoryApi.listProducts(),
        schemeApi.listInventory(),
      ])
      setRows(Array.isArray(s) ? s : [])
      setProducts(Array.isArray(p) ? p : [])
      setInvItems(Array.isArray(inv) ? inv : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load schemes')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <PageSkeleton />

  if (!canEdit) {
    return (
      <div>
        <PageHeader kicker="Schemes" title="Schemes" />
        <p className="mt-4 text-muted">Only Admin / Manager can manage schemes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Admin"
        title="Schemes"
        subtitle="One-page scheme desk — gift inventory, photo, ₹500+ amount/duration customisation. Invoice price unchanged."
        actions={
          tab === 'schemes' ? (
            <Button onClick={() => setEdit(emptyDraft())}>Add scheme</Button>
          ) : null
        }
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'schemes' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setTab('schemes')}
        >
          Schemes
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${tab === 'inventory' ? 'bg-pine text-cream' : 'bg-cream'}`}
          onClick={() => setTab('inventory')}
        >
          Scheme inventory
        </button>
      </div>
      {error ? <p className="text-sm text-blush">{error}</p> : null}

      {tab === 'inventory' ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-4">
            <Field label="Item name">
              <Input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Glass / Fan / Freia 10gm" />
            </Field>
            <Field label="Opening qty">
              <Input type="number" value={invQty} onChange={(e) => setInvQty(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Unit value ₹">
              <Input type="number" value={invValue} onChange={(e) => setInvValue(Number(e.target.value) || 0)} />
            </Field>
            <div className="flex items-end">
              <Button
                disabled={busy || !invName.trim()}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await schemeApi.createInventory({
                      name: invName.trim(),
                      quantity: invQty,
                      unit_value: invValue,
                    })
                    push('Scheme inventory added')
                    setInvName('')
                    setInvQty(0)
                    setInvValue(0)
                    await load()
                  } catch (err) {
                    push(err instanceof ApiError ? err.message : 'Failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Add item
              </Button>
            </div>
          </div>
          {invItems.length === 0 ? (
            <EmptyState title="No scheme stock" body="Add glasses, fans, AC, or convert products here." />
          ) : (
            <DataTable
              rows={invItems}
              rowKey={(r) => r.id}
              columns={[
                { key: 'n', header: 'Item', cell: (r) => r.name },
                { key: 'q', header: 'Qty', cell: (r) => r.quantity },
                { key: 'v', header: 'Unit ₹', cell: (r) => String(r.unit_value) },
                {
                  key: 'a',
                  header: '',
                  cell: (r) => (
                    <Button size="sm" variant="ghost" onClick={() => { setStockFor(r); setStockQty(0) }}>
                      Stock in
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      ) : tab === 'schemes' && rows.length === 0 ? (
        <EmptyState title="No schemes" body="Create amount, product, slab, new party, target or dual schemes." />
      ) : tab === 'schemes' ? (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => r.name },
            {
              key: 'kind',
              header: 'Type',
              cell: (r) => KINDS.find((k) => k.value === r.kind)?.label ?? r.kind,
            },
            {
              key: 'trigger',
              header: 'Trigger',
              cell: (r) => {
                if (r.kind === 'product') return `${r.product_name || 'Product'} × ${r.product_qty}`
                if (r.kind === 'target') return `Target ₹${r.target_amount} / ${r.duration_days}d`
                return `₹${r.min_amount}`
              },
            },
            {
              key: 'gift',
              header: 'Gift / stock',
              cell: (r) => (
                <span>
                  {r.gift_qty} × {r.gift_name}
                  <span className="block text-xs text-muted">
                    {r.gift_inventory_name
                      ? `${r.gift_inventory_name} · qty ${r.gift_inventory_qty ?? 0}`
                      : 'No scheme inventory linked'}
                  </span>
                </span>
              ),
            },
            {
              key: 'on',
              header: 'Active',
              cell: (r) => (r.is_active ? 'Yes' : 'No'),
            },
            {
              key: 'a',
              header: '',
              cell: (r) => (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        id: r.id,
                        name: r.name,
                        kind: r.kind,
                        min_amount: Number(r.min_amount) || 0,
                        product: r.product || '',
                        product_qty: r.product_qty || 0,
                        gift_name: r.gift_name,
                        gift_qty: r.gift_qty || 1,
                        gift_value: Number(r.gift_value) || 0,
                        gift_inventory: r.gift_inventory || '',
                        photo_preview: r.photo_url || '',
                        photo_file: null,
                        target_amount: Number(r.target_amount) || 0,
                        duration_days: r.duration_days || 0,
                        remarks: r.remarks || '',
                        is_active: r.is_active,
                      })
                    }
                  >
                    Edit
                  </Button>
                  {r.is_active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await schemeApi.deactivate(r.id)
                          push('Scheme deactivated')
                          await load()
                        } catch (err) {
                          push(err instanceof ApiError ? err.message : 'Failed')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      Off
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      ) : null}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit scheme' : 'Add scheme'} wide>
        {edit ? (
          <div className="space-y-3">
            <Field label="Name">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select
                value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value as SchemeKind })}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            {edit.kind === 'product' ? (
              <>
                <Field label="Product">
                  <Select value={edit.product} onChange={(e) => setEdit({ ...edit, product: e.target.value })}>
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Product qty">
                  <Input
                    type="number"
                    value={edit.product_qty}
                    onChange={(e) => setEdit({ ...edit, product_qty: Number(e.target.value) || 0 })}
                  />
                </Field>
              </>
            ) : (
              <Field label={edit.kind === 'target' ? 'Min / start amount' : 'Min amount ₹'}>
                <Input
                  type="number"
                  value={edit.min_amount}
                  onChange={(e) => setEdit({ ...edit, min_amount: Number(e.target.value) || 0 })}
                />
              </Field>
            )}
            {edit.kind === 'target' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target amount ₹">
                  <Input
                    type="number"
                    value={edit.target_amount}
                    onChange={(e) => setEdit({ ...edit, target_amount: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Duration days">
                  <Input
                    type="number"
                    value={edit.duration_days}
                    onChange={(e) => setEdit({ ...edit, duration_days: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Scheme inventory product">
              <Select
                value={edit.gift_inventory}
                onChange={(e) => {
                  const id = e.target.value
                  const item = invItems.find((i) => i.id === id)
                  setEdit({
                    ...edit,
                    gift_inventory: id,
                    gift_name: item?.name || edit.gift_name,
                    gift_value: item ? Number(item.unit_value) || 0 : edit.gift_value,
                  })
                }}
              >
                <option value="">Select from scheme inventory…</option>
                {invItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (qty {i.quantity})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qty for this scheme">
                <Input
                  type="number"
                  min={1}
                  value={edit.gift_qty}
                  onChange={(e) => setEdit({ ...edit, gift_qty: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label="Unit value ₹">
                <Input
                  type="number"
                  value={edit.gift_value}
                  onChange={(e) => setEdit({ ...edit, gift_value: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <Field label="Scheme photo">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () =>
                    setEdit({ ...edit, photo_preview: String(reader.result || ''), photo_file: file })
                  reader.readAsDataURL(file)
                }}
              />
              {edit.photo_preview ? (
                <img src={edit.photo_preview} alt="" className="mt-2 h-20 w-20 rounded-lg object-cover ring-1 ring-line" />
              ) : (
                <span className="mt-1 block text-xs text-muted">Optional scheme image</span>
              )}
            </Field>
            <Field label="Remarks">
              <Textarea value={edit.remarks} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} rows={2} />
            </Field>
            <Button
              disabled={busy || !edit.name.trim() || !edit.gift_inventory || edit.gift_qty < 1}
              onClick={async () => {
                setBusy(true)
                try {
                  const invName =
                    invItems.find((i) => i.id === edit.gift_inventory)?.name || edit.gift_name.trim() || 'Gift'
                  const payload: SchemeInput = {
                    name: edit.name.trim(),
                    kind: edit.kind,
                    min_amount: edit.min_amount,
                    product: edit.kind === 'product' ? edit.product || null : null,
                    product_qty: edit.product_qty,
                    gift_name: invName,
                    gift_qty: edit.gift_qty,
                    gift_value: edit.gift_value,
                    gift_inventory: edit.gift_inventory || null,
                    convert_inventory: null,
                    allow_convert_to_product: false,
                    target_amount: edit.target_amount,
                    duration_days: edit.duration_days,
                    remarks: edit.remarks,
                    is_active: edit.is_active,
                  }
                  if (edit.id) {
                    await schemeApi.update(edit.id, payload)
                    if (edit.photo_file) {
                      try {
                        await schemeApi.uploadPhoto(edit.id, edit.photo_file)
                      } catch {
                        push('Scheme saved; photo upload failed (is API ready?)')
                      }
                    }
                    push('Scheme updated')
                  } else {
                    const created = await schemeApi.create(payload)
                    if (edit.photo_file && created.scheme?.id) {
                      try {
                        await schemeApi.uploadPhoto(created.scheme.id, edit.photo_file)
                      } catch {
                        push('Scheme created; photo upload failed (is API ready?)')
                      }
                    }
                    push('Scheme created')
                  }
                  setEdit(null)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Save failed')
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

      <Modal open={!!stockFor} onClose={() => setStockFor(null)} title="Scheme stock in">
        {stockFor ? (
          <div className="space-y-3">
            <p className="text-sm">
              {stockFor.name} · current qty {stockFor.quantity}
            </p>
            <Field label="Add qty">
              <Input type="number" min={1} value={stockQty || ''} onChange={(e) => setStockQty(Number(e.target.value) || 0)} />
            </Field>
            <Button
              disabled={busy || stockQty <= 0}
              onClick={async () => {
                setBusy(true)
                try {
                  await schemeApi.stockIn(stockFor.id, stockQty)
                  push('Stock in saved')
                  setStockFor(null)
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
