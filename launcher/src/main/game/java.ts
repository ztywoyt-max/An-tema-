import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { chmod, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { open, openEntryReadStream, walkEntriesGenerator } from '@xmcl/unzip'
import type { PackManifest } from '../../shared/types'
import { downloadMany, type DownloadProgress } from '../net/download'
import { log } from '../logger'
import { platformKey } from './platform'

export interface JavaInfo {
  /** java/javaw para rodar o jogo (sem janela de console no Windows). */
  game: string
  /** java "normal", usado para o instalador do NeoForge. */
  console: string
  version: string
}

export async function javaVersion(executable: string): Promise<string | null> {
  return new Promise((resolveP) => {
    const p = spawn(executable, ['-version'], { windowsHide: true })
    let out = ''
    p.stderr.on('data', (d) => (out += d))
    p.stdout.on('data', (d) => (out += d))
    p.on('error', () => resolveP(null))
    p.on('close', () => {
      const m = /version "([^"]+)"/.exec(out)
      resolveP(m ? m[1] : null)
    })
  })
}

export function majorOf(version: string) {
  const parts = version.split(/[._-]/)
  return parts[0] === '1' ? Number(parts[1]) : Number(parts[0])
}

async function findJavaHome(dir: string, depth = 0): Promise<string | null> {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java'
  if (existsSync(join(dir, 'bin', exe))) return dir
  if (existsSync(join(dir, 'Contents', 'Home', 'bin', exe))) return join(dir, 'Contents', 'Home')
  if (depth > 2) return null
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory()) {
      const found = await findJavaHome(join(dir, e.name), depth + 1)
      if (found) return found
    }
  }
  return null
}

function executablesFor(home: string): Pick<JavaInfo, 'game' | 'console'> {
  if (process.platform === 'win32') return { game: join(home, 'bin', 'javaw.exe'), console: join(home, 'bin', 'java.exe') }
  return { game: join(home, 'bin', 'java'), console: join(home, 'bin', 'java') }
}

async function extractZip(file: string, dest: string) {
  const zip = await open(file, { lazyEntries: true, autoClose: false })
  const root = resolve(dest) + sep
  try {
    for await (const entry of walkEntriesGenerator(zip)) {
      const target = resolve(dest, entry.fileName)
      if (!target.startsWith(root)) throw new Error(`Entrada suspeita no zip: ${entry.fileName}`)
      if (entry.fileName.endsWith('/')) {
        await mkdir(target, { recursive: true })
        continue
      }
      await mkdir(dirname(target), { recursive: true })
      await pipeline(await openEntryReadStream(zip, entry), createWriteStream(target))
      const mode = (entry.externalFileAttributes >>> 16) & 0o777
      if (mode && process.platform !== 'win32') await chmod(target, mode)
    }
  } finally {
    zip.close()
  }
}

async function extractTarGz(file: string, dest: string) {
  await mkdir(dest, { recursive: true })
  await new Promise<void>((res, rej) => {
    const p = spawn('tar', ['-xzf', file, '-C', dest])
    p.on('error', rej)
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`tar terminou com código ${c}`))))
  })
}

/**
 * Garante o Java exigido pelo modpack. Usa o caminho personalizado do jogador se ele
 * tiver configurado um; senão baixa e mantém um Java próprio na pasta do launcher.
 */
export async function ensureJava(
  manifest: PackManifest,
  runtimeDir: string,
  cacheDir: string,
  customPath: string,
  onProgress: (p: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<JavaInfo> {
  const major = manifest.java.major
  if (customPath) {
    const v = await javaVersion(customPath)
    if (v && majorOf(v) === major) {
      log.info(`Usando Java personalizado ${v}: ${customPath}`)
      return { game: customPath, console: customPath.replace(/javaw\.exe$/i, 'java.exe'), version: v }
    }
    log.warn(`Java personalizado inválido ou não é Java ${major} (${v ?? 'não executou'}). Usando o Java do launcher.`)
  }

  const key = platformKey()
  const dir = join(runtimeDir, `java-${major}-${key}`)
  const existingHome = existsSync(dir) ? await findJavaHome(dir) : null
  if (existingHome) {
    const exes = executablesFor(existingHome)
    const v = await javaVersion(exes.console)
    if (v && majorOf(v) === major) return { ...exes, version: v }
    log.warn('Java do launcher corrompido; reinstalando.')
  }

  const pkg = manifest.java.platforms[key]
  if (!pkg) throw new Error(`Não há Java ${major} configurado para ${key}.`)
  const isZip = pkg.url.toLowerCase().endsWith('.zip')
  const archive = join(cacheDir, `java-${major}-${key}${isZip ? '.zip' : '.tar.gz'}`)
  log.info(`Baixando Java ${major} (${key})…`)
  await downloadMany([{ ...pkg, dest: archive, label: `Java ${major}` }], { onProgress, signal })

  const tmp = `${dir}.extraindo`
  await rm(tmp, { recursive: true, force: true })
  await rm(dir, { recursive: true, force: true })
  log.info('Extraindo Java…')
  if (isZip) await extractZip(archive, tmp)
  else await extractTarGz(archive, tmp)
  await rename(tmp, dir)
  await rm(archive, { force: true })

  const home = await findJavaHome(dir)
  if (!home) throw new Error('O pacote do Java não contém bin/java.')
  const exes = executablesFor(home)
  const v = await javaVersion(exes.console)
  if (!v) throw new Error('O Java instalado não executou. Verifique o antivírus.')
  log.info(`Java ${v} pronto.`)
  return { ...exes, version: v }
}
