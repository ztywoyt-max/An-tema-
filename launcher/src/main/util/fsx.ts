import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, writeFile, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Hashes } from '../../shared/types'

/** Grava JSON de forma atômica (arquivo temporário + rename), evitando arquivos corrompidos. */
export async function writeJsonAtomic(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2))
  await rename(tmp, file)
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

export async function fileSize(file: string): Promise<number | null> {
  try {
    return (await stat(file)).size
  } catch {
    return null
  }
}

export type HashAlgorithm = 'sha1' | 'sha256' | 'sha512'

export function hashFile(file: string, algorithm: HashAlgorithm): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash(algorithm)
    createReadStream(file)
      .on('error', reject)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
  })
}

/** Escolhe o hash mais forte disponível para verificar um arquivo. */
export function strongestHash(h: Hashes): { algorithm: HashAlgorithm; value: string } | null {
  if (h.sha512) return { algorithm: 'sha512', value: h.sha512.toLowerCase() }
  if (h.sha256) return { algorithm: 'sha256', value: h.sha256.toLowerCase() }
  if (h.sha1) return { algorithm: 'sha1', value: h.sha1.toLowerCase() }
  return null
}

/**
 * Verifica se um arquivo local corresponde ao esperado.
 * `deep = false` confere só o tamanho (rápido, usado a cada abertura);
 * `deep = true` confere o hash (usado em "Verificar arquivos").
 */
export async function isFileValid(file: string, expected: Hashes & { size?: number }, deep: boolean): Promise<boolean> {
  const size = await fileSize(file)
  if (size === null) return false
  if (expected.size !== undefined && size !== expected.size) return false
  if (!deep && expected.size !== undefined) return true
  const hash = strongestHash(expected)
  if (!hash) return size > 0
  return (await hashFile(file, hash.algorithm)) === hash.value
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
