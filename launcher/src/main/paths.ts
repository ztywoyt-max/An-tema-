import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

/** Estrutura de pastas do launcher (em %APPDATA%\.anatema no Windows). */
export interface Paths {
  root: string
  game: string
  runtime: string
  cache: string
  logs: string
  settings: string
  accounts: string
  installedState: string
}

let cached: Paths | null = null

export function paths(): Paths {
  if (cached) return cached
  const root = process.env.ANATEMA_HOME || join(app.getPath('appData'), '.anatema')
  cached = {
    root,
    game: join(root, 'jogo'),
    runtime: join(root, 'runtime'),
    cache: join(root, 'cache'),
    logs: join(root, 'registros'),
    settings: join(root, 'ajustes.json'),
    accounts: join(root, 'contas.json'),
    installedState: join(root, 'jogo', '.anatema-instalacao.json'),
  }
  for (const dir of [cached.root, cached.game, cached.runtime, cached.cache, cached.logs]) {
    mkdirSync(dir, { recursive: true })
  }
  return cached
}

export function resourcePath(...parts: string[]): string {
  return app.isPackaged ? join(process.resourcesPath, ...parts) : join(app.getAppPath(), 'resources', ...parts)
}
