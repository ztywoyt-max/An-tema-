// Regras puras do manifesto (sem Electron), usadas pelo launcher e pelos testes automáticos.
import type { PackFile, PackManifest, Settings } from '../../shared/types'

/** Validação mínima para não aceitar um manifesto corrompido ou de outro formato. */
export function validateManifest(m: unknown): asserts m is PackManifest {
  const x = m as PackManifest
  if (!x || x.schema !== 1) throw new Error('Manifesto em formato desconhecido.')
  if (!x.minecraft || !x.loader?.version || !x.loader.installer?.url) throw new Error('Manifesto sem versão do jogo/NeoForge.')
  if (!Array.isArray(x.files)) throw new Error('Manifesto sem lista de arquivos.')
  const seen = new Set<string>()
  for (const f of x.files) {
    if (!f.path || !f.url || !f.id) throw new Error(`Entrada inválida no manifesto: ${JSON.stringify(f).slice(0, 120)}`)
    // Impede caminhos que escapem da pasta do jogo.
    if (f.path.includes('..') || f.path.startsWith('/') || /^[a-z]:/i.test(f.path)) throw new Error(`Caminho proibido: ${f.path}`)
    if (seen.has(f.path)) throw new Error(`Arquivo duplicado no manifesto: ${f.path}`)
    seen.add(f.path)
  }
}

/** Arquivos que este cliente deve ter, respeitando os opcionais ligados/desligados. */
export function clientFiles(m: PackManifest, settings: Settings): { wanted: PackFile[]; disabled: PackFile[] } {
  const wanted: PackFile[] = []
  const disabled: PackFile[] = []
  for (const f of m.files) {
    if (f.side === 'server') continue
    if (f.optional) {
      const on = settings.optional[f.id] ?? f.defaultEnabled ?? true
      ;(on ? wanted : disabled).push(f)
    } else wanted.push(f)
  }
  return { wanted, disabled }
}
