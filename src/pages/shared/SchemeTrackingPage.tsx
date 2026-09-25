import { useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { DataTable } from '../../components/ui/DataTable'
import { Badge, Button, EmptyState, Input, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { inr } from '../../lib/format'
import type { SchemeStatus } from '../../types'
import { useToast } from '../../context/ToastContext'

const STATUS_CLASS: Record<SchemeStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  'Gift dispatched': 'bg-gold/20 text-[#7a5a22] ring-[#e6d3a8]',
  Delivered: 'bg-sage/25 text-pine ring-sage/40',
  Cancelled: 'bg-stone-100 text-stone-500 ring-stone-200',
}

export function SchemeTrackingPage() {
  const loading = usePageLoad()
  const state = useAppState()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [offerName, setOfferName] = useState('')
  const [amazonName, setAmazonName] = useState('Amazon Gift ₹500')

  const glassOffers = state.schemeOffers.filter((o) => (o.scheme_kind ?? 'glass_free') === 'glass_free')
  const amazonOffers = state.schemeOffers.filter((o) => o.scheme_kind === 'amazon_gift')

  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return state.schemes
      .map((sc) => ({
        sc,
        customer: state.customers.find((c) => c.customer_id === sc.customer_id)!,
        caller: state.employees.find((e) => e.employee_id === sc.caller_id),
        isAmazon: /amazon/i.test(sc.gift_link) || /amazon/i.test(sc.caller_remark),
      }))
      .filter((r) => !status || r.sc.status === status)
      .filter((r) => !s || `${r.customer.customer_name} ${r.customer.firm_name} ${r.sc.scheme_month}`.toLowerCase().includes(s))
  }, [state, q, status])

  const amazonRows = rows.filter((r) => r.isAmazon)
  const otherRows = rows.filter((r) => !r.isAmazon)

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Schemes"
        title="Scheme tracking"
        subtitle="Glass-free schemes on the order form, plus Amazon gift offers tracked separately."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Glass-free schemes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="e.g. 1 glass free" value={offerName} onChange={(e) => setOfferName(e.target.value)} />
            <Button
              onClick={async () => {
                if (!offerName.trim()) return
                try {
                  await api.addSchemeOffer(offerName, 'glass_free')
                  setOfferName('')
                  push('Glass-free scheme added')
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Could not add scheme', 'err')
                }
              }}
            >
              Add
            </Button>
            {[1, 2, 3].map((n) => (
              <Button
                key={n}
                variant="ghost"
                onClick={async () => {
                  try {
                    await api.addSchemeOffer(`${n} glass free`, 'glass_free')
                    push(`${n} glass free ready`)
                  } catch (e) {
                    push(e instanceof Error ? e.message : 'Already listed', 'err')
                  }
                }}
              >
                + {n} glass free
              </Button>
            ))}
          </div>
          {glassOffers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">None yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {glassOffers.map((o) => (
                <li key={o.offer_id} className="flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-sm">
                  {o.offer_name}
                  <button type="button" className="text-blush" onClick={() => void api.removeSchemeOffer(o.offer_id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Amazon gift offers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input className="max-w-xs" value={amazonName} onChange={(e) => setAmazonName(e.target.value)} placeholder="Amazon Gift ₹500" />
            <Button
              onClick={async () => {
                if (!amazonName.trim()) return
                try {
                  await api.addSchemeOffer(amazonName, 'amazon_gift')
                  setAmazonName('Amazon Gift ₹500')
                  push('Amazon gift offer added')
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Could not add', 'err')
                }
              }}
            >
              Add Amazon gift
            </Button>
            {['Amazon Gift ₹500', 'Amazon Gift ₹1000'].map((label) => (
              <Button
                key={label}
                variant="ghost"
                onClick={async () => {
                  try {
                    await api.addSchemeOffer(label, 'amazon_gift')
                    push(`${label} ready`)
                  } catch (e) {
                    push(e instanceof Error ? e.message : 'Already listed', 'err')
                  }
                }}
              >
                + {label}
              </Button>
            ))}
          </div>
          {amazonOffers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">None yet. Add “Amazon Gift ₹500” style offers.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {amazonOffers.map((o) => (
                <li key={o.offer_id} className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">
                  {o.offer_name}
                  <button type="button" className="text-blush" onClick={() => void api.removeSchemeOffer(o.offer_id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Customer or month" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['Pending', 'Gift dispatched', 'Delivered', 'Cancelled'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Amazon gift tracking</p>
      <DataTable
        rows={amazonRows}
        rowKey={(r) => r.sc.scheme_id}
        empty={<EmptyState title="No Amazon gift rows" body="Seeded Amazon gift links appear here." />}
        columns={[
          { key: 'c', header: 'Customer', cell: (r) => r.customer.firm_name || r.customer.customer_name },
          { key: 'm', header: 'Month', cell: (r) => r.sc.scheme_month },
          { key: 'q', header: 'Qty', cell: (r) => r.sc.quantity },
          { key: 'v', header: 'Value', cell: (r) => inr(r.sc.scheme_value) },
          {
            key: 'g',
            header: 'Gift',
            cell: (r) => (
              <a className="text-pine underline" href={r.sc.gift_link} target="_blank" rel="noreferrer">
                Amazon link
              </a>
            ),
          },
          {
            key: 's',
            header: 'Status',
            cell: (r) => <Badge className={STATUS_CLASS[r.sc.status]}>{r.sc.status}</Badge>,
          },
          {
            key: 'a',
            header: '',
            cell: (r) => (
              <Select
                className="w-40 py-1"
                value={r.sc.status}
                onChange={(e) => void api.updateScheme(r.sc.scheme_id, { status: e.target.value as SchemeStatus })}
              >
                {['Pending', 'Gift dispatched', 'Delivered', 'Cancelled'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            ),
          },
        ]}
      />

      <p className="mb-2 mt-8 text-xs font-medium uppercase tracking-wider text-muted">Glass / other scheme tracking</p>
      <DataTable
        rows={otherRows}
        rowKey={(r) => r.sc.scheme_id}
        empty={<EmptyState title="No schemes" body="Qualify a retailer and they'll appear here." />}
        columns={[
          { key: 'c', header: 'Customer', cell: (r) => r.customer.firm_name || r.customer.customer_name },
          { key: 'm', header: 'Month', cell: (r) => r.sc.scheme_month },
          { key: 'q', header: 'Qty', cell: (r) => r.sc.quantity, sort: (a, b) => a.sc.quantity - b.sc.quantity },
          { key: 'v', header: 'Value', cell: (r) => inr(r.sc.scheme_value) },
          {
            key: 'g',
            header: 'Gift',
            cell: (r) => (
              <a className="text-pine underline" href={r.sc.gift_link} target="_blank" rel="noreferrer">
                Link
              </a>
            ),
          },
          {
            key: 's',
            header: 'Status',
            cell: (r) => <Badge className={STATUS_CLASS[r.sc.status]}>{r.sc.status}</Badge>,
          },
          { key: 'cl', header: 'Caller', cell: (r) => r.caller?.employee_name ?? '—' },
          {
            key: 'rm',
            header: 'Remark',
            cell: (r) => (
              <Input
                defaultValue={r.sc.caller_remark}
                onBlur={(e) => {
                  if (e.target.value !== r.sc.caller_remark) void api.updateScheme(r.sc.scheme_id, { caller_remark: e.target.value }).then(() => push('Remark saved'))
                }}
              />
            ),
          },
          {
            key: 'a',
            header: '',
            cell: (r) => (
              <Select
                className="w-40 py-1"
                value={r.sc.status}
                onChange={(e) => void api.updateScheme(r.sc.scheme_id, { status: e.target.value as SchemeStatus })}
              >
                {['Pending', 'Gift dispatched', 'Delivered', 'Cancelled'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            ),
          },
        ]}
      />
    </div>
  )
}
