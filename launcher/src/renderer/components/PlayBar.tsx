import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleAlert, Loader2, Square, X } from 'lucide-react'
import corvo from '@brand/corvo.svg?raw'
import { api } from '../app/api'
import { selectAccount, useStore } from '../app/store'
import { bytes, cx, elapsed, speed } from '../app/format'

/** Barra inferior fixa: estado da instalação/jogo e o botão principal. */
export function PlayBar() {
  const game = useStore((s) => s.game)
  const account = useStore(selectAccount)
  const pack = useStore((s) => s.pack)
  const login = useStore((s) => s.login)
  const loggingIn = useStore((s) => s.loggingIn)
  const go = useStore((s) => s.go)
  const official = useStore((s) => s.info?.playMode === 'official')
  const needsAccount = !official && !account
  const [, tick] = useState(0)

  useEffect(() => {
    if (game.phase !== 'running') return
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [game.phase])

  const busy = !['idle', 'error', 'running', 'handoff'].includes(game.phase)
  const handoff = game.phase === 'handoff'
  const running = game.phase === 'running'
  const needsInstall = pack && (!pack.installed.minecraft || !pack.installed.loader)
  const pending = pack?.pendingCount ?? 0

  let title = 'A entrada aguarda.'
  let subtitle = 'Os arquivos serão verificados ao iniciar.'
  if (official) subtitle = 'Tudo é instalado e o Minecraft Launcher abre com o perfil ANÁTEMA.'
  if (needsAccount) {
    title = 'Entre como Condenado.'
    subtitle = 'Conecte sua conta Microsoft para atravessar o domínio.'
  } else if (busy) {
    title = game.label
    subtitle = [game.detail, speed(game.bytesPerSecond)].filter(Boolean).join(' · ') || 'Preparando…'
  } else if (handoff) {
    title = 'Tudo pronto. O Minecraft Launcher foi aberto.'
    subtitle = 'Lá, escolha o perfil ANÁTEMA e clique em Jogar. O servidor já está na lista de Multijogador.'
  } else if (running) {
    title = 'Você está no Domínio.'
    subtitle = `Sessão iniciada há ${elapsed(game.startedAt) || 'instantes'}. O launcher aguarda em segundo plano.`
  } else if (game.phase === 'error') {
    title = game.error?.message ?? 'Algo deu errado.'
    subtitle = game.error?.hint ?? 'Veja a aba Registros para os detalhes.'
  } else if (needsInstall) {
    title = 'Primeira travessia.'
    subtitle = official
      ? 'NeoForge e mods serão instalados e o perfil ANÁTEMA criado no Minecraft Launcher.'
      : 'Java, Minecraft, NeoForge e mods serão instalados automaticamente.'
  } else if (pending > 0) {
    title = 'Há uma atualização do modpack.'
    subtitle = `${pending} arquivo${pending > 1 ? 's' : ''} para baixar (${bytes(pack!.pendingBytes)}).`
  }

  const progress = game.progress
  const showBar = busy

  let action: { label: string; onClick: () => void; variant: string; icon: React.ReactNode; disabled?: boolean }
  if (needsAccount) {
    action = { label: loggingIn ? 'Aguardando' : 'Entrar', onClick: () => void login(), variant: 'primary', icon: <ArrowUpRight size={20} />, disabled: loggingIn }
  } else if (busy) {
    action = { label: 'Cancelar', onClick: () => void api.game.cancel(), variant: 'ghost', icon: <X size={18} />, disabled: game.phase === 'launching' }
  } else if (running) {
    action = { label: 'Fechar jogo', onClick: () => void api.game.kill(), variant: 'ghost', icon: <Square size={14} /> }
  } else {
    action = {
      label: needsInstall ? 'Instalar' : pending > 0 ? 'Atualizar' : handoff ? 'Abrir de novo' : 'Jogar',
      onClick: () => void api.game.play(),
      variant: 'primary',
      icon: <ArrowUpRight size={20} />,
    }
  }

  return (
    <footer className={cx('playbar', busy && 'busy', (running || handoff) && 'running', game.phase === 'error' && 'error')}>
      <div className="playbar-status">
        <span className="playbar-sigil">
          {busy ? <Loader2 size={18} className="spin" /> : game.phase === 'error' ? <CircleAlert size={18} /> : <i className="sigil-crow" dangerouslySetInnerHTML={{ __html: corvo }} />}
        </span>
        <div className="playbar-text">
          <strong>{title}</strong>
          <span>
            {subtitle}
            {game.phase === 'error' && (
              <button className="link" onClick={() => go('registros')}>
                Abrir registros
              </button>
            )}
          </span>
          <div className={cx('progress', showBar && 'visible', showBar && progress === undefined && 'indeterminate')}>
            <div className="progress-fill" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        </div>
        {showBar && progress !== undefined && <span className="playbar-pct">{Math.round(progress * 100)}%</span>}
      </div>

      <button className={cx('play-btn', action.variant)} onClick={action.onClick} disabled={action.disabled}>
        <span className="play-label">{action.label}</span>
        <span className="play-icon">{action.icon}</span>
        <span className="play-shine" />
      </button>
    </footer>
  )
}
