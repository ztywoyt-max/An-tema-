#!/usr/bin/env node
// Gera o manifesto do modpack (links, tamanhos e hashes) a partir de modpack/pack.json.
//
//   node tools/modpack/build-manifest.mjs            → resolve tudo no Modrinth (versões NeoForge 1.21.1)
//   node tools/modpack/build-manifest.mjs --offline  → usa só a trava antiga (modpack/legado-mods.lock.json)
//
// Saída: modpack/manifest.json e launcher/resources/manifest.json (cópia embutida no launcher).
// O relatório lista mods não encontrados e dependências adicionadas automaticamente.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OFFLINE = process.argv.includes('--offline')
const API = 'https://api.modrinth.com/v2'
const UA = 'anatema-modpack-builder (projeto ANATEMA)'

const pack = JSON.parse(await readFile(join(ROOT, 'modpack/pack.json'), 'utf8'))
const legacy = JSON.parse(await readFile(join(ROOT, 'modpack/legado-mods.lock.json'), 'utf8'))
const legacyBySlug = new Map(legacy.map((m) => [m.slug, m]))

async function api(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, { headers: { 'user-agent': UA } })
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      continue
    }
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Modrinth ${res.status} em ${path}`)
    return res.json()
  }
}

const sideOf = (clientSide, serverSide) =>
  clientSide === 'unsupported' ? 'server' : serverSide === 'unsupported' ? 'client' : 'both'

function fromLegacy(entry, def) {
  return {
    id: def.slug,
    path: `mods/${entry.filename}`,
    name: def.name ?? entry.name,
    version: entry.version,
    side: entry.client && entry.server ? 'both' : entry.client ? 'client' : 'server',
    category: def.category,
    description: def.description ?? entry.reason,
    page: entry.page,
    license: entry.license,
    url: entry.url,
    size: entry.size,
    sha1: entry.sha1,
    sha512: entry.sha512,
    ...(def.optional ? { optional: true, defaultEnabled: def.defaultEnabled ?? true } : {}),
  }
}

/** Extrai a parte numérica de uma versão ("2.1.37", "neoforge-2.1.37+mc1.21") para comparar. */
function numericVersion(v) {
  const m = /(\d+(?:\.\d+)+)/.exec(v ?? '')
  return m ? m[1].split('.').map(Number) : []
}
function compareVersions(a, b) {
  const x = numericVersion(a)
  const y = numericVersion(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

/**
 * Escolhe a versão de um projeto para NeoForge/1.21.1.
 * Ordem: versão fixada pela dependência (version_id) → "version" do pack.json → mais recente
 * que respeite "below" (limite superior) → release mais recente.
 */
async function resolveModrinth(def, project, pinnedVersionId) {
  let pick = null
  if (pinnedVersionId) {
    const v = await api(`/version/${pinnedVersionId}`)
    if (v && v.loaders.includes('neoforge') && v.game_versions.includes(pack.minecraft)) pick = v
  }
  if (!pick) {
    const q = `?loaders=${encodeURIComponent('["neoforge"]')}&game_versions=${encodeURIComponent(`["${pack.minecraft}"]`)}`
    let versions = (await api(`/project/${project.id}/version${q}`)) ?? []
    if (def.below) versions = versions.filter((v) => compareVersions(v.version_number, def.below) < 0)
    pick =
      (def.version && versions.find((v) => v.version_number === def.version || v.id === def.version)) ||
      versions.find((v) => v.version_type === 'release') ||
      versions[0]
  }
  if (!pick) return null
  const file = pick.files.find((f) => f.primary) ?? pick.files[0]
  return {
    entry: {
      id: def.slug,
      path: `mods/${file.filename}`,
      name: def.name ?? project.title,
      version: pick.version_number,
      side: def.side ?? sideOf(project.client_side, project.server_side),
      category: def.category,
      description: def.description ?? project.description,
      page: `https://modrinth.com/mod/${project.slug}`,
      icon: project.icon_url ?? undefined,
      license: project.license?.id,
      url: file.url,
      size: file.size,
      sha1: file.hashes.sha1,
      sha512: file.hashes.sha512,
      ...(def.optional ? { optional: true, defaultEnabled: def.defaultEnabled ?? true } : {}),
    },
    deps: pick.dependencies
      .filter((d) => d.dependency_type === 'required' && d.project_id)
      .map((d) => ({ project: d.project_id, version: d.version_id ?? null })),
  }
}

/** Procura no Modrinth projetos com nome parecido que tenham versão NeoForge 1.21.1. */
async function suggest(def) {
  const facets = encodeURIComponent(JSON.stringify([['categories:neoforge'], [`versions:${pack.minecraft}`]]))
  const res = await api(`/search?query=${encodeURIComponent(def.name ?? def.slug)}&facets=${facets}&limit=5`)
  return (res?.hits ?? []).map((h) => `${h.slug} ("${h.title}")`)
}

const files = []
const report = { resolved: 0, legacy: [], missing: [], autoDeps: [], suggestions: {} }
const bySlug = new Map()

if (OFFLINE) {
  for (const def of pack.mods) {
    const l = legacyBySlug.get(def.slug)
    if (l) {
      files.push(fromLegacy(l, def))
      report.legacy.push(def.slug)
    } else report.missing.push(def.slug)
  }
} else {
  const candidates = pack.mods.flatMap((m) => [m.slug, ...(m.alternatives ?? [])])
  const projects = new Map()
  for (let i = 0; i < candidates.length; i += 80) {
    const chunk = candidates.slice(i, i + 80)
    for (const p of (await api(`/projects?ids=${encodeURIComponent(JSON.stringify(chunk))}`)) ?? []) {
      projects.set(p.slug, p)
      projects.set(p.id, p)
    }
  }
  // Dependências: projeto → versão exigida (quando o mod declara uma versão exata).
  const pendingDeps = new Map()
  const queueDeps = (deps) => {
    for (const d of deps) if (!pendingDeps.has(d.project) || d.version) pendingDeps.set(d.project, d.version)
  }
  for (const def of pack.mods) {
    let r = null
    let project = null
    for (const slug of [def.slug, ...(def.alternatives ?? [])]) {
      project = projects.get(slug)
      r = project ? await resolveModrinth(def, project) : null
      if (r) {
        if (slug !== def.slug) console.log(`  ${def.slug} → encontrado como "${slug}"`)
        break
      }
    }
    if (r) {
      files.push(r.entry)
      bySlug.set(project.id, true)
      queueDeps(r.deps)
      report.resolved++
    } else if (legacyBySlug.has(def.slug)) {
      files.push(fromLegacy(legacyBySlug.get(def.slug), def))
      report.legacy.push(def.slug)
    } else {
      report.missing.push(def.slug)
      report.suggestions[def.slug] = await suggest(def)
    }
  }
  // Dependências obrigatórias que não estavam na lista entram como bibliotecas,
  // na versão que o mod pede (quando ele declara uma).
  while (pendingDeps.size) {
    const wanted = [...pendingDeps].filter(([id]) => !bySlug.has(id))
    pendingDeps.clear()
    if (!wanted.length) break
    const deps = (await api(`/projects?ids=${encodeURIComponent(JSON.stringify(wanted.map(([id]) => id)))}`)) ?? []
    for (const p of deps) {
      bySlug.set(p.id, true)
      if (files.some((f) => f.id === p.slug)) continue
      const pinned = wanted.find(([id]) => id === p.id)?.[1]
      const r = await resolveModrinth({ slug: p.slug, category: 'bibliotecas' }, p, pinned)
      if (r) {
        files.push(r.entry)
        report.autoDeps.push(p.slug)
        queueDeps(r.deps)
      } else report.missing.push(`${p.slug} (dependência)`)
    }
  }
}

const manifest = {
  schema: 1,
  pack: { name: pack.name, version: pack.version, updated: new Date().toISOString() },
  minecraft: pack.minecraft,
  loader: pack.loader,
  java: pack.java,
  server: pack.server,
  memory: pack.memory,
  jvmArgs: pack.jvmArgs,
  files: files.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  systems: pack.systems,
  news: pack.news,
  ...(report.missing.length ? { unresolved: report.missing } : {}),
}

for (const out of ['modpack/manifest.json', 'launcher/resources/manifest.json']) {
  await mkdir(dirname(join(ROOT, out)), { recursive: true })
  await writeFile(join(ROOT, out), JSON.stringify(manifest, null, 2) + '\n')
}

const total = files.reduce((a, f) => a + (f.size ?? 0), 0)
console.log(`Manifesto gerado: ${files.length} arquivos, ${(total / 1024 / 1024).toFixed(1)} MB`)
console.log(`  Modrinth: ${report.resolved} · trava antiga: ${report.legacy.length} · dependências automáticas: ${report.autoDeps.length}`)
if (report.autoDeps.length) console.log(`  Dependências adicionadas: ${report.autoDeps.join(', ')}`)
if (report.missing.length) {
  console.log(`  NÃO ENCONTRADOS (${report.missing.length}): ${report.missing.join(', ')}`)
  for (const [slug, hits] of Object.entries(report.suggestions)) {
    console.log(`    ${slug}: ${hits.length ? `parecidos no Modrinth → ${hits.join(', ')}` : 'nada parecido com versão NeoForge 1.21.1'}`)
  }
  if (process.argv.includes('--strict')) process.exit(1)
}
