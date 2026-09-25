import { apiFetch, API_BASE, getAccessToken } from './http'

export type DashboardPulse = {
  date: string
  orders: {
    total: number
    delivered: number
    dispatching: number
    in_transit: number
    returned: number
  }
  revenue: {
    total: number
    delivered: number
    dispatching: number
    in_transit: number
    returned: number
  }
  products: {
    total: number
    in_stock: number
    new_purchase: number
    stock_out: number
    out_of_stock: number
  }
  team: {
    total: number
    managers: number
    tl: number
    fse_caller: number
  }
  expiry: {
    total_cases: number
    open: number
    pending_mrp: number
    closed_this_month: number
  }
  cities?: { id: string; city: string; status: string }[]
}

export const dashboardApi = {
  pulse(date: string) {
    return apiFetch<DashboardPulse>(`/dashboard/pulse/?date=${encodeURIComponent(date)}`)
  },
}

/** Trigger browser download for export endpoints. */
export async function downloadExport(path: string, filename: string) {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
