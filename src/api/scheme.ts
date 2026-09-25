import { apiFetch, API_BASE, asArray, getAccessToken } from './http'

export type SchemeKind =
  | 'amount'
  | 'product'
  | 'slab'
  | 'new_party'
  | 'target'
  | 'dual_stockist'
  | 'dual_retail'

export type ApiScheme = {
  id: string
  name: string
  kind: SchemeKind
  is_active: boolean
  min_amount: string | number
  product: string | null
  product_name?: string | null
  product_qty: number
  gift_name: string
  gift_qty: number
  gift_value: string | number
  gift_inventory?: string | null
  gift_inventory_name?: string | null
  gift_inventory_qty?: number | null
  convert_inventory?: string | null
  convert_inventory_name?: string | null
  convert_inventory_qty?: number | null
  allow_convert_to_product: boolean
  photo_url?: string | null
  target_amount: string | number
  duration_days: number
  remarks: string
  sort_order: number
}

export type SchemeInventoryItem = {
  id: string
  name: string
  quantity: number
  unit_value: string | number
  remarks: string
}

export type SchemeEligibleResponse = {
  customer_id: string
  customer_level: number
  prior_order_count: number
  prior_purchase_total: string
  order_amount: string
  combined_amount: string
  is_new_party: boolean
  eligible: (ApiScheme & { action: string; reason?: string; dual_role?: string })[]
  continue_schemes: (ApiScheme & {
    action: string
    reason?: string
    progress_amount?: string
    remaining?: string
  })[]
}

export type SchemeOrder = {
  id: string
  scheme_order_no?: string
  sale_order_id: string
  scheme_id: string
  scheme_name?: string
  customer_id?: string
  customer_name?: string
  firm_name?: string
  gift_name: string
  gift_qty: number
  status: string
  fse_name?: string
  tl_name?: string
  created_at?: string
}

export type SchemeInput = Partial<ApiScheme> & {
  name: string
  kind: SchemeKind
  gift_name: string
}

export type AttachSchemeResponse = {
  message: string
  order_schemes: unknown[]
  scheme_orders?: SchemeOrder[]
}

export const schemeApi = {
  list() {
    return apiFetch<unknown>('/scheme/').then((data) => asArray<ApiScheme>(data, ['results', 'data', 'schemes']))
  },
  create(data: SchemeInput) {
    return apiFetch<{ message: string; scheme: ApiScheme }>('/scheme/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  update(id: string, data: Partial<SchemeInput>) {
    return apiFetch<{ message: string; scheme: ApiScheme }>(`/scheme/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deactivate(id: string) {
    return apiFetch<{ message: string }>(`/scheme/${id}/`, { method: 'DELETE' })
  },
  uploadPhoto(schemeId: string, file: File) {
    const form = new FormData()
    form.append('photo', file)
    const token = getAccessToken()
    return fetch(`${API_BASE}/scheme/${schemeId}/photo/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { message?: string }).message || 'Photo upload failed')
      return data as { message: string; scheme_id: string; photo_url: string }
    })
  },
  eligible(data: {
    customer_id: string
    order_amount: number
    items?: { product_id: string; quantity: number }[]
  }) {
    return apiFetch<SchemeEligibleResponse>('/scheme/eligible/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  attach(orderId: string, selections: { scheme_id: string; mode: string }[]) {
    return apiFetch<AttachSchemeResponse>(`/scheme/orders/${orderId}/attach/`, {
      method: 'POST',
      body: JSON.stringify({ selections }),
    })
  },
  changeSchemeOrderStatus(schemeOrderId: string, status: string) {
    return apiFetch<{ message: string; scheme_order?: SchemeOrder }>(
      `/scheme/scheme-orders/${schemeOrderId}/status/`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
    )
  },
  listSchemeOrders(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return apiFetch<unknown>(`/scheme/scheme-orders/${q}`).then((data) =>
      asArray<SchemeOrder>(data, ['results', 'data', 'scheme_orders', 'orders']),
    )
  },
  listInventory() {
    return apiFetch<unknown>('/scheme/inventory/').then((data) =>
      asArray<SchemeInventoryItem>(data, ['results', 'data', 'items']),
    )
  },
  createInventory(data: { name: string; quantity?: number; unit_value?: number; remarks?: string }) {
    return apiFetch<{ message: string; item: SchemeInventoryItem }>('/scheme/inventory/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  stockIn(id: string, quantity: number, remarks?: string) {
    return apiFetch<{ message: string; item: SchemeInventoryItem }>(`/scheme/inventory/${id}/stock-in/`, {
      method: 'POST',
      body: JSON.stringify({ quantity, remarks }),
    })
  },
}
