import { useEffect } from 'react'
import { OrderForm } from '../../components/orders/OrderForm'
import { PageHeader, PageSkeleton, usePageLoad } from '../../components/ui/primitives'

export function OfficeOrder() {
  const loading = usePageLoad(200)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        document.getElementById('order-submit')?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (loading) return <PageSkeleton />
  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <PageHeader kicker="Desk" title="Order entry" subtitle="Stock is checked live. After create you get a unique order ID, then choose payment terms." />
      <OrderForm variant="office" />
    </div>
  )
}
