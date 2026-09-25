import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Gift,
  LayoutDashboard,
  Package,
  Phone,
  Search,
  Truck,
  Users,
  Wallet,
  Warehouse,
  FileText,
  BarChart3,
  Headphones,
  Clock,
  Store,
} from 'lucide-react'
import { ROLE_HOME, useSession } from '../../context/SessionContext'
import { useAppState } from '../../api/store'
import type { RoleUi } from '../../types'
import { useEffect, useState, type ReactNode } from 'react'
import { GlobalSearch } from '../search/GlobalSearch'

const NAV: Record<RoleUi, { to: string; label: string; icon: typeof LayoutDashboard }[]> = {
  Admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/approvals', label: 'Order desk', icon: ClipboardList },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
    { to: '/returns', label: 'Returns', icon: Truck },
    { to: '/admin/schemes', label: 'Schemes', icon: Gift },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/support', label: 'Support', icon: Headphones },
    { to: '/hrms', label: 'HRMS', icon: Clock },
    { to: '/marketplace', label: 'Marketplace', icon: Store },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/admin/inventories', label: 'City stock', icon: Warehouse },
    { to: '/admin/employees', label: 'Team', icon: Users },
    { to: '/warehouse/ledger', label: 'Stock', icon: Warehouse },
    { to: '/dispatch', label: 'Dispatch', icon: Truck },
  ],
  'Team Leader': [
    { to: '/approvals', label: 'Order desk', icon: ClipboardList },
    { to: '/admin/orders', label: 'Team orders', icon: ClipboardList },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
    { to: '/returns', label: 'Returns', icon: Truck },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/admin/employees', label: 'Team', icon: Users },
    { to: '/hrms', label: 'HRMS', icon: Clock },
  ],
  'Sales Manager': [
    { to: '/admin/orders', label: 'Sales register', icon: ClipboardList },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
    { to: '/returns', label: 'Returns', icon: Truck },
    { to: '/admin/schemes', label: 'Schemes', icon: Gift },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/admin/employees', label: 'Team', icon: Users },
    { to: '/admin/inventories', label: 'City stock', icon: Warehouse },
    { to: '/hrms', label: 'HRMS', icon: Clock },
  ],
  FSE: [
    { to: '/fse', label: 'New order', icon: ClipboardList },
    { to: '/fse/orders', label: 'My orders', icon: Truck },
    { to: '/fse/unproductive', label: 'Unproductive', icon: ClipboardList },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
    { to: '/hrms', label: 'HRMS', icon: Clock },
  ],
  Caller: [
    { to: '/caller/queue', label: 'Call queue', icon: Phone },
    { to: '/fse', label: 'New order', icon: ClipboardList },
    { to: '/fse/orders', label: 'My orders', icon: Truck },
    { to: '/fse/unproductive', label: 'Unproductive', icon: ClipboardList },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
    { to: '/hrms', label: 'HRMS', icon: Clock },
  ],
  'Office Staff': [
    { to: '/office', label: 'Order entry', icon: ClipboardList },
    { to: '/office/orders', label: 'Recent orders', icon: Truck },
  ],
  Warehouse: [
    { to: '/warehouse/ledger', label: 'Current stock', icon: Warehouse },
    { to: '/warehouse/purchase', label: 'Purchase in', icon: Package },
    { to: '/dispatch', label: 'Dispatch desk', icon: Truck },
  ],
  Dispatch: [
    { to: '/dispatch', label: 'Dispatch desk', icon: Truck },
    { to: '/scheme-orders', label: 'Scheme orders', icon: Gift },
  ],
  Accounts: [
    { to: '/accounts/cod', label: 'COD reconcile', icon: Wallet },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/customers', label: 'Customers', icon: Users },
  ],
}

export function AppShell({ children }: { children: ReactNode }) {
  const { employee, uiRole, logout, apiUser } = useSession()
  const state = useAppState()
  const nav = useNavigate()
  const loc = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const items = NAV[uiRole]
  const isFse = uiRole === 'FSE' || uiRole === 'Caller'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="grain min-h-svh bg-paper text-ink lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white/70 lg:flex">
        <button type="button" className="px-5 pb-4 pt-5 text-left" onClick={() => nav(ROLE_HOME[uiRole])}>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gold">FREIA CRM</p>
          <p className="font-display text-xl leading-none">Distribution</p>
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
          {items.map((i) => {
            const Icon = i.icon
            const active = loc.pathname === i.to || (i.to !== ROLE_HOME[uiRole] && loc.pathname.startsWith(i.to))
            return (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to.split('/').length <= 2}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
                  active || loc.pathname === i.to ? 'bg-pine text-cream' : 'text-muted hover:bg-cream hover:text-ink'
                }`}
              >
                <Icon size={16} />
                {i.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-line p-3 text-xs text-muted">
          <p className="truncate font-medium text-ink">{employee.employee_name}</p>
          <p className="truncate">{apiUser.role}</p>
          <button type="button" className="mt-2 text-blush underline" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-white/80 px-3 py-2 lg:px-5">
          <button type="button" className="rounded-lg p-2 text-muted hover:bg-cream lg:hidden" onClick={() => nav(ROLE_HOME[uiRole])}>
            <LayoutDashboard size={18} />
          </button>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-cream/40 px-3 py-2 text-left text-sm text-muted"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={14} />
            Search…
          </button>
          {isFse ? (
            <>
              <NavLink
                to="/fse/orders"
                className={`rounded-full px-3 py-1.5 text-xs lg:hidden ${
                  loc.pathname.startsWith('/fse/orders') ? 'bg-ink text-cream' : 'bg-cream text-ink'
                }`}
              >
                My orders
              </NavLink>
              <NavLink to="/fse" className="rounded-full bg-pine px-3 py-1.5 text-xs text-cream">
                New order
              </NavLink>
            </>
          ) : null}
        </header>
        <main className="flex-1 overflow-x-hidden p-3 pb-20 sm:p-5 lg:pb-5">{children}</main>
      </div>

      {isFse ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
          <NavLink
            to="/fse"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${
                isActive && loc.pathname === '/fse' ? 'bg-pine text-cream' : 'text-muted'
              }`
            }
            end
          >
            <ClipboardList size={18} />
            New order
          </NavLink>
          <NavLink
            to="/fse/orders"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${
                isActive ? 'bg-pine text-cream' : 'text-muted'
              }`
            }
          >
            <Truck size={18} />
            My orders
          </NavLink>
          <NavLink
            to="/fse/unproductive"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${
                isActive ? 'bg-pine text-cream' : 'text-muted'
              }`
            }
          >
            <ClipboardList size={18} />
            Visits
          </NavLink>
        </nav>
      ) : null}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} customers={state.customers} orders={state.orders} dispatches={state.dispatches} />
    </div>
  )
}
