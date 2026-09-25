import { apiFetch, asArray } from './http'

export type InvoiceRow = {
  id: string
  invoice_no: string
  template: string
  template_label: string
  amount: string
  notes: string
  order_id: string
  created_at?: string
}

export type SupportRow = {
  id: string
  name: string
  phone: string
  enquiry: string
  feedback: string
  status: string
  created_at?: string
}

export type AttendanceRow = {
  id: number
  punch_date: string
  login_at?: string
  logout_at?: string
  user_name?: string
}

export type LeaveRow = {
  id: number
  from_date: string
  to_date: string
  reason: string
  hr_email: string
  status: string
  user_name: string
}

export const opsApi = {
  listInvoices() {
    return apiFetch<unknown>('/sales/invoices/').then((data) =>
      asArray<InvoiceRow>(data, ['results', 'data', 'invoices']),
    )
  },
  createInvoice(data: { order_id: string; template: string; amount?: number; notes?: string; invoice_no?: string }) {
    return apiFetch<{ message: string; invoice: { id: string; invoice_no: string; template: string; amount: string } }>(
      '/sales/invoices/',
      { method: 'POST', body: JSON.stringify(data) },
    )
  },
  listSupport() {
    return apiFetch<unknown>('/sales/support/').then((data) =>
      asArray<SupportRow>(data, ['results', 'data', 'support']),
    )
  },
  createSupport(data: { name: string; phone: string; enquiry: string; feedback?: string }) {
    return apiFetch<{ message: string; id: string }>('/sales/support/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  attendance(action: 'login' | 'logout') {
    return apiFetch<{ message: string; punch_date: string; login_at?: string; logout_at?: string }>(
      '/accounts/attendance/',
      { method: 'POST', body: JSON.stringify({ action }) },
    )
  },
  listAttendance() {
    return apiFetch<unknown>('/accounts/attendance/').then((data) =>
      asArray<AttendanceRow>(data, ['results', 'data', 'attendance']),
    )
  },
  createLeave(data: { from_date: string; to_date: string; reason: string; hr_email?: string }) {
    return apiFetch<{ message: string; id: number }>('/accounts/leave/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  listLeave() {
    return apiFetch<unknown>('/accounts/leave/').then((data) =>
      asArray<LeaveRow>(data, ['results', 'data', 'leaves']),
    )
  },
}
