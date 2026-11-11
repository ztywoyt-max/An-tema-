// Sincroniza mods, pacotes de recursos, shaders e configurações com o manifesto.
// Garante que todos os jogadores tenham exatamente os mesmos arquivos do servidor.

import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FileStatus, PackFile, PackManifest, Settings } from '../../shared/types'
import { downloadMany, type DownloadProgress, type DownloadTask } from '../net/download'
import { isFileValid, readJson, writeJsonAtomic } from '../util/fsx'
import { log } from '../logger'
import { clientFiles } from './pack'

/** Pastas cujo conteúdo é controlado pelo launcher (arquivos estranhos são retirados). */
const MANAGED_DIRS = ['mods']
const QUARANTINE = 'mods_retirados'

interface InstalledState {
  files: Record<string, { id: string; sha?: string }>
}

const shaOf = (f: PackFile) => f.sha512 ?? f.sha256 ?? f.sha1

export async function packFileStatus(m: PackManifest, settings: Settings, gameDir: string, deep = false) {
  const { wanted, disabled } = clientFiles(m, settings)
  const files: Record<string, FileStatus> = {}
  let pendingBytes = 0
  let pendingCount = 0
  await Promise.all(
    wanted.map(async (f) => {
      const dest = join(gameDir, f.path)
      if (f.overwrite === 'once' && existsSync(dest)) {
        files[f.id] = 'ok'
        return
      }
      const ok = await isFileValid(dest, f, deep)
      if (ok) files[f.id] = 'ok'
      else {
        files[f.id] = existsSync(dest) ? 'outdated' : 'missing'
        pendingBytes += f.size ?? 0
        pendingCount++
      }
    }),
  )
  for (const f of disabled) files[f.id] = 'disabled'
  return { files, pendingBytes, pendingCount }
}

export async function syncPackFiles(
  m: PackManifest,
  settings: Settings,
  gameDir: string,
  stateFile: string,
  opts: { deep: boolean; concurrency: number; signal: AbortSignal; onProgress: (p: DownloadProgress) => void },
) {
  const { wanted, disabled } = clientFiles(m, settings)
  const previous = (await readJson<InstalledState>(stateFile)) ?? { files: {} }

  // 1) Baixa/atualiza o que falta.
  const tasks: DownloadTask[] = []
  for (const f of wanted) {
    const dest = join(gameDir, f.path)
    if (f.overwrite === 'once' && existsSync(dest)) continue
    tasks.push({ url: f.url, sha1: f.sha1, sha256: f.sha256, sha512: f.sha512, size: f.size, dest, label: f.name })
  }
  await downloadMany(tasks, {
    concurrency: opts.concurrency,
    deep: opts.deep,
    signal: opts.signal,
    onProgress: opts.onProgress,
    onFileDone: (t, downloaded) => downloaded && log.info(`Baixado: ${t.label}`),
  })

  // 2) Remove arquivos que o launcher instalou antes e que saíram do manifesto (ou foram desligados).
  const wantedPaths = new Set(wanted.map((f) => f.path))
  for (const [path] of Object.entries(previous.files)) {
    if (!wantedPaths.has(path)) {
      await rm(join(gameDir, path), { force: true })
      log.info(`Removido (fora do modpack): ${path}`)
    }
  }
  for (const f of disabled) {
    if (existsSync(join(gameDir, f.path))) {
      await rm(join(gameDir, f.path), { force: true })
      log.info(`Desativado: ${f.name}`)
    }
  }

  // 3) Mods que não fazem parte do modpack vão para uma pasta separada — o servidor recusaria a conexão.
  for (const dir of MANAGED_DIRS) {
    const abs = join(gameDir, dir)
    if (!existsSync(abs)) continue
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const rel = `${dir}/${entry.name}`
      if (wantedPaths.has(rel)) continue
      const target = join(gameDir, QUARANTINE, entry.name)
      await mkdir(dirname(target), { recursive: true })
      await rename(join(abs, entry.name), target).catch(() => rm(join(abs, entry.name), { force: true }))
      log.warn(`Mod fora do modpack movido para ${QUARANTINE}/: ${entry.name}`)
    }
  }

  await ensureDefaultOptions(gameDir)

  const state: InstalledState = { files: {} }
  for (const f of wanted) state.files[f.path] = { id: f.id, sha: shaOf(f) }
  await writeJsonAtomic(stateFile, state)
}

/**
 * Opções iniciais do jogo na primeira instalação: português, sem a tela de boas-vindas de
 * acessibilidade e com valores equilibrados para o modpack. Nunca sobrescreve as escolhas do jogador.
 */
export async function ensureDefaultOptions(gameDir: string) {
  const file = join(gameDir, 'options.txt')
  if (existsSync(file)) return
  const defaults = [
    'version:3955',
    'lang:pt_br',
    'onboardAccessibility:false',
    'narrator:0',
    'renderDistance:10',
    'simulationDistance:8',
    'guiScale:3',
    'maxFps:120',
    'enableVsync:false',
    'tutorialStep:none',
    'joinedFirstServer:true',
    'skipMultiplayerWarning:true',
    'soundCategory_music:0.35',
  ]
  await mkdir(gameDir, { recursive: true })
  await writeFile(file, defaults.join('\n') + '\n')
  log.info('Opções iniciais do jogo criadas (português, sem tela de acessibilidade).')
}

export async function totalPackSize(m: PackManifest) {
  return m.files.reduce((a, f) => a + (f.size ?? 0), 0)
}


