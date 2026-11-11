import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import type { Hashes } from '../../shared/types'
import { isFileValid, strongestHash } from '../util/fsx'
import { USER_AGENT } from '../config'

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

let fetchImpl: FetchFn = (url, init) => fetch(url, init)

/** No Electron usamos `net.fetch` (pilha de rede do Chromium, respeita proxy do sistema). */
export function setFetch(fn: FetchFn) {
  fetchImpl = fn
}

export function httpFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)
  return fetchImpl(url, { ...init, headers })
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, body?: string) {
    super(`HTTP ${status} ao acessar ${new URL(url).host}${body ? `: ${body.slice(0, 300)}` : ''}`)
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs)
  const res = await httpFetch(url, { ...init, signal })
  if (!res.ok) throw new HttpError(res.status, url, await res.text().catch(() => ''))
  return (await res.json()) as T
}

export interface DownloadTask extends Hashes {
  url: string | string[]
  dest: string
  size?: number
  /** Nome amigável para os registros. */
  label?: string
}

export interface DownloadProgress {
  doneFiles: number
  totalFiles: number
  doneBytes: number
  totalBytes: number
  bytesPerSecond: number
  current?: string
}

export interface DownloadManyOptions {
  concurrency?: number
  signal?: AbortSignal
  /** Confere hash dos arquivos já existentes (modo "Verificar arquivos"). */
  deep?: boolean
  onProgress?: (p: DownloadProgress) => void
  onFileDone?: (task: DownloadTask, downloaded: boolean) => void
  retries?: number
}

class ChecksumError extends Error {}

/** Baixa um arquivo para `dest`, verificando hash, com arquivo temporário e troca atômica. */
export async function downloadFile(task: DownloadTask, onBytes: (n: number) => void, signal?: AbortSignal) {
  const urls = Array.isArray(task.url) ? task.url : [task.url]
  const expected = strongestHash(task)
  let lastError: unknown
  for (const url of urls) {
    const tmp = `${task.dest}.part`
    let received = 0
    try {
      await mkdir(dirname(task.dest), { recursive: true })
      const res = await httpFetch(url, { signal })
      if (!res.ok || !res.body) throw new HttpError(res.status, url)
      const hash = expected ? createHash(expected.algorithm) : null
      const counter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length
          hash?.update(chunk)
          onBytes(chunk.length)
          cb(null, chunk)
        },
      })
      await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(tmp), { signal })
      if (task.size !== undefined && received !== task.size) {
        throw new ChecksumError(`tamanho inesperado (${received} ≠ ${task.size})`)
      }
      if (expected && hash && hash.digest('hex') !== expected.value) {
        throw new ChecksumError('hash não confere')
      }
      await rename(tmp, task.dest)
      return
    } catch (e) {
      onBytes(-received)
      await rm(tmp, { force: true }).catch(() => {})
      if (signal?.aborted) throw e
      lastError = e
    }
  }
  throw lastError
}

/**
 * Baixa vários arquivos em paralelo. Arquivos já válidos são pulados.
 * Cada arquivo é tentado `retries` vezes, com espera crescente entre as tentativas.
 */
export async function downloadMany(tasks: DownloadTask[], opts: DownloadManyOptions = {}) {
  const concurrency = Math.max(1, opts.concurrency ?? 8)
  const retries = opts.retries ?? 3
  const progress: DownloadProgress = {
    doneFiles: 0,
    totalFiles: tasks.length,
    doneBytes: 0,
    totalBytes: tasks.reduce((a, t) => a + (t.size ?? 0), 0),
    bytesPerSecond: 0,
  }
  // Velocidade calculada numa janela deslizante de ~3 s.
  const samples: [number, number][] = []
  let lastEmit = 0
  const emit = (force = false) => {
    const now = Date.now()
    if (!force && now - lastEmit < 100) return
    lastEmit = now
    samples.push([now, progress.doneBytes])
    while (samples.length > 2 && now - samples[0][0] > 3000) samples.shift()
    const [t0, b0] = samples[0]
    progress.bytesPerSecond = now > t0 ? Math.max(0, ((progress.doneBytes - b0) * 1000) / (now - t0)) : 0
    opts.onProgress?.({ ...progress })
  }

  const queue = tasks.slice()
  const failures: { task: DownloadTask; error: unknown }[] = []

  const worker = async () => {
    for (;;) {
      if (opts.signal?.aborted) return
      const task = queue.shift()
      if (!task) return
      progress.current = task.label
      let downloaded = false
      if (await isFileValid(task.dest, task, !!opts.deep)) {
        progress.doneBytes += task.size ?? 0
      } else {
        let attempt = 0
        for (;;) {
          try {
            let got = 0
            await downloadFile(
              task,
              (n) => {
                got += n
                progress.doneBytes += n
                emit()
              },
              opts.signal,
            )
            // Corrige o total quando o tamanho não era conhecido.
            if (task.size === undefined) progress.totalBytes += got
            downloaded = true
            break
          } catch (error) {
            if (opts.signal?.aborted) return
            if (++attempt > retries) {
              failures.push({ task, error })
              break
            }
            await new Promise((r) => setTimeout(r, 600 * 2 ** attempt))
          }
        }
      }
      progress.doneFiles++
      opts.onFileDone?.(task, downloaded)
      emit()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length || 1) }, worker))
  emit(true)
  if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
  if (failures.length) {
    const first = failures[0]
    const reason = first.error instanceof Error ? first.error.message : String(first.error)
    const err = new Error(
      `${failures.length} arquivo(s) não puderam ser baixados. Primeiro: ${first.task.label ?? first.task.dest} — ${reason}`,
    )
    ;(err as Error & { failures: typeof failures }).failures = failures
    throw err
  }
}
