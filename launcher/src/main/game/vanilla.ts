// Instalação do Minecraft "puro" direto dos servidores oficiais da Mojang:
// version.json, client.jar, bibliotecas, configuração de log e assets (sons, idiomas, texturas).

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { downloadMany, fetchJson, type DownloadProgress, type DownloadTask } from '../net/download'
import { isFileValid, readJson } from '../util/fsx'
import { log } from '../logger'
import { mojangOs } from './platform'

const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCES = 'https://resources.download.minecraft.net'
const LIBRARIES = 'https://libraries.minecraft.net/'

interface Rule {
  action: 'allow' | 'disallow'
  os?: { name?: string; arch?: string }
  features?: Record<string, boolean>
}

interface Artifact {
  path: string
  url: string
  sha1: string
  size: number
}

export interface VersionJson {
  id: string
  inheritsFrom?: string
  downloads?: { client?: { url: string; sha1: string; size: number } }
  libraries: {
    name: string
    url?: string
    downloads?: { artifact?: Artifact; classifiers?: Record<string, Artifact> }
    natives?: Record<string, string>
    rules?: Rule[]
  }[]
  assetIndex?: { id: string; url: string; sha1: string; size: number; totalSize: number }
  logging?: { client?: { file: { id: string; url: string; sha1: string; size: number } } }
  javaVersion?: { majorVersion: number }
}

export function rulesAllow(rules: Rule[] | undefined): boolean {
  if (!rules?.length) return true
  let allowed = false
  const os = mojangOs()
  const arch = process.arch === 'ia32' ? 'x86' : process.arch
  for (const r of rules) {
    if (r.features) continue // recursos opcionais (demo, resolução) não afetam arquivos
    let matches = true
    if (r.os?.name && r.os.name !== os) matches = false
    if (r.os?.arch && r.os.arch !== arch) matches = false
    if (matches) allowed = r.action === 'allow'
  }
  return allowed
}

/** Converte "grupo:artefato:versão[:classificador]" em caminho Maven. */
export function mavenPath(name: string): string {
  const [coords, ext = 'jar'] = name.split('@')
  const [group, artifact, version, classifier] = coords.split(':')
  const file = `${artifact}-${version}${classifier ? `-${classifier}` : ''}.${ext}`
  return [...group.split('.'), artifact, version, file].join('/')
}

/** Lista as bibliotecas necessárias deste version.json para o SO atual. */
export function libraryTasks(v: VersionJson, librariesDir: string): DownloadTask[] {
  const tasks: DownloadTask[] = []
  const os = mojangOs()
  const arch = process.arch === 'x64' ? '64' : '32'
  for (const lib of v.libraries) {
    if (!rulesAllow(lib.rules)) continue
    const a = lib.downloads?.artifact
    if (a?.url) {
      tasks.push({ url: a.url, sha1: a.sha1, size: a.size, dest: join(librariesDir, a.path), label: lib.name })
    } else if (!lib.downloads && lib.name) {
      // Formato antigo (sem "downloads"): baixa do repositório indicado ou do oficial.
      const path = mavenPath(lib.name)
      tasks.push({ url: (lib.url ?? LIBRARIES) + path, dest: join(librariesDir, path), label: lib.name })
    }
    const nativeKey = lib.natives?.[os]?.replace('${arch}', arch)
    const native = nativeKey ? lib.downloads?.classifiers?.[nativeKey] : undefined
    if (native) tasks.push({ url: native.url, sha1: native.sha1, size: native.size, dest: join(librariesDir, native.path), label: `${lib.name} (nativo)` })
  }
  // Remove duplicatas pelo destino
  return [...new Map(tasks.map((t) => [t.dest, t])).values()]
}

export async function installVanilla(
  version: string,
  root: string,
  opts: { concurrency: number; deep: boolean; signal: AbortSignal; onProgress: (p: DownloadProgress, stage: string) => void },
): Promise<VersionJson> {
  const versionDir = join(root, 'versions', version)
  const jsonPath = join(versionDir, `${version}.json`)

  // 1) version.json (só consulta a Mojang se não existir ou estiver corrompido)
  let json = await readJson<VersionJson>(jsonPath)
  if (!json || opts.deep) {
    const list = await fetchJson<{ versions: { id: string; url: string; sha1: string }[] }>(VERSION_MANIFEST)
    const entry = list.versions.find((x) => x.id === version)
    if (!entry) throw new Error(`Versão ${version} não encontrada na Mojang.`)
    if (!json || !(await isFileValid(jsonPath, { sha1: entry.sha1 }, true))) {
      await downloadMany([{ url: entry.url, sha1: entry.sha1, dest: jsonPath, label: `${version}.json` }], { signal: opts.signal })
      json = (await readJson<VersionJson>(jsonPath))!
    }
  }
  if (!json) throw new Error('Falha ao ler o version.json.')

  const tasks: DownloadTask[] = []
  if (json.downloads?.client) {
    const c = json.downloads.client
    tasks.push({ url: c.url, sha1: c.sha1, size: c.size, dest: join(versionDir, `${version}.jar`), label: `Minecraft ${version}` })
  }
  tasks.push(...libraryTasks(json, join(root, 'libraries')))
  const logCfg = json.logging?.client?.file
  if (logCfg) tasks.push({ url: logCfg.url, sha1: logCfg.sha1, size: logCfg.size, dest: join(root, 'assets', 'log_configs', logCfg.id), label: 'log config' })

  log.info(`Verificando Minecraft ${version}: ${tasks.length} arquivos base.`)
  await downloadMany(tasks, {
    concurrency: opts.concurrency,
    deep: opts.deep,
    signal: opts.signal,
    onProgress: (p) => opts.onProgress(p, 'Minecraft'),
  })

  // 2) Assets
  if (json.assetIndex) {
    const ai = json.assetIndex
    const indexPath = join(root, 'assets', 'indexes', `${ai.id}.json`)
    await downloadMany([{ url: ai.url, sha1: ai.sha1, size: ai.size, dest: indexPath, label: 'índice de assets' }], {
      signal: opts.signal,
      deep: opts.deep,
    })
    const index = (await readJson<{ objects: Record<string, { hash: string; size: number }> }>(indexPath))!
    const seen = new Set<string>()
    const assets: DownloadTask[] = []
    for (const [name, o] of Object.entries(index.objects)) {
      if (seen.has(o.hash)) continue
      seen.add(o.hash)
      const sub = `${o.hash.slice(0, 2)}/${o.hash}`
      assets.push({ url: `${RESOURCES}/${sub}`, sha1: o.hash, size: o.size, dest: join(root, 'assets', 'objects', sub), label: name })
    }
    log.info(`Verificando ${assets.length} assets do jogo.`)
    await downloadMany(assets, {
      concurrency: Math.max(opts.concurrency, 16),
      deep: opts.deep,
      signal: opts.signal,
      onProgress: (p) => opts.onProgress(p, 'Recursos do jogo'),
    })
  }
  return json
}

export function vanillaInstalled(root: string, version: string) {
  return existsSync(join(root, 'versions', version, `${version}.jar`))
}
