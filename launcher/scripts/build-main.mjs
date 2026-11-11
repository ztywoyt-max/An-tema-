// Compila o processo principal e o preload do Electron com esbuild.
import { build, context } from 'esbuild'
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../launcher.config.json', import.meta.url), 'utf8'))
const DIST_URL = process.env.ANATEMA_DIST_URL || cfg.distributionUrl || ''
const MS_CLIENT_ID = process.env.ANATEMA_MS_CLIENT_ID || cfg.microsoftClientId || ''

const watch = process.argv.includes('--watch')
const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
  logLevel: 'info',
  define: {
    'process.env.ANATEMA_DIST_URL': JSON.stringify(DIST_URL),
    'process.env.ANATEMA_MS_CLIENT_ID': JSON.stringify(MS_CLIENT_ID),
  },
}
const targets = [
  { ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.js' },
  { ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.js' },
]
if (watch) {
  for (const t of targets) await (await context(t)).watch()
} else {
  await Promise.all(targets.map((t) => build(t)))
}
