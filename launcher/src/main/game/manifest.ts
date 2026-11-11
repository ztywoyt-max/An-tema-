import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PackManifest } from '../../shared/types'
import { validateManifest } from './pack'

export { validateManifest, clientFiles } from './pack'
import { DISTRIBUTION_URL } from '../config'
import { fetchJson } from '../net/download'
import { log, errorMessage } from '../logger'
import { readJson, writeJsonAtomic } from '../util/fsx'
import { resourcePath } from '../paths'

export interface LoadedManifest {
  manifest: PackManifest
  source: 'remote' | 'cache' | 'bundled'
}

export async function loadManifest(cacheDir: string, preferRemote = true): Promise<LoadedManifest> {
  const cacheFile = join(cacheDir, 'manifest.json')
  if (preferRemote && DISTRIBUTION_URL) {
    try {
      const url = `${DISTRIBUTION_URL}${DISTRIBUTION_URL.includes('?') ? '&' : '?'}t=${Date.now()}`
      const remote = await fetchJson<unknown>(url, { headers: { 'cache-control': 'no-cache' } }, 15000)
      validateManifest(remote)
      await writeJsonAtomic(cacheFile, remote)
      return { manifest: remote, source: 'remote' }
    } catch (e) {
      log.warn(`Não foi possível baixar o manifesto do modpack (${errorMessage(e)}). Usando cópia local.`)
    }
  }
  const cached = await readJson<unknown>(cacheFile)
  if (cached) {
    try {
      validateManifest(cached)
      return { manifest: cached, source: 'cache' }
    } catch {
      /* cache inválido — cai para o embutido */
    }
  }
  const bundled = JSON.parse(await readFile(resourcePath('manifest.json'), 'utf8'))
  validateManifest(bundled)
  return { manifest: bundled, source: 'bundled' }
}
