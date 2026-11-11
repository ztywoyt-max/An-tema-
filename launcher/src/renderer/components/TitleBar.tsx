import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, House, LogOut, Minus, Package, Plus, ScrollText, Settings2, Square, X } from 'lucide-react'
import corvo from '@brand/corvo.svg?raw'
import { api } from '../app/api'
import { selectAccount, useStore, type Page } from '../app/store'
import { cx } from '../app/format'
import { SkinFace } from './SkinFace'

const TABS: { id: Page; label: string; icon: typeof House }[] = [
  { id: 'inicio', label: 'Início', icon: House },
  { id: 'modpack', label: 'Modpack', icon: Package },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2 },
  { id: 'registros', label: 'Registros', icon: ScrollText },
]

export function TitleBar() {
  const page = useStore((s) => s.page)
  const go = useStore((s) => s.go)
  const maximized = useStore((s) => s.maximized)
  const errors = useStore((s) => s.game.phase === 'error')

  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-crow" dangerouslySetInnerHTML={{ __html: corvo }} />
        <div className="brand-text">
          <strong>ANÁTEMA</strong>
          <span>Os condenados despertam</span>
        </div>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={page === t.id}
            className={cx('tab', page === t.id && 'active')}
            onClick={() => go(t.id)}
          >
            <t.icon size={16} strokeWidth={1.8} />
            <span>{t.label}</span>
            {t.id === 'registros' && errors && <i className="tab-alert" />}
          </button>
        ))}
      </nav>

      <div className="titlebar-right">
        <AccountMenu />
        <div className="win-controls">
          <button aria-label="Minimizar" onClick={() => api.app.minimize()}>
            <Minus size={15} />
          </button>
          <button aria-label={maximized ? 'Restaurar' : 'Maximizar'} onClick={() => api.app.toggleMaximize()}>
            {maximized ? <Copy size={13} /> : <Square size={12} />}
          </button>
          <button aria-label="Fechar" className="close" onClick={() => api.app.close()}>
            <X size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}

function AccountMenu() {
  const account = useStore(selectAccount)
  const accounts = useStore((s) => s.accounts)
  const login = useStore((s) => s.login)
  const loggingIn = useStore((s) => s.loggingIn)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  if (!account) {
    return (
      <button className="account-chip login" onClick={() => void login()} disabled={loggingIn}>
        <MicrosoftMark />
        <span>{loggingIn ? 'Aguardando…' : 'Entrar'}</span>
      </button>
    )
  }

  return (
    <div className="account" ref={ref}>
      <button className={cx('account-chip', open && 'open')} onClick={() => setOpen((v) => !v)}>
        <SkinFace url={account.skinUrl} name={account.name} size={26} />
        <span className="account-name">{account.name}</span>
        <ChevronDown size={14} className="chev" />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-label">Contas</div>
          {accounts.map((a) => (
            <div key={a.id} className={cx('menu-account', a.id === account.id && 'current')}>
              <button
                className="menu-account-main"
                onClick={() => {
                  void api.accounts.select(a.id)
                  setOpen(false)
                }}
              >
                <SkinFace url={a.skinUrl} name={a.name} size={22} />
                <span>{a.name}</span>
                {a.id === account.id && <em>em uso</em>}
              </button>
              <button className="icon-btn" title="Remover conta" onClick={() => void api.accounts.remove(a.id)}>
                <LogOut size={14} />
              </button>
            </div>
          ))}
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false)
              void login()
            }}
          >
            <Plus size={15} /> Adicionar outra conta
          </button>
        </div>
      )}
    </div>
  )
}

export function MicrosoftMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}
