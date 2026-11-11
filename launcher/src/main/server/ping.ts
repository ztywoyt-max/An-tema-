// Consulta o status do servidor pelo protocolo oficial "Server List Ping" do Minecraft
// (o mesmo que a lista de servidores do jogo usa): jogadores, versão, MOTD e latência.

import { connect, type Socket } from 'node:net'
import { resolveSrv } from 'node:dns/promises'
import type { ServerStatus } from '../../shared/types'
import { MINECRAFT_PROTOCOL_1_21_1 } from '../config'

function varint(n: number): Buffer {
  const out: number[] = []
  let v = n >>> 0
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v) b |= 0x80
    out.push(b)
  } while (v)
  return Buffer.from(out)
}

function readVarint(buf: Buffer, offset: number): [number, number] | null {
  let result = 0
  let shift = 0
  let pos = offset
  for (;;) {
    if (pos >= buf.length) return null
    const b = buf[pos++]
    result |= (b & 0x7f) << shift
    if (!(b & 0x80)) return [result >>> 0, pos]
    shift += 7
    if (shift > 35) throw new Error('VarInt grande demais')
  }
}

function packet(id: number, ...parts: Buffer[]) {
  const body = Buffer.concat([varint(id), ...parts])
  return Buffer.concat([varint(body.length), body])
}

function mcString(s: string) {
  const b = Buffer.from(s, 'utf8')
  return Buffer.concat([varint(b.length), b])
}

/** Converte o MOTD (texto ou componente JSON) em texto simples. */
export function flattenChat(c: unknown): string {
  if (typeof c === 'string') return c.replace(/§./g, '')
  if (!c || typeof c !== 'object') return ''
  const o = c as { text?: string; translate?: string; extra?: unknown[] }
  return (o.text ?? o.translate ?? '').replace(/§./g, '') + (o.extra ?? []).map(flattenChat).join('')
}

export function parseAddress(address: string): { host: string; port: number; explicitPort: boolean } {
  const m = /^\[?([^\]]+?)\]?(?::(\d+))?$/.exec(address.trim())
  if (!m) return { host: address, port: 25565, explicitPort: false }
  return { host: m[1], port: m[2] ? Number(m[2]) : 25565, explicitPort: !!m[2] }
}

export async function pingServer(address: string, timeoutMs = 6000): Promise<ServerStatus> {
  const parsed = parseAddress(address)
  let { host, port } = parsed
  if (!parsed.explicitPort) {
    try {
      const srv = await resolveSrv(`_minecraft._tcp.${host}`)
      if (srv[0]) ({ name: host, port } = srv[0])
    } catch {
      /* sem registro SRV */
    }
  }

  return new Promise((resolve) => {
    const started = Date.now()
    let socket: Socket | null = null
    let buffer = Buffer.alloc(0)
    let status: ServerStatus | null = null
    let statusAt = 0
    const done = (s: ServerStatus) => {
      clearTimeout(timer)
      socket?.destroy()
      resolve(s)
    }
    const fail = (error: string) => done({ online: false, address, checkedAt: Date.now(), error })
    const timer = setTimeout(() => (status ? done(status) : fail('Tempo esgotado')), timeoutMs)

    socket = connect({ host, port }, () => {
      const portBuf = Buffer.alloc(2)
      portBuf.writeUInt16BE(port)
      socket!.write(packet(0x00, varint(MINECRAFT_PROTOCOL_1_21_1), mcString(parsed.host), portBuf, varint(1)))
      socket!.write(packet(0x00))
    })
    socket.on('error', (e: NodeJS.ErrnoException) =>
      fail(e.code === 'ECONNREFUSED' ? 'Servidor fechado' : e.code === 'ENOTFOUND' ? 'Endereço não encontrado' : e.message),
    )
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      try {
        for (;;) {
          const len = readVarint(buffer, 0)
          if (!len) return
          const [length, start] = len
          if (buffer.length < start + length) return
          const payload = buffer.subarray(start, start + length)
          buffer = buffer.subarray(start + length)
          const idv = readVarint(payload, 0)!
          const [id, pos] = idv
          if (id === 0x00 && !status) {
            const sl = readVarint(payload, pos)!
            const json = JSON.parse(payload.subarray(sl[1], sl[1] + sl[0]).toString('utf8'))
            statusAt = Date.now()
            status = {
              online: true,
              address,
              latencyMs: statusAt - started,
              version: json.version?.name,
              motd: flattenChat(json.description),
              players: {
                online: json.players?.online ?? 0,
                max: json.players?.max ?? 0,
                sample: (json.players?.sample ?? []).slice(0, 12),
              },
              favicon: typeof json.favicon === 'string' ? json.favicon : undefined,
              checkedAt: Date.now(),
            }
            const t = Buffer.alloc(8)
            t.writeBigInt64BE(BigInt(statusAt))
            socket!.write(packet(0x01, t))
          } else if (id === 0x01 && status) {
            status.latencyMs = Date.now() - statusAt
            done(status)
            return
          }
        }
      } catch (e) {
        if (status) done(status)
        else fail(`Resposta inválida: ${(e as Error).message}`)
      }
    })
    socket.on('close', () => (status ? done(status) : fail('Conexão encerrada')))
  })
}
