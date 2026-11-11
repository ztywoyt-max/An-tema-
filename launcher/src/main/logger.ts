import { appendFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LogLevel, LogLine, LogSource } from '../shared/types'

type Listener = (lines: LogLine[]) => void

const MAX_LINES = 8000
const FLUSH_MS = 120

/**
 * Barramento de registros: mantém as últimas linhas em memória (para a aba Registros),
 * grava em disco e envia lotes para a interface sem travar com jogos muito verbosos.
 */
class Logger {
  private lines: LogLine[] = []
  private seq = 0
  private pending: LogLine[] = []
  private diskQueue: string[] = []
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<Listener>()
  private file: string | null = null

  async init(dir: string) {
    // Mantém os 5 registros anteriores: launcher.log → launcher.1.log …
    const base = join(dir, 'launcher.log')
    try {
      const files = await readdir(dir)
      for (let i = 4; i >= 1; i--) {
        const from = join(dir, `launcher.${i}.log`)
        if (files.includes(`launcher.${i}.log`)) await rename(from, join(dir, `launcher.${i + 1}.log`)).catch(() => {})
      }
      if (existsSync(base)) await rename(base, join(dir, 'launcher.1.log'))
      await rm(join(dir, 'launcher.6.log'), { force: true })
    } catch {
      /* primeira execução */
    }
    this.file = base
    await writeFile(base, '')
  }

  on(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  history() {
    return this.lines.slice()
  }

  clear() {
    this.lines = []
  }

  log(level: LogLevel, source: LogSource, text: string) {
    for (const part of text.replace(/\r/g, '').split('\n')) {
      if (!part.trim()) continue
      const line: LogLine = { seq: ++this.seq, t: Date.now(), level, source, text: part }
      this.lines.push(line)
      this.pending.push(line)
      this.diskQueue.push(`${new Date(line.t).toISOString()} [${source}/${level.toUpperCase()}] ${part}`)
    }
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES)
    if (!this.timer) this.timer = setTimeout(() => this.flush(), FLUSH_MS)
  }

  info = (t: string) => this.log('info', 'launcher', t)
  warn = (t: string) => this.log('warn', 'launcher', t)
  error = (t: string) => this.log('error', 'launcher', t)
  debug = (t: string) => this.log('debug', 'launcher', t)

  /** Classifica uma linha de saída do Minecraft/NeoForge pelo nível. */
  game(text: string, stderr = false) {
    for (const part of text.split(/\r?\n/)) {
      if (!part.trim()) continue
      const m = /\/(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]/.exec(part) || /\[(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]/.exec(part)
      let level: LogLevel = stderr ? 'warn' : 'info'
      if (m) {
        const l = m[1]
        level = l === 'WARN' ? 'warn' : l === 'ERROR' || l === 'FATAL' ? 'error' : l === 'INFO' ? 'info' : 'debug'
      } else if (/exception|error:|caused by/i.test(part)) level = 'error'
      this.log(level, 'jogo', part)
    }
  }

  private flush() {
    this.timer = null
    const batch = this.pending
    this.pending = []
    for (const fn of this.listeners) fn(batch)
    if (this.file && this.diskQueue.length) {
      const chunk = this.diskQueue.join('\n') + '\n'
      this.diskQueue = []
      appendFile(this.file, chunk).catch(() => {})
    }
  }
}

export const log = new Logger()

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
