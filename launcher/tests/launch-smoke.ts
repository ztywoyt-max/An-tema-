// Teste de fumaça (somente desenvolvimento): inicia o Minecraft instalado pelo launcher em modo
// offline, num monitor virtual, para validar classpath, argumentos e carregamento dos mods.
// Nunca é incluído no launcher distribuído.
import { launch } from '@xmcl/core'
import { readFileSync, readdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { buildLaunchOptions } from '../src/main/game/launch'

const home = process.argv[2]
const manifest = JSON.parse(readFileSync(process.argv[3], 'utf8'))
const javaHome = join(home, 'runtime', 'java-21-linux-x64', readdirSync(join(home, 'runtime', 'java-21-linux-x64'))[0])
const out = createWriteStream(join(home, 'smoke.log'))
const opts = buildLaunchOptions({
  manifest,
  settings: { memoryMB: 4096, width: 1280, height: 720, fullscreen: false, autoConnect: false, afterLaunch: 'keep', reduceMotion: false, concurrency: 8, javaPath: '', jvmArgs: '', optional: {}, selectedAccount: null },
  gameDir: join(home, 'jogo'),
  javaPath: join(javaHome, 'bin', 'java'),
  profile: { id: '0d4a1d2b3c4e4f5a8b9c0d1e2f3a4b5c', name: 'Teste' },
  accessToken: '0',
  userType: 'legacy',
})
launch(opts).then((p) => {
  console.log('PID', p.pid)
  p.stdout?.pipe(out)
  p.stderr?.pipe(out)
  p.on('exit', (c) => console.log('EXIT', c))
})
