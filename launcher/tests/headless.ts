// Instalação + teste de abertura do jogo SEM interface, usado pelo GitHub Actions para garantir
// que o modpack realmente abre antes de chegar aos jogadores. Usa exatamente o mesmo motor do launcher.
//
//   node headless.cjs <pasta> <manifest.json> [--boot]
//
// Com --boot o Minecraft é aberto em modo offline de TESTE (perfil fictício, sem conectar a servidor)
// e o script espera o menu principal carregar. Sai com código 1 se o jogo travar.

import { launch } from '@xmcl/core'
import { createWriteStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { PackManifest, Settings } from '../src/shared/types'
import { validateManifest } from '../src/main/game/pack'
import { ensureJava } from '../src/main/game/java'
import { installVanilla } from '../src/main/game/vanilla'
import { installNeoForge } from '../src/main/game/neoforge'
import { syncPackFiles } from '../src/main/game/mods'
import { buildLaunchOptions } from '../src/main/game/launch'
import { log } from '../src/main/logger'

const [home, manifestPath] = process.argv.slice(2)
const boot = process.argv.includes('--boot')
if (!home || !manifestPath) {
  console.error('uso: headless <pasta> <manifest.json> [--boot]')
  process.exit(2)
}

const settings: Settings = {
  memoryMB: 4096,
  width: 1280,
  height: 720,
  fullscreen: false,
  autoConnect: false,
  afterLaunch: 'keep',
  reduceMotion: true,
  concurrency: 16,
  javaPath: '',
  jvmArgs: '',
  optional: {},
  selectedAccount: null,
}

log.on((lines) => lines.forEach((l) => console.log(`[${l.level}] ${l.text}`)))

async function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackManifest
  validateManifest(manifest)
  const dirs = { game: join(home, 'jogo'), runtime: join(home, 'runtime'), cache: join(home, 'cache') }
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true })
  const signal = new AbortController().signal
  const quiet = () => {}

  console.log(`== ${manifest.pack.name} ${manifest.pack.version}: ${manifest.files.length} arquivos`)
  const java = await ensureJava(manifest, dirs.runtime, dirs.cache, '', quiet, signal)
  console.log(`== Java ${java.version}`)
  await installVanilla(manifest.minecraft, dirs.game, { concurrency: 16, deep: false, signal, onProgress: quiet })
  console.log('== Minecraft instalado')
  await installNeoForge(manifest, dirs.game, dirs.cache, java.console, { signal, onProgress: quiet })
  console.log('== NeoForge instalado')
  await syncPackFiles(manifest, settings, dirs.game, join(dirs.game, '.anatema-instalacao.json'), { deep: true, concurrency: 16, signal, onProgress: quiet })
  console.log('== Mods sincronizados e verificados por hash')
  if (!boot) return

  const out = join(home, 'boot.log')
  const stream = createWriteStream(out)
  const proc = await launch(
    buildLaunchOptions({
      manifest,
      settings,
      gameDir: dirs.game,
      javaPath: java.console,
      profile: { id: '0d4a1d2b3c4e4f5a8b9c0d1e2f3a4b5c', name: 'TesteCI' },
      accessToken: '0',
      userType: 'legacy',
    }),
  )
  let buffer = ''
  // O ModernFix registra "Game took X seconds to start" quando o menu principal aparece.
  const READY = /Game took [\d.]+ seconds to start|Sound engine started/
  const CRASH = /Game crashed|Crash report saved|Exception in thread "main"/
  const result = await new Promise<'ok' | 'crash' | 'timeout' | 'exit'>((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), 15 * 60_000)
    const onData = (d: Buffer) => {
      stream.write(d)
      buffer = (buffer + String(d)).slice(-20000)
      if (CRASH.test(buffer)) {
        clearTimeout(timer)
        resolve('crash')
      } else if (READY.test(buffer)) {
        clearTimeout(timer)
        // Dá alguns segundos para o menu principal terminar de abrir.
        setTimeout(() => resolve('ok'), 15000)
      }
    }
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.on('exit', () => {
      clearTimeout(timer)
      resolve(CRASH.test(buffer) ? 'crash' : READY.test(buffer) ? 'ok' : 'exit')
    })
  })
  if (result === 'ok' && process.env.SCREENSHOT) {
    const { spawnSync } = await import('node:child_process')
    spawnSync('import', ['-window', 'root', process.env.SCREENSHOT])
  }
  proc.kill()
  const crashDir = join(dirs.game, 'crash-reports')
  if (result !== 'ok') {
    console.error(`== FALHOU: ${result}`)
    if (existsSync(crashDir)) {
      for (const f of readdirSync(crashDir)) console.error(readFileSync(join(crashDir, f), 'utf8').split('\n').slice(0, 80).join('\n'))
    }
    process.exit(1)
  }
  console.log('== O jogo abriu até o menu principal com todos os mods. ✔')
}

main()
  .then(() => setTimeout(() => process.exit(0), 300))
  .catch((e) => {
    console.error('== ERRO:', e instanceof Error ? e.stack : e)
    process.exit(1)
  })
