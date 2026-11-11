import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createTcp } from 'node:net'
import { mavenPath, rulesAllow, libraryTasks } from '../src/main/game/vanilla'
import { validateManifest, clientFiles } from '../src/main/game/pack'
import { downloadMany } from '../src/main/net/download'
import { parseAddress, flattenChat, pingServer } from '../src/main/server/ping'
import { isFileValid } from '../src/main/util/fsx'
import { majorOf } from '../src/main/game/java'
import type { PackManifest, Settings } from '../src/shared/types'

const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'resources', 'manifest.json'), 'utf8')) as PackManifest

test('caminho maven com e sem classificador', () => {
  assert.equal(mavenPath('net.neoforged:neoforge:21.1.256'), 'net/neoforged/neoforge/21.1.256/neoforge-21.1.256.jar')
  assert.equal(mavenPath('org.lwjgl:lwjgl:3.3.3:natives-windows'), 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar')
  assert.equal(mavenPath('a.b:c:1@zip'), 'a/b/c/1/c-1.zip')
})

test('regras de SO do version.json', () => {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
  assert.equal(rulesAllow(undefined), true)
  assert.equal(rulesAllow([{ action: 'allow', os: { name: os } }]), true)
  assert.equal(rulesAllow([{ action: 'allow', os: { name: 'nenhum' } }]), false)
  assert.equal(rulesAllow([{ action: 'allow' }, { action: 'disallow', os: { name: os } }]), false)
})

test('bibliotecas filtradas por SO e sem duplicatas', () => {
  const tasks = libraryTasks(
    {
      id: 'x',
      libraries: [
        { name: 'a:b:1', downloads: { artifact: { path: 'a/b/1/b-1.jar', url: 'https://x/b.jar', sha1: '1', size: 1 } } },
        { name: 'a:b:1', downloads: { artifact: { path: 'a/b/1/b-1.jar', url: 'https://x/b.jar', sha1: '1', size: 1 } } },
        { name: 'c:d:1', rules: [{ action: 'allow', os: { name: 'nenhum' } }], downloads: { artifact: { path: 'c.jar', url: 'https://x/c.jar', sha1: '2', size: 1 } } },
      ],
    },
    '/lib',
  )
  assert.equal(tasks.length, 1)
})

test('manifesto embutido é válido e sem duplicatas', () => {
  validateManifest(manifest)
  assert.ok(manifest.files.length > 40)
  for (const f of manifest.files) assert.ok(f.sha1 || f.sha512, `sem hash: ${f.id}`)
})

test('manifesto recusa caminhos fora da pasta do jogo', () => {
  const bad = structuredClone(manifest)
  bad.files[0].path = '../../Windows/evil.dll'
  assert.throws(() => validateManifest(bad), /proibido/)
})

test('opcionais respeitam os ajustes do jogador', () => {
  const m = structuredClone(manifest)
  m.files.push({ ...m.files[0], id: 'opt', path: 'mods/opt.jar', optional: true, defaultEnabled: false })
  const s = { optional: {} } as unknown as Settings
  assert.ok(clientFiles(m, s).disabled.some((f) => f.id === 'opt'))
  assert.ok(clientFiles(m, { optional: { opt: true } } as unknown as Settings).wanted.some((f) => f.id === 'opt'))
})

test('downloads: baixa, confere hash, refaz arquivo corrompido e recusa hash errado', async () => {
  const body = Buffer.from('conteúdo do mod '.repeat(5000))
  const sha1 = createHash('sha1').update(body).digest('hex')
  let hits = 0
  const srv = createServer((req, res) => {
    hits++
    if (req.url === '/falha' && hits % 2 === 1) return res.destroy()
    res.end(body)
  }).listen(0)
  const port = (srv.address() as { port: number }).port
  const dir = mkdtempSync(join(tmpdir(), 'anatema-'))
  const dest = join(dir, 'mods', 'a.jar')
  try {
    await downloadMany([{ url: `http://127.0.0.1:${port}/ok`, dest, sha1, size: body.length }])
    assert.ok(await isFileValid(dest, { sha1 }, true))
    writeFileSync(dest, 'corrompido')
    await downloadMany([{ url: `http://127.0.0.1:${port}/ok`, dest, sha1, size: body.length }])
    assert.ok(await isFileValid(dest, { sha1, size: body.length }, true))
    // Falha intermitente: deve tentar de novo e conseguir.
    await downloadMany([{ url: `http://127.0.0.1:${port}/falha`, dest: join(dir, 'b.jar'), sha1 }], { retries: 3 })
    await assert.rejects(downloadMany([{ url: `http://127.0.0.1:${port}/ok`, dest: join(dir, 'c.jar'), sha1: '0'.repeat(40) }], { retries: 1 }), /não puderam/)
  } finally {
    srv.close()
  }
})

test('endereço do servidor e MOTD', () => {
  assert.deepEqual(parseAddress('play.exemplo.com'), { host: 'play.exemplo.com', port: 25565, explicitPort: false })
  assert.deepEqual(parseAddress('play.exemplo.com:25570'), { host: 'play.exemplo.com', port: 25570, explicitPort: true })
  assert.equal(flattenChat({ text: '§cO céu ', extra: [{ text: 'sangra' }] }), 'O céu sangra')
})

test('ping de servidor fala o protocolo do Minecraft', async () => {
  const status = JSON.stringify({ version: { name: '1.21.1' }, players: { online: 3, max: 50, sample: [] }, description: { text: 'ANÁTEMA' } })
  const varint = (n: number) => {
    const o: number[] = []
    do {
      let b = n & 0x7f
      n >>>= 7
      if (n) b |= 0x80
      o.push(b)
    } while (n)
    return Buffer.from(o)
  }
  const frame = (id: number, payload: Buffer) => {
    const body = Buffer.concat([varint(id), payload])
    return Buffer.concat([varint(body.length), body])
  }
  const srv = createTcp((sock) => {
    let sent = false
    sock.on('error', () => {})
    sock.on('data', () => {
      if (!sent) {
        sent = true
        const s = Buffer.from(status)
        sock.write(frame(0, Buffer.concat([varint(s.length), s])))
        sock.write(frame(1, Buffer.alloc(8)))
      }
    })
  }).listen(0)
  const port = (srv.address() as { port: number }).port
  const r = await pingServer(`127.0.0.1:${port}`)
  srv.close()
  assert.equal(r.online, true)
  assert.equal(r.players?.online, 3)
  assert.equal(r.motd, 'ANÁTEMA')
})

test('versão do Java', () => {
  assert.equal(majorOf('21.0.12.1'), 21)
  assert.equal(majorOf('1.8.0_392'), 8)
})
