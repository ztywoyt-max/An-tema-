// Instalação do NeoForge com o instalador oficial (modo sem janela), como o próprio
// NeoForge recomenda. O instalador baixa as bibliotecas e gera o cliente modificado.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PackManifest } from '../../shared/types'
import { downloadMany, type DownloadProgress } from '../net/download'
import { log } from '../logger'
import { readJson, writeJsonAtomic } from '../util/fsx'
import { libraryTasks, type VersionJson } from './vanilla'

export function neoforgeVersionId(m: PackManifest) {
  return `neoforge-${m.loader.version}`
}

function markerPath(root: string, m: PackManifest) {
  return join(root, 'versions', neoforgeVersionId(m), '.anatema-ok.json')
}

/** Confere se o NeoForge está instalado e com todas as bibliotecas presentes. */
export async function neoforgeReady(root: string, m: PackManifest): Promise<boolean> {
  const id = neoforgeVersionId(m)
  const json = await readJson<VersionJson>(join(root, 'versions', id, `${id}.json`))
  const marker = await readJson<{ installer: string }>(markerPath(root, m))
  if (!json || !marker || marker.installer !== m.loader.installer.url) return false
  for (const t of libraryTasks(json, join(root, 'libraries'))) if (!existsSync(t.dest)) return false
  return true
}

function runInstaller(java: string, installer: string, root: string, flag: string, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(java, ['-jar', installer, flag, root], { cwd: root, windowsHide: true, signal })
    const pipe = (level: 'info' | 'warn') => (d: Buffer) => {
      for (const line of String(d).split(/\r?\n/)) if (line.trim()) log.log(level, 'launcher', `[NeoForge] ${line}`)
    }
    p.stdout.on('data', pipe('info'))
    p.stderr.on('data', pipe('warn'))
    p.on('error', reject)
    p.on('close', (code) => resolve(code ?? 1))
  })
}

export async function installNeoForge(
  m: PackManifest,
  root: string,
  cacheDir: string,
  javaConsole: string,
  opts: { signal: AbortSignal; onProgress: (p: DownloadProgress) => void; force?: boolean },
) {
  if (!opts.force && (await neoforgeReady(root, m))) return
  const installer = join(cacheDir, `neoforge-${m.loader.version}-installer.jar`)
  await downloadMany([{ ...m.loader.installer, dest: installer, label: `Instalador NeoForge ${m.loader.version}` }], {
    signal: opts.signal,
    onProgress: opts.onProgress,
  })

  // O instalador exige um launcher_profiles.json na pasta de destino.
  const profiles = join(root, 'launcher_profiles.json')
  if (!existsSync(profiles)) await writeFile(profiles, JSON.stringify({ profiles: {}, version: 3 }, null, 2))

  log.info(`Instalando NeoForge ${m.loader.version} (isso pode levar alguns minutos na primeira vez)…`)
  // Versões atuais usam --install-client; versões antigas do instalador usavam --installClient.
  let code = await runInstaller(javaConsole, installer, root, '--install-client', opts.signal)
  if (code !== 0 && !opts.signal.aborted) {
    log.warn('Tentando o modo de instalação alternativo do NeoForge…')
    code = await runInstaller(javaConsole, installer, root, '--installClient', opts.signal)
  }
  if (opts.signal.aborted) throw new DOMException('Cancelado', 'AbortError')
  if (code !== 0) throw new Error(`O instalador do NeoForge falhou (código ${code}). Veja a aba Registros.`)

  const id = neoforgeVersionId(m)
  if (!existsSync(join(root, 'versions', id, `${id}.json`))) {
    throw new Error('O NeoForge terminou, mas o perfil de versão não foi criado.')
  }
  await writeJsonAtomic(markerPath(root, m), { installer: m.loader.installer.url, at: new Date().toISOString() })
  log.info(`NeoForge ${m.loader.version} instalado.`)
}
