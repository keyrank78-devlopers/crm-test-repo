# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"C:\Users\PC\Desktop\cosmetics-frontend\src\pages\fse\FseOrder.tsx")
t = path.read_text(encoding="utf-8")

# Alias so old bandHint refs don't crash if any remain
if "function bandHint(" not in t and "priceLimitInfo" in t:
    t = t.replace(
        "function priceLimitInfo(price: number | '', p?: ApiProduct | null) {",
        "function bandHint(p?: ApiProduct | null) {\n"
        "  return priceLimitInfo('', p).limitLabel\n"
        "}\n\n"
        "function priceLimitInfo(price: number | '', p?: ApiProduct | null) {",
        1,
    )

SALE_OLD_START = "saleLines.map((line) => {"
MORE_OLD_START = "moreLines.map((line) => {"

def find_map_block(src: str, start_marker: str) -> tuple[int, int]:
    i = src.find(start_marker)
    if i < 0:
        return -1, -1
    # find matching closing for map: `})}`  after return — walk braces from first `{` after =>
    j = src.find("{", i)
    depth = 0
    k = j
    while k < len(src):
        ch = src[k]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                # include trailing `)` of .map((...) => {...})
                end = k + 1
                if end < len(src) and src[end] == ")":
                    end += 1
                return i, end
        k += 1
    return -1, -1

SALE_NEW = r'''saleLines.map((line) => {
              const p = products.find((x) => x.id === line.product_id)
              const limit = priceLimitInfo(line.price, p)
              const stockQty = Number(p?.quantity ?? 0)
              return (
                <div
                  key={line.key}
                  className={`space-y-2 rounded-xl border p-3 ${
                    limit.error ? 'border-blush bg-blush/5' : 'border-pine/20 bg-white'
                  }`}
                >
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
                      ? ` · List ₹${Number(p?.single_unit_price || p?.price).toFixed(2)}`
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
                        <p className="text-base font-semibold leading-tight">₹{lineSubtotal(line).toFixed(2)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={saleLines.length <= 1}
                        title="Remove line"
                        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-blush disabled:opacity-40"
                        onClick={() => setSaleLines((rows) => rows.filter((r) => r.key !== line.key))}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })'''

MORE_NEW = r'''moreLines.map((line) => {
            const p = products.find((x) => x.id === line.product_id)
            const limit = priceLimitInfo(line.price, p)
            const stockQty = Number(p?.quantity ?? 0)
            return (
              <div
                key={line.key}
                className={`space-y-2 rounded-xl border p-3 ${
                  limit.error ? 'border-blush bg-blush/5' : 'border-pine/20 bg-white'
                }`}
              >
                <Field label="Product">
                  <Select
                    value={line.product_id}
                    onChange={(e) => {
                      const next = products.find((x) => x.id === e.target.value)
                      setMoreLines((rows) =>
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
                    ? ` · List ₹${Number(p?.single_unit_price || p?.price).toFixed(2)}`
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
                        setMoreLines((rows) =>
                          rows.map((r) =>
                            r.key === line.key
                              ? { ...r, quantity: raw === '' ? '' : Number(raw) }
                              : r,
                          ),
                        )
                      }}
                      onBlur={() =>
                        setMoreLines((rows) =>
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
                        setMoreLines((rows) =>
                          rows.map((r) =>
                            r.key === line.key
                              ? { ...r, price: raw === '' ? '' : Number(raw) }
                              : r,
                          ),
                        )
                      }}
                      onBlur={() =>
                        setMoreLines((rows) =>
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
                      <p className="text-base font-semibold leading-tight">₹{lineSubtotal(line).toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      title="Remove line"
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-blush"
                      onClick={() => setMoreLines((rows) => rows.filter((r) => r.key !== line.key))}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })'''

for label, marker, new in (("sale", SALE_OLD_START, SALE_NEW), ("more", MORE_OLD_START, MORE_NEW)):
    a, b = find_map_block(t, marker)
    if a < 0:
        print(f"FAIL find {label}")
        continue
    t = t[:a] + new + t[b:]
    print(f"OK replace {label}", a, b)

# Ensure toast uses err tone
t = t.replace("push(bandErr)\n", "push(bandErr, 'err')\n")
t = t.replace("push(bandErr, 'err', 'err')", "push(bandErr, 'err')")

# Ensure Trash2 import
if "Trash2" not in t.split("from 'lucide-react'")[0] if "lucide-react" in t else True:
    if "from 'lucide-react'" not in t:
        t = t.replace(
            "import { useNavigate } from 'react-router-dom'\n",
            "import { useNavigate } from 'react-router-dom'\nimport { Trash2 } from 'lucide-react'\n",
            1,
        )

path.write_text(t, encoding="utf-8")
print("written", path.stat().st_size)
# verify
t2 = path.read_text(encoding="utf-8")
print("bandHint refs", t2.count("bandHint("))
print("priceLimitInfo in map", "const limit = priceLimitInfo" in t2)
print("clampToBand(raw", "clampToBand(raw" in t2)
print("No price limit", "No price limit set" in t2)
