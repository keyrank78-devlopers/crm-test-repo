import { apiFetch, asArray } from './http'

export type CityInventory = {
  id: string
  city: string
  status: string
  created_at?: string
  updated_at?: string
}

export type BulkCityCreateResult = {
  message: string
  created: CityInventory[]
  skipped: { city: string; id: string; reason: string }[]
}

export type ApiProduct = {
  id: string
  name: string
  purchase_party: string
  date: string
  batch_number: string
  price: number
  quantity: number
  single_unit_price: string | number
  inventory: string | null
  max_price?: string | number
  min_price?: string | number
}

export type ApiExpiryProduct = ApiProduct & {
  produt_id: string
  expiry_date: string | null
}

export type ProductCreateInput = {
  name: string
  purchase_party: string
  date: string
  batch_number: string
  price: number
  quantity: number
  inventory?: string
  max_price?: number
  min_price?: number
  expiry_date?: string
  produt_id?: string
}

export const inventoryApi = {
  listCityInventories() {
    return apiFetch<unknown>('/inventory/product-in-inventory/').then((data) =>
      asArray<CityInventory>(data, ['results', 'data']),
    )
  },

  createCityInventories(cities: string[], status = 'active') {
    return apiFetch<BulkCityCreateResult>('/inventory/product-in-inventory/', {
      method: 'POST',
      body: JSON.stringify({ cities, status }),
    })
  },

  updateCityInventory(id: string, data: Partial<Pick<CityInventory, 'city' | 'status'>>) {
    return apiFetch<CityInventory>(`/inventory/product-in-inventory-by-id/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  listProducts() {
    return apiFetch<unknown>('/inventory/product/').then((data) => asArray<ApiProduct>(data, ['results', 'data', 'products']))
  },

  createProducts(items: ProductCreateInput[]) {
    return apiFetch<{ message: string; created: ApiProduct[]; errors: unknown[] }>('/inventory/product/', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  },

  createProduct(data: ProductCreateInput) {
    return apiFetch<ApiProduct>('/inventory/product/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  listExpiryProducts() {
    return apiFetch<unknown>('/inventory/expiry-product/').then((data) =>
      asArray<ApiExpiryProduct>(data, ['results', 'data', 'products']),
    )
  },

  createExpiryProducts(items: ProductCreateInput[]) {
    return apiFetch<{ message: string; created: ApiExpiryProduct[]; errors: unknown[] }>(
      '/inventory/expiry-product/',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    )
  },

  updateProduct(id: string, data: Partial<ProductCreateInput> & { quantity?: number; single_unit_price?: number }) {
    return apiFetch<ApiProduct>(`/inventory/product-by-id/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  updateExpiryProduct(id: string, data: Partial<ProductCreateInput> & { quantity?: number; expiry_date?: string; single_unit_price?: number }) {
    return apiFetch<ApiExpiryProduct>(`/inventory/expiry-product-by-id/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  exportPath(kind: 'normal' | 'expiry' = 'normal') {
    return `/inventory/export/?kind=${kind}`
  },
}
