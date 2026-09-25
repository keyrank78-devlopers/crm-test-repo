import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ALL_ASSIGNABLE_ROLES,
  accountsApi,
  canManageUsers,
  creatableRolesFor,
} from '../../api/accounts'
import { ApiError, type ApiUser, type BackendRole } from '../../api/http'
import { DataTable } from '../../components/ui/DataTable'
import { Button, Field, Input, Modal, PageHeader, PageSkeleton, Select, usePageLoad } from '../../components/ui/primitives'
import { useToast } from '../../context/ToastContext'
import { useSession } from '../../context/SessionContext'

type Draft = {
  id?: number
  email: string
  first_name: string
  last_name: string
  phone_number: string
  role: BackendRole
  password: string
  reports_to: number | ''
}

export function EmployeesPage() {
  const loading = usePageLoad()
  const { apiUser } = useSession()
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ApiUser[]>([])
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [fetchError, setFetchError] = useState('')

  const allowedRoles = useMemo(() => creatableRolesFor(apiUser.role), [apiUser.role])
  const canManage = canManageUsers(apiUser.role)

  const emptyDraft = (): Draft => ({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: allowedRoles[0]?.value ?? 'fse',
    password: '',
    reports_to: apiUser.role === 'tl' ? apiUser.id : '',
  })

  const load = useCallback(async () => {
    setFetchError('')
    try {
      setRows(await accountsApi.listUsers())
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  if (loading) return <PageSkeleton />

  if (!canManage) {
    return (
      <div className="animate-fade-up">
        <PageHeader kicker="Team" title="Employees & roles" />
        <p className="mt-4 max-w-lg text-muted">You do not have permission to manage users.</p>
      </div>
    )
  }

  const list = Array.isArray(rows) ? rows : []
  const filtered = list.filter((u) => {
    const hay = `${u.first_name} ${u.last_name} ${u.email} ${u.role} ${u.phone_number}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const tlOptions = list.filter((u) => u.role === 'tl' && u.is_active)
  const managerOptions = list.filter((u) => (u.role === 'manager' || u.role === 'admin') && u.is_active)

  const hint =
    apiUser.role === 'admin'
      ? 'You can create any role. Assign FSE → TL so order visibility works.'
      : apiUser.role === 'manager'
        ? 'You can create TL and FSE. Link each FSE to a TL.'
        : 'You can create FSE only — they report to you.'

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Team"
        title="Team"
        subtitle="Live users and roles."
        actions={
          <>
            <Input className="w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button onClick={() => setEdit(emptyDraft())}>Add user</Button>
          </>
        }
      />
      <p className="mb-3 text-sm text-muted">{hint}</p>

      {fetchError ? <p className="mb-3 text-sm text-blush">{fetchError}</p> : null}

      <DataTable
        rows={filtered}
        rowKey={(u) => String(u.id)}
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (u) => `${u.first_name} ${u.last_name}`.trim(),
            sort: (a, b) => a.first_name.localeCompare(b.first_name),
          },
          { key: 'email', header: 'Email', cell: (u) => u.email },
          { key: 'phone', header: 'Phone', cell: (u) => u.phone_number },
          {
            key: 'role',
            header: 'Role',
            cell: (u) => ALL_ASSIGNABLE_ROLES.find((r) => r.value === u.role)?.label ?? u.role,
          },
          {
            key: 'boss',
            header: 'Reports to',
            cell: (u) => u.reports_to_name || '—',
          },
          {
            key: 'status',
            header: 'Status',
            cell: (u) => (
              <span className={u.is_active ? 'text-pine' : 'text-blush'}>{u.is_active ? 'Active' : 'Inactive'}</span>
            ),
          },
          {
            key: 'a',
            header: '',
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEdit({
                      id: u.id,
                      email: u.email,
                      first_name: u.first_name,
                      last_name: u.last_name,
                      phone_number: u.phone_number,
                      role: u.role,
                      password: '',
                      reports_to: u.reports_to ?? '',
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || u.id === apiUser.id}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const res = await accountsApi.setActive(u.id, !u.is_active)
                      push(res.message)
                      await load()
                    } catch (err) {
                      push(err instanceof ApiError ? err.message : 'Failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit user' : 'Create user'}>
        {edit && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  placeholder="e.g. Rahul"
                  value={edit.first_name}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
                />
              </Field>
              <Field label="Last name">
                <Input
                  placeholder="e.g. Sharma"
                  value={edit.last_name}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                placeholder="user@company.com"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </Field>
            <Field label="Phone (10 digits)">
              <Input
                placeholder="9876543210"
                value={edit.phone_number}
                maxLength={10}
                onChange={(e) => setEdit({ ...edit, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </Field>
            <Field label="Role">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as BackendRole, reports_to: '' })}>
                {allowedRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            {edit.role === 'fse' || edit.role === 'caller' ? (
              apiUser.role !== 'tl' ? (
              <Field label="Reports to (TL)">
                <Select
                  value={edit.reports_to === '' ? '' : String(edit.reports_to)}
                  onChange={(e) => setEdit({ ...edit, reports_to: e.target.value ? Number(e.target.value) : '' })}
                >
                  <option value="">Select TL…</option>
                  {tlOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </option>
                  ))}
                </Select>
              </Field>
              ) : (
              <p className="text-xs text-muted">This {edit.role.toUpperCase()} will report to you.</p>
              )
            ) : null}
            {edit.role === 'tl' && (apiUser.role === 'admin' || apiUser.role === 'manager') ? (
              <Field label="Reports to (Manager, optional)">
                <Select
                  value={edit.reports_to === '' ? '' : String(edit.reports_to)}
                  onChange={(e) => setEdit({ ...edit, reports_to: e.target.value ? Number(e.target.value) : '' })}
                >
                  <option value="">None</option>
                  {managerOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({t.role})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label={edit.id ? 'New password (optional)' : 'Password (min 8)'}>
              <Input
                type="text"
                autoComplete="new-password"
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              />
            </Field>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!edit.email || !edit.first_name || !edit.last_name || !edit.phone_number || !edit.role) {
                  push('Fill all required fields')
                  return
                }
                if (
                  (edit.role === 'fse' || edit.role === 'caller') &&
                  apiUser.role !== 'tl' &&
                  !edit.reports_to
                ) {
                  push('Select a TL for this user')
                  return
                }
                if (!edit.id && edit.password.length < 8) {
                  push('Password must be at least 8 characters')
                  return
                }
                setBusy(true)
                try {
                  const reports_to =
                    (edit.role === 'fse' || edit.role === 'caller') && apiUser.role === 'tl'
                      ? apiUser.id
                      : edit.reports_to === ''
                        ? null
                        : edit.reports_to
                  if (edit.id) {
                    const payload: Parameters<typeof accountsApi.updateUser>[1] = {
                      email: edit.email,
                      first_name: edit.first_name,
                      last_name: edit.last_name,
                      phone_number: edit.phone_number,
                      role: edit.role,
                      reports_to,
                    }
                    if (edit.password) payload.password = edit.password
                    const res = await accountsApi.updateUser(edit.id, payload)
                    push(res.message)
                  } else {
                    const res = await accountsApi.createUser({
                      email: edit.email,
                      first_name: edit.first_name,
                      last_name: edit.last_name,
                      phone_number: edit.phone_number,
                      role: edit.role,
                      password: edit.password,
                      reports_to,
                    })
                    push(res.message)
                  }
                  setEdit(null)
                  await load()
                } catch (err) {
                  push(err instanceof ApiError ? err.message : 'Save failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
