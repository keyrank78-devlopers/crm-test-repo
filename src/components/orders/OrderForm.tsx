import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useAppState } from '../../api/store'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import {
  batchStock,
  courierOptionsForPin,
  customerOrderCount,
  levelFromOrderCount,
  productStock,
} from '../../lib/compute'
import { inrDec, phoneOk, toIsoDate } from '../../lib/format'
import { CUSTOMER_TYPES, parseGlassFreeScheme, type Customer, type CustomerType, type Order, type PartyType, type PaymentMode } from '../../types'
import { Button, Field, Input, Select, Textarea } from '../ui/primitives'

const PAYMENT_TERMS: { mode: PaymentMode; label: string; hint: string }[] = [
  { mode: 'Advance', label: 'Advance', hint: 'Full payment before dispatch' },
  { mode: 'COD', label: 'COD', hint: 'Cash on delivery' },
  { mode: 'Advance+COD', label: 'Advance+COD', hint: 'Some amount advance, balance COD' },
  { mode: 'Credit', label: 'Credit', hint: 'Supply on credit for a set period' },
]

const CREDIT_PRESETS = [7, 15, 21, 30, 45]

const STATES = [
  'Haryana',
  'Punjab',
  'Rajasthan',
  'Delhi',
  'Uttar Pradesh',
  'Himachal Pradesh',
  'Uttarakhand',
  'Madhya Pradesh',
  'Gujarat',
  'Maharashtra',
  'Bihar',
  'West Bengal',
  'Other',
]

function partyFromType(t: CustomerType): PartyType {
  if (t === 'Ecommerce') return 'Online'
  if (t === 'End consumer') return 'Individual'
  if (t === 'Stockist' || t === 'Super Stockist') return 'Cosmetic Shop'
  if (t === 'Wholesaler') return 'General Store'
  if (t === 'FSE') return 'Individual'
  return 'Chemist'
}

interface ProdLine {
  id: string
  product_id: string
  qty: number
  rate: number
}

function lineId() {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function OrderForm({ variant, defaultPlatform = '' }: { variant: 'fse' | 'office'; defaultPlatform?: string }) {
  const state = useAppState()
  const { employee } = useSession()
  const { push } = useToast()
  const nav = useNavigate()
  const fses = state.employees.filter((e) => e.role === 'FSE')
  const teamLeaders = state.employees.filter((e) => e.role === 'Team Leader')
  const offers = state.schemeOffers

  const inStockProducts = useMemo(
    () => state.products.filter((p) => productStock(state, p.product_id) > 0),
    [state],
  )
  const defaultProductId = inStockProducts[0]?.product_id ?? ''

  const initialTl =
    employee.role === 'FSE' && employee.team_leader_id
      ? employee.team_leader_id
      : teamLeaders[0]?.employee_id ?? ''

  const [orderDate, setOrderDate] = useState(toIsoDate(new Date()))
  const [platform, setPlatform] = useState(defaultPlatform)
  const [teamLeaderId, setTeamLeaderId] = useState(initialTl)
  const fsesForTl = useMemo(
    () => (teamLeaderId ? fses.filter((e) => e.team_leader_id === teamLeaderId) : fses),
    [fses, teamLeaderId],
  )
  const [fseId, setFseId] = useState(
    employee.role === 'FSE' ? employee.employee_id : fsesForTl[0]?.employee_id ?? fses[0]?.employee_id ?? '',
  )
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new')
  const [customerType, setCustomerType] = useState<CustomerType>('Retailer')
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [firm, setFirm] = useState('')
  const [region, setRegion] = useState('Haryana')
  const [district, setDistrict] = useState('')
  const [tehsil, setTehsil] = useState('')
  const [houseNo, setHouseNo] = useState('')
  const [city, setCity] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [lines, setLines] = useState<ProdLine[]>([
    {
      id: lineId(),
      product_id: defaultProductId,
      qty: 1,
      rate: state.products.find((p) => p.product_id === defaultProductId)?.default_rate ?? 0,
    },
  ])
  const [scheme, setScheme] = useState('')
  const [remark, setRemark] = useState('')
  const [expiryClaimFree, setExpiryClaimFree] = useState(false)
  const [expiryClaimProductId, setExpiryClaimProductId] = useState(defaultProductId)
  const [expiryClaimQty, setExpiryClaimQty] = useState(1)
  const [expiryClaimDetails, setExpiryClaimDetails] = useState('')
  const [gstin, setGstin] = useState('')
  const [dlNumber, setDlNumber] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('COD')
  const [creditDays, setCreditDays] = useState(15)
  const [customCredit, setCustomCredit] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState(0)
  const [preferredCourier, setPreferredCourier] = useState('')
  const [payError, setPayError] = useState('')
  const [created, setCreated] = useState<Order | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [triedSubmit, setTriedSubmit] = useState(false)

  const needFirm = customerType !== 'End consumer' && customerType !== 'FSE'
  const selectedOffer = offers.find((o) => o.offer_name === scheme)
  const schemeFreeGlasses = selectedOffer?.free_glasses ?? parseGlassFreeScheme(scheme) ?? 0
  const schemeFreeProductId = lines.find((l) => l.product_id)?.product_id ?? ''
  const pinCourierOptions = useMemo(() => courierOptionsForPin(pinCode), [pinCode])

  useEffect(() => {
    const pin = pinCode.trim()
    if (!/^\d{6}$/.test(pin)) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
        const data = (await res.json()) as { Status?: string; PostOffice?: { Name?: string; District?: string; State?: string; Block?: string; Division?: string }[] }[]
        const first = data?.[0]
        if (cancelled || first?.Status !== 'Success' || !first.PostOffice?.[0]) return
        const po = first.PostOffice[0]
        if (po.Name) setCity(po.Name)
        if (po.District) setDistrict(po.District)
        if (po.State) setRegion(STATES.includes(po.State) ? po.State : 'Other')
        const tehsilVal = po.Block || po.Division || po.Name || ''
        if (tehsilVal) setTehsil(tehsilVal)
        setErrors((e) => {
          const next = { ...e }
          delete next.city
          delete next.district
          delete next.tehsil
          delete next.pin
          return next
        })
      } catch {
        // silent — optional toast
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinCode])

  useEffect(() => {
    if (!preferredCourier || !pinCourierOptions.includes(preferredCourier as 'Shadowfax' | 'India Post')) {
      setPreferredCourier(pinCourierOptions[0] ?? 'India Post')
    }
  }, [pinCourierOptions, preferredCourier])

  const priorOrders = matchedCustomerId ? customerOrderCount(state, matchedCustomerId) : 0
  const existingLevel = matchedCustomerId != null ? levelFromOrderCount(priorOrders) : null
  const thisOrderNumber = matchedCustomerId != null ? priorOrders + 1 : 0
  const existingLevelLabel =
    matchedCustomerId != null
      ? priorOrders <= 0
        ? 'First time — no prior orders'
        : `${priorOrders} prior order${priorOrders === 1 ? '' : 's'} · this is order #${thisOrderNumber} · Level ${existingLevel}`
      : null

  const FIELD_LABELS: Record<string, string> = {
    date: 'Date',
    tl: 'Team Leader',
    fse: 'FSE',
    name: 'Name',
    contact: 'Contact no',
    firm: 'Firm name',
    district: 'District',
    tehsil: 'Tehsil / Village',
    house: 'Landmark',
    city: 'City',
    pin: 'PIN code',
    product: 'Products',
    gstin: 'GSTIN',
    expiryClaim: 'Expiry Claim Free',
  }

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + Math.max(1, l.qty) * Math.max(0, l.rate), 0),
    [lines],
  )

  function availableFor(productId: string, exceptLineId?: string) {
    const onHand = Math.max(0, productStock(state, productId))
    const reserved = lines
      .filter((l) => l.product_id === productId && l.id !== exceptLineId)
      .reduce((s, l) => s + Math.max(0, l.qty), 0)
    return Math.max(0, onHand - reserved)
  }

  function bestBatch(productId: string) {
    const batches = state.batches.filter((b) => b.product_id === productId)
    let best = batches[0]
    let bestQty = -1
    for (const b of batches) {
      const q = batchStock(state, b.batch_id)
      if (q > bestQty) {
        bestQty = q
        best = b
      }
    }
    return best
  }

  function clearError(key: string) {
    setErrors((e) => {
      if (!e[key]) return e
      const { [key]: _, ...rest } = e
      return rest
    })
  }

  function fillFromCustomer(found: Customer) {
    setMatchedCustomerId(found.customer_id)
    setContact(found.contact_no_1)
    setName(found.customer_name)
    setFirm(found.firm_name)
    setHouseNo(found.landmark || found.address)
    setCity(found.village_city || found.district)
    setDistrict(found.district)
    setTehsil(found.tehsil)
    setPinCode(found.pin_code)
    setRegion(found.state || 'Haryana')
    setCustomerType(CUSTOMER_TYPES.includes(found.customer_type) ? found.customer_type : 'Retailer')
    setGstin(found.gstin || '')
    setDlNumber(found.dl_number || '')
    clearError('name')
    clearError('firm')
    clearError('house')
    clearError('city')
    clearError('district')
    clearError('tehsil')
    clearError('pin')
    clearError('contact')
  }

  function findCustomerByPhone(phone: string) {
    const digits = phone.replace(/\D/g, '')
    const last10 = digits.slice(-10)
    return state.customers.find((c) => {
      const cd = c.contact_no_1.replace(/\D/g, '')
      return c.contact_no_1 === phone.trim() || cd === digits || (last10.length === 10 && cd.endsWith(last10))
    })
  }

  function applyExistingCustomer(phone: string) {
    const found = findCustomerByPhone(phone)
    if (!found) {
      setMatchedCustomerId(null)
      return
    }
    fillFromCustomer(found)
  }

  function clearCustomerFields() {
    setMatchedCustomerId(null)
    setName('')
    setFirm('')
    setHouseNo('')
    setCity('')
    setDistrict('')
    setTehsil('')
    setPinCode('')
    setRegion('Haryana')
    setCustomerType('Retailer')
    setGstin('')
    setDlNumber('')
  }

  function patchLine(id: string, patch: Partial<ProdLine>) {
    clearError('product')
    setLineErrors((e) => {
      if (!e[id]) return e
      const { [id]: _, ...rest } = e
      return rest
    })
    setLines((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        if (patch.qty !== undefined) next.qty = Math.max(1, patch.qty)
        if (patch.product_id !== undefined && patch.rate === undefined) {
          next.rate = state.products.find((p) => p.product_id === patch.product_id)?.default_rate ?? 0
        }
        if (patch.rate !== undefined) next.rate = Math.max(0, patch.rate)
        return next
      }),
    )
  }

  function checkStockLines(rows: ProdLine[]) {
    const next: Record<string, string> = {}
    const used = new Map<string, number>()
    for (const line of rows) {
      if (!line.product_id || line.qty <= 0) continue
      const onHand = Math.max(0, productStock(state, line.product_id))
      const already = used.get(line.product_id) ?? 0
      const remaining = Math.max(0, onHand - already)
      if (line.qty > remaining) {
        const p = state.products.find((x) => x.product_id === line.product_id)
        next[line.id] =
          remaining <= 0
            ? `Out of stock — ${p?.product_name ?? 'product'} has 0 available`
            : `Out of stock — only ${remaining} available (asked ${line.qty})`
      }
      used.set(line.product_id, already + line.qty)
    }
    return next
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!orderDate) next.date = 'Pick the order date'
    if (!teamLeaderId) next.tl = 'Select Team Leader'
    if (!fseId) next.fse = 'Select which FSE is booking this order'
    if (!name.trim()) next.name = 'Enter the person / party name'
    if (contact.trim() && !phoneOk(contact)) {
      next.contact = 'Must be a 10-digit Indian mobile (starts with 6–9)'
    }
    // Existing pick is optional — can type fields manually
    if (needFirm && !firm.trim() && customerMode === 'new') next.firm = 'Firm / shop name is required for this customer type'
    if (!district.trim()) next.district = 'Enter district'
    if (!tehsil.trim()) next.tehsil = 'Enter tehsil / village'
    // Landmark + phone + existing pick are optional
    if (!city.trim()) next.city = 'Enter city'
    if (!pinCode.trim()) next.pin = 'Enter PIN code'
    else if (!/^\d{6}$/.test(pinCode.trim())) next.pin = 'PIN must be exactly 6 digits'
    if (inStockProducts.length === 0) next.product = 'No products with inventory on hand'
    else if (!lines.some((l) => l.product_id && l.qty > 0)) next.product = 'Add at least one product with quantity'
    if (gstin.trim() && !/^[0-9A-Z]{15}$/i.test(gstin.replace(/\s/g, ''))) next.gstin = 'GSTIN must be exactly 15 letters/numbers, or leave blank'
    if (expiryClaimFree) {
      if (!expiryClaimProductId) next.expiryClaim = 'Select the free product for expiry claim'
      else if (!expiryClaimQty || expiryClaimQty < 1) next.expiryClaim = 'Enter free qty for expiry claim (at least 1)'
      else if (!expiryClaimDetails.trim()) next.expiryClaim = 'Add expiry claim details (batch / reason)'
      else {
        const claimAvail = Math.max(0, productStock(state, expiryClaimProductId))
        const alreadyOnOrder = lines.filter((l) => l.product_id === expiryClaimProductId).reduce((s, l) => s + l.qty, 0)
        const schemeExtra =
          schemeFreeGlasses > 0 && schemeFreeProductId === expiryClaimProductId ? schemeFreeGlasses : 0
        const remaining = Math.max(0, claimAvail - alreadyOnOrder - schemeExtra)
        if (expiryClaimQty > remaining) {
          next.expiryClaim =
            remaining <= 0
              ? 'Out of stock for expiry claim free — 0 available'
              : `Out of stock — only ${remaining} available for expiry claim free`
        }
      }
    }
    if (schemeFreeGlasses > 0 && schemeFreeProductId) {
      const onHand = Math.max(0, productStock(state, schemeFreeProductId))
      const paid = lines.filter((l) => l.product_id === schemeFreeProductId).reduce((s, l) => s + l.qty, 0)
      const claimExtra = expiryClaimFree && expiryClaimProductId === schemeFreeProductId ? expiryClaimQty : 0
      const remaining = Math.max(0, onHand - paid - claimExtra)
      if (schemeFreeGlasses > remaining) {
        next.product = `Scheme “${scheme}” needs ${schemeFreeGlasses} free glass — only ${remaining} stock left`
      }
    }
    const stockErrs = checkStockLines(lines)
    if (Object.keys(stockErrs).length) {
      next.product = Object.values(stockErrs)[0] ?? 'Fix stock quantity'
    }
    return { next, stockErrs }
  }

  async function submit() {
    setTriedSubmit(true)
    const { next, stockErrs } = validate()
    setErrors(next)
    setLineErrors(stockErrs)
    if (Object.keys(next).length) {
      const stockMsg = Object.values(stockErrs)[0]
      push(stockMsg ?? `Fix ${Object.keys(next).length} field(s) marked in red`, 'err')
      requestAnimationFrame(() => {
        document.getElementById('order-validation-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    setBusy(true)
    try {
      let customer =
        customerMode === 'existing' && matchedCustomerId
          ? state.customers.find((c) => c.customer_id === matchedCustomerId)
          : contact.trim()
            ? state.customers.find((c) => c.contact_no_1 === contact.trim())
            : undefined

      if (customerMode === 'existing' && customer) {
        customer = await api.updateCustomer(customer.customer_id, {
          customer_name: name.trim(),
          firm_name: firm.trim(),
          contact_no_1: contact.trim() || customer.contact_no_1,
          gstin: gstin.trim().toUpperCase(),
          dl_number: dlNumber.trim().toUpperCase(),
          address: houseNo.trim(),
          village_city: city.trim(),
          tehsil: tehsil.trim(),
          post_office: tehsil.trim(),
          district: district.trim(),
          state: region,
          pin_code: pinCode.trim(),
          landmark: houseNo.trim(),
          customer_type: customerType,
          party_type: partyFromType(customerType),
        })
      } else if (customerMode === 'new' || !customer) {
        customer = await api.createCustomer({
          customer_name: name.trim(),
          firm_name: firm.trim(),
          contact_no_1: contact.trim(),
          contact_no_2: '',
          gstin: gstin.trim().toUpperCase(),
          dl_number: dlNumber.trim().toUpperCase(),
          address: houseNo.trim(),
          village_city: city.trim(),
          tehsil: tehsil.trim(),
          post_office: tehsil.trim(),
          district: district.trim(),
          state: region,
          pin_code: pinCode.trim(),
          landmark: houseNo.trim(),
          customer_type: customerType,
          customer_level: 'New',
          party_type: partyFromType(customerType),
        })
      }

      const items = lines
        .filter((l) => l.product_id && l.qty > 0)
        .map((l) => {
          const batch = bestBatch(l.product_id)
          return {
            product_id: l.product_id,
            batch_id: batch?.batch_id ?? '',
            qty: l.qty,
            rate: l.rate,
            is_free: false,
          }
        })

      if (schemeFreeGlasses > 0 && schemeFreeProductId) {
        const batch = bestBatch(schemeFreeProductId)
        items.push({
          product_id: schemeFreeProductId,
          batch_id: batch?.batch_id ?? '',
          qty: schemeFreeGlasses,
          rate: 0,
          is_free: true,
        })
      }

      if (expiryClaimFree && expiryClaimProductId && expiryClaimQty > 0) {
        const batch = bestBatch(expiryClaimProductId)
        items.push({
          product_id: expiryClaimProductId,
          batch_id: batch?.batch_id ?? '',
          qty: expiryClaimQty,
          rate: 0,
          is_free: true,
        })
      }

      const tl = state.employees.find((e) => e.employee_id === teamLeaderId)
      const order = await api.createOrder({
        customer_id: customer.customer_id,
        employee_id: fseId,
        platform: platform.trim() || defaultPlatform || 'retailer',
        order_type: customerType === 'Ecommerce' ? 'Ecommerce' : 'Retail',
        payment_mode: 'COD',
        credit_days: 0,
        advance_amount: 0,
        preferred_courier: preferredCourier || pinCourierOptions[0] || 'India Post',
        scheme,
        discount: 0,
        courier_charges: 0,
        order_remark: remark.trim(),
        expiry_damage_remark: expiryClaimFree ? `Expiry claim free: ${expiryClaimDetails.trim()}` : '',
        expiry_claim_free: expiryClaimFree,
        expiry_claim_product_id: expiryClaimFree ? expiryClaimProductId : '',
        expiry_claim_qty: expiryClaimFree ? expiryClaimQty : 0,
        expiry_claim_details: expiryClaimFree ? expiryClaimDetails.trim() : '',
        order_date: orderDate,
        tsr_name: tl?.employee_name ?? '',
        asm_name: '',
        items,
      })
      setCreated(order)
      setPayMode(customerType === 'Ecommerce' ? 'Advance' : 'COD')
      setCreditDays(15)
      setCustomCredit(false)
      setAdvanceAmount(Math.round(order.total_value * 0.3))
      setPreferredCourier(order.preferred_courier || pinCourierOptions[0] || 'India Post')
      setPayError('')
      push(`Order ${order.order_no} created — choose payment terms`)
      requestAnimationFrame(() => {
        document.getElementById('payment-terms-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPayment() {
    if (!created) return
    if (payMode === 'Credit' && (!creditDays || creditDays < 1)) {
      setPayError('Enter credit period in days (e.g. 15)')
      return
    }
    if (payMode === 'Advance+COD') {
      if (!advanceAmount || advanceAmount <= 0) {
        setPayError('Advance amount must be greater than 0')
        return
      }
      if (advanceAmount >= created.total_value) {
        setPayError('Advance must be less than order total (balance COD)')
        return
      }
    }
    if (!preferredCourier) {
      setPayError('Pick a preferred courier for this PIN')
      return
    }
    setPayError('')
    setBusy(true)
    try {
      await api.setPaymentTerms(
        created.order_id,
        payMode,
        creditDays,
        payMode === 'Advance+COD' ? advanceAmount : 0,
        preferredCourier,
      )
      const creditNote = payMode === 'Credit' ? ` · ${creditDays}-day credit` : ''
      const advNote = payMode === 'Advance+COD' ? ` · advance ${inrDec(advanceAmount)}` : ''
      push(`Order ${created.order_no} · ${payMode}${creditNote}${advNote} · ${preferredCourier} — TL / Admin / Manager will review`)
      nav(variant === 'fse' ? '/fse/orders' : variant === 'office' && defaultPlatform === 'call' ? '/caller/queue' : '/office/orders')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save payment terms', 'err')
    } finally {
      setBusy(false)
    }
  }

  const errorList = Object.entries(errors)
  const showBanner = triedSubmit && errorList.length > 0

  if (created) {
    return (
      <div id="payment-terms-step" className="space-y-4">
        <div className="rounded-2xl border border-pine/25 bg-pine/5 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Order created</p>
          <p className="font-display mt-1 text-2xl text-pine">{created.order_no}</p>
          <p className="mt-1 text-sm text-muted">
            ID <span className="font-mono text-ink">{created.order_id}</span> · {inrDec(created.total_value)}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Payment terms</p>
          <p className="mb-3 text-sm text-muted">Pick how this order will be paid.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAYMENT_TERMS.map((t) => {
              const active = payMode === t.mode
              return (
                <button
                  key={t.mode}
                  type="button"
                  onClick={() => {
                    setPayMode(t.mode)
                    setPayError('')
                    if (t.mode === 'Credit' && creditDays < 1) setCreditDays(15)
                    if (t.mode === 'Advance+COD' && advanceAmount <= 0) {
                      setAdvanceAmount(Math.round(created.total_value * 0.3))
                    }
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active ? 'border-pine bg-pine text-cream' : 'border-line bg-white hover:border-pine/40'
                  }`}
                >
                  <span className="block font-medium">{t.label}</span>
                  <span className={`mt-0.5 block text-xs ${active ? 'text-cream/75' : 'text-muted'}`}>{t.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
        {payMode === 'Advance+COD' ? (
          <div className="rounded-2xl border border-line bg-white p-4">
            <Field label="Advance amount" hint={`Must be > 0 and < ${inrDec(created.total_value)}`}>
              <Input
                type="number"
                min={1}
                max={Math.max(1, created.total_value - 1)}
                value={advanceAmount || ''}
                onChange={(e) => {
                  setAdvanceAmount(Math.max(0, Number(e.target.value) || 0))
                  setPayError('')
                }}
              />
            </Field>
            <p className="mt-2 text-sm text-muted">
              Balance COD: <span className="font-medium text-ink">{inrDec(Math.max(0, created.total_value - advanceAmount))}</span>
            </p>
            {payError && payMode === 'Advance+COD' ? (
              <p className="mt-2 text-sm font-medium text-blush" role="alert">
                ! {payError}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Preferred courier</p>
          <p className="mb-3 text-sm text-muted">Options for PIN {pinCode || '—'}</p>
          <div className="flex flex-wrap gap-2">
            {pinCourierOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setPreferredCourier(c)
                  setPayError('')
                }}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  preferredCourier === c ? 'bg-pine text-cream' : 'bg-cream text-ink'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {payMode === 'Credit' ? (
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Credit period</p>
            <div className="flex flex-wrap gap-2">
              {CREDIT_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setCreditDays(d)
                    setCustomCredit(false)
                    setPayError('')
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${
                    !customCredit && creditDays === d ? 'bg-pine text-cream' : 'bg-cream text-ink'
                  }`}
                >
                  {d} days
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomCredit(true)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${customCredit ? 'bg-pine text-cream' : 'bg-cream text-ink'}`}
              >
                Custom
              </button>
            </div>
            {customCredit ? (
              <div className="mt-3 max-w-xs">
                <Field label="Days">
                  <Input
                    type="number"
                    min={1}
                    value={creditDays}
                    onChange={(e) => {
                      setCreditDays(Math.max(1, Number(e.target.value) || 1))
                      setPayError('')
                    }}
                  />
                </Field>
              </div>
            ) : null}
            {payError ? (
              <p className="mt-2 text-sm font-medium text-blush" role="alert">
                ! {payError}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink">
                Credit for <span className="font-medium">{creditDays} days</span>
              </p>
            )}
          </div>
        ) : null}
        {payError && payMode !== 'Credit' && payMode !== 'Advance+COD' ? (
          <p className="text-sm font-medium text-blush" role="alert">
            ! {payError}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button size="lg" disabled={busy} onClick={() => void confirmPayment()}>
            {busy ? 'Saving…' : 'Confirm payment terms'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showBanner ? (
        <div id="order-validation-banner" className="rounded-2xl border border-blush/40 bg-blush/10 px-4 py-3" role="alert">
          <p className="font-medium text-blush">Cannot create order — fix these {errorList.length} mistake(s)</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {errorList.map(([key, msg]) => (
              <li key={key}>
                <button
                  type="button"
                  className="text-left underline decoration-blush/50 hover:text-blush"
                  onClick={() => document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                >
                  <span className="font-medium">{FIELD_LABELS[key] ?? key}:</span> {msg}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="field-date" label="Date" error={errors.date}>
          <Input
            invalid={!!errors.date}
            type="date"
            value={orderDate}
            onChange={(e) => {
              setOrderDate(e.target.value)
              clearError('date')
            }}
          />
        </Field>
        <Field label="Platform">
          <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Meesho, van, shop visit…" />
        </Field>
        <Field id="field-tl" label="Team Leader" error={errors.tl}>
          <Select
            invalid={!!errors.tl}
            value={teamLeaderId}
            onChange={(e) => {
              const id = e.target.value
              setTeamLeaderId(id)
              clearError('tl')
              const nextFses = id ? fses.filter((x) => x.team_leader_id === id) : fses
              if (!nextFses.some((x) => x.employee_id === fseId)) {
                setFseId(nextFses[0]?.employee_id ?? '')
              }
            }}
            disabled={employee.role === 'FSE'}
          >
            <option value="">Select Team Leader</option>
            {teamLeaders.map((e) => (
              <option key={e.employee_id} value={e.employee_id}>
                {e.employee_name} · {e.city_area}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="field-fse" label="FSE" error={errors.fse}>
          <Select
            invalid={!!errors.fse}
            value={fseId}
            onChange={(e) => {
              setFseId(e.target.value)
              clearError('fse')
              const fse = fses.find((x) => x.employee_id === e.target.value)
              if (fse?.team_leader_id) setTeamLeaderId(fse.team_leader_id)
            }}
            disabled={employee.role === 'FSE'}
          >
            <option value="">Select FSE</option>
            {fsesForTl.map((e) => (
              <option key={e.employee_id} value={e.employee_id}>
                {e.employee_name} · {e.city_area}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Customer</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomerMode('new')
                setMatchedCustomerId(null)
                clearCustomerFields()
                setContact('')
                clearError('contact')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                customerMode === 'new' ? 'bg-pine text-cream' : 'bg-cream text-ink'
              }`}
            >
              New customer
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode('existing')
                clearCustomerFields()
                setContact('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                customerMode === 'existing' ? 'bg-pine text-cream' : 'bg-cream text-ink'
              }`}
            >
              Existing customer
            </button>
          </div>
          {customerMode === 'existing' ? (
            <div className="mt-3 space-y-3">
              <Field label="Pick existing party" hint="Optional — pick to autofill, or type fields yourself">
                <Select
                  value={matchedCustomerId ?? ''}
                  onChange={(e) => {
                    const c = state.customers.find((x) => x.customer_id === e.target.value)
                    if (c) fillFromCustomer(c)
                    else {
                      clearCustomerFields()
                      setContact('')
                    }
                  }}
                >
                  <option value="">Optional — select to autofill</option>
                  {state.customers.map((c) => {
                    const n = customerOrderCount(state, c.customer_id)
                    const lvl = levelFromOrderCount(n)
                    return (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.firm_name || c.customer_name} · {c.contact_no_1} · {n === 0 ? 'First time' : `${n} orders`} · {lvl}
                      </option>
                    )
                  })}
                </Select>
              </Field>
              {matchedCustomerId && existingLevelLabel ? (
                <div className="rounded-2xl border border-pine/25 bg-pine/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Customer level</p>
                  <p className="mt-1 font-medium text-pine">{existingLevelLabel}</p>
                  <p className="mt-1 text-sm text-muted">
                    {priorOrders <= 0
                      ? 'New party — first booking on this contact.'
                      : priorOrders < 5
                        ? 'Under 5 orders · Bronze path'
                        : priorOrders < 10
                          ? 'Regular (5+) · Silver path'
                          : 'Loyal (10+) · Gold path'}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <Field label="Customer type">
          <Select
            value={customerType}
            onChange={(e) => {
              setCustomerType(e.target.value as CustomerType)
              clearError('firm')
            }}
          >
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="field-contact" label="Contact no" hint="Optional" error={errors.contact}>
          <Input
            invalid={!!errors.contact}
            value={contact}
            onChange={(e) => {
              const v = e.target.value
              setContact(v)
              clearError('contact')
              if (customerMode === 'existing') {
                if (phoneOk(v)) applyExistingCustomer(v)
                else if (!matchedCustomerId) setMatchedCustomerId(null)
              }
            }}
            placeholder="10-digit mobile (optional)"
            inputMode="numeric"
          />
        </Field>
        <Field id="field-name" label="Name" error={errors.name}>
          <Input
            invalid={!!errors.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clearError('name')
            }}
            placeholder="Person name"
          />
        </Field>
        <Field
          id="field-firm"
          label="Firm name"
          error={errors.firm}
          hint={customerMode === 'existing' || !needFirm ? 'Optional' : undefined}
        >
          <Input
            invalid={!!errors.firm}
            value={firm}
            onChange={(e) => {
              setFirm(e.target.value)
              clearError('firm')
            }}
            placeholder="Shop / firm"
          />
        </Field>
        <Field label="State">
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field id="field-district" label="District" error={errors.district}>
          <Input
            invalid={!!errors.district}
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value)
              clearError('district')
            }}
          />
        </Field>
        <Field id="field-tehsil" label="Tehsil / Village" error={errors.tehsil}>
          <Input
            invalid={!!errors.tehsil}
            value={tehsil}
            onChange={(e) => {
              setTehsil(e.target.value)
              clearError('tehsil')
            }}
          />
        </Field>
        <Field id="field-house" label="Landmark" error={errors.house} hint="Optional">
          <Input
            invalid={!!errors.house}
            value={houseNo}
            onChange={(e) => {
              setHouseNo(e.target.value)
              clearError('house')
            }}
            placeholder="Near bus stand, opp. hospital…"
          />
        </Field>
        <Field id="field-city" label="City" error={errors.city}>
          <Input
            invalid={!!errors.city}
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              clearError('city')
            }}
            placeholder="Village / city"
          />
        </Field>
        <Field id="field-pin" label="PIN code" error={errors.pin} hint="Fills city / district / state from India Post">
          <Input
            invalid={!!errors.pin}
            value={pinCode}
            onChange={(e) => {
              setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              clearError('pin')
            }}
            placeholder="6-digit"
            inputMode="numeric"
          />
        </Field>
      </div>

      <div id="field-product" className={errors.product ? 'rounded-2xl bg-blush/5 p-2' : ''}>
        <div className="mb-2 flex items-center justify-between">
          <p className={`text-xs font-medium uppercase tracking-wider ${errors.product ? 'text-blush' : 'text-muted'}`}>Products</p>
          {inStockProducts.length > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-pine"
              onClick={() => {
                clearError('product')
                const unused = inStockProducts.find((p) => !lines.some((l) => l.product_id === p.product_id))
                const pid = unused?.product_id ?? inStockProducts[0]?.product_id ?? ''
                const prod = state.products.find((p) => p.product_id === pid)
                setLines((s) => [...s, { id: lineId(), product_id: pid, qty: 1, rate: prod?.default_rate ?? 0 }])
              }}
            >
              + Add product
            </button>
          ) : null}
        </div>
        {errors.product ? (
          <p className="mb-2 text-sm font-medium text-blush" role="alert">
            ! {errors.product}
          </p>
        ) : null}
        {inStockProducts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink">No products with inventory on hand</p>
            <p className="mt-1 text-sm text-muted">Add stock before booking an order.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => {
              const p = state.products.find((x) => x.product_id === line.product_id)
              const amount = line.qty * line.rate
              const avail = availableFor(line.product_id, line.id)
              const over = line.qty > avail
              const lineErr = lineErrors[line.id]
              const invMin = p?.low_stock_threshold ?? 0
              const invMax = p?.max_stock ?? avail
              return (
                <div
                  key={line.id}
                  className={`rounded-2xl border bg-white p-3 ${over || lineErr ? 'border-blush/50 bg-blush/[0.03]' : errors.product ? 'border-blush/40' : 'border-line'}`}
                >
                  <Field label="Product">
                    <Select value={line.product_id} onChange={(e) => patchLine(line.id, { product_id: e.target.value })}>
                      {inStockProducts.map((prod) => {
                        const stock = Math.max(0, productStock(state, prod.product_id))
                        return (
                          <option key={prod.product_id} value={prod.product_id}>
                            {prod.product_code} · {prod.product_name} · avail {stock}
                          </option>
                        )
                      })}
                    </Select>
                  </Field>
                  <p className={`mt-1.5 text-sm ${avail <= 0 || over ? 'font-medium text-blush' : 'text-muted'}`}>
                    {avail <= 0
                      ? 'Out of stock — 0 available'
                      : over
                        ? `Out of stock — only ${avail} available`
                        : `${avail} available · inv min ${invMin} / max ${invMax}`}
                  </p>
                  {lineErr ? (
                    <p className="mt-1 text-sm font-medium text-blush" role="alert">
                      ! {lineErr}
                    </p>
                  ) : null}
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">Qty (max {avail})</p>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, avail)}
                        inputMode="numeric"
                        className={`h-11 w-full rounded-xl border bg-white px-3 text-lg font-semibold outline-none focus:border-pine ${
                          over ? 'border-blush' : 'border-line'
                        }`}
                        value={line.qty}
                        onChange={(e) => patchLine(line.id, { qty: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <Field label="Rate ₹">
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={line.rate}
                        onChange={(e) => patchLine(line.id, { rate: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <p className="mb-1 min-w-[6rem] text-right text-sm sm:mb-2">
                      <span className="block text-[11px] uppercase tracking-wider text-muted">Amount</span>
                      <span className="font-display text-lg">{inrDec(amount)}</span>
                      {lines.length > 1 ? (
                        <button type="button" className="mt-1 block w-full text-xs text-blush" onClick={() => setLines((s) => s.filter((x) => x.id !== line.id))}>
                          Remove
                        </button>
                      ) : null}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-pine px-4 py-3 text-cream">
          <span className="text-xs uppercase tracking-wider text-cream/70">Total amount</span>
          <span className="font-display text-2xl">{inrDec(totalAmount)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Scheme"
          hint={
            offers.length === 0
              ? 'Add “1 glass free” / “2 glass free” in Schemes'
              : schemeFreeGlasses > 0
                ? `Adds ${schemeFreeGlasses} free glass on first product (₹0)`
                : 'Only glass-free schemes — 1 glass free, 2 glass free…'
          }
        >
          <Select value={scheme} onChange={(e) => setScheme(e.target.value)} disabled={offers.length === 0}>
            <option value="">None</option>
            {offers.map((o) => (
              <option key={o.offer_id} value={o.offer_name}>
                {o.offer_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="field-gstin" label="GSTIN" hint="Optional" error={errors.gstin}>
          <Input
            invalid={!!errors.gstin}
            value={gstin}
            onChange={(e) => {
              setGstin(e.target.value.toUpperCase())
              clearError('gstin')
            }}
            placeholder="15-character GSTIN"
          />
        </Field>
        <Field label="DL number" hint="Optional">
          <Input
            value={dlNumber}
            onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
            placeholder="Drug license no."
          />
        </Field>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--color-pine,#1f4d3a)]"
            checked={expiryClaimFree}
            onChange={(e) => {
              setExpiryClaimFree(e.target.checked)
              clearError('expiryClaim')
            }}
          />
          <span>
            <span className="block text-sm font-medium text-ink">Expiry free</span>
            <span className="mt-0.5 block text-xs text-muted">
              Free goods against expiry from the party. Does not add to bill value; still uses stock.
            </span>
          </span>
        </label>
        {expiryClaimFree ? (
          <div id="field-expiryClaim" className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Free product" error={errors.expiryClaim && !expiryClaimProductId ? errors.expiryClaim : undefined}>
              <Select
                invalid={!!errors.expiryClaim}
                value={expiryClaimProductId}
                onChange={(e) => {
                  setExpiryClaimProductId(e.target.value)
                  clearError('expiryClaim')
                }}
              >
                {inStockProducts.map((prod) => (
                  <option key={prod.product_id} value={prod.product_id}>
                    {prod.product_code} · {prod.product_name} · avail {Math.max(0, productStock(state, prod.product_id))}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Free qty" error={errors.expiryClaim && expiryClaimQty < 1 ? errors.expiryClaim : undefined}>
              <Input
                invalid={!!errors.expiryClaim}
                type="number"
                min={1}
                value={expiryClaimQty}
                onChange={(e) => {
                  setExpiryClaimQty(Math.max(1, Number(e.target.value) || 1))
                  clearError('expiryClaim')
                }}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Expiry details"
                hint="Expired batch no., party note, date of expiry, etc."
                error={errors.expiryClaim}
              >
                <Textarea
                  invalid={!!errors.expiryClaim}
                  rows={3}
                  value={expiryClaimDetails}
                  onChange={(e) => {
                    setExpiryClaimDetails(e.target.value)
                    clearError('expiryClaim')
                  }}
                  placeholder="e.g. Batch VC2601 expired Aug 2026 — claim against shop invoice 4821"
                />
              </Field>
            </div>
          </div>
        ) : null}
      </div>

      <Field label="Remarks">
        <Textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} />
      </Field>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showBanner ? <p className="text-sm font-medium text-blush">{errorList.length} field(s) still need fixing</p> : <span />}
        <Button id="order-submit" size="lg" disabled={busy || inStockProducts.length === 0} onClick={() => void submit()}>
          {busy ? 'Creating…' : 'Create order'}
        </Button>
      </div>
    </div>
  )
}
