import { Check, Copy, Loader2, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react'
import wordmark from '@brand/anatema-wordmark.svg?raw'
import { selectAccount, useStore } from '../app/store'
import { bytes, cx, shortDate } from '../app/format'
import { Card, Eyebrow } from '../components/ui'
import { MicrosoftMark } from '../components/TitleBar'
import { useState } from 'react'
import { api } from '../app/api'

export function Inicio() {
  const pack = useStore((s) => s.pack)
  const m = pack?.manifest
  const modCount = m?.files.filter((f) => f.path.startsWith('mods/')).length ?? 0

  return (
    <div className="page inicio">
      <div className="inicio-main">
        <Eyebrow index="001">O domínio dos condenados</Eyebrow>
        <div className="hero-word" dangerouslySetInnerHTML={{ __html: wordmark }} />
        <p className="hero-tagline">O céu sangra. A terra recorda.</p>
        <div className="chips">
          <span className="chip">Minecraft Java {m?.minecraft ?? '1.21.1'}</span>
          <span className="chip">NeoForge {m?.loader.version ?? '—'}</span>
          <span className="chip">Roleplay · Sobrevivência</span>
          {modCount > 0 && <span className="chip">{modCount} mods</span>}
        </div>

        <section className="chronicles">
          <div className="section-title">
            <h2>Crônicas</h2>
            <span>Notícias do domínio</span>
          </div>
          <div className="chronicle-list">
            {(m?.news ?? []).map((n, i) => (
              <article key={n.id} className="chronicle" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <div className="chronicle-meta">
                  {n.tag && <span className="tag">{n.tag}</span>}
                  <time>{shortDate(n.date)}</time>
                </div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </article>
            ))}
            {!m?.news?.length && <p className="muted">Nenhuma crônica por enquanto.</p>}
          </div>
        </section>
      </div>

      <aside className="inicio-side">
        <ServerCard />
        <AccountCard />
        <InstallCard />
      </aside>
    </div>
  )
}

function ServerCard() {
  const server = useStore((s) => s.server)
  const m = useStore((s) => s.pack?.manifest)
  const refresh = useStore((s) => s.refreshServer)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const address = m?.server.address ?? server?.address ?? ''
  const online = server?.online
  const players = server?.players

  return (
    <Card className={cx('server-card', online === true && 'online', online === false && 'offline')}>
      <div className="server-top">
        <div className="server-status">
          <span className="pulse" />
          <span>{server ? (online ? 'Domínio aberto' : 'Domínio selado') : 'Consultando…'}</span>
        </div>
        <button
          className="icon-btn"
          title="Atualizar"
          onClick={async () => {
            setRefreshing(true)
            await refresh()
            setRefreshing(false)
          }}
        >
          <RefreshCw size={14} className={cx(refreshing && 'spin')} />
        </button>
      </div>
      <h3 className="server-name">{m?.server.name ?? 'O Domínio dos Condenados'}</h3>
      <button
        className="server-address"
        onClick={() => {
          void navigator.clipboard.writeText(address)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        title="Copiar endereço"
      >
        <span>{address}</span>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>

      <div className="server-stats">
        <div className="stat">
          <Users size={16} />
          <div>
            <strong>{online && players ? players.online : '—'}</strong>
            <span>{online && players ? `de ${players.max} condenados` : 'condenados'}</span>
          </div>
        </div>
        <div className="stat">
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          <div>
            <strong>{online && server?.latencyMs !== undefined ? `${server.latencyMs} ms` : '—'}</strong>
            <span>{online ? 'latência' : (server?.error ?? 'sem resposta')}</span>
          </div>
        </div>
      </div>

      {online && players && players.sample.length > 0 && (
        <div className="server-players">
          {players.sample.slice(0, 8).map((p) => (
            <span key={p.id} className="player-pill" title={p.name}>
              {p.name}
            </span>
          ))}
          {players.online > players.sample.length && <span className="player-pill more">+{players.online - players.sample.length}</span>}
        </div>
      )}
    </Card>
  )
}

function OfficialCard() {
  const official = useStore((s) => s.official)
  return (
    <Card className="account-card" eyebrow="Identidade · O primeiro passo" title="Entre como Condenado.">
      <ol className="steps">
        <li>
          <b>1</b>
          <span>Clique em <strong>Jogar</strong>: o ANÁTEMA instala NeoForge, mods e configurações.</span>
        </li>
        <li>
          <b>2</b>
          <span>O <strong>Minecraft Launcher</strong> oficial abre com o perfil <strong>ANÁTEMA</strong> já selecionado.</span>
        </li>
        <li>
          <b>3</b>
          <span>Clique em Jogar lá, com a sua conta. O servidor já estará em Multijogador.</span>
        </li>
      </ol>
      {official?.found === false && (
        <>
          <p className="note warn">O Minecraft Launcher oficial não foi encontrado neste computador.</p>
          <button className="btn ms" onClick={() => api.official.download()}>
            Baixar o Minecraft Launcher
          </button>
        </>
      )}
    </Card>
  )
}

function AccountCard() {
  const official = useStore((s) => s.info?.playMode === 'official')
  if (official) return <OfficialCard />
  return <MicrosoftAccountCard />
}

function MicrosoftAccountCard() {
  const account = useStore(selectAccount)
  const login = useStore((s) => s.login)
  const loggingIn = useStore((s) => s.loggingIn)
  const info = useStore((s) => s.info)
  if (account) return null
  return (
    <Card className="account-card" eyebrow="Identidade · O primeiro passo" title="Entre como Condenado.">
      <p className="muted">
        Use a conta Microsoft com a qual você comprou o Minecraft — ela pode usar o seu e-mail do Gmail. Sua senha é digitada
        apenas na página oficial da Microsoft.
      </p>
      <button className="btn ms" onClick={() => void login()} disabled={loggingIn || info?.loginConfigured === false}>
        {loggingIn ? <Loader2 size={16} className="spin" /> : <MicrosoftMark size={16} />}
        {loggingIn ? 'Aguardando a Microsoft…' : 'Entrar com Microsoft'}
      </button>
      {info?.loginConfigured === false && <p className="note warn">O login ainda não foi ativado pela equipe neste launcher.</p>}
    </Card>
  )
}

function InstallCard() {
  const pack = useStore((s) => s.pack)
  const go = useStore((s) => s.go)
  if (!pack) {
    return (
      <Card className="install-card" eyebrow="Instalação">
        <p className="muted">Verificando arquivos…</p>
      </Card>
    )
  }
  const mods = pack.manifest.files.filter((f) => f.side !== 'server')
  const okCount = mods.filter((f) => pack.files[f.id] === 'ok').length
  const activeCount = mods.filter((f) => pack.files[f.id] !== 'disabled').length
  const rows: [string, boolean, string][] = [
    [`Java ${pack.manifest.java.major}`, pack.installed.java, pack.installed.java ? 'Pronto' : 'Será baixado'],
    [`Minecraft ${pack.manifest.minecraft}`, pack.installed.minecraft, pack.installed.minecraft ? 'Pronto' : 'Será baixado'],
    [`NeoForge ${pack.manifest.loader.version}`, pack.installed.loader, pack.installed.loader ? 'Pronto' : 'Será instalado'],
    ['Mods e recursos', pack.pendingCount === 0, pack.pendingCount === 0 ? `${okCount}/${activeCount}` : `${bytes(pack.pendingBytes)} a baixar`],
  ]
  return (
    <Card
      className="install-card"
      eyebrow="Instalação"
      actions={
        <button className="link" onClick={() => go('modpack')}>
          Ver modpack
        </button>
      }
    >
      <ul className="install-rows">
        {rows.map(([label, ok, value]) => (
          <li key={label} className={cx(ok ? 'ok' : 'pending')}>
            <span className="dot" />
            <span>{label}</span>
            <em>{value}</em>
          </li>
        ))}
      </ul>
    </Card>
  )
}
