import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus } from 'lucide-react'
import { customersApi, type ApiCustomer, type CreateCustomerInput } from '../../api/customers'
import { inventoryApi, type ApiProduct } from '../../api/inventory'
import { salesApi, type OrderSummary } from '../../api/sales'
import { schemeApi, type ApiScheme, type SchemeEligibleResponse } from '../../api/scheme'
import { ApiError, API_BASE } from '../../api/http'
import { Button, Field, Input, Modal, PageHeader, PageSkeleton, Select, Textarea, usePageLoad } from '../../components/ui/primitives'
import { useToast } from '../../context/ToastContext'


function resolveMediaUrl(url?: string | null) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  try {
    const origin = new URL(API_BASE, window.location.origin).origin
    if (url.startsWith('/')) return `${origin}${url}`
    return `${origin}/${url}`
  } catch {
    return url
  }
}

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

const CUSTOMER_TYPES = [
  { value: 'retail', label: 'Retailer' },
  { value: 'wholesale', label: 'Wholesaler' },
  { value: 'stockist', label: 'Stockist' },
  { value: 'super_stockist', label: 'Super Stockist' },
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'end_user', label: 'End consumer' },
  { value: 'fse', label: 'FSE' },
]

type SaleLine = { key: string; product_id: string; quantity: number | ''; price: number | '' }
type ExpiryCategory = 'missing' | 'damage' | 'non_working'

const EXPIRY_CATEGORIES: { value: ExpiryCategory; label: string }[] = [
  { value: 'missing', label: 'Missing' },
  { value: 'damage', label: 'Damage' },
  { value: 'non_working', label: 'Non-working' },
]

type ClaimLine = {
  key: string
  name: string
  batch_number: string
  quantity: number
  price: number
  expiry_date: string
  category: ExpiryCategory
  remarks: string
}

type PayMode = 'Advanced' | 'COD' | 'Advance + COD' | 'Partial Payment'

const PAYMENT_TERMS: { mode: PayMode; label: string; hint: string }[] = [
  { mode: 'Advanced', label: 'Advanced', hint: 'Full advance before dispatch' },
  { mode: 'COD', label: 'COD', hint: 'Cash on delivery' },
  { mode: 'Advance + COD', label: 'Advance + COD', hint: 'Part advance, balance COD' },
  { mode: 'Partial Payment', label: 'Credits', hint: 'Pay in parts — first part can be 0' },
]

function lid() {
  return Math.random().toString(36).slice(2, 9)
}

function productBand(p?: ApiProduct | null) {
  const min = Number(p?.min_price ?? 0)
  const max = Number(p?.max_price ?? 0)
  return { min, max }
}

function clampToBand(price: number, p?: ApiProduct | null) {
  const { min, max } = productBand(p)
  let next = price
  if (min > 0 && next < min) next = min
  if (max > 0 && next > max) next = max
  return next
}

function defaultUnit(p?: ApiProduct | null) {
  if (!p) return 0
  const unit = Number(p.single_unit_price) || p.price
  return clampToBand(unit, p)
}

function priceLimitInfo(price: number | '', p?: ApiProduct | null) {
  const { min, max } = productBand(p)
  const hasLimit = min > 0 || max > 0
  const limitLabel =
    min > 0 && max > 0
      ? `Min Price ₹${min} – Max Price ₹${max}`
      : min > 0
        ? `Min Price ₹${min}`
        : max > 0
          ? `Max Price ₹${max}`
          : 'No price limit set'

  if (!hasLimit) {
    return { kind: 'nolimit' as const, limitLabel, error: null as string | null }
  }
  if (price === '' || !Number.isFinite(Number(price))) {
    return { kind: 'empty' as const, limitLabel, error: null as string | null }
  }
  const n = Number(price)
  if (min > 0 && n < min) {
    return {
      kind: 'below' as const,
      limitLabel,
      error: `Below minimum — enter at least ₹${min}`,
    }
  }
  if (max > 0 && n > max) {
    return {
      kind: 'above' as const,
      limitLabel,
      error: `Above maximum — enter at most ₹${max}`,
    }
  }
  return { kind: 'ok' as const, limitLabel, error: null as string | null }
}

function lineQty(line: SaleLine) {
  const n = Number(line.quantity)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function linePrice(line: SaleLine) {
  const n = Number(line.price)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function lineSubtotal(line: SaleLine) {
  return lineQty(line) * linePrice(line)
}

function previewNewCustomerSchemes(schemes: ApiScheme[], orderAmount: number): SchemeEligibleResponse {
  const eligible = schemes
    .filter((s) => {
      if (!s.is_active) return false
      const min = Number(s.min_amount || 0)
      if (s.kind === 'new_party') return orderAmount >= min
      if (s.kind === 'amount') return orderAmount >= min
      return false
    })
    .map((s) => ({
      ...s,
      action: 'take_gift',
      reason: s.kind === 'new_party' ? 'New party scheme' : `Order ≥ ₹${s.min_amount}`,
    }))
  return {
    customer_id: '',
    customer_level: 0,
    prior_order_count: 0,
    prior_purchase_total: '0',
    order_amount: String(orderAmount),
    combined_amount: String(orderAmount),
    is_new_party: true,
    eligible,
    continue_schemes: [],
  }
}

function validateLinesAgainstBand(lines: SaleLine[], products: ApiProduct[]) {
  for (const line of lines) {
    if (!line.product_id || lineQty(line) <= 0) continue
    const p = products.find((x) => x.id === line.product_id)
    const info = priceLimitInfo(line.price, p)
    if (info.error) return `${p?.name ?? 'Product'}: ${info.error}`
  }
  return null
}

export function FseOrder() {
  const loading = usePageLoad(180)
  const { push } = useToast()
  const nav = useNavigate()

  // 4 Steps: 1: Customer -> 2: Products & Schemes -> 3: Expiry Claim -> 4: Payment Terms & Confirm
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [customers, setCustomers] = useState<ApiCustomer[]>([])
  const [order, setOrder] = useState<OrderSummary | null>(null)

  // Step 1 — customer
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [name, setName] = useState('')
  const [firmName, setFirmName] = useState('')
  const [phone, setPhone] = useState('')
  const [optionalPhone, setOptionalPhone] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [customerType, setCustomerType] = useState('retail')
  const [pinCode, setPinCode] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [tehsil, setTehsil] = useState('')
  const [stateName, setStateName] = useState('Haryana')
  const [landmark, setLandmark] = useState('')
  const [gstin, setGstin] = useState('')
  const [dl, setDl] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [customerLevel, setCustomerLevel] = useState<number | null>(null)

  // Step 2 — products & schemes
  const [saleLines, setSaleLines] = useState<SaleLine[]>([])
  const [remarks, setRemarks] = useState('')
  const [schemeInfo, setSchemeInfo] = useState<SchemeEligibleResponse | null>(null)
  const [allSchemes, setAllSchemes] = useState<ApiScheme[]>([])
  const [schemePick, setSchemePick] = useState<Record<string, 'take_gift' | 'continue' | ''>>({})
  const [noScheme, setNoScheme] = useState(false)

  // Step 3 — expiry claim
  const [hasExpiryClaim, setHasExpiryClaim] = useState(false)
  const [claimLines, setClaimLines] = useState<ClaimLine[]>([
    {
      key: lid(),
      name: '',
      batch_number: '',
      quantity: 1,
      price: 0,
      expiry_date: new Date().toISOString().slice(0, 10),
      category: 'damage',
      remarks: '',
    },
  ])
  const [claimRemarks, setClaimRemarks] = useState('')
  const [catQty, setCatQty] = useState({ missing: 0, damage: 0, non_working: 0 })
  const [claimMode, setClaimMode] = useState<'individual' | 'bulk'>('individual')
  const [bulkUnit, setBulkUnit] = useState({ missing: 0, damage: 0, non_working: 0 })
  const [bulkExpiry, setBulkExpiry] = useState({
    missing: new Date().toISOString().slice(0, 10),
    damage: new Date().toISOString().slice(0, 10),
    non_working: new Date().toISOString().slice(0, 10),
  })

  // Step 4 — payment terms
  const [payMode, setPayMode] = useState<PayMode>('COD')
  const [advanceCash, setAdvanceCash] = useState(0)
  const [advanceCredits, setAdvanceCredits] = useState(0)
  const [upiId, setUpiId] = useState('')
  const [payError, setPayError] = useState('')

  // Modals & UI previews
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [schemePopupOpen, setSchemePopupOpen] = useState(false)

  async function shareSchemePhoto(s: ApiScheme) {
    const photo = resolveMediaUrl(s.photo_url)
    const title = s.name
    const text = `${s.name} — ${s.gift_qty}× ${s.gift_name}`
    try {
      if (photo && typeof navigator.share === 'function') {
        try {
          const res = await fetch(photo)
          const blob = await res.blob()
          const ext = blob.type.includes('png') ? 'png' : 'jpg'
          const file = new File([blob], `${s.name.replace(/\s+/g, '-')}.${ext}`, { type: blob.type || 'image/jpeg' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title, text, files: [file] })
            push('Scheme photo shared')
            return
          }
        } catch {
          /* fall through to link share */
        }
        await navigator.share({ title, text, url: photo })
        push('Scheme shared')
        return
      }
      if (photo) {
        await navigator.clipboard.writeText(photo)
        push('Photo link copied — paste to share')
        return
      }
      push('No photo on this scheme')
    } catch {
      /* user cancelled share */
    }
  }

  const claimLiveTotal = useMemo(() => {
    if (!hasExpiryClaim) return 0
    if (claimMode === 'bulk') {
      return EXPIRY_CATEGORIES.reduce(
        (sum, c) => sum + (Number(catQty[c.value]) || 0) * (Number(bulkUnit[c.value]) || 0),
        0,
      )
    }
    return claimLines.reduce((sum, l) => {
      if (!l.name.trim() || l.quantity <= 0) return sum
      return sum + l.quantity * (Number(l.price) || 0)
    }, 0)
  }, [hasExpiryClaim, claimMode, claimLines, catQty, bulkUnit])

  const saleLiveTotal = useMemo(
    () => saleLines.reduce((sum, l) => (l.product_id && lineQty(l) > 0 ? sum + lineSubtotal(l) : sum), 0),
    [saleLines],
  )

  const payTotal = saleLiveTotal
  const payPaidLive =
    payMode === 'COD'
      ? 0
      : payMode === 'Advanced'
        ? advanceCash > 0
          ? advanceCash
          : payTotal
        : advanceCash + advanceCredits
  const payPendingLive = Math.max(0, payTotal - Math.min(payPaidLive, payTotal))

  const loadCatalog = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([inventoryApi.listProducts(), customersApi.list()])
      setProducts(p)
      setCustomers(c)
      setSaleLines((prev) => {
        if (prev.length || !p[0]) return prev
        return [{ key: lid(), product_id: p[0].id, quantity: 1, price: defaultUnit(p[0]) }]
      })
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Failed to load catalog')
    }
  }, [push])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    void schemeApi
      .list()
      .then((listed) => setAllSchemes(listed.filter((s) => s.is_active)))
      .catch(() => setAllSchemes([]))
  }, [])

  useEffect(() => {
    const pin = pinCode.trim()
    if (!/^\d{6}$/.test(pin)) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
        const data = (await res.json()) as {
          Status?: string
          PostOffice?: { Name?: string; District?: string; State?: string; Block?: string }[]
        }[]
        const po = data?.[0]?.PostOffice?.[0]
        if (cancelled || data?.[0]?.Status !== 'Success' || !po) return
        if (po.Name) setCity(po.Name)
        if (po.District) setDistrict(po.District)
        if (po.State) setStateName(po.State)
        if (po.Block) setTehsil(po.Block)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pinCode])

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : []
    const s = customerSearch.trim().toLowerCase()
    const digits = customerSearch.replace(/\D/g, '')
    if (!s) return list.slice(0, 40)
    return list
      .filter((c) => {
        const blob = `${c.name} ${c.firm_name ?? ''} ${c.phone} ${c.optional_phone ?? ''} ${c.city} ${c.district} ${c.gst_number ?? ''} ${c.addhar_number ?? ''}`.toLowerCase()
        if (blob.includes(s)) return true
        if (digits.length >= 3) {
          const phones = `${c.phone || ''}${c.optional_phone || ''}`.replace(/\D/g, '')
          if (phones.includes(digits)) return true
        }
        return false
      })
      .slice(0, 40)
  }, [customers, customerSearch])

  useEffect(() => {
    if (customerMode !== 'existing') return
    const q = customerSearch.trim()
    const t = window.setTimeout(() => {
      void customersApi
        .list(q || undefined)
        .then((list) => setCustomers(Array.isArray(list) ? list : []))
        .catch(() => {})
    }, q ? 300 : 0)
    return () => window.clearTimeout(t)
  }, [customerSearch, customerMode])

  function fillCustomerFields(c: ApiCustomer) {
    setName(c.name || '')
    setFirmName(c.firm_name || '')
    setPhone(c.phone || '')
    setOptionalPhone(c.optional_phone || '')
    setGender((c.gender as 'male' | 'female' | 'other') || 'male')
    setCustomerType(c.customer_type || 'retail')
    setPinCode(String(c.pincode || ''))
    setCity(c.city || '')
    setDistrict(c.district || '')
    setTehsil(c.tehsil || '')
    setStateName(c.state || 'Haryana')
    setLandmark(c.landmark || '')
    setGstin(c.gst_number || '')
    setDl(c.driving_license_number || '')
    setAadhaar(c.addhar_number || '')
    setCustomerLevel(typeof c.level === 'number' ? c.level : Number(c.level) || 0)
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)

  useEffect(() => {
    if (customerMode === 'existing' && selectedCustomer) {
      fillCustomerFields(selectedCustomer)
    }
  }, [customerMode, customerId, selectedCustomer])

  // Scheme eligibility calculation
  useEffect(() => {
    if (saleLiveTotal <= 0) {
      setSchemeInfo(null)
      setSchemePick({})
      return
    }

    const prunePick = (allowed: Set<string>) => {
      setSchemePick((prev) => {
        const next: Record<string, 'take_gift' | 'continue' | ''> = {}
        for (const [id, mode] of Object.entries(prev)) {
          if (allowed.has(id) && mode) next[id] = mode
        }
        return next
      })
    }

    if (customerMode === 'new') {
      const info = previewNewCustomerSchemes(allSchemes, saleLiveTotal)
      setSchemeInfo(info)
      prunePick(new Set(info.eligible.map((s) => s.id)))
      return
    }

    if (!customerId) {
      setSchemeInfo(null)
      setSchemePick({})
      return
    }

    setSchemeInfo((prev) => {
      const sameCustomer = prev?.customer_id === customerId
      const prior = sameCustomer ? Number(prev?.prior_purchase_total || 0) : 0
      const combined = prior + saleLiveTotal
      const continueIds = new Set(
        sameCustomer ? (prev?.continue_schemes || []).map((s) => s.id) : [],
      )
      const eligible = allSchemes
        .filter((s) => {
          if (!s.is_active || continueIds.has(s.id)) return false
          return combined >= Number(s.min_amount || 0)
        })
        .map((s) => ({
          ...s,
          action: 'take_gift' as const,
          reason:
            prior > 0
              ? `Combined ₹${combined.toFixed(0)} ≥ ₹${s.min_amount}`
              : `Order ≥ ₹${s.min_amount}`,
        }))
      return {
        customer_id: customerId,
        customer_level: sameCustomer ? (prev?.customer_level ?? 0) : 0,
        prior_order_count: sameCustomer ? (prev?.prior_order_count ?? 0) : 0,
        prior_purchase_total: String(prior),
        order_amount: String(saleLiveTotal),
        combined_amount: String(combined),
        is_new_party: sameCustomer ? (prev?.is_new_party ?? false) : false,
        eligible,
        continue_schemes: sameCustomer ? (prev?.continue_schemes ?? []) : [],
      }
    })

    const items = saleLines
      .filter((l) => l.product_id && lineQty(l) > 0)
      .map((l) => ({ product_id: l.product_id, quantity: lineQty(l) }))
    let cancelled = false
    const t = window.setTimeout(() => {
      void schemeApi
        .eligible({ customer_id: customerId, order_amount: saleLiveTotal, items })
        .then((info) => {
          if (cancelled) return
          setSchemeInfo(info)
          setCustomerLevel(info.customer_level)
          prunePick(
            new Set([
              ...info.eligible.map((s) => s.id),
              ...info.continue_schemes.map((s) => s.id),
            ]),
          )
        })
        .catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [customerId, customerMode, saleLiveTotal, saleLines, allSchemes])

  async function ensureCustomerId(): Promise<string> {
    if (customerMode === 'existing') {
      if (!customerId) throw new Error('Please select an existing customer from the list')
      return customerId
    }
    if (!name.trim() || !phone.trim() || !city.trim() || !pinCode.trim()) {
      throw new Error('Name, phone, city and pincode are required for new customer')
    }
    const payload: CreateCustomerInput = {
      name: name.trim(),
      firm_name: firmName.trim() || undefined,
      phone: phone.replace(/\D/g, '').slice(0, 10),
      optional_phone: optionalPhone.replace(/\D/g, '').slice(0, 10) || undefined,
      gender,
      city: city.trim(),
      state: stateName,
      country: 'India',
      pincode: Number(pinCode),
      landmark: landmark.trim(),
      tehsil: tehsil.trim(),
      district: district.trim(),
      gst_number: gstin.trim() || undefined,
      driving_license_number: dl.trim() || undefined,
      addhar_number: aadhaar.trim() || undefined,
      customer_type: customerType,
      level: 0,
    }
    const res = await customersApi.create(payload)
    setCustomers((prev) => [res.customer, ...prev])
    setCustomerId(res.customer.id)
    return res.customer.id
  }

  // --- STEP NAVIGATION HANDLERS ---
  async function goToStep2() {
    setBusy(true)
    try {
      await ensureCustomerId()
      setStep(2)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Customer selection required', 'err')
    } finally {
      setBusy(false)
    }
  }

  function goToStep3() {
    const validLines = saleLines.filter((l) => l.product_id && lineQty(l) > 0)
    if (!validLines.length) {
      push('Please select at least one product with quantity > 0', 'err')
      return
    }
    const bandErr = validateLinesAgainstBand(validLines, products)
    if (bandErr) {
      push(bandErr, 'err')
      return
    }
    setStep(3)
  }

  function goToStep4() {
    if (hasExpiryClaim) {
      const validClaimItems =
        claimMode === 'bulk'
          ? EXPIRY_CATEGORIES.some((c) => (catQty[c.value] || 0) > 0 && (bulkUnit[c.value] || 0) > 0)
          : claimLines.some((l) => l.name.trim() && l.quantity > 0 && l.expiry_date)
      if (!validClaimItems) {
        push(
          claimMode === 'bulk'
            ? 'Enter quantity & unit price for at least one expiry category'
            : 'Fill at least one expiry line: name, qty, expiry date',
          'err',
        )
        return
      }
    }
    setStep(4)
  }

  // --- FINAL ORDER SUBMISSION AT STEP 4 ---
  async function submitFinalOrder() {
    if (payMode === 'Advance + COD') {
      if (advanceCash <= 0) {
        setPayError('Advance cash must be greater than 0')
        return
      }
      if (payTotal > 0 && advanceCash >= payTotal) {
        setPayError('Advance must be less than order total')
        return
      }
    }
    if (payMode === 'Partial Payment' && advanceCash + advanceCredits > payTotal && payTotal > 0) {
      setPayError('First part cannot exceed order total')
      return
    }
    setPayError('')
    setBusy(true)

    try {
      // 1. Ensure Customer
      const cid = await ensureCustomerId()

      // 2. Validate Products
      const validLines = saleLines.filter((l) => l.product_id && lineQty(l) > 0)
      if (!validLines.length) {
        push('Please select at least one product', 'err')
        setStep(2)
        setBusy(false)
        return
      }
      const bandErr = validateLinesAgainstBand(validLines, products)
      if (bandErr) {
        push(bandErr, 'err')
        setStep(2)
        setBusy(false)
        return
      }

      const items = validLines.map((l) => ({
        product_id: l.product_id,
        quantity: lineQty(l),
        price: linePrice(l),
      }))

      // 3. Create Order
      const res = await salesApi.createOrder({
        customer_id: cid,
        platform: 'fse',
        order_remarks: remarks,
        has_expiry_claim: hasExpiryClaim,
        items,
      })
      const createdOrder = res.order
      setOrder(createdOrder)

      // 4. Attach Expiry Claim if selected
      if (hasExpiryClaim) {
        const today = new Date().toISOString().slice(0, 10)
        const claimItems =
          claimMode === 'bulk'
            ? EXPIRY_CATEGORIES.filter((c) => (catQty[c.value] || 0) > 0).map((c) => ({
                name: `Bulk ${c.label} return`,
                quantity: catQty[c.value],
                price: bulkUnit[c.value] || 0,
                expiry_date: bulkExpiry[c.value] || today,
                category: c.value,
                remarks: claimRemarks,
                purchase_party: 'Customer return',
              }))
            : claimLines
                .filter((l) => l.name.trim() && l.quantity > 0 && l.expiry_date)
                .map((l) => ({
                  name: l.name.trim(),
                  batch_number: l.batch_number.trim() || undefined,
                  quantity: l.quantity,
                  price: l.price,
                  expiry_date: l.expiry_date,
                  category: l.category,
                  remarks: l.remarks,
                  purchase_party: 'Customer return',
                }))
        if (claimItems.length) {
          await salesApi.attachExpiryClaim(createdOrder.order_id, claimItems, claimRemarks)
        }
      }

      // 5. Attach Scheme if selected
      const selections = noScheme
        ? []
        : Object.entries(schemePick)
            .filter(([, mode]) => mode === 'take_gift' || mode === 'continue')
            .slice(0, 1)
            .map(([scheme_id, mode]) => ({
              scheme_id,
              mode: mode as string,
            }))
      if (selections.length) {
        await schemeApi.attach(createdOrder.order_id, selections).catch(() => {})
      }

      // 6. Set Payment Terms
      const payRes = await salesApi.setPaymentTerms(createdOrder.order_id, {
        payment_type: payMode,
        advance_cash: advanceCash,
        advance_credits: advanceCredits,
        upi_id: upiId || undefined,
      })

      push(`${payRes.message} · Order #${createdOrder.order_id} placed successfully!`)
      nav('/fse/orders')
    } catch (err) {
      push(err instanceof ApiError || err instanceof Error ? err.message : 'Order creation failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageSkeleton />

  const totalItemCount = saleLines.reduce((acc, l) => acc + (lineQty(l) || 0), 0)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        kicker="Field desk"
        title="Write the order"
        subtitle="1. Customer → 2. Products → 3. Expiry → 4. Payment terms."
      />

      {/* Stepper Tabs Bar */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { n: 1, label: '1. Customer' },
          { n: 2, label: '2. Products' },
          { n: 3, label: '3. Expiry' },
          { n: 4, label: '4. Payment' },
        ].map(({ n, label }) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              if (n < step) setStep(n as 1 | 2 | 3 | 4)
            }}
            disabled={n > step}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-all ${
              step === n
                ? 'bg-pine text-cream shadow-sm'
                : step > n
                  ? 'bg-moss text-ink cursor-pointer hover:opacity-90'
                  : 'bg-cream text-muted opacity-60 cursor-not-allowed'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* STEP 1: CUSTOMER SELECTION & DETAILS */}
      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${customerMode === 'existing' ? 'bg-pine text-cream' : 'bg-cream'}`}
              onClick={() => setCustomerMode('existing')}
            >
              Existing customer
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${customerMode === 'new' ? 'bg-pine text-cream' : 'bg-cream'}`}
              onClick={() => {
                setCustomerMode('new')
                setCustomerId('')
                setName('')
                setFirmName('')
                setPhone('')
                setOptionalPhone('')
                setGender('male')
                setCustomerType('retail')
                setPinCode('')
                setCity('')
                setDistrict('')
                setTehsil('')
                setStateName('Haryana')
                setLandmark('')
                setGstin('')
                setDl('')
                setAadhaar('')
                setCustomerLevel(0)
              }}
            >
              New customer
            </button>
          </div>

          {customerMode === 'existing' ? (
            <>
              {customerId ? (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-pine/30 bg-pine/5 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Selected customer</p>
                    <p className="font-semibold text-pine">
                      {(selectedCustomer?.firm_name || firmName) ||
                        selectedCustomer?.name ||
                        name ||
                        'Customer'}
                    </p>
                    <p className="text-xs text-muted">
                      {selectedCustomer?.name || name}
                      {(selectedCustomer?.firm_name || firmName)
                        ? ` · ${selectedCustomer?.firm_name || firmName}`
                        : ''}
                      {' · '}
                      {selectedCustomer?.phone || phone}
                      {(selectedCustomer?.city || city) ? ` · ${selectedCustomer?.city || city}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                    onClick={() => {
                      setCustomerId('')
                      setCustomerSearch('')
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Search customer">
                    <Input
                      placeholder="Phone, name, firm, city…"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setCustomerId('')
                      }}
                    />
                  </Field>
                  <div className="rounded-xl border border-line bg-white">
                    <p className="border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                      {filteredCustomers.length
                        ? `${filteredCustomers.length} match${filteredCustomers.length === 1 ? '' : 'es'}`
                        : customerSearch.trim()
                          ? 'No customer found'
                          : 'Type phone or name to search'}
                    </p>
                    <ul className="max-h-56 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-zinc-100"
                            onClick={() => {
                              setCustomerId(c.id)
                              setCustomerSearch('')
                              fillCustomerFields(c)
                            }}
                          >
                            <span className="font-medium">{c.firm_name || c.name}</span>
                            <span className="text-xs text-muted">
                              {c.name}
                              {c.firm_name ? ` · ${c.firm_name}` : ''}
                              {' · '}
                              {c.phone}
                              {c.city ? ` · ${c.city}` : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-blush font-medium">Select a customer from the list above to proceed.</p>
                </>
              )}
            </>
          ) : null}

          {(customerMode === 'new' || selectedCustomer) && (
            <>
              <Field label="Customer name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={customerMode === 'existing'}
                />
              </Field>
              <Field label="Firm name">
                <Input
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Shop / firm"
                  readOnly={customerMode === 'existing'}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input
                    value={phone}
                    maxLength={10}
                    readOnly={customerMode === 'existing'}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </Field>
                <Field label="Alt phone">
                  <Input
                    value={optionalPhone}
                    maxLength={10}
                    readOnly={customerMode === 'existing'}
                    onChange={(e) => setOptionalPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <Select
                    value={gender}
                    disabled={customerMode === 'existing'}
                    onChange={(e) => setGender(e.target.value as typeof gender)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Type">
                  <Select
                    value={customerType}
                    disabled={customerMode === 'existing'}
                    onChange={(e) => setCustomerType(e.target.value)}
                  >
                    {CUSTOMER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Pincode">
                <Input
                  value={pinCode}
                  maxLength={6}
                  readOnly={customerMode === 'existing'}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Auto-fills city / district"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} readOnly={customerMode === 'existing'} />
                </Field>
                <Field label="District">
                  <Input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    readOnly={customerMode === 'existing'}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tehsil">
                  <Input value={tehsil} onChange={(e) => setTehsil(e.target.value)} readOnly={customerMode === 'existing'} />
                </Field>
                <Field label="State">
                  <Select
                    value={stateName}
                    disabled={customerMode === 'existing'}
                    onChange={(e) => setStateName(e.target.value)}
                  >
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Landmark / Village">
                <Input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  readOnly={customerMode === 'existing'}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GSTIN (optional)">
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} readOnly={customerMode === 'existing'} />
                </Field>
                <Field label="DL (optional)">
                  <Input value={dl} onChange={(e) => setDl(e.target.value)} readOnly={customerMode === 'existing'} />
                </Field>
              </div>
              <Field label="Aadhaar (optional)">
                <Input
                  value={aadhaar}
                  maxLength={12}
                  readOnly={customerMode === 'existing'}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12-digit Aadhaar"
                />
              </Field>
              <Field label="Customer level (orders with us)">
                <Input
                  readOnly
                  value={
                    customerMode === 'existing'
                      ? customerLevel == null
                        ? '—'
                        : String(customerLevel)
                      : '0 (new)'
                  }
                />
              </Field>
            </>
          )}

          <div className="pt-2 flex justify-end">
            <Button disabled={busy || (customerMode === 'existing' && !customerId)} onClick={() => void goToStep2()}>
              {busy ? 'Saving...' : 'Next: Select Products →'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: PRODUCTS & SCHEMES SELECTION */}
      {step === 2 && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          {/* Header with Product Lines Counter & Quick Add Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Select Products for Order</p>
              <p className="text-xs text-pine font-medium">
                {saleLines.length} product line{saleLines.length === 1 ? '' : 's'} · {totalItemCount} total item{totalItemCount === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              className="inline-flex items-center gap-1"
              onClick={() => {
                const p = products[0]
                if (!p) return
                setSaleLines((rows) => [...rows, { key: lid(), product_id: p.id, quantity: 1, price: defaultUnit(p) }])
              }}
            >
              <Plus size={14} /> Add Line
            </Button>
          </div>

          {/* Scrollable Container for Product Lines (Handles 1 to 50+ Products Easily) */}
          <div className="max-h-[480px] overflow-y-auto pr-1.5 space-y-3 rounded-xl border border-line/60 bg-zinc-50/50 p-2.5">
            {saleLines.map((line, index) => {
              const p = products.find((x) => x.id === line.product_id)
              const limit = priceLimitInfo(line.price, p)
              const stockQty = Number(p?.quantity ?? 0)
              return (
                <div
                  key={line.key}
                  className={`space-y-2 rounded-xl border p-3 bg-white shadow-sm transition-all ${
                    limit.error ? 'border-blush bg-blush/5' : 'border-line/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted bg-cream px-2 py-0.5 rounded">
                      Item #{index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={saleLines.length <= 1}
                      title="Remove line"
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-blush disabled:opacity-30 transition-colors"
                      onClick={() => setSaleLines((rows) => rows.filter((r) => r.key !== line.key))}
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </div>

                  <Field label="Product">
                    <Select
                      value={line.product_id}
                      onChange={(e) => {
                        const next = products.find((x) => x.id === e.target.value)
                        setSaleLines((rows) =>
                          rows.map((r) =>
                            r.key === line.key
                              ? { ...r, product_id: e.target.value, price: defaultUnit(next) }
                              : r,
                          ),
                        )
                      }}
                    >
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="text-[11px] text-muted">
                    Stock {stockQty}
                    {Number(p?.single_unit_price || p?.price) > 0
                      ? ` · MRP ₹${Number(p?.single_unit_price || p?.price).toFixed(2)}`
                      : ''}
                  </p>
                  <p
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      limit.kind === 'nolimit'
                        ? 'bg-amber-100 text-amber-900'
                        : limit.error
                          ? 'bg-blush/15 text-blush'
                          : 'bg-pine/10 text-pine'
                    }`}
                  >
                    {limit.limitLabel}
                    {limit.kind === 'ok' ? ' · within limit' : ''}
                    {limit.error ? ` · ${limit.error}` : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Qty">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.quantity === '' ? '' : String(line.quantity)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setSaleLines((rows) =>
                            rows.map((r) =>
                              r.key === line.key
                                ? { ...r, quantity: raw === '' ? '' : Number(raw) }
                                : r,
                            ),
                          )
                        }}
                        onBlur={() =>
                          setSaleLines((rows) =>
                            rows.map((r) =>
                              r.key === line.key ? { ...r, quantity: lineQty(r) || 1 } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Price / unit (₹)" error={limit.error || undefined}>
                      <Input
                        type="text"
                        inputMode="decimal"
                        invalid={!!limit.error}
                        value={line.price === '' ? '' : String(line.price)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '')
                          setSaleLines((rows) =>
                            rows.map((r) =>
                              r.key === line.key
                                ? { ...r, price: raw === '' ? '' : Number(raw) }
                                : r,
                            ),
                          )
                        }}
                        onBlur={() =>
                          setSaleLines((rows) =>
                            rows.map((r) =>
                              r.key === line.key
                                ? { ...r, price: r.price === '' ? '' : linePrice(r) }
                                : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted">Subtotal</p>
                        <p className="text-base font-semibold leading-tight text-pine">₹{lineSubtotal(line).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between items-center pt-1">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="inline-flex items-center gap-1"
              onClick={() => {
                const p = products[0]
                if (!p) return
                setSaleLines((rows) => [...rows, { key: lid(), product_id: p.id, quantity: 1, price: defaultUnit(p) }])
              }}
            >
              <Plus size={14} /> Add Product Line
            </Button>
            <p className="text-xs font-semibold text-pine">
              Total lines: {saleLines.length}
            </p>
          </div>

          {/* Schemes Section */}
          {saleLiveTotal > 0 &&
          (customerMode === 'new' || !!customerId) &&
          (allSchemes.length > 0 || !!schemeInfo) ? (
            <div className="space-y-3 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Applicable Schemes</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={noScheme}
                    onChange={(e) => {
                      setNoScheme(e.target.checked)
                      if (e.target.checked) setSchemePick({})
                    }}
                  />
                  No Scheme
                </label>
              </div>
              {!noScheme ? (
                <>
                  <p className="text-xs text-muted">
                    Only one scheme per order · live total ₹{saleLiveTotal.toFixed(2)}.
                    {schemeInfo
                      ? ` Prior ₹${schemeInfo.prior_purchase_total} + this → ₹${schemeInfo.combined_amount}`
                      : ' Checking eligibility…'}
                  </p>
                  {(() => {
                    const listed =
                      allSchemes.length > 0
                        ? allSchemes
                        : [
                            ...(schemeInfo?.eligible || []),
                            ...(schemeInfo?.continue_schemes || []),
                          ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
                    const unlocked = listed.filter(
                      (s) =>
                        schemeInfo?.eligible.some((e) => e.id === s.id) ||
                        schemeInfo?.continue_schemes.some((e) => e.id === s.id),
                    )
                    const locked = listed.filter((s) => !unlocked.some((u) => u.id === s.id))
                    return (
                      <>
                        {unlocked.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
                            No scheme unlocked yet — raise order value or customer history to meet min amount.
                          </p>
                        ) : null}
                        {unlocked.map((s) => {
                          const eligible = schemeInfo?.eligible.find((e) => e.id === s.id)
                          const cont = schemeInfo?.continue_schemes.find((e) => e.id === s.id)
                          const canApply = !!eligible
                          const photo = resolveMediaUrl(s.photo_url)
                          return (
                            <div
                              key={s.id}
                              className="overflow-hidden rounded-2xl border border-pine/40 bg-pine/5 text-sm"
                            >
                              <div className="flex gap-3 p-3">
                                <button
                                  type="button"
                                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream ring-1 ring-line"
                                  onClick={() => photo && setPhotoPreview(photo)}
                                  disabled={!photo}
                                >
                                  {photo ? (
                                    <img src={photo} alt={s.gift_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted">
                                      No photo
                                    </span>
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium leading-tight">{s.name}</p>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {s.gift_qty}× {s.gift_name} · min ₹{Number(s.min_amount || 0).toFixed(0)}
                                  </p>
                                  <p className="mt-1 text-xs text-pine">
                                    {canApply ? eligible?.reason || 'Unlocked — can apply' : cont?.reason || 'Continue later'}
                                  </p>
                                  {canApply ? (
                                    <Select
                                      className="mt-2"
                                      value={schemePick[s.id] || ''}
                                      onChange={(e) => {
                                        const mode = e.target.value as 'take_gift' | ''
                                        setNoScheme(false)
                                        setSchemePick(mode ? { [s.id]: mode } : {})
                                      }}
                                    >
                                      <option value="">Skip</option>
                                      <option value="take_gift">Apply scheme</option>
                                    </Select>
                                  ) : cont ? (
                                    <Select
                                      className="mt-2"
                                      value={schemePick[s.id] || ''}
                                      onChange={(e) => {
                                        const mode = e.target.value as 'continue' | ''
                                        setNoScheme(false)
                                        setSchemePick(mode ? { [s.id]: mode } : {})
                                      }}
                                    >
                                      <option value="">Skip</option>
                                      <option value="continue">Continue scheme</option>
                                    </Select>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {locked.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted">Locked</p>
                            {locked.map((s) => {
                              const min = Number(s.min_amount || 0)
                              const combined = Number(schemeInfo?.combined_amount || saleLiveTotal)
                              const need = Math.max(0, min - combined)
                              return (
                                <div
                                  key={s.id}
                                  className="rounded-xl border border-line bg-cream/40 px-3 py-2 text-sm opacity-80"
                                >
                                  <p className="font-medium">{s.name}</p>
                                  <p className="text-xs text-muted">
                                    {s.gift_qty}× {s.gift_name} · needs ₹{min.toFixed(0)}
                                    {need > 0 ? ` · ₹${need.toFixed(0)} more to unlock` : ''}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </>
              ) : (
                <p className="text-sm text-muted">No Scheme — gift schemes skipped.</p>
              )}
            </div>
          ) : null}

          <Field label="Order Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional notes for order..." />
          </Field>

          <div className="rounded-xl border border-pine/20 bg-pine/5 px-3 py-2 text-sm">
            <p className="font-semibold text-pine">Live total · ₹{saleLiveTotal.toFixed(2)}</p>
            <p className="text-xs text-muted">Updates live as you change quantity / unit price</p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back to Customer
            </Button>
            <Button disabled={!saleLiveTotal} onClick={goToStep3}>
              Next: Expiry Claim →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: EXPIRY CLAIM SELECTION */}
      {step === 3 && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <Field label="Expiry on this order? (Mandatory choice)">
            <Select value={hasExpiryClaim ? 'yes' : 'no'} onChange={(e) => setHasExpiryClaim(e.target.value === 'yes')}>
              <option value="no">No — No expiry returned</option>
              <option value="yes">Yes — Attach returned expiry products</option>
            </Select>
          </Field>

          {hasExpiryClaim ? (
            <div className="space-y-3 rounded-xl border border-line p-4 bg-zinc-50/50">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Attach returned expiry products
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm ${claimMode === 'individual' ? 'bg-pine text-cream' : 'bg-cream'}`}
                  onClick={() => setClaimMode('individual')}
                >
                  Individual products
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm ${claimMode === 'bulk' ? 'bg-pine text-cream' : 'bg-cream'}`}
                  onClick={() => setClaimMode('bulk')}
                >
                  All at once (by category)
                </button>
              </div>

              {claimMode === 'bulk' ? (
                <div className="space-y-3">
                  {EXPIRY_CATEGORIES.map((c) => (
                    <div key={c.value} className="space-y-2 rounded-xl border border-line bg-white p-3">
                      <p className="text-sm font-medium">{c.label}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Qty">
                          <Input
                            type="number"
                            min={0}
                            value={catQty[c.value] || ''}
                            onChange={(e) =>
                              setCatQty((prev) => ({ ...prev, [c.value]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                          />
                        </Field>
                        <Field label="Unit ₹">
                          <Input
                            type="number"
                            min={0}
                            value={bulkUnit[c.value] || ''}
                            onChange={(e) =>
                              setBulkUnit((prev) => ({ ...prev, [c.value]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                          />
                        </Field>
                        <Field label="Expiry">
                          <Input
                            type="date"
                            value={bulkExpiry[c.value]}
                            onChange={(e) => setBulkExpiry((prev) => ({ ...prev, [c.value]: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <p className="text-xs text-muted">
                        Line = ₹{((catQty[c.value] || 0) * (bulkUnit[c.value] || 0)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {claimLines.map((line) => (
                    <div key={line.key} className="space-y-2 rounded-xl border border-line bg-white p-3">
                      <Field label="Product name / item">
                        <Input
                          placeholder="Product name"
                          value={line.name}
                          onChange={(e) =>
                            setClaimLines((rows) =>
                              rows.map((r) => (r.key === line.key ? { ...r, name: e.target.value } : r)),
                            )
                          }
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Batch no">
                          <Input
                            value={line.batch_number}
                            onChange={(e) =>
                              setClaimLines((rows) =>
                                rows.map((r) => (r.key === line.key ? { ...r, batch_number: e.target.value } : r)),
                              )
                            }
                          />
                        </Field>
                        <Field label="Category">
                          <Select
                            value={line.category}
                            onChange={(e) =>
                              setClaimLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key ? { ...r, category: e.target.value as ExpiryCategory } : r,
                                ),
                              )
                            }
                          >
                            {EXPIRY_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Qty">
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              setClaimLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key ? { ...r, quantity: Math.max(1, Number(e.target.value) || 1) } : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Price ₹">
                          <Input
                            type="number"
                            min={0}
                            value={line.price}
                            onChange={(e) =>
                              setClaimLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key ? { ...r, price: Math.max(0, Number(e.target.value) || 0) } : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Expiry date">
                          <Input
                            type="date"
                            value={line.expiry_date}
                            onChange={(e) =>
                              setClaimLines((rows) =>
                                rows.map((r) => (r.key === line.key ? { ...r, expiry_date: e.target.value } : r)),
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-xs font-medium">Subtotal: ₹{(line.quantity * (Number(line.price) || 0)).toFixed(2)}</p>
                        <button
                          type="button"
                          disabled={claimLines.length <= 1}
                          className="text-xs text-blush hover:underline disabled:opacity-40"
                          onClick={() => setClaimLines((rows) => rows.filter((r) => r.key !== line.key))}
                        >
                          Remove line
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      setClaimLines((rows) => [
                        ...rows,
                        {
                          key: lid(),
                          name: '',
                          batch_number: '',
                          quantity: 1,
                          price: 0,
                          expiry_date: new Date().toISOString().slice(0, 10),
                          category: 'damage',
                          remarks: '',
                        },
                      ])
                    }
                  >
                    + Add expiry line
                  </Button>
                </>
              )}

              <Field label="Expiry claim remarks">
                <Textarea value={claimRemarks} onChange={(e) => setClaimRemarks(e.target.value)} rows={2} />
              </Field>

              <div className="rounded-xl border border-pine/20 bg-pine/5 px-3 py-2 text-sm">
                <p className="font-semibold text-pine">Expiry Claim total · ₹{claimLiveTotal.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
              No expiry claim attached for this order. Click Next to set payment terms.
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Back to Products
            </Button>
            <Button onClick={goToStep4}>
              Next: Payment Terms →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: PAYMENT TERMS & FINAL ORDER CONFIRMATION */}
      {step === 4 && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          {/* Order Summary Card */}
          <div className="rounded-xl border border-pine/30 bg-pine/5 p-4 space-y-3">
            <div className="flex justify-between items-start border-b border-pine/20 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Customer</p>
                <p className="font-bold text-pine text-base">
                  {firmName || name || selectedCustomer?.name || 'Selected Customer'}
                </p>
                <p className="text-xs text-muted">
                  {name} · {phone} · {city}
                </p>
              </div>
              <span className="rounded-full bg-pine text-cream text-xs px-3 py-1 font-medium">
                Step 4 of 4
              </span>
            </div>

            {/* Products Summary List */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">Products Summary ({saleLines.filter((l) => l.product_id && lineQty(l) > 0).length} lines)</p>
              <div className="max-h-44 overflow-y-auto pr-1 space-y-1">
                {saleLines
                  .filter((l) => l.product_id && lineQty(l) > 0)
                  .map((l) => {
                    const p = products.find((x) => x.id === l.product_id)
                    return (
                      <div key={l.key} className="flex justify-between text-xs py-1 border-b border-line/40">
                        <span className="font-medium text-ink">
                          {p?.name || 'Product'} × {lineQty(l)}
                        </span>
                        <span>₹{lineSubtotal(l).toFixed(2)}</span>
                      </div>
                    )
                  })}
              </div>
              <div className="flex justify-between font-bold text-sm text-pine pt-2">
                <span>Grand Total:</span>
                <span>₹{saleLiveTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Expiry Claim Summary */}
            <div className="text-xs text-muted pt-1 border-t border-pine/20">
              <span className="font-medium text-ink">Expiry Claim: </span>
              {hasExpiryClaim ? (
                <span className="text-pine font-medium">Attached (₹{claimLiveTotal.toFixed(2)})</span>
              ) : (
                <span>No expiry claim</span>
              )}
            </div>
          </div>

          {/* Scheme Selection for this Order */}
          <div className="space-y-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Scheme for this order</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={noScheme}
                  onChange={(e) => {
                    setNoScheme(e.target.checked)
                    if (e.target.checked) setSchemePick({})
                  }}
                />
                No Scheme
              </label>
            </div>
            {!noScheme ? (
              (schemeInfo?.eligible || []).length === 0 && (schemeInfo?.continue_schemes || []).length === 0 ? (
                <p className="text-sm text-muted">No scheme unlocked for this order total.</p>
              ) : (
                <div className="space-y-2">
                  {(schemeInfo?.eligible || []).map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                        schemePick[s.id] === 'take_gift' ? 'border-pine bg-pine/5' : 'border-line'
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name="pay-scheme"
                        checked={schemePick[s.id] === 'take_gift'}
                        onChange={() => {
                          setNoScheme(false)
                          setSchemePick({ [s.id]: 'take_gift' })
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block text-xs text-muted">
                          {s.gift_qty}× {s.gift_name}
                          {s.reason ? ` · ${s.reason}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                  {(schemeInfo?.continue_schemes || []).map((s) => (
                    <label
                      key={`c-${s.id}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                        schemePick[s.id] === 'continue' ? 'border-pine bg-pine/5' : 'border-line'
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name="pay-scheme"
                        checked={schemePick[s.id] === 'continue'}
                        onChange={() => {
                          setNoScheme(false)
                          setSchemePick({ [s.id]: 'continue' })
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block text-xs text-muted">
                          Continue later
                          {s.reason ? ` · ${s.reason}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-muted">No Scheme — gift will not be attached.</p>
            )}
          </div>

          {/* Payment Mode Selection */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Payment terms</p>
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
                      if (t.mode === 'Advance + COD' && advanceCash <= 0) {
                        setAdvanceCash(payTotal > 0 ? Math.round(payTotal * 0.3) : 0)
                      }
                      if (t.mode === 'Advanced') setAdvanceCash(payTotal)
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

          {payMode === 'Advance + COD' || payMode === 'Advanced' ? (
            <Field label="Advance cash / paid (₹)">
              <Input
                type="number"
                min={0}
                value={advanceCash || ''}
                onChange={(e) => {
                  setAdvanceCash(Math.max(0, Number(e.target.value) || 0))
                  setPayError('')
                }}
              />
            </Field>
          ) : null}

          {payMode === 'Partial Payment' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                First part now (optional). Remaining balance can be collected later.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Credits (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={advanceCredits || ''}
                    onChange={(e) => {
                      setAdvanceCredits(Math.max(0, Number(e.target.value) || 0))
                      setPayError('')
                    }}
                  />
                </Field>
                <Field label="Cash (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={advanceCash || ''}
                    onChange={(e) => {
                      setAdvanceCash(Math.max(0, Number(e.target.value) || 0))
                      setPayError('')
                    }}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-white p-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Paid</p>
              <p className="font-medium text-pine">₹{Math.min(payPaidLive, payTotal).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Pending</p>
              <p className="font-medium text-blush">₹{payPendingLive.toFixed(2)}</p>
            </div>
          </div>

          <Field label="UPI ID (for QR payment)">
            <Input
              value={upiId}
              placeholder="name@upi / merchant VPA"
              onChange={(e) => setUpiId(e.target.value)}
            />
          </Field>

          {upiId.trim() ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-cream/50 p-4">
              <img
                alt="UPI QR"
                className="h-36 w-36 rounded-md bg-white p-1"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  `upi://pay?pa=${encodeURIComponent(upiId.trim())}&am=${payPendingLive > 0 ? payPendingLive.toFixed(2) : payTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent('FREIA order')}`,
                )}`}
              />
              <p className="text-center text-xs text-muted">Scan to pay · {upiId.trim()}</p>
            </div>
          ) : null}

          {payError ? <p className="text-sm text-blush font-medium">{payError}</p> : null}

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" type="button" disabled={busy} onClick={() => setStep(3)}>
              ← Back to Expiry
            </Button>
            <Button disabled={busy} onClick={() => void submitFinalOrder()}>
              {busy ? 'Placing Order…' : 'Confirm & Place Order'}
            </Button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Modal open={schemePopupOpen} onClose={() => setSchemePopupOpen(false)} title="Scheme unlocked">
        <p className="mb-3 text-sm text-muted">Order value crossed a scheme threshold. Choose a scheme or No Scheme.</p>
        <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
          {(schemeInfo?.eligible || []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-line px-3 py-2 text-left hover:border-pine"
                onClick={() => {
                  setNoScheme(false)
                  setSchemePick({ [s.id]: 'take_gift' })
                  setSchemePopupOpen(false)
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{s.reason}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setNoScheme(true)
              setSchemePick({})
              setSchemePopupOpen(false)
            }}
          >
            No Scheme
          </Button>
          <Button onClick={() => setSchemePopupOpen(false)}>Continue</Button>
        </div>
      </Modal>

      {photoPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-lg overflow-hidden rounded-2xl bg-white p-2 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={photoPreview} alt="Scheme" className="max-h-[80vh] w-full rounded-xl object-contain" />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPhotoPreview(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const s = allSchemes.find((x) => resolveMediaUrl(x.photo_url) === photoPreview)
                  if (s) void shareSchemePhoto(s)
                }}
              >
                Share photo
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
