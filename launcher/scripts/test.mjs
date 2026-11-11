// Empacota os testes (tests/*.test.ts) com esbuild e roda com o executor nativo do Node.
import { build } from 'esbuild'
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const entries = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => `tests/${f}`)
await build({ entryPoints: entries, bundle: true, platform: 'node', format: 'cjs', outdir: 'dist-test', external: ['electron'], logLevel: 'warning' })
const r = spawnSync(process.execPath, ['--test', ...entries.map((e) => e.replace('tests/', 'dist-test/').replace('.ts', '.js'))], { stdio: 'inherit' })
process.exit(r.status ?? 1)
