import { useMemo, useState, type ReactNode } from 'react'
import { Pagination } from './primitives'

export interface Column<T> {
  key: string
  header: string
  sort?: (a: T, b: T) => number
  cell: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  rows,
  columns,
  pageSize = 25,
  rowKey,
  empty,
  rowClassName,
}: {
  rows: T[]
  columns: Column<T>[]
  pageSize?: number
  rowKey: (row: T) => string
  empty?: ReactNode
  rowClassName?: (row: T) => string
}) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sort) return rows
    return [...rows].sort((a, b) => col.sort!(a, b) * dir)
  }, [rows, sortKey, dir, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pages)
  const slice = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  if (!rows.length) return <>{empty}</>

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-cream/80 text-xs uppercase tracking-wider text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-3 font-medium ${c.className ?? ''}`}>
                  {c.sort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-ink"
                      onClick={() => {
                        if (sortKey === c.key) setDir((d) => (d === 1 ? -1 : 1))
                        else {
                          setSortKey(c.key)
                          setDir(1)
                        }
                        setPage(1)
                      }}
                    >
                      {c.header}
                      {sortKey === c.key ? (dir === 1 ? ' ↑' : ' ↓') : ''}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-t border-line hover:opacity-95 ${rowClassName?.(row) ?? 'bg-white/60 hover:bg-cream/50'}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-3 align-top ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pages={pages} onPage={setPage} total={sorted.length} />
    </div>
  )
}
