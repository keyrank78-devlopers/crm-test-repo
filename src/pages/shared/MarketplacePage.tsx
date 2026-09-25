import { PageHeader } from '../../components/ui/primitives'

const CHANNELS = [
  {
    name: 'Meesho',
    needs: 'Seller panel login, API / catalog access, order webhook',
    status: 'Research — credentials required',
  },
  {
    name: 'Snapdeal',
    needs: 'Seller hub access, API keys, return mapping',
    status: 'Research — credentials required',
  },
  {
    name: 'Amazon Seller Central',
    needs: 'SP-API credentials, marketplace IDs, order/finance scopes',
    status: 'Research — credentials required',
  },
  {
    name: 'Flipkart Seller Hub',
    needs: 'Seller API token, listing + order sync scopes',
    status: 'Research — credentials required',
  },
]

/** PDF §17 — Marketplace research (blocked on provider credentials) */
export function MarketplacePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        kicker="Integrations"
        title="E-commerce marketplaces"
        subtitle="Requirements checklist. Live sync starts after service-provider credentials are shared."
      />
      <ul className="space-y-2">
        {CHANNELS.map((c) => (
          <li key={c.name} className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-lg">{c.name}</p>
              <span className="rounded bg-cream px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Pending creds
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{c.needs}</p>
            <p className="mt-2 text-xs text-pine">{c.status}</p>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed border-line bg-cream/40 p-4 text-sm text-muted">
        <p className="font-medium text-ink">Also tracking (PDF §16 Research)</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Courier cost</li>
          <li>Return price</li>
          <li>Pending payment amount</li>
          <li>Data tracking with providers</li>
        </ul>
      </div>
    </div>
  )
}
