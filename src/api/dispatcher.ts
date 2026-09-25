import { apiFetch, asArray } from './http'

export type DispatchRow = {
  id: string
  order: string
  courier: 'shadowfax' | 'delhivery' | 'india_post'
  awb_code: string
  status: string
  last_synced_at?: string | null
  order_status?: string
  customer_name?: string
  firm_name?: string | null
  total_price?: string
}

export type WaitingOrder = {
  id: string
  status: string
  total_price: string
  customer_name: string
  firm_name: string | null
  created_by: string
}

export const dispatcherApi = {
  desk() {
    return apiFetch<unknown>('/dispatcher/').then((data) => {
      const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
      return {
        waiting: asArray<WaitingOrder>(obj.waiting ?? data, ['waiting', 'results', 'data']),
        dispatches: asArray<DispatchRow>(obj.dispatches, ['dispatches', 'results', 'data']),
      }
    })
  },
  create(data: {
    order_id?: string
    scheme_order_id?: string
    courier: string
    awb_code: string
  }) {
    return apiFetch<{ message: string; dispatch: DispatchRow }>('/dispatcher/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateStatus(id: string, status: string, tracking_raw?: string) {
    return apiFetch<{ message: string; dispatch: DispatchRow }>(`/dispatcher/${id}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status, tracking_raw }),
    })
  },
  syncDelhivery() {
    return apiFetch<{ message: string; count: number }>('/dispatcher/delhivery/sync/', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
}
