// Login oficial: Microsoft (OAuth 2.0 + PKCE) → Xbox Live → XSTS → Minecraft Services.
// O jogador entra com a própria conta Microsoft — que pode usar um endereço Gmail.

import { BrowserWindow, session } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { fetchJson, httpFetch, HttpError } from '../net/download'
import { MS_CLIENT_ID, MS_REDIRECT_URI } from '../config'

const AUTHORIZE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
const TOKEN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const SCOPE = 'XboxLive.signin offline_access'

export class AuthError extends Error {
  constructor(message: string, public hint?: string) {
    super(message)
  }
}

export interface MsTokens {
  accessToken: string
  refreshToken: string
}

export interface MinecraftSession {
  accessToken: string
  expiresAt: number
  profile: { id: string; name: string; skinUrl?: string; capeUrl?: string }
  refreshToken: string
}

const base64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Abre a janela de login da Microsoft e devolve o código de autorização. */
function interactiveAuthorize(parent: BrowserWindow | null): Promise<{ code: string; verifier: string }> {
  const verifier = base64url(randomBytes(48))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))
  const url = new URL(AUTHORIZE)
  url.search = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URI,
    scope: SCOPE,
    prompt: 'select_account',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString()

  return new Promise((resolve, reject) => {
    // Sessão isolada e descartável: nada do login fica salvo no navegador interno.
    const partition = `login-${Date.now()}`
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      parent: parent ?? undefined,
      modal: !!parent,
      title: 'Entrar com Microsoft',
      backgroundColor: '#ffffff',
      autoHideMenuBar: true,
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    let settled = false
    const finish = (err: Error | null, code?: string) => {
      if (settled) return
      settled = true
      if (!win.isDestroyed()) win.close()
      session.fromPartition(partition).clearStorageData().catch(() => {})
      if (err) reject(err)
      else resolve({ code: code!, verifier })
    }
    const inspect = (target: string) => {
      if (!target.startsWith(MS_REDIRECT_URI)) return false
      const params = new URL(target).searchParams
      if (params.get('state') !== state) {
        finish(new AuthError('Resposta de login inválida.'))
      } else if (params.get('error')) {
        const desc = params.get('error_description') || params.get('error') || ''
        finish(
          params.get('error') === 'access_denied'
            ? new AuthError('Login cancelado.')
            : new AuthError('A Microsoft recusou o login.', decodeURIComponent(desc)),
        )
      } else {
        finish(null, params.get('code')!)
      }
      return true
    }
    win.webContents.on('will-redirect', (e, target) => {
      if (inspect(target)) e.preventDefault()
    })
    win.webContents.on('will-navigate', (e, target) => {
      if (inspect(target)) e.preventDefault()
    })
    win.webContents.on('did-navigate', (_e, target) => inspect(target))
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.on('closed', () => finish(new AuthError('Login cancelado.')))
    win.loadURL(url.toString()).catch(() => {})
  })
}

async function tokenRequest(params: Record<string, string>): Promise<MsTokens> {
  const res = await httpFetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, scope: SCOPE, ...params }).toString(),
    signal: AbortSignal.timeout(20000),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, string>
  if (!res.ok) {
    if (body.error === 'invalid_grant') throw new AuthError('Sua sessão Microsoft expirou. Entre novamente.')
    throw new AuthError('Falha ao obter o token da Microsoft.', body.error_description)
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token }
}

const XERR: Record<string, [string, string?]> = {
  '2148916233': ['Esta conta Microsoft não tem perfil Xbox.', 'Entre uma vez em minecraft.net com essa conta para criar o perfil e tente de novo.'],
  '2148916235': ['O Xbox Live não está disponível no país desta conta.'],
  '2148916236': ['Esta conta precisa de verificação de idade.', 'Acesse account.xbox.com para concluir.'],
  '2148916237': ['Esta conta precisa de verificação de idade.', 'Acesse account.xbox.com para concluir.'],
  '2148916238': ['Conta de menor de idade sem família configurada.', 'Um responsável precisa adicionar a conta a uma família Microsoft.'],
}

async function xboxChain(msAccessToken: string) {
  const xbl = await fetchJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      }),
    },
  )
  const xstsRes = await httpFetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
    signal: AbortSignal.timeout(20000),
  })
  const xsts = (await xstsRes.json().catch(() => ({}))) as { Token?: string; XErr?: number; DisplayClaims?: { xui: { uhs: string }[] } }
  if (!xstsRes.ok || !xsts.Token) {
    const known = xsts.XErr ? XERR[String(xsts.XErr)] : undefined
    throw new AuthError(known?.[0] ?? 'O Xbox Live recusou o login.', known?.[1])
  }
  return { uhs: xsts.DisplayClaims?.xui[0]?.uhs ?? xbl.DisplayClaims.xui[0].uhs, token: xsts.Token }
}

async function minecraftLogin(uhs: string, xstsToken: string) {
  let res: { access_token: string; expires_in: number }
  try {
    res = await fetchJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xstsToken}` }),
    })
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) {
      throw new AuthError(
        'O login do launcher ainda não foi liberado pela Mojang.',
        'O aplicativo do launcher precisa ser aprovado para usar a API do Minecraft.',
      )
    }
    throw e
  }
  return { accessToken: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 }
}

async function minecraftProfile(accessToken: string) {
  const res = await httpFetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  })
  if (res.status === 404) {
    throw new AuthError(
      'Esta conta não possui o Minecraft: Java Edition.',
      'Use a conta Microsoft com a qual o jogo foi comprado (ou que tenha o Game Pass).',
    )
  }
  if (!res.ok) throw new HttpError(res.status, res.url)
  const p = (await res.json()) as {
    id: string
    name: string
    skins?: { url: string; state: string }[]
    capes?: { url: string; state: string }[]
  }
  return {
    id: p.id,
    name: p.name,
    skinUrl: p.skins?.find((s) => s.state === 'ACTIVE')?.url,
    capeUrl: p.capes?.find((c) => c.state === 'ACTIVE')?.url,
  }
}

async function completeChain(ms: MsTokens): Promise<MinecraftSession> {
  const { uhs, token } = await xboxChain(ms.accessToken)
  const mc = await minecraftLogin(uhs, token)
  const profile = await minecraftProfile(mc.accessToken)
  return { ...mc, profile, refreshToken: ms.refreshToken }
}

export function loginConfigured() {
  return MS_CLIENT_ID.length > 0
}

export async function loginInteractive(parent: BrowserWindow | null): Promise<MinecraftSession> {
  if (!loginConfigured()) {
    throw new AuthError(
      'O login Microsoft ainda não foi configurado neste launcher.',
      'A equipe precisa registrar o aplicativo do launcher na Microsoft.',
    )
  }
  const { code, verifier } = await interactiveAuthorize(parent)
  const ms = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: MS_REDIRECT_URI, code_verifier: verifier })
  return completeChain(ms)
}

export async function refreshSession(refreshToken: string): Promise<MinecraftSession> {
  const ms = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
  return completeChain(ms)
}
