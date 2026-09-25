import { apiFetch, asArray, type ApiUser, type BackendRole } from './http'

export const ALL_ASSIGNABLE_ROLES: { value: BackendRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'tl', label: 'TL' },
  { value: 'fse', label: 'FSE' },
  { value: 'caller', label: 'Caller' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'inventory', label: 'Inventory' },
]

/** Who can create which roles */
const CREATABLE: Record<string, BackendRole[]> = {
  admin: ['admin', 'manager', 'tl', 'fse', 'caller', 'dispatcher', 'inventory'],
  manager: ['tl', 'fse', 'caller'],
  tl: ['fse', 'caller'],
}

export function canManageUsers(role: string) {
  return role in CREATABLE
}

export function creatableRolesFor(actorRole: string) {
  const values = CREATABLE[actorRole] ?? []
  return ALL_ASSIGNABLE_ROLES.filter((r) => values.includes(r.value))
}

export function canManageCityInventory(role: string) {
  return role === 'admin' || role === 'manager'
}

/** @deprecated use ALL_ASSIGNABLE_ROLES / creatableRolesFor */
export const ASSIGNABLE_ROLES = ALL_ASSIGNABLE_ROLES

export type CreateUserInput = {
  email: string
  first_name: string
  last_name: string
  phone_number: string
  role: BackendRole
  password: string
  reports_to?: number | null
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  password?: string
  reports_to?: number | null
}

export type LoginResponse = {
  message: string
  access: string
  refresh: string
  user: ApiUser
}

export const accountsApi = {
  login(email: string, password: string) {
    return apiFetch<LoginResponse>('/accounts/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout() {
    return apiFetch<{ message: string }>('/accounts/logout/', { method: 'POST' })
  },

  me() {
    return apiFetch<ApiUser>('/accounts/me/')
  },

  listUsers() {
    return apiFetch<unknown>('/accounts/users/').then((data) => asArray<ApiUser>(data, ['results', 'data', 'users']))
  },

  createUser(data: CreateUserInput) {
    return apiFetch<{ message: string; user: ApiUser }>('/accounts/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateUser(id: number, data: UpdateUserInput) {
    return apiFetch<{ message: string; user: ApiUser }>(`/accounts/users/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  setActive(id: number, is_active: boolean) {
    return apiFetch<{ message: string; user: ApiUser }>(`/accounts/users/${id}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
  },
}
