import { safeStorage } from 'electron'
import type { Account } from '../../shared/types'
import { readJson, writeJsonAtomic } from '../util/fsx'
import type { MinecraftSession } from './microsoft'
import { refreshSession } from './microsoft'

interface StoredAccount extends Account {
  /** Refresh token da Microsoft, cifrado pelo sistema operacional quando possível. */
  secret: string
  encrypted: boolean
  mcToken?: string
  mcExpiresAt?: number
}

/** Guarda as contas do jogador. Tokens ficam cifrados com o cofre do Windows (DPAPI). */
export class AccountStore {
  private accounts: StoredAccount[] = []
  constructor(private file: string) {}

  async load() {
    this.accounts = (await readJson<StoredAccount[]>(this.file)) ?? []
  }

  list(): Account[] {
    return this.accounts.map(({ secret: _s, encrypted: _e, mcToken: _t, mcExpiresAt: _x, ...pub }) => pub)
  }

  has(id: string) {
    return this.accounts.some((a) => a.id === id)
  }

  private seal(value: string) {
    if (safeStorage.isEncryptionAvailable()) {
      return { secret: safeStorage.encryptString(value).toString('base64'), encrypted: true }
    }
    return { secret: Buffer.from(value).toString('base64'), encrypted: false }
  }

  private unseal(a: StoredAccount) {
    const buf = Buffer.from(a.secret, 'base64')
    return a.encrypted ? safeStorage.decryptString(buf) : buf.toString()
  }

  async upsert(session: MinecraftSession): Promise<Account> {
    const id = session.profile.id
    const existing = this.accounts.find((a) => a.id === id)
    const entry: StoredAccount = {
      id,
      uuid: session.profile.id,
      name: session.profile.name,
      skinUrl: session.profile.skinUrl,
      capeUrl: session.profile.capeUrl,
      addedAt: existing?.addedAt ?? Date.now(),
      lastUsed: Date.now(),
      ...this.seal(session.refreshToken),
      mcToken: undefined,
      mcExpiresAt: undefined,
    }
    // O token do Minecraft fica apenas em memória; só o refresh token é persistido.
    this.memory.set(id, { token: session.accessToken, expiresAt: session.expiresAt })
    this.accounts = [entry, ...this.accounts.filter((a) => a.id !== id)]
    await this.save()
    return this.list().find((a) => a.id === id)!
  }

  private memory = new Map<string, { token: string; expiresAt: number }>()

  async remove(id: string) {
    this.accounts = this.accounts.filter((a) => a.id !== id)
    this.memory.delete(id)
    await this.save()
  }

  /** Devolve um token válido do Minecraft, renovando a sessão quando necessário. */
  async session(id: string): Promise<{ account: Account; accessToken: string }> {
    const stored = this.accounts.find((a) => a.id === id)
    if (!stored) throw new Error('Conta não encontrada.')
    const cached = this.memory.get(id)
    if (cached && cached.expiresAt - Date.now() > 10 * 60_000) {
      return { account: this.list().find((a) => a.id === id)!, accessToken: cached.token }
    }
    const fresh = await refreshSession(this.unseal(stored))
    const account = await this.upsert(fresh)
    return { account, accessToken: fresh.accessToken }
  }

  private async save() {
    await writeJsonAtomic(this.file, this.accounts)
  }
}
