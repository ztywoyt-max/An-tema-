// Integração com o Minecraft Launcher oficial: o ANÁTEMA instala NeoForge e mods, cria o perfil
// "ANÁTEMA" no launcher oficial e o abre. O jogador entra com a própria conta Microsoft lá —
// nenhuma configuração de login é necessária no ANÁTEMA.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readJson, writeJsonAtomic } from '../util/fsx'

export const PROFILE_ID = 'anatema'
const STORE_APP = 'shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft'

/** Pasta .minecraft usada pelo launcher oficial. */
export function officialMinecraftDir(): string {
  if (process.env.ANATEMA_MC_DIR) return process.env.ANATEMA_MC_DIR
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), '.minecraft')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'minecraft')
  return join(homedir(), '.minecraft')
}

export interface OfficialLauncher {
  kind: 'exe' | 'store'
  path: string
}

function exeCandidates(): string[] {
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  return [
    'C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft.exe',
    join(pf86, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    join(pf, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    join(local, 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
  ]
}

/** Procura o Minecraft Launcher instalado (versão clássica, Xbox app ou Microsoft Store). */
export async function findOfficialLauncher(): Promise<OfficialLauncher | null> {
  if (process.platform !== 'win32') return null
  for (const p of exeCandidates()) if (existsSync(p)) return { kind: 'exe', path: p }
  // Versão da Microsoft Store: pergunta ao Windows se o pacote está instalado.
  const installed = await new Promise<boolean>((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', 'if (Get-AppxPackage -Name Microsoft.4297127D64EC6) { "sim" }'], { windowsHide: true })
    let out = ''
    ps.stdout.on('data', (d) => (out += d))
    ps.on('error', () => resolve(false))
    ps.on('close', () => resolve(out.includes('sim')))
    setTimeout(() => {
      ps.kill()
      resolve(false)
    }, 6000)
  })
  return installed ? { kind: 'store', path: STORE_APP } : null
}

export function openOfficialLauncher(l: OfficialLauncher) {
  const child =
    l.kind === 'exe'
      ? spawn(l.path, [], { detached: true, stdio: 'ignore', cwd: dirname(l.path) })
      : spawn('explorer.exe', [l.path], { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

interface LauncherProfiles {
  profiles: Record<string, Record<string, unknown>>
  settings?: Record<string, unknown>
  version?: number
  [k: string]: unknown
}

export interface ProfileOptions {
  versionId: string
  gameDir: string
  memoryMB: number
  jvmArgs: string[]
  width: number
  height: number
  iconDataUri?: string
}

/**
 * Cria/atualiza o perfil "ANÁTEMA" no launcher_profiles.json do launcher oficial, sem tocar nos
 * perfis do jogador. Remove o perfil genérico "NeoForge" que o instalador cria, para não confundir.
 */
export async function writeOfficialProfile(mcDir: string, o: ProfileOptions) {
  const file = join(mcDir, 'launcher_profiles.json')
  const data = (await readJson<LauncherProfiles>(file)) ?? { profiles: {}, settings: {}, version: 3 }
  data.profiles ??= {}
  for (const [key, p] of Object.entries(data.profiles)) {
    if (key !== PROFILE_ID && p.lastVersionId === o.versionId && /neoforge/i.test(String(p.name ?? key))) delete data.profiles[key]
  }
  const now = new Date().toISOString()
  const previous = data.profiles[PROFILE_ID] ?? {}
  data.profiles[PROFILE_ID] = {
    ...previous,
    name: 'ANÁTEMA',
    type: 'custom',
    created: previous.created ?? now,
    lastUsed: now,
    lastVersionId: o.versionId,
    gameDir: o.gameDir,
    javaArgs: [`-Xmx${o.memoryMB}M`, `-Xms${Math.min(2048, o.memoryMB)}M`, ...o.jvmArgs].join(' '),
    resolution: { width: o.width, height: o.height },
    ...(o.iconDataUri ? { icon: o.iconDataUri } : {}),
  }
  await writeJsonAtomic(file, data)
}

/* ───────────── servers.dat (lista de servidores do jogo, formato NBT) ───────────── */

function nbtString(s: string) {
  const b = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(2)
  len.writeUInt16BE(b.length)
  return Buffer.concat([len, b])
}

/** Gera um servers.dat com o servidor do ANÁTEMA (NBT sem compressão, como o jogo grava). */
export function serversDat(name: string, ip: string): Buffer {
  const TAG_END = 0
  const TAG_BYTE = 1
  const TAG_STRING = 8
  const TAG_LIST = 9
  const TAG_COMPOUND = 10
  const named = (type: number, key: string, payload: Buffer) => Buffer.concat([Buffer.from([type]), nbtString(key), payload])
  const entry = Buffer.concat([
    named(TAG_STRING, 'name', nbtString(name)),
    named(TAG_STRING, 'ip', nbtString(ip)),
    named(TAG_BYTE, 'acceptTextures', Buffer.from([1])),
    Buffer.from([TAG_END]),
  ])
  const count = Buffer.alloc(4)
  count.writeInt32BE(1)
  const list = Buffer.concat([Buffer.from([TAG_COMPOUND]), count, entry])
  return Buffer.concat([Buffer.from([TAG_COMPOUND]), nbtString(''), named(TAG_LIST, 'servers', list), Buffer.from([TAG_END])])
}

/** Coloca o servidor na lista de Multijogador, sem apagar a lista se o jogador já tiver uma. */
export async function ensureServerListed(gameDir: string, name: string, ip: string) {
  const file = join(gameDir, 'servers.dat')
  if (existsSync(file)) {
    const current = await readFile(file).catch(() => Buffer.alloc(0))
    if (current.includes(Buffer.from(ip, 'utf8'))) return
    if (current.length > 0) return // lista do jogador: não mexemos
  }
  await mkdir(gameDir, { recursive: true })
  await writeFile(file, serversDat(name, ip))
}
