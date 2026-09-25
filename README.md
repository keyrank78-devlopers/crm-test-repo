# FREIA Distribution CRM (frontend)

React/Vite web app for **FREIA Skincare** distribution. Backend API lives in a separate repo: [Cosmetics-crm-backend](https://github.com/developers-grandeurnet/Cosmetics-crm-backend).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production bundle
npm run preview  # serve the built files
```

## Switch roles

On first load, pick a role card (Owner, Sonia / Team Leader, field agent, office desk, caller, warehouse, accounts). After that, use the **dropdown in the top bar** — that is the demo “view as”. Session is kept in `sessionStorage` for the tab.

| Role | Lands on |
| --- | --- |
| Owner / Admin | Company dashboard, then every module |
| Team Leader | Roster + attendance, team performance, drill-down orders |
| FSE | Mobile order pad, today’s orders, damage reports |
| Office staff | Keyboard order entry + recent orders / AWB |
| Caller | Dialer-style follow-up queue + schemes |
| Warehouse | Ledger, purchase in, expiry / low-stock alerts |
| Accounts | COD by courier, mark received |

Global search: **Ctrl+K** (customers, order numbers, AWB/dockets).

## What was built

- Seven **different** home UIs (not one dashboard with hidden menus).
- Mock layer in `src/types`, `src/data/seed.ts`, `src/api/store.ts` — swap `api.*` for HTTP later without rewriting screens.
- Seed: 25 products (2–3 batches), 42 customers, 19 people, **7,390+ orders** (sales register pagination), follow-ups, COD payments, stock movements, schemes, damage reports, ~3 weeks of attendance.
- Live interactions:
  - Submit order → **Sale Out** on the batch, warehouse closing qty drops.
  - Mark returned / return-to-stock → **Return In** + caller queue item.
  - COD pending = `cod_amount − amount_received − returned_value`; courier totals update when you mark received.
  - Multiple AWB/dockets per order.
  - Expired / near-expiry batches flagged (not blocked) using a configurable window.
  - Dashboards **aggregate from orders**, not a hardcoded summary sheet.

## Assumptions (called in code where it mattered)

- Spec spelling `eccomerce` is stored as `ecommerce` / `Ecommerce`.
- FSE / TSR / ASM share the field-agent UI.
- Team Leader Sonia is the default leader demo user; other leaders via the people list + role switch.
- Dates are ISO under the hood, shown as `dd MMM yyyy`.
- `daily_performance` sales figures are computed live; only **attendance** is stored as rows.

## Stack

React 19 + TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, date-fns, Lucide icons.
