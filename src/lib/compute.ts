import type { AppState, DeliveryStatus, Order, Payment, PaymentMode, StockTxn } from '../types'
import { daysUntil, pct } from './format'

export function amountPending(p: Payment): number {
  return Math.max(0, Math.round((p.cod_amount - p.amount_received - p.returned_value) * 100) / 100)
}

export function batchStock(state: AppState, batchId: string): number {
  let qty = 0
  for (const t of state.stockLedger) {
    if (t.batch_id !== batchId) continue
    if (t.txn_type === 'Purchase In' || t.txn_type === 'Return In') qty += t.qty
    else qty -= t.qty
  }
  return qty
}

export function productStock(state: AppState, productId: string): number {
  let qty = 0
  for (const t of state.stockLedger) {
    if (t.product_id !== productId) continue
    if (t.txn_type === 'Purchase In' || t.txn_type === 'Return In') qty += t.qty
    else qty -= t.qty
  }
  return qty
}

export function isExpiring(expiry: string, thresholdDays: number): 'expired' | 'soon' | 'ok' {
  const d = daysUntil(expiry)
  if (d < 0) return 'expired'
  if (d <= thresholdDays) return 'soon'
  return 'ok'
}

export interface StockRow {
  product_id: string
  batch_id: string
  opening: number
  inQty: number
  outQty: number
  closing: number
}

export function ledgerRows(state: AppState, from?: string, to?: string): StockRow[] {
  const map = new Map<string, StockRow>()
  for (const b of state.batches) {
    map.set(`${b.product_id}|${b.batch_id}`, {
      product_id: b.product_id,
      batch_id: b.batch_id,
      opening: 0,
      inQty: 0,
      outQty: 0,
      closing: 0,
    })
  }
  for (const t of state.stockLedger) {
    const key = `${t.product_id}|${t.batch_id}`
    let row = map.get(key)
    if (!row) {
      row = { product_id: t.product_id, batch_id: t.batch_id, opening: 0, inQty: 0, outQty: 0, closing: 0 }
      map.set(key, row)
    }
    const inbound = t.txn_type === 'Purchase In' || t.txn_type === 'Return In'
    if (from && t.txn_date < from) {
      row.opening += inbound ? t.qty : -t.qty
      continue
    }
    if (to && t.txn_date > to) continue
    if (!from || t.txn_date >= from) {
      if (inbound) row.inQty += t.qty
      else row.outQty += t.qty
    }
  }
  for (const row of map.values()) row.closing = row.opening + row.inQty - row.outQty
  return [...map.values()]
}

export function teamMemberIds(state: AppState, leaderId: string): string[] {
  return state.employees.filter((e) => e.employee_id === leaderId || e.team_leader_id === leaderId).map((e) => e.employee_id)
}

export function inRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export interface PersonPerf {
  employee_id: string
  total_order: number
  total_sale: number
  fse_total_order: number
  fse_sale: number
  office_staff_total_order: number
  office_staff_sale: number
  no_delivered: number
  amount_delivered: number
  no_return: number
  amount_return: number
  no_hold: number
  amount_hold: number
  no_reorder: number
  amount_reorder: number
  return_pct: number
}

export function performanceFor(
  state: AppState,
  employeeIds: string[] | null,
  from?: string,
  to?: string,
): PersonPerf[] {
  const set = employeeIds ? new Set(employeeIds) : null
  const map = new Map<string, PersonPerf>()
  const ensure = (id: string) => {
    let p = map.get(id)
    if (!p) {
      p = {
        employee_id: id,
        total_order: 0,
        total_sale: 0,
        fse_total_order: 0,
        fse_sale: 0,
        office_staff_total_order: 0,
        office_staff_sale: 0,
        no_delivered: 0,
        amount_delivered: 0,
        no_return: 0,
        amount_return: 0,
        no_hold: 0,
        amount_hold: 0,
        no_reorder: 0,
        amount_reorder: 0,
        return_pct: 0,
      }
      map.set(id, p)
    }
    return p
  }

  const empById = new Map(state.employees.map((e) => [e.employee_id, e]))
  const reorderIds = new Set(state.followups.filter((f) => f.reorder_done).map((f) => f.order_id))

  for (const o of state.orders) {
    if (set && !set.has(o.employee_id)) continue
    if (!inRange(o.order_date, from, to)) continue
    const p = ensure(o.employee_id)
    const emp = empById.get(o.employee_id)
    p.total_order += 1
    p.total_sale += o.total_value
    if (emp?.role === 'FSE' || o.platform === 'van-working') {
      p.fse_total_order += 1
      p.fse_sale += o.total_value
    }
    if (emp?.role === 'Office Staff' || o.order_type === 'Office') {
      p.office_staff_total_order += 1
      p.office_staff_sale += o.total_value
    }
    if (o.delivery_status === 'Delivered') {
      p.no_delivered += 1
      p.amount_delivered += o.total_value
    } else if (o.delivery_status === 'Returned') {
      p.no_return += 1
      p.amount_return += o.total_value
    } else if (o.delivery_status === 'Hold') {
      p.no_hold += 1
      p.amount_hold += o.total_value
    }
    if (reorderIds.has(o.order_id)) {
      p.no_reorder += 1
      p.amount_reorder += o.total_value
    }
  }

  for (const p of map.values()) p.return_pct = pct(p.no_return, p.total_order)
  return [...map.values()]
}

export function companyKpis(state: AppState, from?: string, to?: string) {
  let totalOrders = 0
  let totalSales = 0
  let totalReturns = 0
  let returnValue = 0
  for (const o of state.orders) {
    if (!inRange(o.order_date, from, to)) continue
    totalOrders += 1
    totalSales += o.total_value
    if (o.delivery_status === 'Returned') {
      totalReturns += 1
      returnValue += o.total_value
    }
  }
  let pendingCod = 0
  const orderById = new Map(state.orders.map((o) => [o.order_id, o]))
  for (const p of state.payments) {
    const o = orderById.get(p.order_id)
    if (!o || !inRange(o.order_date, from, to)) continue
    if (o.payment_mode === 'COD') pendingCod += amountPending(p)
  }
  const lowStock = state.products.filter((p) => productStock(state, p.product_id) <= p.low_stock_threshold).length
  const nearExpiry = state.batches.filter((b) => {
    const flag = isExpiring(b.expiry_date, state.expiryAlertDays)
    return flag !== 'ok' && batchStock(state, b.batch_id) > 0
  }).length
  return {
    totalOrders,
    totalSales,
    totalReturns,
    returnValue,
    returnPct: pct(totalReturns, totalOrders),
    pendingCod,
    lowStock,
    nearExpiry,
  }
}

export function salesTrend(state: AppState, from: string, to: string, grain: 'day' | 'week' | 'month') {
  const buckets = new Map<string, { sales: number; orders: number; returns: number }>()
  const keyFor = (d: string) => {
    if (grain === 'month') return d.slice(0, 7)
    if (grain === 'week') {
      const dt = new Date(d + 'T00:00:00')
      const onejan = new Date(dt.getFullYear(), 0, 1)
      const week = Math.ceil(((dt.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
      return `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
    return d
  }
  for (const o of state.orders) {
    if (!inRange(o.order_date, from, to)) continue
    const k = keyFor(o.order_date)
    const row = buckets.get(k) ?? { sales: 0, orders: 0, returns: 0 }
    row.sales += o.total_value
    row.orders += 1
    if (o.delivery_status === 'Returned') row.returns += o.total_value
    buckets.set(k, row)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({ label, ...v }))
}

export function orderById(state: AppState, id: string): Order | undefined {
  return state.orders.find((o) => o.order_id === id)
}

export function applyStock(txns: StockTxn[], txn: StockTxn): StockTxn[] {
  return [txn, ...txns]
}

export const STATUS_META: Record<
  DeliveryStatus,
  { label: string; className: string }
> = {
  Submitted: { label: 'Submitted', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  'Ready for Dispatch': { label: 'Ready for dispatch', className: 'bg-pine/10 text-pine ring-pine/25' },
  Pending: { label: 'Pending', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  'At Hub': { label: 'At Hub', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  'Assigned for Delivery': { label: 'Assigned', className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  'Out for Delivery': { label: 'Out for delivery', className: 'bg-gold/20 text-[#7a5a22] ring-[#e6d3a8]' },
  Delivered: { label: 'Delivered', className: 'bg-sage/25 text-pine ring-sage/40' },
  Hold: { label: 'Hold', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
  Returned: { label: 'Returned', className: 'bg-blush/15 text-blush ring-blush/30' },
  Cancelled: { label: 'Cancelled', className: 'bg-stone-100 text-stone-500 ring-stone-200' },
}

/** Status path Team Lead / Sales Manager can set on a submitted order blob. */
export const APPROVAL_STATUSES: DeliveryStatus[] = [
  'Submitted',
  'Ready for Dispatch',
  'Pending',
  'At Hub',
  'Assigned for Delivery',
  'Out for Delivery',
  'Delivered',
  'Hold',
  'Returned',
  'Cancelled',
]

export const PAYMENT_META: Record<PaymentMode, { className: string }> = {
  Cash: { className: 'bg-gold/20 text-[#7a5a22] ring-[#e6d3a8]' },
  UPI: { className: 'bg-teal-50 text-teal-800 ring-teal-200' },
  Credit: { className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  COD: { className: 'bg-blush/15 text-blush ring-blush/30' },
  Prepaid: { className: 'bg-pine/10 text-pine ring-pine/20' },
  Advance: { className: 'bg-pine/10 text-pine ring-pine/20' },
  Token: { className: 'bg-gold/20 text-[#7a5a22] ring-[#e6d3a8]' },
  'Part payment': { className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  'Advance+COD': { className: 'bg-orange-50 text-orange-900 ring-orange-200' },
}

/** Modes where full settlement is still pending after booking. */
export function paymentIsDeferred(mode: PaymentMode): boolean {
  return mode === 'COD' || mode === 'Credit' || mode === 'Part payment' || mode === 'Token' || mode === 'Advance+COD'
}

/** Prior completed/open orders for a party (excludes cancelled). */
export function customerOrderCount(state: AppState, customerId: string): number {
  return state.orders.filter((o) => o.customer_id === customerId && o.delivery_status !== 'Cancelled').length
}

/** Map prior order count → CRM level keyword. */
export function levelFromOrderCount(priorOrders: number): import('../types').CustomerLevel {
  if (priorOrders <= 0) return 'New'
  if (priorOrders < 5) return 'Bronze'
  if (priorOrders < 10) return 'Silver'
  return 'Gold'
}

/** Human label: First time / 5+ orders etc. */
export function orderFrequencyLabel(priorOrders: number): string {
  if (priorOrders <= 0) return 'First time'
  if (priorOrders === 1) return '1 prior order'
  if (priorOrders < 5) return `${priorOrders} prior orders (under 5)`
  if (priorOrders < 10) return `${priorOrders} prior orders · Regular (5+)`
  return `${priorOrders} prior orders · Loyal (10+)`
}

/**
 * Courier options by PIN prefix. Many North/metro prefixes get both.
 */
export function courierOptionsForPin(pin: string): ('Shadowfax' | 'India Post')[] {
  const p = pin.trim()
  if (!/^\d{6}$/.test(p)) return ['India Post']
  const prefix = Number(p.slice(0, 2))
  // Both available for many North/metro prefixes
  const both = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 40, 56, 60, 70])
  const shadowOnly = new Set([26, 27, 28, 29])
  if (both.has(prefix)) return ['Shadowfax', 'India Post']
  if (shadowOnly.has(prefix)) return ['Shadowfax']
  return ['India Post']
}
export function courierForPin(pin: string): 'Shadowfax' | 'India Post' {
  return courierOptionsForPin(pin)[0]!
}

export const CHANNEL_META: Record<string, { label: string; className: string }> = {
  'van-working': { label: 'Van working', className: 'bg-pine/10 text-pine ring-pine/20' },
  retailer: { label: 'Retail', className: 'bg-gold/20 text-[#7a5a22] ring-[#e6d3a8]' },
  ecommerce: { label: 'E-commerce', className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
}
