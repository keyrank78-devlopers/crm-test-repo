import { useMemo, useRef, useState } from 'react'
import { Input } from './primitives'

export function Autocomplete<T>({
  items,
  value,
  onChange,
  toLabel,
  placeholder,
  autoFocus,
}: {
  items: T[]
  value: T | null
  onChange: (v: T | null) => void
  toLabel: (v: T) => string
  placeholder?: string
  autoFocus?: boolean
}) {
  const [q, setQ] = useState(value ? toLabel(value) : '')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    const s = q.trim().toLowerCase()
    if (!s) return list.slice(0, 12)
    return list.filter((i) => toLabel(i).toLowerCase().includes(s)).slice(0, 12)
  }, [items, q, toLabel])

  return (
    <div className="relative" ref={box}>
      <Input
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange(null)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-card">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matches</li>
          ) : (
            filtered.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(item)
                    setQ(toLabel(item))
                    setOpen(false)
                  }}
                >
                  {toLabel(item)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
