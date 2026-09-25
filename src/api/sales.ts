import { apiFetch, asArray } from './http'
import type { ApiCustomer } from './customers'

export type OrderSummary = {
  order_id: string
  status: string
  quantity: number
  total_price: string
  has_expiry_claim: boolean
  expiry_claim_total: string
  expiry_claim_used: string
  expiry_claim_remaining: string
  payable_now: string
}

export type ApiOrderItem = {
  id: string
  product: string
  product_name?: string
  quantity: number
  price: string
  amount: string
  claim_applied: string
}

export type PaymentBalance = {
  total_amount: string
  initial_paid?: string
  collected_amount?: string
  paid_amount: string
  pending_amount: string
  payment_type: string | null
  payment_status: string | null
  upi_id?: string
  advance_payment_cash?: string
  advance_payment_credits?: string
  receipt_count?: number
}

export type PaymentReceiptRow = {
  id: string
  amount: string
  method: string
  reference: string
  received_at: string | null
  notes: string
  created_at: string | null
  recorded_by: string | null
}

export type ApiOrder = {
  id: string
  platform: string
  customer: string
  customer_name?: string
  firm_name?: string | null
  customer_detail?: ApiCustomer
  quantity: number
  total_price: string
  payment_type: string
  payment_terms?: {
    payment_type: string
    total_amount: string
    advance_payment_cash: string
    advance_payment_credits: string
    paid_amount?: string
    pending_amount?: string
    payment_status: string
    receipt_count?: number
    upi_id?: string
  } | null
  created_by_name?: string | null
  created_by_role?: string
  tl_name?: string | null
  user?: number
  status: string
  order_remarks: string | null
  has_expiry_claim: boolean
  expiry_claim_total: string
  expiry_claim_used: string
  expiry_claim_remaining: string
  order_date?: string
  created_at?: string
  items?: ApiOrderItem[]
  scheme_gifts?: {
    id?: string
    scheme_id?: string
    scheme_name?: string
    gift_name: string
    gift_qty: number
    mode?: string
    attached_at?: string | null
  }[]
}



export type CreateOrderInput = {
  customer_id: string
  platform?: string
  payment_type?: 'retail' | 'wholesale'
  order_remarks?: string
  has_expiry_claim: boolean
  items?: { product_id: string; quantity: number; price?: number }[]
}

export type ExpiryCategory = 'missing' | 'damage' | 'non_working'

export type ExpiryClaimItem = {
  expiry_product_id?: string
  name?: string
  batch_number?: string
  purchase_party?: string
  quantity: number
  price?: number
  expiry_date?: string
  category?: ExpiryCategory
  remarks?: string
}

export const salesApi = {
  listOrders() {
    return apiFetch<unknown>('/sales/orders/').then((data) => asArray<ApiOrder>(data, ['results', 'data', 'orders']))
  },
  createOrder(data: CreateOrderInput) {
    return apiFetch<{
      message: string
      inventory_updated: boolean
      inventory_deductions: unknown[]
      next_step: string
      order: OrderSummary
    }>('/sales/orders/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  getOrder(orderId: string) {
    return apiFetch<unknown>(`/sales/orders/${orderId}/`)
  },
  attachExpiryClaim(orderId: string, items: ExpiryClaimItem[], remarks = '') {
    return apiFetch<{ message: string; order: OrderSummary }>(`/sales/orders/${orderId}/expiry-claim/`, {
      method: 'POST',
      body: JSON.stringify({ remarks, items }),
    })
  },
  skipExpiryClaim(orderId: string) {
    return apiFetch<{ message: string; order: OrderSummary }>(`/sales/orders/${orderId}/expiry-claim/skip/`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
  addProducts(
    orderId: string,
    items: { product_id: string; quantity: number; price?: number }[],
    apply_expiry_claim = true,
  ) {
    return apiFetch<{ message: string; order: OrderSummary; inventory_deductions?: unknown[] }>(
      `/sales/orders/${orderId}/products/`,
      {
        method: 'POST',
        body: JSON.stringify({ items, apply_expiry_claim }),
      },
    )
  },
  setPaymentTerms(
    orderId: string,
    data: {
      payment_type: string
      advance_payment_cash?: number
      advance_payment_credits?: number
      upi_id?: string
    },
  ) {
    return apiFetch<{
      message: string
      payment: {
        id: string
        payment_type: string
        total_amount: string
        advance_payment_cash: string
        advance_payment_credits: string
        upi_id?: string
        paid_amount?: string
        pending_amount?: string
        payment_status: string
      }
      order: OrderSummary
    }>(`/sales/orders/${orderId}/payment/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getPayment(orderId: string) {
    return apiFetch<{
      message?: string
      payment: (PaymentBalance & { id?: string }) | null
      balance: PaymentBalance
      history: PaymentReceiptRow[]
      order: OrderSummary
    }>(`/sales/orders/${orderId}/payment/`)
  },

  recordPayment(
    orderId: string,
    data: {
      amount: number
      method?: string
      reference?: string
      received_at?: string
      notes?: string
    },
  ) {
    return apiFetch<{
      message: string
      receipt: PaymentReceiptRow
      balance: PaymentBalance
      history: PaymentReceiptRow[]
      order: OrderSummary
    }>(`/sales/orders/${orderId}/payment/receive/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  listUnproductive() {
    return apiFetch<unknown>('/sales/unproductive/').then((data) =>
      asArray<{
        id: string
        firm_name: string
        contact_name: string
        email: string
        phone: string
        address: string
        remarks: string
        visit_date: string
      }>(data, ['results', 'data']),
    )
  },

  createUnproductive(data: {
    firm_name: string
    contact_name: string
    email?: string
    phone: string
    address?: string
    remarks: string
    visit_date: string
  }) {
    return apiFetch<{ message: string; id: string }>('/sales/unproductive/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  changeStatus(
    orderId: string,
    status: string,
    extra?: { return_remarks?: string; followup_status?: string; followup_note?: string },
  ) {
    return apiFetch<{ message: string; order_id?: string; status?: string; order?: ApiOrder }>(
      `/sales/orders/${orderId}/status/`,
      {
        method: 'POST',
        body: JSON.stringify({ status, ...extra }),
      },
    )
  },
  exportOrders(dateFrom?: string, dateTo?: string) {
    const q = new URLSearchParams()
    if (dateFrom) q.set('date_from', dateFrom)
    if (dateTo) q.set('date_to', dateTo)
    const qs = q.toString()
    return `/sales/orders/export/${qs ? `?${qs}` : ''}`
  },
}
