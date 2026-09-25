import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  PackageMinus,
  Truck,
  Phone,
  Wallet,
  RotateCcw,
  PackagePlus,
  Gift,
  Play,
  Pause,
  RotateCw,
} from 'lucide-react'
import { Button, PageHeader } from '../../components/ui/primitives'
import { inr } from '../../lib/format'

const STEPS = [
  {
    id: 'book',
    title: '1. Book the order',
    who: 'FSE / Office',
    body: 'Retailer picked. Vitamin C Serum × 5 at ₹499. Total ₹2,495. Cash / COD captured on the spot.',
    metric: '₹2,495',
    metricLabel: 'Order value',
    to: '/fse',
    icon: ClipboardList,
  },
  {
    id: 'stock-out',
    title: '2. Stock goes out',
    who: 'Warehouse',
    body: 'Batch VC2603 Sale Out −5. Closing stock drops on the ledger the same second the order is submitted.',
    metric: '180 → 175',
    metricLabel: 'Batch closing',
    to: '/warehouse/ledger',
    icon: PackageMinus,
  },
  {
    id: 'dispatch',
    title: '3. Courier + AWB',
    who: 'Office',
    body: 'India Post assigned. Two cartons? Two docket numbers on one order. Status moves to At Hub.',
    metric: '2 AWBs',
    metricLabel: 'Multi-docket',
    to: '/office/orders',
    icon: Truck,
  },
  {
    id: 'ofd',
    title: '4. Out for delivery',
    who: 'Caller',
    body: 'OFD card lands in the dialer. One tap: Delivered, Not available, or Hold. Oldest calls first.',
    metric: 'Queue +1',
    metricLabel: 'OFD follow-up',
    to: '/caller/queue',
    icon: Phone,
  },
  {
    id: 'cod',
    title: '5. COD sitting with courier',
    who: 'Accounts',
    body: 'Pending = COD − received − returned. India Post running total ticks up until money is marked in.',
    metric: '₹2,495 pending',
    metricLabel: 'COD open',
    to: '/accounts/cod',
    icon: Wallet,
  },
  {
    id: 'return',
    title: '6. Party returns it',
    who: 'Warehouse / Office',
    body: 'Mark Returned. Stock Return In +5. Payment returned value fills. No spreadsheet re-total.',
    metric: '175 → 180',
    metricLabel: 'Stock back',
    to: '/warehouse/ledger',
    icon: RotateCcw,
  },
  {
    id: 'followup',
    title: '7. Caller loop',
    who: 'Caller',
    body: 'Return follow-up appears automatically. Reorder done / No requirement / Call on 3rd day.',
    metric: 'Follow-up live',
    metricLabel: 'Return queue',
    to: '/caller/queue',
    icon: PackagePlus,
  },
  {
    id: 'scheme',
    title: '8. Scheme still tracked',
    who: 'Admin + Caller',
    body: 'Gift tier, link, and caller remark stay on the same customer — even after a return.',
    metric: 'Gold hamper',
    metricLabel: 'Scheme',
    to: '/schemes',
    icon: Gift,
  },
]

export function JourneyFlow() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2800)
    return () => clearInterval(t)
  }, [playing])

  const current = STEPS[step]!
  const Icon = current.icon

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker="Client walkthrough"
        title="Order → return, one loop"
        subtitle="Watch the same carton move through every desk. Play it in a pitch — then jump into the live screen."
        actions={
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep(0)
                setPlaying(true)
              }}
            >
              <RotateCw size={16} />
              Replay
            </Button>
          </div>
        }
      />

      <div className="mb-6 overflow-x-auto no-scrollbar">
        <div className="flex min-w-[720px] items-center gap-0">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" className="flex flex-1 items-center" onClick={() => { setStep(i); setPlaying(false) }}>
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                    i === step ? 'animate-flow-pulse scale-110 bg-pine text-cream' : i < step ? 'bg-sage text-pine' : 'bg-cream text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`hidden text-[10px] sm:block ${i === step ? 'text-pine' : 'text-muted'}`}>{s.who}</span>
              </div>
              {i < STEPS.length - 1 ? (
                <div className={`mx-1 h-0.5 flex-1 ${i < step ? 'bg-sage' : 'bg-line'}`} />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div key={current.id} className="animate-fade-up grid gap-4 lg:grid-cols-5">
        <div className="rounded-3xl border border-pine/20 bg-pine p-6 text-cream lg:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{current.who}</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream/10">
              <Icon size={22} />
            </span>
            <div>
              <h2 className="font-display text-3xl leading-tight">{current.title}</h2>
              <p className="mt-3 max-w-xl text-cream/80">{current.body}</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-cream/50">{current.metricLabel}</p>
              <p className="animate-pop font-display text-4xl">{current.metric}</p>
            </div>
            <Button className="bg-cream text-pine hover:bg-white" onClick={() => nav(current.to)}>
              Open this desk
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted">Live sample ticket</p>
          <p className="mt-2 font-display text-xl">FR-2026-00012</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Customer</span>
              <span>Shri Sharma Medical</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">SKU</span>
              <span>FR-VC-30 × 5</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Value</span>
              <span>{inr(2495)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Now</span>
              <span className="font-medium text-pine">{current.title.replace(/^\d+\.\s/, '')}</span>
            </li>
          </ul>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full bg-pine transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const SIcon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStep(i)
                setPlaying(false)
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                i === step ? 'border-pine bg-cream' : 'border-line bg-white hover:border-pine/30'
              }`}
            >
              <SIcon size={16} className="text-pine" />
              <p className="mt-2 text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted">{s.who}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
