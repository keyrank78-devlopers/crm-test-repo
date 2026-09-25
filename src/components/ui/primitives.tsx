import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { CHANNEL_META, PAYMENT_META, STATUS_META } from '../../lib/compute'
import type { DeliveryStatus, PaymentMode } from '../../types'

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3.5 text-base' }
  const variants = {
    primary: 'bg-pine text-cream hover:bg-ink disabled:opacity-50',
    ghost: 'bg-transparent text-ink ring-1 ring-line hover:bg-cream disabled:opacity-50',
    danger: 'bg-blush text-white hover:opacity-90 disabled:opacity-50',
    soft: 'bg-cream text-pine hover:bg-moss/40 disabled:opacity-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`w-full rounded-xl border bg-zinc-100 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 ${
        invalid
          ? 'border-blush ring-2 ring-blush/20 focus:border-blush focus:ring-blush/25'
          : 'border-line focus:border-pine focus:ring-2 focus:ring-pine/15 focus:bg-white'
      } ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Textarea({ className = '', invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`w-full rounded-xl border bg-zinc-100 px-3 py-2.5 text-sm text-ink outline-none ${
        invalid
          ? 'border-blush ring-2 ring-blush/20 focus:border-blush focus:ring-blush/25'
          : 'border-line focus:border-pine focus:ring-2 focus:ring-pine/15 focus:bg-white'
      } ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Select({ className = '', invalid, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={`w-full rounded-xl border bg-zinc-100 px-3 py-2.5 text-sm text-ink outline-none ${
        invalid
          ? 'border-blush ring-2 ring-blush/20 focus:border-blush focus:ring-blush/25'
          : 'border-line focus:border-pine focus:ring-2 focus:ring-pine/15 focus:bg-white'
      } ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  id?: string
}) {
  return (
    <label id={id} className={`block rounded-xl ${error ? 'bg-blush/5 p-2 -m-2' : ''}`}>
      <span className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${error ? 'text-blush' : 'text-muted'}`}>
        {label}
        {error ? <span className="normal-case tracking-normal">· fix this</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      {error ? (
        <span className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-blush" role="alert">
          <span aria-hidden>!</span>
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const m = STATUS_META[status]
  return <Badge className={m.className}>{m.label}</Badge>
}

export function PaymentBadge({ mode }: { mode: PaymentMode }) {
  return <Badge className={PAYMENT_META[mode].className}>{mode}</Badge>
}

export function ChannelBadge({ platform }: { platform: string }) {
  const m = CHANNEL_META[platform] ?? { label: platform, className: 'bg-cream text-muted ring-line' }
  return <Badge className={m.className}>{m.label}</Badge>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white/80 shadow-card ${className}`}>{children}</div>
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">{kicker}</p> : null}
        <h1 className="font-display text-3xl text-ink md:text-[2rem]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream/40 px-6 py-16 text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-blush/30 bg-blush/10 px-6 py-10 text-center">
      <p className="font-display text-lg text-blush">Something went sideways</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="ghost">
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-3 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

export function usePageLoad(ms = 340) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
  }, [ms])
  return loading
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  // Portal to body so page animations (transform) don't trap position:fixed
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-card ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        style={{ maxHeight: 'min(92svh, 720px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button type="button" className="rounded-full p-1 text-muted hover:bg-cream" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Pagination({
  page,
  pages,
  onPage,
  total,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
  total: number
}) {
  if (pages <= 1) return <p className="text-xs text-muted">{total} rows</p>
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm text-muted">
      <span>
        {total.toLocaleString('en-IN')} rows · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function Kpi({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string
  hint?: string
  alert?: boolean
}) {
  return (
    <Card className={`p-4 ${alert ? 'ring-1 ring-blush/40' : ''}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display mt-2 text-2xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}

export function ExpiryFlag({ kind }: { kind: 'expired' | 'soon' | 'ok' }) {
  if (kind === 'ok') return null
  return (
    <Badge className={kind === 'expired' ? 'bg-blush/15 text-blush ring-blush/30' : 'bg-amber-50 text-amber-800 ring-amber-200'}>
      {kind === 'expired' ? 'Expired batch' : 'Near expiry'}
    </Badge>
  )
}
