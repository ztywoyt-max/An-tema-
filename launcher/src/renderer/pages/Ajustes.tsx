import { useEffect, useState } from 'react'
import { Camera, FileWarning, FolderOpen, Gauge, Joystick, MonitorCog, RotateCcw, ScrollText, Sparkles, UserRound, Wrench } from 'lucide-react'
import { api } from '../app/api'
import { useStore } from '../app/store'
import { cx, gb } from '../app/format'
import { Card, Setting, Toggle } from '../components/ui'
import { SkinFace } from '../components/SkinFace'

const RESOLUTIONS: [number, number][] = [
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
]

export function Ajustes() {
  const s = useStore((st) => st.settings)
  const set = useStore((st) => st.setSettings)
  const info = useStore((st) => st.info)
  const pack = useStore((st) => st.pack)
  if (!s || !info) return null

  const total = info.totalMemoryMB
  const maxMem = Math.max(2048, Math.floor((total - 1536) / 512) * 512)
  const recommended = pack?.manifest.memory.recommendedMB ?? 6144
  const minimum = pack?.manifest.memory.minimumMB ?? 4096
  const pct = (v: number) => ((v - 2048) / (maxMem - 2048)) * 100

  return (
    <div className="page ajustes">
      <header className="page-head">
        <div>
          <div className="eyebrow">Ajustes</div>
          <h1>Prepare sua travessia</h1>
          <p className="muted">As mudanças são salvas automaticamente.</p>
        </div>
      </header>

      <div className="settings-grid">
        <Card title={<><Gauge size={16} /> Desempenho</>} className="span-2">
          <div className="memory">
            <div className="memory-head">
              <div>
                <strong>Memória do jogo</strong>
                <span>
                  Seu computador tem {gb(total)}. Recomendado para o modpack: {gb(recommended)}.
                </span>
              </div>
              <div className={cx('memory-value', s.memoryMB < minimum && 'low')}>{gb(s.memoryMB)}</div>
            </div>
            <div className="range-wrap">
              <input
                type="range"
                min={2048}
                max={maxMem}
                step={512}
                value={Math.min(s.memoryMB, maxMem)}
                onChange={(e) => void set({ memoryMB: Number(e.target.value) })}
                style={{ ['--fill' as string]: `${pct(Math.min(s.memoryMB, maxMem))}%` }}
              />
              {recommended <= maxMem && (
                <span className="range-mark" style={{ left: `${pct(recommended)}%` }} title="Recomendado">
                  <i />
                  recomendado
                </span>
              )}
            </div>
            {s.memoryMB < minimum && <p className="note warn">Abaixo de {gb(minimum)} o modpack pode travar ou fechar sozinho.</p>}
          </div>
          <Setting title="Downloads simultâneos" description="Mais conexões baixam mais rápido em internet boa.">
            <div className="stepper">
              <button onClick={() => void set({ concurrency: Math.max(1, s.concurrency - 2) })}>−</button>
              <span>{s.concurrency}</span>
              <button onClick={() => void set({ concurrency: Math.min(32, s.concurrency + 2) })}>+</button>
            </div>
          </Setting>
        </Card>

        <Card title={<><Joystick size={16} /> Jogo</>}>
          <Setting title="Resolução da janela">
            <select
              value={`${s.width}x${s.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number)
                void set({ width: w, height: h })
              }}
            >
              {!RESOLUTIONS.some(([w, h]) => w === s.width && h === s.height) && (
                <option value={`${s.width}x${s.height}`}>
                  {s.width} × {s.height}
                </option>
              )}
              {RESOLUTIONS.map(([w, h]) => (
                <option key={w} value={`${w}x${h}`}>
                  {w} × {h}
                </option>
              ))}
            </select>
          </Setting>
          <Setting title="Tela cheia" description="Abre o jogo ocupando a tela toda.">
            <Toggle checked={s.fullscreen} onChange={(v) => void set({ fullscreen: v })} />
          </Setting>
          <Setting title="Entrar direto no servidor" description="Pula o menu e conecta ao Domínio ao abrir.">
            <Toggle checked={s.autoConnect} onChange={(v) => void set({ autoConnect: v })} />
          </Setting>
        </Card>

        <Card title={<><MonitorCog size={16} /> Launcher</>}>
          <Setting title="Ao iniciar o jogo">
            <select value={s.afterLaunch} onChange={(e) => void set({ afterLaunch: e.target.value as typeof s.afterLaunch })}>
              <option value="minimize">Minimizar o launcher</option>
              <option value="hide">Esconder o launcher</option>
              <option value="keep">Manter aberto</option>
              <option value="close">Fechar o launcher</option>
            </select>
          </Setting>
          <Setting title="Reduzir animações" description="Desliga partículas e transições.">
            <Toggle checked={s.reduceMotion} onChange={(v) => void set({ reduceMotion: v })} />
          </Setting>
          <UpdaterRow />
        </Card>

        <Accounts />

        <Card title={<><FolderOpen size={16} /> Pastas</>}>
          <div className="folder-buttons">
            <button className="btn" onClick={() => api.app.openFolder('game')}>
              <FolderOpen size={15} /> Pasta do jogo
            </button>
            <button className="btn" onClick={() => api.app.openFolder('screenshots')}>
              <Camera size={15} /> Capturas de tela
            </button>
            <button className="btn" onClick={() => api.app.openFolder('crash')}>
              <FileWarning size={15} /> Relatórios de erro
            </button>
            <button className="btn" onClick={() => api.app.openFolder('logs')}>
              <ScrollText size={15} /> Registros
            </button>
          </div>
          <p className="muted small path">{info.dataDir}</p>
        </Card>

        <Advanced />
      </div>
    </div>
  )
}

function UpdaterRow() {
  const u = useStore((s) => s.updater)
  const info = useStore((s) => s.info)
  const text =
    u.state === 'checking'
      ? 'Procurando atualizações…'
      : u.state === 'available' || u.state === 'downloading'
        ? `Baixando a versão ${u.version}…`
        : u.state === 'ready'
          ? `Versão ${u.version} pronta.`
          : u.state === 'none'
            ? 'Você está na versão mais recente.'
            : u.state === 'error'
              ? 'Não foi possível verificar agora.'
              : u.state === 'disabled'
                ? 'Atualização automática ativa na versão instalada.'
                : ''
  return (
    <Setting title={`Versão ${info?.version ?? ''}`} description={text}>
      {u.state === 'ready' ? (
        <button className="btn accent" onClick={() => api.updater.install()}>
          <Sparkles size={15} /> Reiniciar e atualizar
        </button>
      ) : (
        <button className="btn" disabled={u.state === 'checking' || u.state === 'disabled'} onClick={() => void api.updater.check()}>
          <RotateCcw size={15} /> Verificar
        </button>
      )}
    </Setting>
  )
}

function Accounts() {
  const accounts = useStore((s) => s.accounts)
  const selected = useStore((s) => s.settings?.selectedAccount)
  const login = useStore((s) => s.login)
  return (
    <Card title={<><UserRound size={16} /> Contas</>} actions={<button className="link" onClick={() => void login()}>Adicionar</button>}>
      {accounts.length === 0 && <p className="muted">Nenhuma conta conectada.</p>}
      <ul className="account-list">
        {accounts.map((a) => (
          <li key={a.id} className={cx(a.id === selected && 'current')}>
            <SkinFace url={a.skinUrl} name={a.name} size={30} />
            <div>
              <strong>{a.name}</strong>
              <span>Conta Microsoft{a.id === selected ? ' · em uso' : ''}</span>
            </div>
            {a.id !== selected && (
              <button className="btn small" onClick={() => void api.accounts.select(a.id)}>
                Usar
              </button>
            )}
            <button className="btn small ghost" onClick={() => void api.accounts.remove(a.id)}>
              Sair
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Advanced() {
  const s = useStore((st) => st.settings)!
  const set = useStore((st) => st.setSettings)
  const [jvm, setJvm] = useState(s.jvmArgs)
  const [java, setJava] = useState(s.javaPath)
  useEffect(() => setJvm(s.jvmArgs), [s.jvmArgs])
  useEffect(() => setJava(s.javaPath), [s.javaPath])
  return (
    <Card title={<><Wrench size={16} /> Avançado</>} className="span-2">
      <div className="advanced-grid">
        <label className="field">
          <span>Java personalizado</span>
          <input
            placeholder="Automático (recomendado)"
            value={java}
            onChange={(e) => setJava(e.target.value)}
            onBlur={() => java !== s.javaPath && void set({ javaPath: java.trim() })}
          />
          <em>Deixe vazio para usar o Java 21 que o launcher instala.</em>
        </label>
        <label className="field">
          <span>Argumentos extras da JVM</span>
          <input
            placeholder="-XX:+AlwaysPreTouch"
            value={jvm}
            onChange={(e) => setJvm(e.target.value)}
            onBlur={() => jvm !== s.jvmArgs && void set({ jvmArgs: jvm })}
          />
          <em>Somente se você souber o que está fazendo.</em>
        </label>
      </div>
      <div className="danger-zone">
        <div>
          <strong>Reinstalar tudo</strong>
          <span>Remove Java, Minecraft, NeoForge e mods e baixa de novo. Mundos, prints e opções são mantidos.</span>
        </div>
        <button className="btn danger" onClick={() => void api.pack.reset()}>
          <RotateCcw size={15} /> Reinstalar
        </button>
      </div>
    </Card>
  )
}
