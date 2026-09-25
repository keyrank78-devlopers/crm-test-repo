const TOKEN_KEY = 'freia_access'
const REFRESH_KEY = 'freia_refresh'
const USER_KEY = 'freia_api_user'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export type ApiUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  role: BackendRole
  phone_number: string
  is_active: boolean
  reports_to?: number | null
  reports_to_name?: string | null
}

export type BackendRole = 'admin' | 'manager' | 'tl' | 'fse' | 'caller' | 'dispatcher' | 'inventory'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token)
  else localStorage.removeItem(REFRESH_KEY)
}

export function getStoredApiUser(): ApiUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ApiUser
  } catch {
    return null
  }
}

export function setStoredApiUser(user: ApiUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function clearAuthStorage() {
  setAccessToken(null)
  setRefreshToken(null)
  setStoredApiUser(null)
}

export const AUTH_EXPIRED_EVENT = 'freia:auth-expired'

function notifyAuthExpired() {
  clearAuthStorage()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
}

function formatError(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback
  const obj = body as Record<string, unknown>
  if (typeof obj.message === 'string') return obj.message
  if (typeof obj.detail === 'string') return obj.detail
  const first = Object.values(obj)[0]
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  if (typeof first === 'string') return first
  return fallback
}

/** Normalize list endpoints that may return a bare array or a wrapped object. */
export function asArray<T>(data: unknown, keys: string[] = ['results', 'data', 'orders', 'users', 'items']): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

type FetchInit = RequestInit & { _retried?: boolean }

let refreshInFlight: Promise<boolean> | null = null

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refresh = getRefreshToken()
    try {
      const res = await fetch(`${API_BASE}/accounts/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refresh ? { refresh } : {}),
      })
      const text = await res.text()
      let body: unknown = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }
      if (!res.ok) return false
      const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
      const access = obj && typeof obj.access === 'string' ? obj.access : null
      const nextRefresh = obj && typeof obj.refresh === 'string' ? obj.refresh : null
      if (!access) return false
      setAccessToken(access)
      if (nextRefresh) setRefreshToken(nextRefresh)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

function isAuthFailure(status: number, body: unknown) {
  if (status !== 401) return false
  if (!body || typeof body !== 'object') return true
  const code = (body as Record<string, unknown>).code
  const detail = String((body as Record<string, unknown>).detail || '')
  return code === 'token_not_valid' || /token/i.test(detail) || /expired/i.test(detail) || detail.length > 0
}

export async function apiFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const skipRefresh = path.includes('/accounts/login/') || path.includes('/accounts/refresh/')
    if (!skipRefresh && !init._retried && isAuthFailure(res.status, body)) {
      const ok = await tryRefreshAccessToken()
      if (ok) {
        return apiFetch<T>(path, { ...init, _retried: true })
      }
      notifyAuthExpired()
    }
    throw new ApiError(formatError(body, res.statusText || 'Request failed'), res.status, body)
  }
  return body as T
}
