import { useSyncExternalStore } from 'react'
import { paymentIsDeferred, productStock } from '../lib/compute'
import { uid } from '../lib/format'
import type {
  AppState,
  AttendanceMark,
  CreateCustomerInput,
  CreateOrderInput,
  DamageType,
  DeliveryStatus,
  Employee,
  FollowupOrderStatus,
  PaymentMode,
  Product,
  ProductBatch,
  PurchaseEntryInput,
  RoleUi,
  SchemeStatus,
} from '../types'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

/** Empty live shell — no seed/demo data. Pages not yet on API stay empty. */
const emptyState = (): AppState => ({
  products: [],
  batches: [],
  customers: [],
  employees: [],
  orders: [],
  orderItems: [],
  dispatches: [],
  payments: [],
  followups: [],
  stockLedger: [],
  damageReports: [],
  schemes: [],
  schemeOffers: [],
  attendance: [],
  expiryAlertDays: 30,
})

let state: AppState = emptyState()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  return state
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function roleToUi(role: Employee['role']): RoleUi {
  if (role === 'Admin') return 'Admin'
  if (role === 'Team Leader') return 'Team Leader'
  if (role === 'ASM') return 'Sales Manager'
  if (role === 'FSE' || role === 'TSR') return 'FSE'
  if (role === 'Office Staff') return 'Office Staff'
  if (role === 'Caller') return 'Caller'
  if (role === 'Warehouse') return 'Warehouse'
  if (role === 'Dispatch') return 'Dispatch'
  return 'Accounts'
}

export const api = {
  getState: () => state,

  async createCustomer(input: CreateCustomerInput) {
    await delay()
    const customer = { ...input, customer_id: uid('C') }
    state = { ...state, customers: [customer, ...state.customers] }
    emit()
    return customer
  },

  async createOrder(input: CreateOrderInput) {
    await delay(360)
    const needed = new Map<string, number>()
    for (const i of input.items) {
      needed.set(i.product_id, (needed.get(i.product_id) ?? 0) + i.qty)
    }
    for (const [product_id, qty] of needed) {
      const available = Math.max(0, productStock(state, product_id))
      if (qty > available) {
        const name = state.products.find((p) => p.product_id === product_id)?.product_name ?? 'Product'
        throw new Error(`Out of stock — ${name}: only ${available} available`)
      }
    }
    const order_id = uid('O')
    const seq = state.orders.length + 1
    const total_qty = input.items.filter((i) => !i.is_free).reduce((s, i) => s + i.qty, 0)
    const free_qty = input.items.filter((i) => i.is_free).reduce((s, i) => s + i.qty, 0)
    const gross = input.items.reduce((s, i) => s + i.qty * i.rate, 0)
    const total_value = Math.max(0, gross - input.discount + input.courier_charges)
    const deferred = paymentIsDeferred(input.payment_mode)
    const advance_amount = Math.max(0, input.advance_amount ?? 0)
    const order = {
      order_id,
      order_no: `FR-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
      order_date: input.order_date || inputDateToday(),
      customer_id: input.customer_id,
      employee_id: input.employee_id,
      platform: input.platform,
      order_type: input.order_type,
      payment_mode: input.payment_mode,
      credit_days: input.payment_mode === 'Credit' ? input.credit_days : 0,
      advance_amount,
      preferred_courier: input.preferred_courier ?? '',
      scheme: input.scheme,
      discount: input.discount,
      courier_charges: input.courier_charges,
      total_qty,
      free_qty,
      total_value,
      expiry_damage_remark: input.expiry_damage_remark,
      expiry_claim_free: Boolean(input.expiry_claim_free),
      expiry_claim_product_id: input.expiry_claim_free ? (input.expiry_claim_product_id ?? '') : '',
      expiry_claim_qty: input.expiry_claim_free ? Math.max(0, input.expiry_claim_qty ?? 0) : 0,
      expiry_claim_details: input.expiry_claim_free ? (input.expiry_claim_details ?? '').trim() : '',
      order_remark: input.order_remark,
      delivery_status: 'Submitted' as const,
      tsr_name: input.tsr_name ?? '',
      asm_name: input.asm_name ?? '',
    }
    // Bump party level from how many times they have ordered
    const prior = state.orders.filter((o) => o.customer_id === input.customer_id && o.delivery_status !== 'Cancelled').length
    const nextLevel = prior <= 0 ? 'New' : prior < 5 ? 'Bronze' : prior < 10 ? 'Silver' : 'Gold'
    const customers = state.customers.map((c) =>
      c.customer_id === input.customer_id ? { ...c, customer_level: nextLevel as typeof c.customer_level } : c,
    )
    const items = input.items.map((i, n) => ({
      order_item_id: `${order_id}I${n + 1}`,
      order_id,
      product_id: i.product_id,
      batch_id: i.batch_id,
      qty: i.qty,
      rate: i.rate,
      amount: i.qty * i.rate,
      transaction_type: 'Sale' as const,
      is_free: i.is_free,
    }))
    const stock = [
      ...input.items.map((i, n) => ({
        stock_txn_id: uid(`ST${n}`),
        product_id: i.product_id,
        batch_id: i.batch_id,
        txn_date: order.order_date,
        txn_type: input.platform === 'van-working' ? ('Cases Sale Out' as const) : ('Sale Out' as const),
        qty: i.qty,
        reference_order_id: order_id,
        purchase_party: '',
      })),
      ...state.stockLedger,
    ]
    const payments = [...state.payments]
    let payCod = 0
    let payReceived = deferred ? 0 : total_value
    let payDate: string | null = deferred ? null : order.order_date
    if (input.payment_mode === 'Advance+COD') {
      const adv = Math.min(advance_amount, total_value)
      payCod = Math.max(0, total_value - adv)
      payReceived = adv
      payDate = adv > 0 ? order.order_date : null
    } else if (input.payment_mode === 'COD' || input.payment_mode === 'Part payment' || input.payment_mode === 'Credit') {
      payCod = total_value
      payReceived = 0
      payDate = null
    }
    payments.unshift({
      payment_id: uid('PAY'),
      order_id,
      cod_amount: payCod,
      amount_received: payReceived,
      amount_received_date: payDate,
      cheque_no: '',
      returned_value: 0,
    })
    let dispatches = state.dispatches
    if (input.courier_name || input.preferred_courier) {
      dispatches = [
        {
          dispatch_id: uid('D'),
          order_id,
          courier_name: input.courier_name || input.preferred_courier || '',
          docket_nos: [],
          dispatch_date: order.order_date,
          delivery_date: null,
          delivery_status: 'Pending',
          no_of_attempts: 0,
          delivery_remark: '',
          returned_date: null,
        },
        ...dispatches,
      ]
    }
    state = {
      ...state,
      customers,
      orders: [order, ...state.orders],
      orderItems: [...items, ...state.orderItems],
      stockLedger: stock,
      payments,
      dispatches,
    }
    emit()
    return order
  },

  async setPaymentTerms(
    orderId: string,
    payment_mode: PaymentMode,
    credit_days: number,
    advance_amount?: number,
    preferred_courier?: string,
  ) {
    await delay(200)
    const existing = state.orders.find((o) => o.order_id === orderId)
    if (!existing) throw new Error('Order not found')
    const deferred = paymentIsDeferred(payment_mode)
    const days = payment_mode === 'Credit' ? Math.max(1, credit_days) : 0
    const adv = Math.max(0, advance_amount ?? existing.advance_amount ?? 0)
    const orders = state.orders.map((o) =>
      o.order_id === orderId
        ? {
            ...o,
            payment_mode,
            credit_days: days,
            advance_amount: payment_mode === 'Advance+COD' ? adv : 0,
            ...(preferred_courier !== undefined ? { preferred_courier } : {}),
          }
        : o,
    )
    const payments = state.payments.map((p) => {
      if (p.order_id !== orderId) return p
      if (payment_mode === 'Advance+COD') {
        const a = Math.min(adv, existing.total_value)
        return {
          ...p,
          cod_amount: Math.max(0, existing.total_value - a),
          amount_received: a,
          amount_received_date: a > 0 ? existing.order_date : null,
        }
      }
      return {
        ...p,
        cod_amount: payment_mode === 'COD' || payment_mode === 'Part payment' || payment_mode === 'Credit' ? existing.total_value : 0,
        amount_received: deferred ? 0 : existing.total_value,
        amount_received_date: deferred ? null : existing.order_date,
      }
    })
    let dispatches = state.dispatches
    if (preferred_courier) {
      const has = dispatches.some((d) => d.order_id === orderId)
      if (has) {
        dispatches = dispatches.map((d) => (d.order_id === orderId ? { ...d, courier_name: preferred_courier } : d))
      } else {
        dispatches = [
          {
            dispatch_id: uid('D'),
            order_id: orderId,
            courier_name: preferred_courier,
            docket_nos: [],
            dispatch_date: existing.order_date,
            delivery_date: null,
            delivery_status: 'Pending',
            no_of_attempts: 0,
            delivery_remark: '',
            returned_date: null,
          },
          ...dispatches,
        ]
      }
    }
    state = { ...state, orders, payments, dispatches }
    emit()
    return orders.find((o) => o.order_id === orderId)!
  },

  async syncCourierStatus(orderId: string) {
    await delay(320)
    const order = state.orders.find((o) => o.order_id === orderId)
    if (!order) throw new Error('Order not found')
    const nextOf: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
      'Ready for Dispatch': 'Assigned for Delivery',
      'At Hub': 'Assigned for Delivery',
      Pending: 'Assigned for Delivery',
      'Assigned for Delivery': 'Out for Delivery',
      'Out for Delivery': 'Delivered',
    }
    const next = nextOf[order.delivery_status]
    if (!next) {
      return order
    }
    await this.setDeliveryStatus(orderId, next, next === 'Delivered' ? 'Courier sync · Delivered (Done)' : 'Courier sync')
    return state.orders.find((o) => o.order_id === orderId)!
  },

  async updateCustomer(customerId: string, patch: Partial<CreateCustomerInput>) {
    await delay(80)
    state = {
      ...state,
      customers: state.customers.map((c) => (c.customer_id === customerId ? { ...c, ...patch } : c)),
    }
    emit()
    return state.customers.find((c) => c.customer_id === customerId)!
  },

  async updateOrder(orderId: string, patch: Partial<CreateOrderInput> & { delivery_status?: DeliveryStatus }) {
    await delay()
    const existing = state.orders.find((o) => o.order_id === orderId)
    if (!existing) throw new Error('Order not found')
    if (existing.delivery_status !== 'Pending') throw new Error('Only pending orders can be edited')
    let orders = state.orders
    let orderItems = state.orderItems
    let stockLedger = state.stockLedger
    if (patch.items) {
      stockLedger = stockLedger.filter((t) => t.reference_order_id !== orderId)
      orderItems = orderItems.filter((i) => i.order_id !== orderId)
      const items = patch.items.map((i, n) => ({
        order_item_id: `${orderId}I${n + 1}`,
        order_id: orderId,
        product_id: i.product_id,
        batch_id: i.batch_id,
        qty: i.qty,
        rate: i.rate,
        amount: i.qty * i.rate,
        transaction_type: 'Sale' as const,
        is_free: i.is_free,
      }))
      orderItems = [...items, ...orderItems]
      stockLedger = [
        ...patch.items.map((i, n) => ({
          stock_txn_id: uid(`ST${n}`),
          product_id: i.product_id,
          batch_id: i.batch_id,
          txn_date: existing.order_date,
          txn_type: 'Sale Out' as const,
          qty: i.qty,
          reference_order_id: orderId,
          purchase_party: '',
        })),
        ...stockLedger,
      ]
      const gross = patch.items.reduce((s, i) => s + i.qty * i.rate, 0)
      const discount = patch.discount ?? existing.discount
      const courier_charges = patch.courier_charges ?? existing.courier_charges
      orders = state.orders.map((o) =>
        o.order_id === orderId
          ? {
              ...o,
              ...('scheme' in patch ? { scheme: patch.scheme! } : {}),
              discount,
              courier_charges,
              payment_mode: patch.payment_mode ?? o.payment_mode,
              order_remark: patch.order_remark ?? o.order_remark,
              total_qty: patch.items!.filter((i) => !i.is_free).reduce((s, i) => s + i.qty, 0),
              free_qty: patch.items!.filter((i) => i.is_free).reduce((s, i) => s + i.qty, 0),
              total_value: Math.max(0, gross - discount + courier_charges),
            }
          : o,
      )
    } else {
      orders = state.orders.map((o) => (o.order_id === orderId ? { ...o, ...patch, delivery_status: patch.delivery_status ?? o.delivery_status } : o))
    }
    state = { ...state, orders, orderItems, stockLedger }
    emit()
  },

  async setDeliveryStatus(orderId: string, status: DeliveryStatus, remark = '') {
    await delay()
    const order = state.orders.find((o) => o.order_id === orderId)
    if (!order) throw new Error('Order not found')
    const prev = order.delivery_status
    const orders = state.orders.map((o) => (o.order_id === orderId ? { ...o, delivery_status: status } : o))
    let dispatches = state.dispatches.map((d) =>
      d.order_id === orderId
        ? {
            ...d,
            delivery_status: status,
            delivery_date: status === 'Delivered' ? inputDateToday() : d.delivery_date,
            returned_date: status === 'Returned' ? inputDateToday() : d.returned_date,
            delivery_remark: remark || d.delivery_remark,
            no_of_attempts: status === 'Hold' || status === 'Returned' ? d.no_of_attempts + 1 : d.no_of_attempts,
          }
        : d,
    )
    let stockLedger = state.stockLedger
    let followups = state.followups
    let payments = state.payments
    let orderItems = state.orderItems

    if (status === 'Returned' && prev !== 'Returned') {
      const saleItems = state.orderItems.filter((i) => i.order_id === orderId && i.transaction_type === 'Sale')
      const returns = saleItems.map((i) => ({
        ...i,
        order_item_id: uid('R'),
        transaction_type: 'Return' as const,
      }))
      orderItems = [...returns, ...orderItems]
      stockLedger = [
        ...saleItems.map((i) => ({
          stock_txn_id: uid('ST'),
          product_id: i.product_id,
          batch_id: i.batch_id,
          txn_date: inputDateToday(),
          txn_type: 'Return In' as const,
          qty: i.qty,
          reference_order_id: orderId,
          purchase_party: '',
        })),
        ...stockLedger,
      ]
      payments = payments.map((p) => (p.order_id === orderId ? { ...p, returned_value: p.cod_amount || order.total_value, amount_received: 0 } : p))
      const exists = followups.some((f) => f.order_id === orderId && f.queue_reason === 'Return follow-up')
      if (!exists) {
        followups = [
          {
            followup_id: uid('F'),
            order_id: orderId,
            caller_id: state.employees.find((e) => e.role === 'Caller')?.employee_id ?? 'E014',
            executive_remark: '',
            order_status: 'Pending call',
            returned_remark: remark,
            reorder_done: false,
            message_flag: false,
            call_on_3rd_day: null,
            last_call_date: null,
            queue_reason: 'Return follow-up',
          },
          ...followups,
        ]
      }
    }

    if ((status === 'Out for Delivery' || status === 'Hold') && !followups.some((f) => f.order_id === orderId && f.queue_reason === 'OFD follow-up' && f.order_status === 'Pending call')) {
      followups = [
        {
          followup_id: uid('F'),
          order_id: orderId,
          caller_id: state.employees.find((e) => e.role === 'Caller')?.employee_id ?? 'E014',
          executive_remark: '',
          order_status: 'Pending call',
          returned_remark: '',
          reorder_done: false,
          message_flag: false,
          call_on_3rd_day: status === 'Hold' ? inputDateToday() : null,
          last_call_date: null,
          queue_reason: 'OFD follow-up',
        },
        ...followups,
      ]
    }

    state = { ...state, orders, dispatches, stockLedger, followups, payments, orderItems }
    emit()
  },

  async attachDockets(orderId: string, courier_name: string, docket_nos: string[]) {
    await delay()
    const existing = state.dispatches.find((d) => d.order_id === orderId)
    const nos = docket_nos.filter(Boolean)
    let dispatches
    if (existing) {
      dispatches = state.dispatches.map((d) =>
        d.order_id === orderId
          ? {
              ...d,
              courier_name,
              docket_nos: [...new Set([...d.docket_nos, ...nos])],
              delivery_status: nos.length ? ('At Hub' as const) : d.delivery_status,
            }
          : d,
      )
    } else {
      dispatches = [
        {
          dispatch_id: uid('D'),
          order_id: orderId,
          courier_name,
          docket_nos: nos,
          dispatch_date: inputDateToday(),
          delivery_date: null,
          delivery_status: 'At Hub' as const,
          no_of_attempts: 0,
          delivery_remark: '',
          returned_date: null,
        },
        ...state.dispatches,
      ]
    }
    // AWB saved → order moves automatically out of desk / ready queue
    const bump: DeliveryStatus[] = ['Submitted', 'Ready for Dispatch', 'Pending', 'Assigned for Delivery']
    const orders = state.orders.map((o) =>
      o.order_id === orderId && nos.length && bump.includes(o.delivery_status) ? { ...o, delivery_status: 'At Hub' as const } : o,
    )
    state = { ...state, dispatches, orders }
    emit()
  },

  async markPaymentReceived(orderId: string, amount: number, date: string, cheque_no: string) {
    await delay()
    state = {
      ...state,
      payments: state.payments.map((p) =>
        p.order_id === orderId
          ? {
              ...p,
              amount_received: Math.min(p.cod_amount, p.amount_received + amount),
              amount_received_date: date,
              cheque_no: cheque_no || p.cheque_no,
            }
          : p,
      ),
    }
    emit()
  },

  async saveFollowup(
    followupId: string,
    patch: {
      order_status: FollowupOrderStatus
      executive_remark: string
      call_on_3rd_day: string | null
      reorder_done: boolean
    },
  ) {
    await delay()
    state = {
      ...state,
      followups: state.followups.map((f) =>
        f.followup_id === followupId
          ? {
              ...f,
              ...patch,
              last_call_date: inputDateToday(),
              queue_reason: patch.reorder_done || patch.order_status === 'Reorder done' ? 'Reorder follow-up' : f.queue_reason,
            }
          : f,
      ),
    }
    emit()
  },

  async createPurchase(input: PurchaseEntryInput) {
    await delay()
    let batches = state.batches
    let batch_id = input.batch_id
    if (input.new_batch) {
      batch_id = uid('B')
      batches = [
        {
          batch_id,
          product_id: input.product_id,
          batch_no: input.new_batch.batch_no,
          mfg_date: input.new_batch.mfg_date,
          expiry_date: input.new_batch.expiry_date,
        },
        ...batches,
      ]
    }
    if (!batch_id) throw new Error('Batch required')
    const txn = {
      stock_txn_id: uid('ST'),
      product_id: input.product_id,
      batch_id,
      txn_date: input.txn_date,
      txn_type: 'Purchase In' as const,
      qty: input.qty,
      reference_order_id: null,
      purchase_party: input.purchase_party,
    }
    state = { ...state, batches, stockLedger: [txn, ...state.stockLedger] }
    emit()
  },

  async returnToStock(orderId: string) {
    await delay(200)
    await this.setDeliveryStatus(orderId, 'Returned', 'Warehouse return-to-stock')
  },

  async saveDamage(input: {
    employee_id: string
    customer_name: string
    contact_no: string
    damage_type: DamageType
    product_id: string
    batch_id: string
    qty: number
  }) {
    await delay()
    const product = state.products.find((p) => p.product_id === input.product_id)
    state = {
      ...state,
      damageReports: [
        {
          damage_id: uid('DM'),
          report_date: inputDateToday(),
          product_detail: product?.product_name ?? '',
          ...input,
        },
        ...state.damageReports,
      ],
    }
    emit()
  },

  async saveProduct(product: Omit<Product, 'product_id'> & { product_id?: string }) {
    await delay()
    if (product.product_id) {
      state = { ...state, products: state.products.map((p) => (p.product_id === product.product_id ? { ...p, ...product } as Product : p)) }
    } else {
      state = { ...state, products: [{ ...product, product_id: uid('P') }, ...state.products] }
    }
    emit()
  },

  async saveBatch(batch: Omit<ProductBatch, 'batch_id'> & { batch_id?: string }) {
    await delay()
    if (batch.batch_id) {
      state = { ...state, batches: state.batches.map((b) => (b.batch_id === batch.batch_id ? { ...b, ...batch } as ProductBatch : b)) }
    } else {
      state = { ...state, batches: [{ ...batch, batch_id: uid('B') }, ...state.batches] }
    }
    emit()
  },

  async saveEmployee(emp: Omit<Employee, 'employee_id'> & { employee_id?: string }) {
    await delay()
    if (emp.employee_id) {
      state = { ...state, employees: state.employees.map((e) => (e.employee_id === emp.employee_id ? { ...e, ...emp } as Employee : e)) }
    } else {
      state = { ...state, employees: [{ ...emp, employee_id: uid('E') }, ...state.employees] }
    }
    emit()
  },

  async setAttendance(employee_id: string, report_date: string, attendance: AttendanceMark) {
    await delay(120)
    const rest = state.attendance.filter((a) => !(a.employee_id === employee_id && a.report_date === report_date))
    state = { ...state, attendance: [{ employee_id, report_date, attendance }, ...rest] }
    emit()
  },

  async setExpiryThreshold(days: number) {
    state = { ...state, expiryAlertDays: days }
    emit()
  },

  async updateScheme(id: string, patch: { status?: SchemeStatus; caller_remark?: string }) {
    await delay()
    state = { ...state, schemes: state.schemes.map((s) => (s.scheme_id === id ? { ...s, ...patch } : s)) }
    emit()
  },

  async addSchemeOffer(offer_name: string, scheme_kind?: 'glass_free' | 'amazon_gift' | 'product') {
    await delay(120)
    const name = offer_name.trim()
    if (!name) throw new Error('Enter a scheme name')
    const kind =
      scheme_kind ??
      (/amazon\s*gift/i.test(name) ? 'amazon_gift' : /glass/i.test(name) ? 'glass_free' : 'product')
    if (kind === 'amazon_gift') {
      const label = name
      if (state.schemeOffers.some((o) => o.offer_name.toLowerCase() === label.toLowerCase())) return
      state = {
        ...state,
        schemeOffers: [
          { offer_id: uid('OFF'), offer_name: label, free_glasses: 0, scheme_kind: 'amazon_gift' as const },
          ...state.schemeOffers,
        ],
      }
      emit()
      return
    }
    const free_glasses = (() => {
      const m = name.match(/^(\d+)\s*glass(?:es)?\s*free$/i)
      return m ? Number(m[1]) : 0
    })()
    if (free_glasses < 1) throw new Error('Scheme must be like “1 glass free”, “2 glass free”, or “Amazon Gift ₹500”')
    const label = `${free_glasses} glass free`
    if (state.schemeOffers.some((o) => o.free_glasses === free_glasses && (o.scheme_kind ?? 'glass_free') === 'glass_free')) return
    state = {
      ...state,
      schemeOffers: [
        { offer_id: uid('OFF'), offer_name: label, free_glasses, scheme_kind: 'glass_free' as const },
        ...state.schemeOffers,
      ].sort((a, b) => {
        const ak = a.scheme_kind ?? 'glass_free'
        const bk = b.scheme_kind ?? 'glass_free'
        if (ak !== bk) return ak.localeCompare(bk)
        return a.free_glasses - b.free_glasses
      }),
    }
    emit()
  },

  async removeSchemeOffer(offer_id: string) {
    await delay(80)
    state = { ...state, schemeOffers: state.schemeOffers.filter((o) => o.offer_id !== offer_id) }
    emit()
  },

  async setProductThreshold(product_id: string, low_stock_threshold: number) {
    await delay(80)
    state = { ...state, products: state.products.map((p) => (p.product_id === product_id ? { ...p, low_stock_threshold } : p)) }
    emit()
  },
}

function inputDateToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
