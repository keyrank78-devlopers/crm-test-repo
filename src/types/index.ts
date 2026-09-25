export type RoleUi =
  | 'Admin'
  | 'Team Leader'
  | 'Sales Manager'
  | 'FSE'
  | 'Office Staff'
  | 'Caller'
  | 'Warehouse'
  | 'Accounts'
  | 'Dispatch'

export type EmployeeRole =
  | 'TSR'
  | 'ASM'
  | 'FSE'
  | 'Caller'
  | 'Team Leader'
  | 'Office Staff'
  | 'Warehouse'
  | 'Accounts'
  | 'Admin'
  | 'Dispatch'

/** Spec listed platform "eccomerce" / order_type "Eccomerce"; we store ecommerce / Ecommerce. */
export type Platform = string
export type OrderType = 'Retail' | 'Office' | 'Ecommerce'
export type PaymentMode = 'Cash' | 'UPI' | 'Credit' | 'COD' | 'Prepaid' | 'Advance' | 'Token' | 'Part payment' | 'Advance+COD'

export type DeliveryStatus =
  | 'Submitted'
  | 'Ready for Dispatch'
  | 'Pending'
  | 'At Hub'
  | 'Assigned for Delivery'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Hold'
  | 'Returned'
  | 'Cancelled'

export type TransactionType = 'Sale' | 'Return'
export type StockTxnType = 'Purchase In' | 'Sale Out' | 'Return In' | 'Cases Sale Out'
export type DamageType = 'Not working' | 'Expired' | 'Damaged'
export type FollowupOrderStatus =
  | 'No requirement'
  | 'Will order in future'
  | 'Reorder done'
  | '2nd time returned'
  | 'Delivered'
  | 'Not available'
  | 'Pending call'

export type CustomerType = 'Super Stockist' | 'Retailer' | 'Stockist' | 'Wholesaler' | 'Ecommerce' | 'End consumer' | 'FSE'

/** Keep in sync with CustomerType — used by order form dropdowns. */
export const CUSTOMER_TYPES: CustomerType[] = [
  'Super Stockist',
  'Retailer',
  'Stockist',
  'Wholesaler',
  'Ecommerce',
  'End consumer',
  'FSE',
]
export type CustomerLevel = 'New' | 'Bronze' | 'Silver' | 'Gold'
export type PartyType = 'Chemist' | 'Cosmetic Shop' | 'General Store' | 'Individual' | 'Online'
export type SchemeStatus = 'Pending' | 'Gift dispatched' | 'Delivered' | 'Cancelled'
export type AttendanceMark = 'Present' | 'Absent' | 'Half day' | 'Leave'

export interface Product {
  product_id: string
  product_code: string
  product_name: string
  default_rate: number
  pack_size: string
  /** Reorder / low-stock floor (min) */
  low_stock_threshold: number
  /** Target / ceiling stock (max) */
  max_stock: number
}

export interface ProductBatch {
  batch_id: string
  product_id: string
  batch_no: string
  mfg_date: string
  expiry_date: string
}

export interface Customer {
  customer_id: string
  customer_name: string
  firm_name: string
  contact_no_1: string
  contact_no_2: string
  gstin: string
  dl_number: string
  address: string
  village_city: string
  tehsil: string
  post_office: string
  district: string
  state: string
  pin_code: string
  landmark: string
  customer_type: CustomerType
  customer_level: CustomerLevel
  party_type: PartyType
}

export interface Employee {
  employee_id: string
  employee_name: string
  role: EmployeeRole
  team_leader_id: string | null
  city_area: string
}

export interface Order {
  order_id: string
  order_no: string
  order_date: string
  customer_id: string
  employee_id: string
  platform: Platform
  order_type: OrderType
  payment_mode: PaymentMode
  credit_days: number
  /** Amount paid advance when payment_mode is Advance+COD */
  advance_amount?: number
  /** Preferred courier chosen at booking (PIN-serviceable) */
  preferred_courier?: string
  scheme: string
  discount: number
  courier_charges: number
  total_qty: number
  free_qty: number
  total_value: number
  expiry_damage_remark: string
  expiry_claim_free: boolean
  expiry_claim_product_id: string
  expiry_claim_qty: number
  expiry_claim_details: string
  order_remark: string
  delivery_status: DeliveryStatus
  tsr_name: string
  asm_name: string
}

export interface OrderItem {
  order_item_id: string
  order_id: string
  product_id: string
  batch_id: string
  qty: number
  rate: number
  amount: number
  transaction_type: TransactionType
  is_free: boolean
}

export interface Dispatch {
  dispatch_id: string
  order_id: string
  courier_name: string
  docket_nos: string[]
  dispatch_date: string
  delivery_date: string | null
  delivery_status: DeliveryStatus
  no_of_attempts: number
  delivery_remark: string
  returned_date: string | null
}

export interface Payment {
  payment_id: string
  order_id: string
  cod_amount: number
  amount_received: number
  amount_received_date: string | null
  cheque_no: string
  returned_value: number
}

export interface ReturnFollowup {
  followup_id: string
  order_id: string
  caller_id: string
  executive_remark: string
  order_status: FollowupOrderStatus
  returned_remark: string
  reorder_done: boolean
  message_flag: boolean
  call_on_3rd_day: string | null
  last_call_date: string | null
  queue_reason: 'OFD follow-up' | 'Return follow-up' | 'Reorder follow-up'
}

export interface StockTxn {
  stock_txn_id: string
  product_id: string
  batch_id: string
  txn_date: string
  txn_type: StockTxnType
  qty: number
  reference_order_id: string | null
  purchase_party: string
}

export interface DamageReport {
  damage_id: string
  employee_id: string
  report_date: string
  customer_name: string
  contact_no: string
  damage_type: DamageType
  product_detail: string
  product_id: string
  batch_id: string
  qty: number
}

export interface SchemeTracking {
  scheme_id: string
  customer_id: string
  scheme_month: string
  quantity: number
  scheme_value: number
  gift_link: string
  status: SchemeStatus
  caller_id: string
  caller_remark: string
}

export interface AttendanceRecord {
  employee_id: string
  report_date: string
  attendance: AttendanceMark
}

export interface SchemeOffer {
  offer_id: string
  /** Display name e.g. "1 glass free" */
  offer_name: string
  /** Free glass units added to the order at ₹0 */
  free_glasses: number
  /** Defaults to glass_free for existing offers */
  scheme_kind?: 'glass_free' | 'amazon_gift' | 'product'
}

/** Only glass-free schemes: "1 glass free", "2 glasses free", etc. */
export function parseGlassFreeScheme(name: string): number | null {
  const m = name.trim().match(/^(\d+)\s*glass(?:es)?\s*free$/i)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 ? n : null
}

export interface AppState {
  products: Product[]
  batches: ProductBatch[]
  customers: Customer[]
  employees: Employee[]
  orders: Order[]
  orderItems: OrderItem[]
  dispatches: Dispatch[]
  payments: Payment[]
  followups: ReturnFollowup[]
  stockLedger: StockTxn[]
  damageReports: DamageReport[]
  schemes: SchemeTracking[]
  schemeOffers: SchemeOffer[]
  attendance: AttendanceRecord[]
  expiryAlertDays: number
}

export interface CreateOrderInput {
  customer_id: string
  employee_id: string
  platform: Platform
  order_type: OrderType
  payment_mode: PaymentMode
  credit_days: number
  /** Amount paid advance when payment_mode is Advance+COD */
  advance_amount?: number
  preferred_courier?: string
  scheme: string
  discount: number
  courier_charges: number
  order_remark: string
  expiry_damage_remark: string
  expiry_claim_free?: boolean
  expiry_claim_product_id?: string
  expiry_claim_qty?: number
  expiry_claim_details?: string
  courier_name?: string
  order_date?: string
  tsr_name?: string
  asm_name?: string
  items: {
    product_id: string
    batch_id: string
    qty: number
    rate: number
    is_free: boolean
  }[]
}

export interface CreateCustomerInput {
  customer_name: string
  firm_name: string
  contact_no_1: string
  contact_no_2: string
  gstin: string
  dl_number: string
  address: string
  village_city: string
  tehsil: string
  post_office: string
  district: string
  state: string
  pin_code: string
  landmark: string
  customer_type: CustomerType
  customer_level: CustomerLevel
  party_type: PartyType
}

export interface PurchaseEntryInput {
  product_id: string
  batch_id?: string
  new_batch?: { batch_no: string; mfg_date: string; expiry_date: string }
  qty: number
  purchase_party: string
  txn_date: string
}
