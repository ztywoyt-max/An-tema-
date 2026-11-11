import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureServerListed, serversDat, writeOfficialProfile, PROFILE_ID } from '../src/main/game/official'

/** Leitor NBT mínimo, só para conferir o arquivo gerado. */
function readNbt(buf: Buffer) {
  let i = 0
  const u8 = () => buf[i++]
  const u16 = () => ((i += 2), buf.readUInt16BE(i - 2))
  const i32 = () => ((i += 4), buf.readInt32BE(i - 4))
  const str = () => {
    const n = u16()
    i += n
    return buf.toString('utf8', i - n, i)
  }
  const payload = (t: number): unknown => {
    if (t === 1) return u8()
    if (t === 8) return str()
    if (t === 9) {
      const et = u8()
      return Array.from({ length: i32() }, () => payload(et))
    }
    if (t === 10) {
      const o: Record<string, unknown> = {}
      for (let t2 = u8(); t2 !== 0; t2 = u8()) o[str()] = payload(t2)
      return o
    }
    throw new Error(`tag ${t}`)
  }
  assert.equal(u8(), 10)
  str()
  const root = payload(10)
  assert.equal(i, buf.length, 'sobrou lixo no fim do arquivo')
  return root as { servers: { name: string; ip: string; acceptTextures: number }[] }
}

test('servers.dat é NBT válido com o servidor do ANÁTEMA', () => {
  const nbt = readNbt(serversDat('O Domínio dos Condenados', 'domination-variance.tun.ply.gg'))
  assert.equal(nbt.servers.length, 1)
  assert.equal(nbt.servers[0].name, 'O Domínio dos Condenados')
  assert.equal(nbt.servers[0].ip, 'domination-variance.tun.ply.gg')
  assert.equal(nbt.servers[0].acceptTextures, 1)
})

test('lista de servidores do jogador não é apagada', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anatema-'))
  writeFileSync(join(dir, 'servers.dat'), Buffer.from('lista do jogador'))
  await ensureServerListed(dir, 'X', 'a.b')
  assert.equal(readFileSync(join(dir, 'servers.dat'), 'utf8'), 'lista do jogador')
  const fresh = mkdtempSync(join(tmpdir(), 'anatema-'))
  await ensureServerListed(fresh, 'X', 'a.b')
  assert.equal(readNbt(readFileSync(join(fresh, 'servers.dat'))).servers[0].ip, 'a.b')
})

test('perfil ANÁTEMA no launcher oficial preserva os perfis do jogador', async () => {
  const mc = mkdtempSync(join(tmpdir(), 'mc-'))
  writeFileSync(
    join(mc, 'launcher_profiles.json'),
    JSON.stringify({
      profiles: {
        meu: { name: 'Meu perfil', type: 'custom', lastVersionId: '1.20.4' },
        NeoForge: { name: 'NeoForge', type: 'custom', lastVersionId: 'neoforge-21.1.256' },
      },
      settings: { crashAssistance: true },
      version: 3,
    }),
  )
  const opts = { versionId: 'neoforge-21.1.256', gameDir: 'C:\\anatema\\jogo', memoryMB: 6144, jvmArgs: ['-XX:+UseG1GC'], width: 1600, height: 900 }
  await writeOfficialProfile(mc, opts)
  await writeOfficialProfile(mc, { ...opts, memoryMB: 8192 })
  const data = JSON.parse(readFileSync(join(mc, 'launcher_profiles.json'), 'utf8'))
  assert.ok(data.profiles.meu, 'perfil do jogador sumiu')
  assert.equal(data.profiles.NeoForge, undefined, 'perfil genérico do NeoForge deveria sair')
  assert.equal(data.settings.crashAssistance, true)
  const p = data.profiles[PROFILE_ID]
  assert.equal(p.name, 'ANÁTEMA')
  assert.equal(p.lastVersionId, 'neoforge-21.1.256')
  assert.equal(p.gameDir, 'C:\\anatema\\jogo')
  assert.match(p.javaArgs, /^-Xmx8192M -Xms2048M -XX:\+UseG1GC$/)
  assert.deepEqual(p.resolution, { width: 1600, height: 900 })
})
