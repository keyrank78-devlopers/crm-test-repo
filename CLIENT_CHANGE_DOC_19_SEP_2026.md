# FREIA Cosmetics CRM — Client Change Document

| | |
| --- | --- |
| **Project** | FREIA Skincare Distribution CRM / BMS |
| **Document type** | Already delivered + new client change requests |
| **Date** | **19 September 2026** |
| **Prepared from** | Live frontend/API wiring in codebase + client change note |
| **Status** | Section A = Done · Section B = New / to build |

---

## How to read this doc

- **Section A — Already made:** what is live in the app today (taken from code).
- **Section B — New client wants:** changes requested now (taken from client note).
- **Section C — Sample data:** example numbers / team rows for UI and demo.

---

# Section A — Already made (from code)

## A1. Stack & auth

- React + TypeScript + Vite + Tailwind frontend
- Django / DRF backend APIs (JWT login)
- Roles: `admin` | `manager` | `tl` | `fse` | `caller` | `dispatcher` | `inventory`
- Role-based home redirect + nav path guards
- Password field visible on login

## A2. Roles & navigation (live)

| Role | Home | Main nav |
| --- | --- | --- |
| Admin | `/admin` CEO pulse | Dashboard, Order desk, Scheme orders, Returns, Schemes, Customers, City stock, Team, Stock, Dispatch |
| Manager | Sales register | Sales register, Scheme orders, Returns, Schemes, Customers, Team, City stock |
| TL | Order desk | Order desk, Team orders, Scheme orders, Returns, Customers, Team |
| FSE | New order | New order, My orders, Scheme orders |
| Caller | New order | New order, My orders, Scheme orders, Call queue |
| Warehouse | Stock ledger | Current stock, Purchase in, Dispatch desk |
| Dispatch | Dispatch desk | Dispatch desk, Scheme orders |

**Removed earlier (per prior CEO asks):** Roster, Attendance, Performance from primary nav; Sales register + Call queue from Admin dashboard; Alerts from inventory nav; Scheme “convert gift” / scheme-dispatching tab; COD block from Admin pulse.

## A3. CEO / Admin dashboard (`/admin`) — current

Date picker → `GET /dashboard/pulse/?date=` (falls back to dummy if API down).

| Section | What shows today |
| --- | --- |
| Orders | Delivered / Dispatching / In-transit / Returned + total |
| Revenue | Same buckets in ₹ + total |
| Products | In stock / New purchase / Stock out / Out of stock + total → Stock |
| Expiry | Open / Pending MRP / Closed this month + total cases |
| Team | Managers / TL / FSE·Caller counts → Employees |
| Cities | City chips + Admin/Manager “Add city” → City stock |
| Recent orders | Last 8 sale orders (status-coloured rows) → Order desk |

## A4. FSE / Caller order flow

1. Create customer (or pick existing) + claim flag + products → sale order  
2. Expiry claim attach **or** skip (wallet = qty × unit ₹)  
3. More products + eligible schemes (photo + share) → attach creates **scheme order** in parallel  
4. Payment terms: Advanced / COD / Advance+COD / Partial  

Customer address: Landmark + Village (as currently wired).

## A5. Expiry claim (already on order)

- Yes/No on create; free-form expiry product lines  
- Current line fields in UI: **Product name, Batch, Qty, Unit ₹, Expiry date, Line remarks** + overall remarks  
- Wallet: total / used / remaining on the order  
- Expiry inventory create/list/update APIs wired  

## A6. Orders, status, returns

- Status chain: `pending` → `confirmed` → `dispatcher` → `shipped` → `delivered` → `returned` / `cancelled` (+ `awaiting_expiry_claim`)  
- **Status change + mark return: TL and Manager only** (not FSE, not Admin UI actions)  
- Locked after returned / cancelled; after delivered only return is allowed  
- Order desk, Sales register, Scheme orders, Returns pages  
- Sheet export for orders / inventory where wired  

## A7. Schemes & scheme orders

- Scheme CRUD (admin/manager), photo upload, gift inventory stock-in  
- FSE sees schemes; attach only if eligible  
- Scheme order list + same status flow as sale orders  
- Dispatcher handles scheme AWB via `scheme_order_id`  

## A8. Dispatch

- Tabs: Waiting | Dispatched | Return  
- Couriers: Shadowfax / Delhivery / India Post + AWB  
- Sale desk + scheme orders at dispatcher status  
- Delhivery sync (admin / manager / dispatcher)  

## A9. Inventory & cities

- City inventories (list / bulk create / update)  
- Normal + expiry purchase in (city on form)  
- Stock ledger; product min/max band on normal purchase  
- Export normal / expiry  

## A10. Team & customers

- Employees: create / edit / activate; `reports_to` hierarchy  
- Customer 360: list, detail, payment KPIs, order history (live APIs)  

## A11. APIs already used by frontend

| Area | Examples |
| --- | --- |
| Auth / users | login, me, users CRUD |
| Sales | orders CRUD steps, expiry-claim, payment, status, export |
| Scheme | schemes, photo, eligible, attach, scheme-orders, inventory |
| Inventory | cities, products, expiry-products, export |
| Dispatcher | desk, create, status, Delhivery sync |
| Customers | list, create, get |
| Dashboard | pulse by date |

---

# Section B — New client wants (19 Sep 2026)

> Source: client change note — *“Expiry with products with new three field; new three categories with quantity; CEO dashboard hero; from section remove cities, add team data like Grandeur CRM.”*

These items are **not fully delivered yet** as specified below. They are the next build scope.

## B1. Expiry with products — add **three new fields**

**Ask:** On **Expiry with products**, add **three new fields** (in addition to the product lines already used).

**Already present (for reference):** Product name, Batch, Qty, Unit ₹ / MRP, Expiry date, Remarks.

**New (client):** three additional fields on expiry-with-products.

| # | Field (client) | Type (proposed) | Notes |
| --- | --- | --- | --- |
| 1 | *(Field 1 — as named by client)* | Text / number / date / dropdown | Confirm exact label with client |
| 2 | *(Field 2 — as named by client)* | Text / number / date / dropdown | Confirm exact label with client |
| 3 | *(Field 3 — as named by client)* | Text / number / date / dropdown | Confirm exact label with client |

**Build impact:** FSE expiry step UI + expiry APIs/models + order detail / TL-Manager view + export columns.

*If client named the three fields in a separate sheet, paste labels into the table above before development starts.*

## B2. New **three categories** with **quantity**

**Ask:** Introduce **three new categories**, each showing / storing a **quantity**.

| # | Category name (client) | Quantity | Where shown |
| --- | --- | --- | --- |
| 1 | *(Category 1)* | Qty | CEO pulse and/or inventory / expiry module |
| 2 | *(Category 2)* | Qty | Same |
| 3 | *(Category 3)* | Qty | Same |

**Build impact:** Dashboard pulse section (and/or stock) + API fields for the three category quantities + seed/demo data.

*Fill exact category names from client (e.g. product lines, claim types, or stock buckets) before coding.*

## B3. CEO dashboard — **Hero**

**Ask:** Add a **hero** block at the top of the CEO / Admin dashboard (above the current pulse cards).

**Proposed content (compact, brand-first):**

- FREIA brand / “Company pulse” as primary signal  
- Selected **view date** (existing calendar stays)  
- One short line: live vs sample pulse  
- Primary CTA: Order desk (existing link)  

**Not in hero:** city chips, secondary tables, clutter, extra KPI strips.

**Build impact:** Frontend-only layout on `AdminDashboard` first; optional later hook to pulse totals in the hero summary line.

## B4. Dashboard section: **remove Cities** → **Team data like Grandeur CRM**

**Ask:**

1. **Remove** the **Cities** block from the CEO dashboard section grid.  
2. **Add Team data** in that space, styled like **Grandeur CRM** team list (roster-style rows, not only role counts).

**Keep:**

- Existing Team **counts** card (Managers / TL / FSE·Caller) can stay, **or** merge into the Grandeur-style list — prefer one clear Team area.  
- City stock remains available under **City stock** nav / purchase city (management of cities does **not** need to live on the CEO pulse).

**Grandeur-style team row (target columns):**

| Name | Role | City / area | Phone | Status |
| --- | --- | --- | --- | --- |
| … | Manager / TL / FSE / Caller | … | … | Active |

**Data source:** live `accounts` users list (preferred) with fallback to sample team rows in Section C.

**Build impact:** Remove cities UI + add city API from dashboard load path for this section; render team table; link “View team” → `/admin/employees`.

---

# Section C — Sample data (for demo / dummy until APIs extended)

## C1. CEO hero (sample)

| Item | Value |
| --- | --- |
| Brand | FREIA Skincare |
| Title | Company pulse |
| View date | 19-09-2026 |
| One-liner | Live pulse for selected date |
| CTA | Order desk |

## C2. Three categories + quantity (placeholders — replace names when client confirms)

| Category | Quantity |
| --- | --- |
| Category 1 | 420 |
| Category 2 | 186 |
| Category 3 | 95 |

## C3. Expiry with products — sample line (existing fields + 3 new slots)

| Product | Qty | MRP | Expiry date | New field 1 | New field 2 | New field 3 |
| --- | --- | --- | --- | --- | --- | --- |
| Freia Cream 10gm | 60 | 119 | 2026-04-08 | — | — | — |
| Freia Face Wash | 45 | 85 | 2026-03-15 | — | — | — |

*Total MRP example:* `(60×119) + (45×85) = 10,965`

## C4. Team data — Grandeur CRM style (sample)

| Name | Role | City | Phone | Status |
| --- | --- | --- | --- | --- |
| Priya Sharma | Office / Manager | Lucknow | 98765 01001 | Active |
| Rahul Verma | TL | Kanpur | 98765 01002 | Active |
| Amit Singh | TL | Varanasi | 98765 01003 | Active |
| Neha Gupta | FSE | Lucknow | 98765 01004 | Active |
| Vikas Yadav | FSE | Kanpur | 98765 01005 | Active |
| Sana Khan | Caller | Lucknow | 98765 01006 | Active |
| Rohit Das | FSE | Allahabad | 98765 01007 | Active |
| Meera Joshi | Office / Manager | HQ | 98765 01008 | Active |

## C5. Pulse snapshot (current dashboard shape — sample)

| Block | Sample |
| --- | --- |
| Orders | Delivered 120 · Dispatching 35 · In-transit 48 · Returned 12 |
| Revenue | Delivered ₹1,80,000 · Dispatching ₹45,000 · In-transit ₹62,000 · Returned ₹18,000 |
| Products | In stock 1860 · New purchase 420 · Stock out 95 · Out of stock 14 |
| Expiry | Open 18 · Pending MRP ₹1,86,500 · Closed this month 9 |
| Team counts | Managers 8 · TL 6 · FSE/Caller 42 |

---

# Section D — Scope summary for next sprint

| # | Item | Status |
| --- | --- | --- |
| A | Full CRM flows in Section A | **Done** |
| B1 | Expiry products + **3 new fields** | **New** |
| B2 | **3 categories** with **quantity** | **New** |
| B3 | CEO dashboard **hero** | **New** |
| B4 | Remove **Cities** from pulse; add **Grandeur-style Team data** | **New** |

---

# Section E — Open confirmations (before build)

1. Exact **names** of the three new expiry-product fields.  
2. Exact **names** of the three categories (and which screen: dashboard only vs inventory vs both).  
3. Hero: text-only vs include a light brand image.  
4. Team list: show **all** users or filter by role / city.

---

**Document end — 19 September 2026**
