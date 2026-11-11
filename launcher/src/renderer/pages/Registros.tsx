import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Copy, Download, FolderOpen, Search, Trash2 } from 'lucide-react'
import type { LogLevel, LogLine } from '@shared/types'
import { api } from '../app/api'
import { useStore } from '../app/store'
import { clock, cx } from '../app/format'

const ROW = 22
const LEVELS: { id: LogLevel; label: string }[] = [
  { id: 'error', label: 'Erros' },
  { id: 'warn', label: 'Avisos' },
  { id: 'info', label: 'Info' },
  { id: 'debug', label: 'Debug' },
]

export function Registros() {
  const logs = useStore((s) => s.logs)
  const toast = useStore((s) => s.toast)
  const [source, setSource] = useState<'todos' | 'launcher' | 'jogo'>('todos')
  const [levels, setLevels] = useState<Record<LogLevel, boolean>>({ error: true, warn: true, info: true, debug: false })
  const [query, setQuery] = useState('')
  const [follow, setFollow] = useState(true)
  const viewport = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ top: 0, height: 600 })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter((l) => levels[l.level] && (source === 'todos' || l.source === source) && (!q || l.text.toLowerCase().includes(q)))
  }, [logs, levels, source, query])

  const counts = useMemo(() => {
    const c = { error: 0, warn: 0 }
    for (const l of logs) if (l.level === 'error' || l.level === 'warn') c[l.level]++
    return c
  }, [logs])

  // Rolagem automática para a última linha.
  useEffect(() => {
    const el = viewport.current
    if (follow && el) el.scrollTop = el.scrollHeight
  }, [filtered.length, follow])

  useEffect(() => {
    const el = viewport.current!
    const ro = new ResizeObserver(() => setScroll((s) => ({ ...s, height: el.clientHeight })))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Lista virtualizada: só as linhas visíveis são desenhadas, mesmo com milhares de registros.
  const start = Math.max(0, Math.floor(scroll.top / ROW) - 20)
  const end = Math.min(filtered.length, Math.ceil((scroll.top + scroll.height) / ROW) + 20)
  const slice = filtered.slice(start, end)

  const copyAll = async () => {
    await navigator.clipboard.writeText(filtered.map(format).join('\n'))
    toast({ kind: 'ok', title: `${filtered.length} linhas copiadas.` })
  }

  return (
    <div className="page registros">
      <header className="page-head">
        <div>
          <div className="eyebrow">Registros</div>
          <h1>O que o domínio sussurra</h1>
          <p className="muted">
            {logs.length} linhas · <span className="c-warn">{counts.warn} {counts.warn === 1 ? 'aviso' : 'avisos'}</span> · <span className="c-err">{counts.error} {counts.error === 1 ? 'erro' : 'erros'}</span>
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => void copyAll()}>
            <Copy size={15} /> Copiar
          </button>
          <button
            className="btn"
            onClick={async () => {
              const path = await api.logs.export()
              if (path) toast({ kind: 'ok', title: 'Registros exportados.', body: path })
            }}
          >
            <Download size={15} /> Exportar
          </button>
          <button className="btn" onClick={() => api.app.openFolder('logs')}>
            <FolderOpen size={15} /> Pasta
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              await api.logs.clear()
              useStore.setState({ logs: [] })
            }}
          >
            <Trash2 size={15} /> Limpar
          </button>
        </div>
      </header>

      <div className="log-toolbar">
        <div className="segmented">
          {(['todos', 'launcher', 'jogo'] as const).map((s) => (
            <button key={s} className={cx(source === s && 'active')} onClick={() => setSource(s)}>
              {s === 'todos' ? 'Tudo' : s === 'launcher' ? 'Launcher' : 'Jogo'}
            </button>
          ))}
        </div>
        <div className="level-filters">
          {LEVELS.map((l) => (
            <button key={l.id} className={cx('level-btn', l.id, levels[l.id] && 'on')} onClick={() => setLevels((v) => ({ ...v, [l.id]: !v[l.id] }))}>
              <i />
              {l.label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} />
          <input placeholder="Filtrar…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className={cx('btn', follow && 'accent')} onClick={() => setFollow((f) => !f)} title="Seguir novas linhas">
          <ArrowDownToLine size={15} /> Seguir
        </button>
      </div>

      <div
        className="log-view"
        ref={viewport}
        onScroll={(e) => {
          const el = e.currentTarget
          setScroll({ top: el.scrollTop, height: el.clientHeight })
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < ROW * 2
          if (!atBottom && follow) setFollow(false)
        }}
      >
        <div style={{ height: filtered.length * ROW, position: 'relative' }}>
          {slice.map((l, i) => (
            <div key={l.seq} className={cx('log-row', l.level)} style={{ top: (start + i) * ROW }}>
              <time>{clock(l.t)}</time>
              <span className={cx('src', l.source)}>{l.source === 'jogo' ? 'JOGO' : 'LNCH'}</span>
              <span className="lvl">{l.level.toUpperCase()}</span>
              <span className="txt">{highlight(l.text, query)}</span>
            </div>
          ))}
        </div>
        {!filtered.length && <div className="log-empty">Nada por aqui ainda. Os registros aparecem ao instalar e jogar.</div>}
      </div>
    </div>
  )
}

function format(l: LogLine) {
  return `${new Date(l.t).toISOString()} [${l.source}/${l.level.toUpperCase()}] ${l.text}`
}

function highlight(text: string, q: string) {
  const query = q.trim()
  if (!query) return text
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}
