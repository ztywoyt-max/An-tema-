// API simulada: permite abrir a interface num navegador comum (desenvolvimento e capturas de tela)
// sem o processo principal do Electron.
import type { Account, AnatemaApi, EventMap, GameState, LogLine, PackManifest, PackStatus, Settings } from '@shared/types'
import manifestJson from '../../resources/manifest.json'

export function createMockApi(): AnatemaApi {
  const manifest = manifestJson as unknown as PackManifest
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  const emit = <K extends keyof EventMap>(ch: K, p: EventMap[K]) => listeners.get(ch as string)?.forEach((fn) => fn(p))
  const params = new URLSearchParams(location.search)
  const loggedIn = params.get('conta') !== '0'

  let settings: Settings = {
    memoryMB: 6144,
    width: 1600,
    height: 900,
    fullscreen: false,
    autoConnect: true,
    afterLaunch: 'minimize',
    reduceMotion: false,
    concurrency: 8,
    javaPath: '',
    jvmArgs: '',
    optional: {},
    selectedAccount: loggedIn ? 'a1' : null,
  }
  let accounts: Account[] = loggedIn ? [{ id: 'a1', name: 'oZTy_', uuid: '069a79f444e94726a5befca90e38aaf5', addedAt: Date.now() }] : []
  let state: GameState = { phase: 'idle', label: 'Pronto' }
  let seq = 0
  const now = Date.now()
  const sampleLogs: [LogLine['level'], LogLine['source'], string][] = [
    ['info', 'launcher', 'ANÁTEMA Launcher 1.0.0 · win32 x64 · 16310 MB RAM'],
    ['info', 'launcher', `Modpack ANÁTEMA ${manifest.pack.version} · Minecraft 1.21.1 · NeoForge 21.1.256`],
    ['info', 'launcher', 'Java 21.0.12.1 pronto.'],
    ['info', 'launcher', 'Verificando Minecraft 1.21.1: 92 arquivos base.'],
    ['info', 'launcher', 'Verificando 3891 assets do jogo.'],
    ['info', 'jogo', '[12:04:11] [main/INFO] [cp.mo.mo.Launcher/MODLAUNCHER]: ModLauncher running: args [--username, oZTy_, --version, neoforge-21.1.256]'],
    ['warn', 'jogo', '[12:04:15] [main/WARN] [ne.ne.fm.lo.mo.ModFileParser/LOADING]: Mod file sodium has a minor version mismatch'],
    ['info', 'jogo', '[12:04:22] [Render thread/INFO] [minecraft/Minecraft]: Setting user: oZTy_'],
    ['error', 'jogo', '[12:05:02] [Render thread/ERROR] [minecraft/TextureAtlas]: Missing texture anatema_core:item/selo_carmesim'],
    ['info', 'jogo', '[12:05:09] [Server thread/INFO] [minecraft/MinecraftServer]: oZTy_ joined the game'],
  ]
  const logs: LogLine[] = sampleLogs.map(([level, source, text], i) => ({ seq: ++seq, t: now - (sampleLogs.length - i) * 4000, level, source, text }))

  const files: PackStatus['files'] = {}
  for (const f of manifest.files) files[f.id] = f.optional && !f.defaultEnabled ? 'disabled' : 'ok'
  const missing = params.get('pendente') === '1'
  if (missing) manifest.files.slice(3, 9).forEach((f) => (files[f.id] = 'missing'))
  const pack: PackStatus = {
    manifest,
    source: 'remote',
    files,
    pendingBytes: missing ? 48_200_000 : 0,
    pendingCount: missing ? 6 : 0,
    installed: { java: true, minecraft: true, loader: true },
    checkedAt: Date.now(),
  }

  const setState = (s: GameState) => {
    state = s
    emit('game:state', s)
  }

  const simulatePlay = async () => {
    const steps: [GameState['phase'], string, number][] = [
      ['auth', 'Validando sua conta', 0.02],
      ['java', 'Preparando Java 21', 0.12],
      ['minecraft', 'Minecraft 1.21.1 · Recursos do jogo', 0.42],
      ['loader', 'Verificando NeoForge 21.1.256', 0.62],
      ['mods', 'Mods e recursos', 0.86],
      ['launching', 'Iniciando o jogo', 0.99],
    ]
    for (const [phase, label, progress] of steps) {
      setState({ phase, label, progress, detail: '312,4 MB de 1,21 GB · 58/212 arquivos', bytesPerSecond: 14_800_000 })
      await new Promise((r) => setTimeout(r, 700))
    }
    setState({ phase: 'running', label: 'Em jogo', startedAt: Date.now() })
  }

  if (params.get('estado') === 'baixando') {
    state = { phase: 'mods', label: 'Mods e recursos', progress: 0.73, detail: '612,4 MB de 1,21 GB · 148/212 arquivos', bytesPerSecond: 18_400_000 }
  } else if (params.get('estado') === 'erro') {
    state = {
      phase: 'error',
      label: 'Algo deu errado',
      error: { message: 'O Minecraft fechou com o código -1.', hint: 'Veja a aba Registros ou a pasta crash-reports para os detalhes.' },
    }
  }

  return {
    app: {
      info: async () => ({ version: '1.0.0', platform: 'win32', totalMemoryMB: 16310, dataDir: 'C:\\Users\\Jogador\\AppData\\Roaming\\.anatema', loginConfigured: true, isPackaged: false }),
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {},
      openExternal: (url) => window.open(url, '_blank'),
      openFolder: () => {},
      splashDone: () => {},
    },
    settings: {
      get: async () => settings,
      set: async (patch) => {
        settings = { ...settings, ...patch }
        emit('settings:changed', settings)
        return settings
      },
    },
    accounts: {
      list: async () => accounts,
      login: async () => {
        const acc = { id: 'a1', name: 'oZTy_', uuid: '069a79f444e94726a5befca90e38aaf5', addedAt: Date.now() }
        accounts = [acc]
        settings = { ...settings, selectedAccount: acc.id }
        emit('accounts:changed', accounts)
        emit('settings:changed', settings)
        return acc
      },
      remove: async (id) => {
        accounts = accounts.filter((a) => a.id !== id)
        settings = { ...settings, selectedAccount: accounts[0]?.id ?? null }
        emit('accounts:changed', accounts)
        emit('settings:changed', settings)
      },
      select: async (id) => {
        settings = { ...settings, selectedAccount: id }
        emit('settings:changed', settings)
      },
    },
    pack: { status: async () => pack, repair: async () => {}, reset: async () => {} },
    game: {
      play: async () => void simulatePlay(),
      cancel: async () => setState({ phase: 'idle', label: 'Cancelado' }),
      kill: async () => setState({ phase: 'idle', label: 'Pronto' }),
      state: async () => state,
    },
    server: {
      status: async () =>
        params.get('servidor') === '0'
          ? { online: false, address: manifest.server.address, checkedAt: Date.now(), error: 'Servidor fechado' }
          : {
              online: true,
              address: manifest.server.address,
              latencyMs: 38,
              version: 'NeoForge 1.21.1',
              motd: 'O céu sangra. A terra recorda.',
              players: {
                online: 14,
                max: 60,
                sample: ['Corvina', 'Miriel', 'Askar', 'Vael', 'Tormund', 'Ysolde'].map((name, i) => ({ name, id: `00000000-0000-0000-0000-00000000000${i}` })),
              },
              checkedAt: Date.now(),
            },
    },
    logs: { history: async () => logs, clear: async () => void (logs.length = 0), export: async () => null },
    updater: { check: async () => emit('updater:state', { state: 'none' }), install: () => {} },
    on(channel, cb) {
      if (!listeners.has(channel)) listeners.set(channel, new Set())
      listeners.get(channel)!.add(cb as (p: unknown) => void)
      return () => listeners.get(channel)!.delete(cb as (p: unknown) => void)
    },
  }
}
