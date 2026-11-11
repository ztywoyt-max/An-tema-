import { contextBridge, ipcRenderer } from 'electron'
import type { AnatemaApi, EventMap } from '../shared/types'

const invoke = (ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args)
const fire = (ch: string, ...args: unknown[]) => ipcRenderer.send(ch, ...args)

/** Erros do processo principal chegam como "Error invoking remote method 'x': Error: msg". */
async function call<T>(ch: string, ...args: unknown[]): Promise<T> {
  try {
    return (await invoke(ch, ...args)) as T
  } catch (e) {
    const msg = String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
    throw new Error(msg)
  }
}

const api: AnatemaApi = {
  app: {
    info: () => call('app:info'),
    minimize: () => fire('app:minimize'),
    toggleMaximize: () => fire('app:toggleMaximize'),
    close: () => fire('app:close'),
    openExternal: (url) => fire('app:openExternal', url),
    openFolder: (kind) => fire('app:openFolder', kind),
    splashDone: () => fire('app:splashDone'),
  },
  settings: { get: () => call('settings:get'), set: (patch) => call('settings:set', patch) },
  accounts: {
    list: () => call('accounts:list'),
    login: () => call('accounts:login'),
    remove: (id) => call('accounts:remove', id),
    select: (id) => call('accounts:select', id),
  },
  pack: {
    status: (refresh) => call('pack:status', refresh),
    repair: () => call('pack:repair'),
    reset: () => call('pack:reset'),
  },
  game: {
    play: () => call('game:play'),
    cancel: () => call('game:cancel'),
    kill: () => call('game:kill'),
    state: () => call('game:state'),
  },
  server: { status: () => call('server:status') },
  official: { status: () => call('official:status'), download: () => fire('app:openExternal', 'https://www.minecraft.net/pt-br/download') },
  logs: { history: () => call('logs:history'), clear: () => call('logs:clear'), export: () => call('logs:export') },
  updater: { check: () => call('updater:check'), install: () => fire('updater:install') },
  on<K extends keyof EventMap>(channel: K, cb: (payload: EventMap[K]) => void) {
    const listener = (_e: unknown, payload: EventMap[K]) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('anatema', api)
