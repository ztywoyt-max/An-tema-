// Tipos compartilhados entre o processo principal (Node/Electron) e a interface (React).

/* ───────────────────────── Manifesto da distribuição ───────────────────────── */

export type FileSide = 'client' | 'server' | 'both'

export type ModCategory =
  | 'anatema'
  | 'jogabilidade'
  | 'construcao'
  | 'interface'
  | 'desempenho'
  | 'sons'
  | 'visual'
  | 'administracao'
  | 'bibliotecas'
  | 'shaders'

export interface Hashes {
  sha1?: string
  sha256?: string
  sha512?: string
}

export interface RemoteFile extends Hashes {
  url: string
  size?: number
}

export interface PackFile extends RemoteFile {
  /** Identificador estável (slug do Modrinth ou id interno). */
  id: string
  /** Caminho relativo à pasta do jogo, ex.: mods/sodium.jar */
  path: string
  name: string
  version?: string
  side: FileSide
  category: ModCategory
  description?: string
  page?: string
  icon?: string
  license?: string
  /** Opcional: o jogador pode desligar nos ajustes. */
  optional?: boolean
  /** Para opcionais: vem ligado por padrão? */
  defaultEnabled?: boolean
  /** Arquivos de configuração: 'once' só cria se não existir; 'always' sobrescreve sempre. */
  overwrite?: 'once' | 'always'
}

export interface NewsItem {
  id: string
  title: string
  date: string
  tag?: string
  body: string
  url?: string
}

export interface PackManifest {
  schema: 1
  pack: { name: string; version: string; updated: string }
  minecraft: string
  loader: { type: 'neoforge'; version: string; installer: RemoteFile }
  java: {
    major: number
    platforms: Partial<Record<PlatformKey, RemoteFile & { executable: string }>>
  }
  server: { name: string; address: string }
  memory: { minimumMB: number; recommendedMB: number }
  jvmArgs?: string[]
  files: PackFile[]
  news?: NewsItem[]
  links?: { label: string; url: string }[]
  /** Sistemas próprios do ANÁTEMA (exibidos na aba Modpack). */
  systems?: { id: string; name: string; description: string; status: 'ativo' | 'em-desenvolvimento' }[]
  /** Mods da lista que ainda não puderam ser resolvidos para NeoForge 1.21.1. */
  unresolved?: string[]
}

export type PlatformKey = 'windows-x64' | 'windows-arm64' | 'linux-x64' | 'macos-x64' | 'macos-arm64'

/* ───────────────────────── Estado local ───────────────────────── */

export type FileStatus = 'ok' | 'missing' | 'outdated' | 'disabled'

export interface PackStatus {
  manifest: PackManifest
  source: 'remote' | 'cache' | 'bundled'
  files: Record<string, FileStatus>
  pendingBytes: number
  pendingCount: number
  installed: { java: boolean; minecraft: boolean; loader: boolean }
  checkedAt: number
}

export interface Settings {
  memoryMB: number
  width: number
  height: number
  fullscreen: boolean
  autoConnect: boolean
  afterLaunch: 'minimize' | 'hide' | 'keep' | 'close'
  reduceMotion: boolean
  concurrency: number
  javaPath: string
  jvmArgs: string
  optional: Record<string, boolean>
  selectedAccount: string | null
}

export interface Account {
  id: string
  name: string
  uuid: string
  skinUrl?: string
  capeUrl?: string
  addedAt: number
  lastUsed?: number
}

/* ───────────────────────── Jogo / instalação ───────────────────────── */

export type Phase =
  | 'idle'
  | 'auth'
  | 'manifest'
  | 'java'
  | 'minecraft'
  | 'loader'
  | 'mods'
  | 'launching'
  | 'running'
  | 'handoff'
  | 'error'

export interface GameState {
  phase: Phase
  label: string
  detail?: string
  /** 0..1 progresso geral; undefined = indeterminado */
  progress?: number
  bytesPerSecond?: number
  error?: { message: string; hint?: string }
  startedAt?: number
}

/* ───────────────────────── Servidor ───────────────────────── */

export interface ServerStatus {
  online: boolean
  address: string
  latencyMs?: number
  version?: string
  motd?: string
  players?: { online: number; max: number; sample: { name: string; id: string }[] }
  favicon?: string
  checkedAt: number
  error?: string
}

/* ───────────────────────── Registros ───────────────────────── */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogSource = 'launcher' | 'jogo'

export interface LogLine {
  seq: number
  t: number
  level: LogLevel
  source: LogSource
  text: string
}

/* ───────────────────────── Atualizador ───────────────────────── */

export type UpdateState =
  | { state: 'idle' | 'checking' | 'none' | 'disabled' }
  | { state: 'available' | 'downloading'; version: string; progress?: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

/* ───────────────────────── Informações do app ───────────────────────── */

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  totalMemoryMB: number
  dataDir: string
  loginConfigured: boolean
  isPackaged: boolean
  /** official = abre o Minecraft Launcher oficial; own = login e inicialização pelo ANÁTEMA. */
  playMode: 'official' | 'own'
}

export interface OfficialLauncherStatus {
  found: boolean
  kind?: 'exe' | 'store'
  minecraftDir: string
}

/* ───────────────────────── Ponte (preload) ───────────────────────── */

export interface AnatemaApi {
  app: {
    info(): Promise<AppInfo>
    minimize(): void
    toggleMaximize(): void
    close(): void
    openExternal(url: string): void
    openFolder(kind: 'game' | 'logs' | 'mods' | 'screenshots' | 'crash'): void
    splashDone(): void
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  accounts: {
    list(): Promise<Account[]>
    login(): Promise<Account>
    remove(id: string): Promise<void>
    select(id: string): Promise<void>
  }
  pack: {
    status(refresh?: boolean): Promise<PackStatus>
    repair(): Promise<void>
    reset(): Promise<void>
  }
  game: {
    play(): Promise<void>
    cancel(): Promise<void>
    kill(): Promise<void>
    state(): Promise<GameState>
  }
  server: { status(): Promise<ServerStatus> }
  official: { status(): Promise<OfficialLauncherStatus>; download(): void }
  logs: {
    history(): Promise<LogLine[]>
    clear(): Promise<void>
    export(): Promise<string | null>
  }
  updater: { check(): Promise<void>; install(): void }
  on<K extends keyof EventMap>(channel: K, cb: (payload: EventMap[K]) => void): () => void
}

export interface EventMap {
  'game:state': GameState
  'log:lines': LogLine[]
  'accounts:changed': Account[]
  'settings:changed': Settings
  'pack:changed': PackStatus
  'updater:state': UpdateState
  'window:maximized': boolean
}
