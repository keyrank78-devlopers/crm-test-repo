import { useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { batchStock, isExpiring, productStock } from '../../lib/compute'
import { fmtDate } from '../../lib/format'
import { DataTable } from '../../components/ui/DataTable'
import { Button, ExpiryFlag, Field, Input, Modal, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { useToast } from '../../context/ToastContext'
import type { Product, ProductBatch } from '../../types'

export function ProductsPage() {
  const loading = usePageLoad()
  const state = useAppState()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [openP, setOpenP] = useState<Partial<Product> | null>(null)
  const [openB, setOpenB] = useState<Partial<ProductBatch> | null>(null)

  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return state.products.filter((p) => !s || p.product_name.toLowerCase().includes(s) || p.product_code.toLowerCase().includes(s))
  }, [state.products, q])

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Inventory catalogue"
        title="Products & batches"
        subtitle="Set min / max stock here. FSE order form only lists SKUs with on-hand inventory."
        actions={
          <>
            <Input className="w-56" placeholder="Search SKU" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button
              onClick={() =>
                setOpenP({ product_name: '', product_code: '', default_rate: 0, pack_size: '', low_stock_threshold: 40, max_stock: 400 })
              }
            >
              Add product
            </Button>
            <Button variant="ghost" onClick={() => setOpenB({ product_id: state.products[0]?.product_id, batch_no: '', mfg_date: '', expiry_date: '' })}>
              Add batch
            </Button>
          </>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(p) => p.product_id}
        columns={[
          { key: 'code', header: 'Code', cell: (p) => <span className="font-medium">{p.product_code}</span>, sort: (a, b) => a.product_code.localeCompare(b.product_code) },
          { key: 'name', header: 'Product', cell: (p) => p.product_name },
          { key: 'rate', header: 'Rate', cell: (p) => `₹${p.default_rate}`, sort: (a, b) => a.default_rate - b.default_rate },
          { key: 'pack', header: 'Pack', cell: (p) => p.pack_size },
          {
            key: 'minmax',
            header: 'Min / Max',
            cell: (p) => (
              <span className="text-sm">
                {p.low_stock_threshold} / {p.max_stock ?? '—'}
              </span>
            ),
          },
          {
            key: 'onhand',
            header: 'On hand',
            cell: (p) => <span className="font-medium">{Math.max(0, productStock(state, p.product_id))}</span>,
          },
          {
            key: 'batches',
            header: 'Batches',
            cell: (p) => (
              <div className="space-y-1">
                {state.batches
                  .filter((b) => b.product_id === p.product_id)
                  .map((b) => (
                    <div key={b.batch_id} className="flex flex-wrap items-center gap-2 text-xs">
                      <span>{b.batch_no}</span>
                      <span className="text-muted">exp {fmtDate(b.expiry_date)}</span>
                      <span>qty {batchStock(state, b.batch_id)}</span>
                      <ExpiryFlag kind={isExpiring(b.expiry_date, state.expiryAlertDays)} />
                      <button type="button" className="text-pine" onClick={() => setOpenB(b)}>
                        Edit
                      </button>
                    </div>
                  ))}
              </div>
            ),
          },
          {
            key: 'a',
            header: '',
            cell: (p) => (
              <Button size="sm" variant="ghost" onClick={() => setOpenP(p)}>
                Edit
              </Button>
            ),
          },
        ]}
      />

      <Modal open={!!openP} onClose={() => setOpenP(null)} title={openP?.product_id ? 'Edit product' : 'New product'}>
        {openP && (
          <div className="space-y-3">
            <Field label="Code">
              <Input value={openP.product_code ?? ''} onChange={(e) => setOpenP({ ...openP, product_code: e.target.value })} />
            </Field>
            <Field label="Name">
              <Input value={openP.product_name ?? ''} onChange={(e) => setOpenP({ ...openP, product_name: e.target.value })} />
            </Field>
            <Field label="Default rate">
              <Input type="number" value={openP.default_rate ?? 0} onChange={(e) => setOpenP({ ...openP, default_rate: Number(e.target.value) })} />
            </Field>
            <Field label="Pack size">
              <Input value={openP.pack_size ?? ''} onChange={(e) => setOpenP({ ...openP, pack_size: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min stock">
                <Input
                  type="number"
                  value={openP.low_stock_threshold ?? 40}
                  onChange={(e) => setOpenP({ ...openP, low_stock_threshold: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max stock">
                <Input type="number" value={openP.max_stock ?? 400} onChange={(e) => setOpenP({ ...openP, max_stock: Number(e.target.value) })} />
              </Field>
            </div>
            <Button
              onClick={async () => {
                if (!openP.product_name || !openP.product_code) return
                await api.saveProduct({
                  ...(openP as Product),
                  max_stock: openP.max_stock ?? 400,
                  low_stock_threshold: openP.low_stock_threshold ?? 40,
                })
                push('Product saved')
                setOpenP(null)
              }}
            >
              Save
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={!!openB} onClose={() => setOpenB(null)} title="Batch">
        {openB && (
          <div className="space-y-3">
            <Field label="Product">
              <Select value={openB.product_id ?? ''} onChange={(e) => setOpenB({ ...openB, product_id: e.target.value })}>
                {state.products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Batch no">
              <Input value={openB.batch_no ?? ''} onChange={(e) => setOpenB({ ...openB, batch_no: e.target.value })} />
            </Field>
            <Field label="Mfg">
              <Input type="date" value={openB.mfg_date ?? ''} onChange={(e) => setOpenB({ ...openB, mfg_date: e.target.value })} />
            </Field>
            <Field label="Expiry">
              <Input type="date" value={openB.expiry_date ?? ''} onChange={(e) => setOpenB({ ...openB, expiry_date: e.target.value })} />
            </Field>
            <Button
              onClick={async () => {
                if (!openB.batch_no || !openB.mfg_date || !openB.expiry_date || !openB.product_id) return
                await api.saveBatch(openB as ProductBatch)
                push('Batch saved')
                setOpenB(null)
              }}
            >
              Save
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
