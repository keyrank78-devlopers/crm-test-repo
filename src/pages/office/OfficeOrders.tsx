import { useMemo, useState } from 'react'
import { api, useAppState } from '../../api/store'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { DataTable } from '../../components/ui/DataTable'
import { Button, ChannelBadge, EmptyState, Input, PageHeader, PageSkeleton, PaymentBadge, StatusBadge, usePageLoad } from '../../components/ui/primitives'
import { DispatchModal } from '../../components/orders/DispatchModal'
import { fmtDate, inr } from '../../lib/format'
import type { Order } from '../../types'

export function OfficeOrders() {
  const loading = usePageLoad()
  const state = useAppState()
  const { employee } = useSession()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [dispatchFor, setDispatchFor] = useState<Order | null>(null)

  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return state.orders.filter((o) => {
      const officeish = o.platform === 'retailer' || o.platform === 'ecommerce' || o.employee_id === employee.employee_id
      if (!officeish) return false
      if (!s) return true
      const c = state.customers.find((x) => x.customer_id === o.customer_id)
      return `${o.order_no} ${c?.customer_name} ${c?.firm_name}`.toLowerCase().includes(s)
    })
  }, [state, q, employee.employee_id])

  if (loading) return <PageSkeleton />

  return (
    <div className="animate-fade-up">
      <PageHeader kicker="Desk" title="Recent orders" subtitle="Edit only while still pending, then attach AWB." />
      <Input className="mb-4 max-w-md" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable
        rows={rows}
        rowKey={(o) => o.order_id}
        empty={<EmptyState title="No matching orders" body="Book one from Order entry." />}
        columns={[
          { key: 'no', header: 'Order', cell: (o) => o.order_no, sort: (a, b) => a.order_no.localeCompare(b.order_no) },
          { key: 'd', header: 'Date', cell: (o) => fmtDate(o.order_date), sort: (a, b) => a.order_date.localeCompare(b.order_date) },
          {
            key: 'c',
            header: 'Customer',
            cell: (o) => state.customers.find((c) => c.customer_id === o.customer_id)?.firm_name || state.customers.find((c) => c.customer_id === o.customer_id)?.customer_name,
          },
          { key: 'ch', header: 'Channel', cell: (o) => <ChannelBadge platform={o.platform} /> },
          { key: 'p', header: 'Pay', cell: (o) => <PaymentBadge mode={o.payment_mode} /> },
          { key: 'v', header: 'Value', cell: (o) => inr(o.total_value), sort: (a, b) => a.total_value - b.total_value },
          { key: 's', header: 'Status', cell: (o) => <StatusBadge status={o.delivery_status} /> },
          {
            key: 'a',
            header: '',
            cell: (o) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDispatchFor(o)}>
                  Dockets
                </Button>
                {o.delivery_status === 'Pending' ? (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={async () => {
                      await api.setDeliveryStatus(o.order_id, 'At Hub')
                      push('Moved to hub')
                    }}
                  >
                    Dispatch
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      <DispatchModal key={dispatchFor?.order_id} order={dispatchFor} onClose={() => setDispatchFor(null)} />
    </div>
  )
}
