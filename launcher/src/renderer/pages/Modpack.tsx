import { useMemo, useState } from 'react'
import { ExternalLink, FolderOpen, Hammer, Search, ShieldCheck } from 'lucide-react'
import type { ModCategory, PackFile } from '@shared/types'
import { api } from '../app/api'
import { useStore } from '../app/store'
import { bytes, cx, shortDate } from '../app/format'
import { Toggle } from '../components/ui'

const CATEGORIES: { id: ModCategory | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'jogabilidade', label: 'Jogabilidade' },
  { id: 'construcao', label: 'Construção' },
  { id: 'interface', label: 'Interface' },
  { id: 'desempenho', label: 'Desempenho' },
  { id: 'sons', label: 'Sons' },
  { id: 'visual', label: 'Visual' },
  { id: 'administracao', label: 'Administração' },
  { id: 'bibliotecas', label: 'Bibliotecas' },
  { id: 'shaders', label: 'Shaders' },
]

const LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))

export function Modpack() {
  const pack = useStore((s) => s.pack)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const game = useStore((s) => s.game)
  const packError = useStore((s) => s.packError)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<ModCategory | 'todos'>('todos')

  const files = useMemo(() => (pack?.manifest.files ?? []).filter((f) => f.side !== 'server'), [pack])
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: files.length }
    for (const f of files) c[f.category] = (c[f.category] ?? 0) + 1
    return c
  }, [files])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return files.filter(
      (f) =>
        (cat === 'todos' || f.category === cat) &&
        (!q || f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q) || f.id.includes(q)),
    )
  }, [files, query, cat])

  if (!pack) {
    return (
      <div className="page modpack">
        <p className="muted">{packError ?? 'Carregando o modpack…'}</p>
      </div>
    )
  }

  const m = pack.manifest
  const total = files.reduce((a, f) => a + (f.size ?? 0), 0)
  const busy = !['idle', 'error', 'running'].includes(game.phase)
  const systems = m.systems ?? []

  return (
    <div className="page modpack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Modpack oficial</div>
          <h1>
            {m.pack.name} <span className="version">{m.pack.version}</span>
          </h1>
          <p className="muted">
            {files.length} arquivos · {bytes(total)} · atualizado em {shortDate(m.pack.updated)}
            {pack.source !== 'remote' && <span className="badge warn">{pack.source === 'cache' ? 'cópia local' : 'cópia embutida'}</span>}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => api.app.openFolder('mods')}>
            <FolderOpen size={16} /> Pasta de mods
          </button>
          <button className="btn accent" disabled={busy || game.phase === 'running'} onClick={() => void api.pack.repair()}>
            <ShieldCheck size={16} /> Verificar arquivos
          </button>
        </div>
      </header>

      {systems.length > 0 && cat === 'todos' && !query && (
        <section className="systems">
          <div className="section-title">
            <h2>Sistemas ANÁTEMA</h2>
            <span>Feitos exclusivamente para o domínio</span>
          </div>
          <div className="systems-grid">
            {systems.map((s, i) => (
              <article key={s.id} className="system" style={{ animationDelay: `${i * 40}ms` }}>
                <Hammer size={16} className="system-icon" />
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <span className={cx('badge', s.status === 'ativo' ? 'ok' : 'forge')}>{s.status === 'ativo' ? 'Ativo' : 'Na forja'}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mods-toolbar">
        <label className="search">
          <Search size={15} />
          <input placeholder="Buscar mod…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented scroll">
          {CATEGORIES.filter((c) => c.id === 'todos' || counts[c.id]).map((c) => (
            <button key={c.id} className={cx(cat === c.id && 'active')} onClick={() => setCat(c.id)}>
              {c.label}
              <em>{counts[c.id] ?? 0}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="mods-grid">
        {visible.map((f, i) => (
          <ModRow
            key={f.id}
            f={f}
            status={pack.files[f.id]}
            index={i}
            enabled={settings?.optional[f.id] ?? f.defaultEnabled ?? true}
            onToggle={(v) => void setSettings({ optional: { ...settings?.optional, [f.id]: v } })}
          />
        ))}
        {!visible.length && <p className="muted empty">Nenhum mod encontrado.</p>}
      </div>
    </div>
  )
}

function Monogram({ name }: { name: string }) {
  const letters = name
    .replace(/[^A-Za-zÀ-ú0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return <span className="monogram">{letters.toUpperCase()}</span>
}

function ModRow({ f, status, index, enabled, onToggle }: { f: PackFile; status: string; index: number; enabled: boolean; onToggle: (v: boolean) => void }) {
  const [iconOk, setIconOk] = useState(true)
  const statusLabel = status === 'ok' ? 'Instalado' : status === 'disabled' ? 'Desligado' : status === 'outdated' ? 'Atualizar' : 'Pendente'
  return (
    <article className={cx('mod', status === 'disabled' && 'off')} style={{ animationDelay: `${Math.min(index, 20) * 18}ms` }}>
      <div className="mod-icon">{f.icon && iconOk ? <img src={f.icon} alt="" onError={() => setIconOk(false)} /> : <Monogram name={f.name} />}</div>
      <div className="mod-body">
        <div className="mod-title">
          <strong>{f.name}</strong>
          {f.version && <span className="mod-version">{f.version}</span>}
        </div>
        <p>{f.description}</p>
        <div className="mod-tags">
          <span className="tag">{LABEL[f.category] ?? f.category}</span>
          {f.side === 'client' && <span className="tag subtle">Só no cliente</span>}
          {f.size !== undefined && <span className="tag subtle">{bytes(f.size)}</span>}
        </div>
      </div>
      <div className="mod-side">
        {f.optional ? (
          <Toggle checked={enabled} onChange={onToggle} label={`Ativar ${f.name}`} />
        ) : (
          <span className={cx('status-pill', status)}>{statusLabel}</span>
        )}
        {f.page && (
          <button className="icon-btn" title="Página do mod" onClick={() => api.app.openExternal(f.page!)}>
            <ExternalLink size={14} />
          </button>
        )}
      </div>
    </article>
  )
}
