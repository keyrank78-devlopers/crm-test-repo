import { format, parseISO, differenceInDays } from 'date-fns'

export function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function inrDec(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function num(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso.slice(0, 10)), 'dd MMM yyyy')
  } catch {
    return iso
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy')
  } catch {
    return iso
  }
}

export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function daysUntil(iso: string): number {
  return differenceInDays(parseISO(iso.slice(0, 10)), new Date())
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function phoneOk(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/\s/g, ''))
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
