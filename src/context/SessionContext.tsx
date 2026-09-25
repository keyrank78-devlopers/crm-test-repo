import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import {
  ApiError,
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  getStoredApiUser,
  setAccessToken,
  setRefreshToken,
  setStoredApiUser,
  type ApiUser,
} from '../api/http'
import { backendRoleToUi } from '../api/roles'
import type { Employee, RoleUi } from '../types'

interface Session {
  employee: Employee
  apiUser: ApiUser
  uiRole: RoleUi
  logout: () => Promise<void>
}

const Ctx = createContext<Session | null>(null)

export const ROLE_HOME: Record<RoleUi, string> = {
  Admin: '/admin',
  'Team Leader': '/approvals',
  'Sales Manager': '/admin/orders',
  FSE: '/fse',
  'Office Staff': '/office',
  Caller: '/caller/queue',
  Warehouse: '/warehouse/ledger',
  Dispatch: '/dispatch',
  Accounts: '/accounts/cod',
}

/** Paths each role may open (prefixes). */
const ROLE_PATHS: Record<RoleUi, string[]> = {
  Admin: ['/admin', '/approvals', '/returns', '/customers', '/warehouse', '/dispatch', '/scheme-orders', '/reports', '/invoices', '/support', '/hrms', '/marketplace'],
  'Team Leader': ['/approvals', '/admin/orders', '/admin/employees', '/returns', '/customers', '/scheme-orders', '/reports', '/hrms'],
  'Sales Manager': ['/admin', '/returns', '/customers', '/warehouse', '/scheme-orders', '/reports', '/invoices', '/hrms'],
  FSE: ['/fse', '/scheme-orders', '/hrms'],
  Caller: ['/fse', '/caller', '/scheme-orders', '/hrms'],
  'Office Staff': ['/office'],
  Warehouse: ['/warehouse', '/dispatch'],
  Dispatch: ['/dispatch', '/scheme-orders'],
  Accounts: ['/accounts', '/customers', '/invoices'],
}

export function pathAllowedForRole(role: RoleUi, path: string): boolean {
  if (path === '/' || path === '/flow') return true
  return ROLE_PATHS[role].some((p) => path === p || path.startsWith(`${p}/`))
}

function apiUserToEmployee(user: ApiUser): Employee {
  const ui = backendRoleToUi(user.role)
  const roleMap: Record<RoleUi, Employee['role']> = {
    Admin: 'Admin',
    'Team Leader': 'Team Leader',
    'Sales Manager': 'ASM',
    FSE: 'FSE',
    'Office Staff': 'Office Staff',
    Caller: 'Caller',
    Warehouse: 'Warehouse',
    Accounts: 'Accounts',
    Dispatch: 'Dispatch',
  }
  return {
    employee_id: String(user.id),
    employee_name: `${user.first_name} ${user.last_name}`.trim() || user.email,
    role: roleMap[ui],
    team_leader_id: null,
    city_area: '',
  }
}

const POST_LOGIN_HOME_KEY = 'freia_post_login_home'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiUser, setApiUser] = useState<ApiUser | null>(() => getStoredApiUser())

  useEffect(() => {
    const onExpired = () => setApiUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const value = useMemo<Session | null>(() => {
    if (!apiUser) return null
    return {
      employee: apiUserToEmployee(apiUser),
      apiUser,
      uiRole: backendRoleToUi(apiUser.role),
      logout: async () => {
        try {
          await accountsApi.logout()
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(POST_LOGIN_HOME_KEY)
        clearAuthStorage()
        setApiUser(null)
      },
    }
  }, [apiUser])

  if (!value) {
    return (
      <LoginGate
        onLogin={(user, access, refresh) => {
          const home = ROLE_HOME[backendRoleToUi(user.role)]
          sessionStorage.setItem(POST_LOGIN_HOME_KEY, home)
          setAccessToken(access)
          setRefreshToken(refresh)
          setStoredApiUser(user)
          setApiUser(user)
        }}
      />
    )
  }

  return (
    <Ctx.Provider value={value}>
      <RoleLandingGuard />
      {children}
    </Ctx.Provider>
  )
}

/** After login (or wrong-role URL), send user to their home. */
function RoleLandingGuard() {
  const { uiRole } = useSession()
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const postLogin = sessionStorage.getItem(POST_LOGIN_HOME_KEY)
    if (postLogin) {
      sessionStorage.removeItem(POST_LOGIN_HOME_KEY)
      nav(postLogin, { replace: true })
      return
    }
    if (!pathAllowedForRole(uiRole, loc.pathname)) {
      nav(ROLE_HOME[uiRole], { replace: true })
    }
  }, [uiRole, loc.pathname, nav])

  return null
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession requires SessionProvider')
  return ctx
}

function LoginGate({ onLogin }: { onLogin: (user: ApiUser, access: string, refresh: string) => void }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Clear leftover /admin URL after logout so next login does not reopen it
  useEffect(() => {
    if (loc.pathname !== '/') {
      nav('/', { replace: true })
    }
  }, [loc.pathname, nav])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await accountsApi.login(email.trim(), password)
      onLogin(res.user, res.access, res.refresh)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grain min-h-svh bg-paper text-ink">
      <div className="mx-auto flex max-w-lg flex-col px-5 py-12 md:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-pine">FREIA Skincare</p>
        <h1 className="font-display mt-3 text-4xl leading-[1.1] text-ink md:text-5xl">Distribution desk</h1>
        <p className="mt-3 text-muted">Sign in with your account.</p>

        <form onSubmit={submit} className="mt-8 space-y-3 rounded-2xl border border-line bg-white/70 p-5 shadow-card">
          <label className="block text-sm">
            <span className="text-muted">Email</span>
            <input
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Password</span>
            <div className="relative mt-1">
              <input
                className="w-full rounded-xl border border-line bg-white px-3 py-2 pr-16"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted hover:text-ink"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {error ? <p className="text-sm text-blush">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
