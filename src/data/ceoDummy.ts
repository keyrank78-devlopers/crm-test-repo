/** Frontend-only mock data for CEO UI. Not connected to APIs. */

export const dashboardData = {
  orders: {
    delivered: 120,
    dispatching: 35,
    inTransit: 48,
    returned: 12,
  },
  revenue: {
    delivered: 180000,
    dispatching: 45000,
    inTransit: 62000,
    returned: 18000,
  },
  products: {
    inStock: 1860,
    purchase: 420,
    stockOut: 95,
    outOfStock: 14,
  },
  people: {
    office: 8,
    tlManager: 6,
    fseCaller: 42,
  },
  expiry: {
    open: 18,
    pendingValue: 186500,
    closedThisMonth: 9,
  },
  cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Allahabad', 'Gorakhpur'],
}

/** Sample shift when date changes (UI demo until pulse API exists). */
export function dashboardForDate(isoDate: string) {
  const day = Number(isoDate.slice(-2)) || 1
  const f = 0.85 + (day % 7) * 0.05
  const scale = (n: number) => Math.max(0, Math.round(n * f))
  const d = dashboardData
  return {
    orders: {
      delivered: scale(d.orders.delivered),
      dispatching: scale(d.orders.dispatching),
      inTransit: scale(d.orders.inTransit),
      returned: scale(d.orders.returned),
    },
    revenue: {
      delivered: scale(d.revenue.delivered),
      dispatching: scale(d.revenue.dispatching),
      inTransit: scale(d.revenue.inTransit),
      returned: scale(d.revenue.returned),
    },
    products: {
      inStock: scale(d.products.inStock),
      purchase: scale(d.products.purchase),
      stockOut: scale(d.products.stockOut),
      outOfStock: scale(d.products.outOfStock),
    },
    people: { ...d.people },
    expiry: {
      open: scale(d.expiry.open),
      pendingValue: scale(d.expiry.pendingValue),
      closedThisMonth: scale(d.expiry.closedThisMonth),
    },
    cities: d.cities,
  }
}

export const teamDummy = [
  { id: 't1', name: 'Priya Sharma', role: 'Office Staff', city: 'Lucknow', phone: '98765 01001' },
  { id: 't2', name: 'Rahul Verma', role: 'TL Manager', city: 'Kanpur', phone: '98765 01002' },
  { id: 't3', name: 'Amit Singh', role: 'TL Manager', city: 'Varanasi', phone: '98765 01003' },
  { id: 't4', name: 'Neha Gupta', role: 'FSE', city: 'Lucknow', phone: '98765 01004' },
  { id: 't5', name: 'Vikas Yadav', role: 'FSE', city: 'Kanpur', phone: '98765 01005' },
  { id: 't6', name: 'Sana Khan', role: 'Caller', city: 'Lucknow', phone: '98765 01006' },
  { id: 't7', name: 'Rohit Das', role: 'FSE', city: 'Allahabad', phone: '98765 01007' },
  { id: 't8', name: 'Meera Joshi', role: 'Office Staff', city: 'HQ', phone: '98765 01008' },
]

export const orderDetailDummy = {
  deliveryPartner: 'Shadowfax',
  datePunched: '17 Sep 2026, 10:42 AM',
}

export const returnOrdersDummy = [
  {
    id: 'RTO-2201',
    orderId: 'ORD-8841',
    party: 'Arpit Enterprises',
    reason: 'Party refused — damaged carton',
    courier: 'Delhivery',
    awb: 'DLV92837164',
    status: 'Return received',
    returnedOn: '14 Sep 2026',
    value: 12450,
    fse: 'Neha Gupta',
  },
  {
    id: 'RTO-2202',
    orderId: 'ORD-8790',
    party: 'Jonpur Traders',
    reason: 'Wrong address / RTO',
    courier: 'Shadowfax',
    awb: 'SFX44120988',
    status: 'In transit (return)',
    returnedOn: '16 Sep 2026',
    value: 8320,
    fse: 'Vikas Yadav',
  },
  {
    id: 'RTO-2203',
    orderId: 'ORD-8712',
    party: 'Shree Cosmetics',
    reason: 'Customer unavailable ×3',
    courier: 'India Post',
    awb: 'INP77881203',
    status: 'Pending warehouse check',
    returnedOn: '15 Sep 2026',
    value: 15600,
    fse: 'Rohit Das',
  },
]

export const schemeDispatchDummy = [
  {
    id: 'SD-301',
    orderId: 'ORD-8841',
    party: 'Arpit Enterprises',
    scheme: 'Buy ₹5k — Glass set',
    gift: 'Glass set × 1',
    status: 'Dispatching',
    punched: '16 Sep 2026',
  },
  {
    id: 'SD-302',
    orderId: 'ORD-8855',
    party: 'Jonpur Traders',
    scheme: 'New party welcome',
    gift: 'Freia Cream 10gm × 6',
    status: 'Packed',
    punched: '17 Sep 2026',
  },
  {
    id: 'SD-303',
    orderId: 'ORD-8860',
    party: 'Shree Cosmetics',
    scheme: 'Slab ₹25k target',
    gift: 'Table fan × 1',
    status: 'Dispatched',
    punched: '15 Sep 2026',
  },
]
