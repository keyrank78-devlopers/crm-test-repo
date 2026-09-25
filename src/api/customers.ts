import { apiFetch, asArray } from './http'

export type ApiCustomer = {
  id: string
  name: string
  firm_name: string | null
  phone: string
  optional_phone: string | null
  gender: 'male' | 'female' | 'other'
  city: string
  state: string
  country: string
  pincode: number
  landmark: string
  tehsil: string
  district: string
  level: number
  gst_number: string | null
  driving_license_number: string | null
  addhar_number: string | null
  customer_type: string
}

export type CreateCustomerInput = {
  name: string
  firm_name?: string
  phone: string
  optional_phone?: string
  gender: 'male' | 'female' | 'other'
  city: string
  state: string
  country?: string
  pincode: number
  landmark?: string
  tehsil?: string
  district?: string
  level?: number
  gst_number?: string
  driving_license_number?: string
  addhar_number?: string
  customer_type: string
}

export const customersApi = {
  list(q?: string) {
    const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
    return apiFetch<unknown>(`/customers/${query}`).then((data) =>
      asArray<ApiCustomer>(data, ['results', 'data', 'customers']),
    )
  },
  create(data: CreateCustomerInput) {
    return apiFetch<{ message: string; customer: ApiCustomer }>('/customers/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  get(id: string) {
    return apiFetch<ApiCustomer>(`/customers/${id}/`)
  },
}
