import type { ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../app/store'
import { cx } from '../app/format'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={cx('toggle', checked && 'on')} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  )
}

export function Card({ className, children, title, eyebrow, actions }: { className?: string; children: ReactNode; title?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <section className={cx('card', className)}>
      {(title || eyebrow || actions) && (
        <header className="card-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h3>{title}</h3>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Eyebrow({ children, index }: { children: ReactNode; index?: string }) {
  return (
    <div className="eyebrow line">
      <span className="eyebrow-rule" />
      {children}
      {index && <em>/ {index}</em>}
    </div>
  )
}

export function Setting({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting">
      <div className="setting-text">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismiss)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={cx('toast', t.kind)}>
          <span className="toast-icon">
            {t.kind === 'ok' ? <CheckCircle2 size={18} /> : t.kind === 'erro' ? <TriangleAlert size={18} /> : <Info size={18} />}
          </span>
          <div>
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
          <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
