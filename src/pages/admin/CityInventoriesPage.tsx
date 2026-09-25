import { useCallback, useEffect, useState } from 'react'
import { inventoryApi, type CityInventory } from '../../api/inventory'
import { ApiError } from '../../api/http'
import { canManageCityInventory } from '../../api/accounts'
import { DataTable } from '../../components/ui/DataTable'
import { Button, Field, Input, Modal, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'

export function CityInventoriesPage() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const { push } = useToast()
  const [rows, setRows] = useState<CityInventory[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [citiesText, setCitiesText] = useState('')
  const [status, setStatus] = useState('active')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<CityInventory | null>(null)
  const [fetchError, setFetchError] = useState('')

  const canManage = canManageCityInventory(apiUser.role)

  const load = useCallback(async () => {
    setFetchError('')
    try {
      setRows(await inventoryApi.listCityInventories())
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : 'Failed to load inventories')
    }
  }, [])

  useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  if (loading) return <PageSkeleton />

  if (!canManage) {
    return (
      <div className="animate-fade-up">
        <PageHeader kicker="Stock" title="City inventories" />
        <p className="mt-4 max-w-lg text-muted">Only Admin or Manager can create city inventories.</p>
      </div>
    )
  }

  const filtered = rows.filter((r) => r.city.toLowerCase().includes(q.toLowerCase()) || r.status.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Stock"
        title="City inventories"
        actions={
          <>
            <Input className="w-48" placeholder="Search city" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button
              onClick={() => {
                setCitiesText('')
                setStatus('active')
                setOpen(true)
              }}
            >
              Add cities
            </Button>
          </>
        }
      />

      {fetchError ? <p className="mb-3 text-sm text-blush">{fetchError}</p> : null}

      <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        columns={[
          { key: 'city', header: 'City', cell: (r) => r.city, sort: (a, b) => a.city.localeCompare(b.city) },
          { key: 'status', header: 'Status', cell: (r) => r.status },
          {
            key: 'a',
            header: '',
            cell: (r) => (
              <Button size="sm" variant="ghost" onClick={() => setEdit({ ...r })}>
                Edit
              </Button>
            ),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Create city inventories">
        <div className="space-y-3">
          <Field label="Cities (one per line or comma-separated)">
            <textarea
              className="min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
              value={citiesText}
              onChange={(e) => setCitiesText(e.target.value)}
              placeholder={'Delhi\nMumbai\nJaipur'}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </Field>
          <Button
            disabled={busy}
            onClick={async () => {
              const cities = citiesText
                .split(/[\n,]+/)
                .map((c) => c.trim())
                .filter(Boolean)
              if (!cities.length) {
                push('Add at least one city')
                return
              }
              setBusy(true)
              try {
                const res = await inventoryApi.createCityInventories(cities, status)
                push(res.message)
                if (res.skipped.length) {
                  push(`Skipped: ${res.skipped.map((s) => s.city).join(', ')}`)
                }
                setOpen(false)
                await load()
              } catch (err) {
                push(err instanceof ApiError ? err.message : 'Create failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Create
          </Button>
        </div>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit city inventory">
        {edit && (
          <div className="space-y-3">
            <Field label="City">
              <Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select>
            </Field>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await inventoryApi.updateCityInventory(edit.id, { city: edit.city, status: edit.status })
                  push('Updated')
                  setEdit(null)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Update failed')
                } finally {
                  setBusy(false)
                }
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
