export const tokens = (n: number): string => {
  const v = Number(n) || 0
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + 'k'
  return String(Math.round(v))
}

export const usd = (n: number): string => {
  const v = Number(n) || 0
  if (v === 0) return '$0'
  if (v < 0.01) return '<$0.01'
  if (v < 10) return '$' + v.toFixed(2)
  return '$' + v.toFixed(0)
}

export const minutes = (ms: number): string => {
  const m = Math.round((Number(ms) || 0) / 60000)
  if (m <= 60) return m + 'm'
  return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') + 'm'
}

export const clock = (ts: number): string => {
  const d = new Date(ts)
  const h = d.getHours()

  return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h >= 12 ? 'pm' : 'am')
}
