// Orquestra o botão JOGAR: conta → manifesto → Java → Minecraft → NeoForge → mods → iniciar.

import { launch } from '@xmcl/core'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { platformKey } from './platform'
import { join } from 'node:path'
import type { GameState, PackStatus, Phase } from '../../shared/types'
import type { AccountStore } from '../auth/accounts'
import type { SettingsStore } from '../settings'
import type { DownloadProgress } from '../net/download'
import { log, errorMessage } from '../logger'
import type { Paths } from '../paths'
import { formatBytes } from '../util/fsx'
import { ensureJava, javaVersion, majorOf } from './java'
import { loadManifest, type LoadedManifest } from './manifest'
import { installNeoForge, neoforgeReady } from './neoforge'
import { buildLaunchOptions } from './launch'
import { installVanilla, vanillaInstalled } from './vanilla'
import { packFileStatus, syncPackFiles } from './mods'
import { AuthError } from '../auth/microsoft'

/** Peso de cada etapa na barra de progresso geral. */
const WEIGHTS: Partial<Record<Phase, [number, number]>> = {
  auth: [0, 0.03],
  manifest: [0.03, 0.05],
  java: [0.05, 0.2],
  minecraft: [0.2, 0.55],
  loader: [0.55, 0.7],
  mods: [0.7, 0.97],
  launching: [0.97, 1],
}

export interface GameHooks {
  onState(s: GameState): void
  onPackStatus(s: PackStatus): void
  onGameStarted(): void
  onGameExited(code: number | null): void
}

export class GameService {
  private state: GameState = { phase: 'idle', label: 'Pronto' }
  private abort: AbortController | null = null
  private proc: ChildProcess | null = null
  private loaded: LoadedManifest | null = null

  constructor(
    private p: Paths,
    private settings: SettingsStore,
    private accounts: AccountStore,
    private hooks: GameHooks,
  ) {}

  getState() {
    return this.state
  }

  private set(phase: Phase, label: string, extra: Partial<GameState> = {}) {
    this.state = { phase, label, startedAt: this.state.startedAt, ...extra }
    this.hooks.onState(this.state)
  }

  private stageProgress(phase: Phase, label: string) {
    const [a, b] = WEIGHTS[phase] ?? [0, 1]
    return (p: DownloadProgress, stage?: string) => {
      const frac = p.totalBytes > 0 ? p.doneBytes / p.totalBytes : p.totalFiles > 0 ? p.doneFiles / p.totalFiles : 0
      this.set(phase, stage ? `${label} · ${stage}` : label, {
        progress: a + (b - a) * Math.min(1, frac),
        detail:
          p.totalBytes > 0
            ? `${formatBytes(p.doneBytes)} de ${formatBytes(p.totalBytes)} · ${p.doneFiles}/${p.totalFiles} arquivos`
            : `${p.doneFiles}/${p.totalFiles} arquivos`,
        bytesPerSecond: p.bytesPerSecond,
      })
    }
  }

  async manifest(refresh = false) {
    if (!this.loaded || refresh) this.loaded = await loadManifest(this.p.cache, true)
    return this.loaded
  }

  async packStatus(refresh = false, deep = false): Promise<PackStatus> {
    const { manifest, source } = await this.manifest(refresh)
    const st = await packFileStatus(manifest, this.settings.get(), this.p.game, deep)
    const status: PackStatus = {
      manifest,
      source,
      ...st,
      installed: {
        java: false,
        minecraft: vanillaInstalled(this.p.game, manifest.minecraft),
        loader: await neoforgeReady(this.p.game, manifest),
      },
      checkedAt: Date.now(),
    }
    const customJava = this.settings.get().javaPath
    if (customJava) status.installed.java = !!(await javaVersion(customJava))
    else status.installed.java = existsSync(join(this.p.runtime, `java-${manifest.java.major}-${platformKey()}`))
    return status
  }

  isBusy() {
    return !['idle', 'error'].includes(this.state.phase)
  }

  cancel() {
    this.abort?.abort()
  }

  kill() {
    this.proc?.kill()
  }

  /** Executa a instalação/verificação. `deep` confere o hash de todos os arquivos. */
  async prepare(deep: boolean) {
    if (this.isBusy()) throw new Error('Já existe uma operação em andamento.')
    this.abort = new AbortController()
    const signal = this.abort.signal
    this.state = { phase: 'manifest', label: 'Consultando o modpack', startedAt: Date.now() }
    this.hooks.onState(this.state)
    const s = this.settings.get()
    const { manifest } = await this.manifest(true)
    log.info(`Modpack ${manifest.pack.name} ${manifest.pack.version} · Minecraft ${manifest.minecraft} · NeoForge ${manifest.loader.version}`)

    this.set('java', `Preparando Java ${manifest.java.major}`, { progress: WEIGHTS.java![0] })
    const java = await ensureJava(manifest, this.p.runtime, this.p.cache, s.javaPath, this.stageProgress('java', 'Baixando Java'), signal)
    if (majorOf(java.version) !== manifest.java.major) throw new Error(`Java ${manifest.java.major} é necessário.`)

    this.set('minecraft', `Verificando Minecraft ${manifest.minecraft}`, { progress: WEIGHTS.minecraft![0] })
    const mcProgress = this.stageProgress('minecraft', `Minecraft ${manifest.minecraft}`)
    await installVanilla(manifest.minecraft, this.p.game, { concurrency: s.concurrency, deep, signal, onProgress: mcProgress })

    this.set('loader', `Verificando NeoForge ${manifest.loader.version}`, { progress: WEIGHTS.loader![0] })
    await installNeoForge(manifest, this.p.game, this.p.cache, java.console, {
      signal,
      force: false,
      onProgress: this.stageProgress('loader', 'Baixando NeoForge'),
    })

    this.set('mods', 'Sincronizando mods', { progress: WEIGHTS.mods![0] })
    await syncPackFiles(manifest, s, this.p.game, this.p.installedState, {
      deep,
      concurrency: s.concurrency,
      signal,
      onProgress: this.stageProgress('mods', 'Mods e recursos'),
    })
    this.hooks.onPackStatus(await this.packStatus(false))
    return { manifest, java }
  }

  async repair() {
    try {
      await this.prepare(true)
      this.set('idle', 'Arquivos verificados', { progress: undefined })
      log.info('Verificação completa: todos os arquivos conferem.')
    } catch (e) {
      this.fail(e)
    }
  }

  async reset() {
    if (this.isBusy()) throw new Error('Feche o jogo antes de reinstalar.')
    log.warn('Reinstalação completa solicitada: removendo bibliotecas, versões e mods.')
    for (const dir of ['versions', 'libraries', 'mods', 'mods_retirados']) {
      await rm(join(this.p.game, dir), { recursive: true, force: true })
    }
    await rm(this.p.installedState, { force: true })
    await rm(this.p.runtime, { recursive: true, force: true })
    this.hooks.onPackStatus(await this.packStatus(false))
  }

  async play() {
    try {
      const settings = this.settings.get()
      if (!settings.selectedAccount) throw new AuthError('Entre com sua conta Microsoft para jogar.')
      this.set('auth', 'Validando sua conta', { progress: 0.01 })
      const { account, accessToken } = await this.accounts.session(settings.selectedAccount)
      log.info(`Conta: ${account.name}`)

      // prepare() define o estado inicial, então liberamos o estado "auth".
      this.state = { phase: 'idle', label: '' }
      const { manifest, java } = await this.prepare(false)

      this.set('launching', 'Iniciando o jogo', { progress: 0.98 })
      const proc = await launch(
        buildLaunchOptions({
          manifest,
          settings,
          gameDir: this.p.game,
          javaPath: java.game,
          profile: { id: account.uuid, name: account.name },
          accessToken,
        }),
      )
      this.proc = proc
      log.info(`Minecraft iniciado (PID ${proc.pid}).`)
      proc.stdout?.on('data', (d) => log.game(String(d)))
      proc.stderr?.on('data', (d) => log.game(String(d), true))
      this.set('running', 'Em jogo', { progress: undefined, startedAt: Date.now() })
      this.hooks.onGameStarted()
      proc.on('exit', (code) => {
        this.proc = null
        if (code && code !== 0) {
          log.error(`O jogo fechou com erro (código ${code}).`)
          this.set('error', 'O jogo fechou inesperadamente', {
            error: {
              message: `O Minecraft fechou com o código ${code}.`,
              hint: 'Veja a aba Registros ou a pasta crash-reports para os detalhes.',
            },
          })
        } else {
          log.info('Jogo encerrado.')
          this.set('idle', 'Pronto')
        }
        this.hooks.onGameExited(code)
      })
    } catch (e) {
      this.fail(e)
    }
  }

  private fail(e: unknown) {
    if ((e as Error)?.name === 'AbortError' || this.abort?.signal.aborted) {
      log.warn('Operação cancelada.')
      this.set('idle', 'Cancelado')
      return
    }
    const message = errorMessage(e)
    const hint = e instanceof AuthError ? e.hint : hintFor(message)
    log.error(message + (hint ? ` — ${hint}` : ''))
    this.set('error', 'Algo deu errado', { error: { message, hint } })
  }
}

function hintFor(message: string): string | undefined {
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed|network|Tempo/i.test(message)) return 'Verifique sua conexão com a internet e tente novamente.'
  if (/EPERM|EACCES|EBUSY/i.test(message)) return 'Algum arquivo está bloqueado. Feche o jogo e verifique o antivírus.'
  if (/ENOSPC/i.test(message)) return 'Sem espaço em disco.'
  if (/hash|tamanho inesperado/i.test(message)) return 'Um download veio corrompido. Tente "Verificar arquivos" em Modpack.'
  return undefined
}
