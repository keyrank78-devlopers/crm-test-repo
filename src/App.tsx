import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ROLE_HOME, useSession } from './context/SessionContext'

export default function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function RoleHomeRedirect() {
  const { uiRole } = useSession()
  const nav = useNavigate()
  useEffect(() => {
    nav(ROLE_HOME[uiRole], { replace: true })
  }, [uiRole, nav])
  return null
}
