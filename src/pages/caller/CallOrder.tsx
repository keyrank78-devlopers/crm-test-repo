import { OrderForm } from '../../components/orders/OrderForm'
import { PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'

export function CallOrder() {
  const loading = usePageLoad(200)
  if (loading) return <PageSkeleton />
  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <PageHeader
        kicker="Caller"
        title="Call order"
        subtitle="Book an order from a phone call. Platform defaults to call. Same form as office desk."
      />
      <OrderForm variant="office" defaultPlatform="call" />
    </div>
  )
}
