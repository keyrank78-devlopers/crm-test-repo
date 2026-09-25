/** Order status UI helpers (frontend). */

export function statusLabel(s: string) {
  return s.replace(/_/g, ' ')
}

/** Soft row / card background by status. */
export function orderStatusRowClass(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-50/90 border-emerald-200/80'
    case 'shipped':
    case 'dispatcher':
      return 'bg-sky-50/90 border-sky-200/80'
    case 'confirmed':
      return 'bg-amber-50/90 border-amber-200/80'
    case 'returned':
    case 'cancelled':
      return 'bg-rose-50/90 border-rose-200/80'
    case 'awaiting_expiry_claim':
      return 'bg-violet-50/90 border-violet-200/80'
    case 'pending':
    default:
      return 'bg-white/80 border-line'
  }
}

export function orderStatusLocked(status: string): boolean {
  /** Fully locked — no further changes. */
  return status === 'returned' || status === 'cancelled'
}

/** Delivered: only return is allowed; other status edits blocked. */
export function orderStatusBlocksAdvance(status: string): boolean {
  return status === 'delivered' || status === 'returned' || status === 'cancelled'
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const body = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
