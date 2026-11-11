export function bytes(n: number) {
  if (!n) return '0 MB'
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0).replace('.', ',')} MB`
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}

export function speed(n?: number) {
  if (!n) return ''
  return `${bytes(n)}/s`
}

export function gb(mb: number) {
  return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1).replace('.', ',')} GB`
}

export function shortDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
}

export function clock(t: number) {
  return new Date(t).toLocaleTimeString('pt-BR', { hour12: false })
}

export function elapsed(since?: number) {
  if (!since) return ''
  const s = Math.floor((Date.now() - since) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
