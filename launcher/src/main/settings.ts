import { readFileSync } from 'node:fs'
import { totalmem } from 'node:os'
import type { Settings } from '../shared/types'
import { writeJsonAtomic } from './util/fsx'

export function systemMemoryMB() {
  return Math.round(totalmem() / 1024 / 1024)
}

/** Memória sugerida: metade da RAM do PC, entre 4 GB e 8 GB, em múltiplos de 512 MB. */
export function suggestedMemoryMB(recommended = 6144) {
  const half = systemMemoryMB() / 2
  const value = Math.min(Math.max(4096, Math.min(recommended, half)), 8192)
  return Math.floor(value / 512) * 512
}

export function defaultSettings(): Settings {
  return {
    memoryMB: suggestedMemoryMB(),
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
    selectedAccount: null,
  }
}

export class SettingsStore {
  private value: Settings
  constructor(private file: string) {
    let stored: Partial<Settings> = {}
    try {
      stored = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      /* primeira execução */
    }
    this.value = sanitize({ ...defaultSettings(), ...stored })
  }

  get(): Settings {
    return structuredClone(this.value)
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    this.value = sanitize({ ...this.value, ...patch })
    await writeJsonAtomic(this.file, this.value)
    return this.get()
  }
}

function sanitize(s: Settings): Settings {
  const total = systemMemoryMB()
  const maxAllowed = Math.max(2048, total - 1536)
  return {
    ...s,
    memoryMB: clamp(Math.round(s.memoryMB / 256) * 256, 2048, maxAllowed),
    width: clamp(Math.round(s.width), 854, 7680),
    height: clamp(Math.round(s.height), 480, 4320),
    concurrency: clamp(Math.round(s.concurrency), 1, 32),
    afterLaunch: ['minimize', 'hide', 'keep', 'close'].includes(s.afterLaunch) ? s.afterLaunch : 'minimize',
    jvmArgs: String(s.jvmArgs ?? '').slice(0, 2000),
    javaPath: String(s.javaPath ?? ''),
    optional: typeof s.optional === 'object' && s.optional ? s.optional : {},
  }
}

function clamp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.min(Math.max(v, min), max)
}
