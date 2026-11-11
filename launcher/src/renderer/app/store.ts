import { create } from 'zustand'
import type { Account, AppInfo, GameState, LogLine, OfficialLauncherStatus, PackStatus, ServerStatus, Settings, UpdateState } from '@shared/types'
import { api } from './api'

export type Page = 'inicio' | 'modpack' | 'ajustes' | 'registros'

export interface Toast {
  id: number
  kind: 'info' | 'ok' | 'erro'
  title: string
  body?: string
}

interface Store {
  ready: boolean
  page: Page
  info: AppInfo | null
  settings: Settings | null
  accounts: Account[]
  pack: PackStatus | null
  packError: string | null
  game: GameState
  server: ServerStatus | null
  logs: LogLine[]
  updater: UpdateState
  maximized: boolean
  toasts: Toast[]
  loggingIn: boolean
  official: OfficialLauncherStatus | null

  go(page: Page): void
  init(): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<void>
  refreshPack(remote?: boolean): Promise<void>
  refreshServer(): Promise<void>
  refreshOfficial(): Promise<void>
  login(): Promise<void>
  toast(t: Omit<Toast, 'id'>): void
  dismiss(id: number): void
}

const MAX_LOGS = 8000
let toastSeq = 0

export const useStore = create<Store>((set, get) => ({
  ready: false,
  page: 'inicio',
  info: null,
  settings: null,
  accounts: [],
  pack: null,
  packError: null,
  game: { phase: 'idle', label: 'Pronto' },
  server: null,
  logs: [],
  updater: { state: 'idle' },
  maximized: false,
  toasts: [],
  loggingIn: false,
  official: null,

  go: (page) => set({ page }),

  async init() {
    api.on('game:state', (game) => {
      const prev = get().game
      set({ game })
      if (game.phase === 'error' && prev.phase !== 'error') {
        get().toast({ kind: 'erro', title: game.error?.message ?? 'Algo deu errado', body: game.error?.hint })
      }
    })
    api.on('log:lines', (lines) =>
      set((s) => {
        const logs = s.logs.concat(lines)
        return { logs: logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs }
      }),
    )
    api.on('accounts:changed', (accounts) => set({ accounts }))
    api.on('settings:changed', (settings) => set({ settings }))
    api.on('pack:changed', (pack) => set({ pack }))
    api.on('updater:state', (updater) => set({ updater }))
    api.on('window:maximized', (maximized) => set({ maximized }))

    const [info, settings, accounts, game, logs] = await Promise.all([
      api.app.info(),
      api.settings.get(),
      api.accounts.list(),
      api.game.state(),
      api.logs.history(),
    ])
    set({ info, settings, accounts, game, logs, ready: true })
    if (settings.reduceMotion) document.documentElement.classList.add('reduce-motion')
    void get().refreshPack(true)
    void get().refreshServer()
    if (info.playMode === 'official') void get().refreshOfficial()
    setInterval(() => void get().refreshServer(), 30_000)
  },

  async setSettings(patch) {
    const settings = await api.settings.set(patch)
    set({ settings })
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
    if ('optional' in patch) void get().refreshPack(false)
  },

  async refreshPack(remote = false) {
    try {
      set({ pack: await api.pack.status(remote), packError: null })
    } catch (e) {
      set({ packError: (e as Error).message })
    }
  },

  async refreshServer() {
    try {
      set({ server: await api.server.status() })
    } catch {
      /* o card mostra o último estado conhecido */
    }
  },

  async refreshOfficial() {
    try {
      set({ official: await api.official.status() })
    } catch {
      /* mantém o último estado */
    }
  },

  async login() {
    set({ loggingIn: true })
    try {
      const acc = await api.accounts.login()
      get().toast({ kind: 'ok', title: `Bem-vindo, ${acc.name}.`, body: 'Sua conta foi conectada.' })
    } catch (e) {
      const msg = (e as Error).message
      if (!/cancelado/i.test(msg)) get().toast({ kind: 'erro', title: 'Não foi possível entrar', body: msg })
    } finally {
      set({ loggingIn: false })
    }
  },

  toast(t) {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismiss(id), t.kind === 'erro' ? 9000 : 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const selectAccount = (s: Store) => s.accounts.find((a) => a.id === s.settings?.selectedAccount) ?? null
