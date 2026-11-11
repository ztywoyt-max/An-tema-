// Modo desenvolvimento: Vite (interface) + esbuild em watch (processo principal) + Electron.
import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const server = await createServer({ configFile: 'vite.config.ts' })
await server.listen()
const main = spawn(process.execPath, ['scripts/build-main.mjs', '--watch'], { stdio: 'inherit' })
await new Promise((r) => setTimeout(r, 1500))
const electron = spawn(String((await import('electron')).default), ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ANATEMA_DEV_SERVER: 'http://localhost:5173' },
})
electron.on('exit', () => { main.kill(); server.close(); process.exit(0) })
