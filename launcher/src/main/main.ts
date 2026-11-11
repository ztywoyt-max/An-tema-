import { app, BrowserWindow, dialog, ipcMain, net, shell, Menu } from 'electron'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import type { EventMap, Settings } from '../shared/types'
import { paths, resourcePath } from './paths'
import { log, errorMessage } from './logger'
import { SettingsStore, systemMemoryMB } from './settings'
import { AccountStore } from './auth/accounts'
import { loginConfigured, loginInteractive } from './auth/microsoft'
import { GameService } from './game/service'
import { pingServer } from './server/ping'
import { setFetch } from './net/download'
import { setupUpdater } from './updater'
import { findOfficialLauncher, officialMinecraftDir } from './game/official'
import { readFileSync } from 'node:fs'

const DEV_URL = process.env.ANATEMA_DEV_SERVER

// Uma única instância do launcher por vez.
if (!app.requestSingleInstanceLock()) app.quit()

app.setAppUserModelId('br.anatema.launcher')
Menu.setApplicationMenu(null)

let mainWindow: BrowserWindow | null = null
let splash: BrowserWindow | null = null

function send<K extends keyof EventMap>(channel: K, payload: EventMap[K]) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function rendererUrl(page: 'index' | 'splash') {
  return DEV_URL ? `${DEV_URL}/${page}.html` : `file://${join(__dirname, '..', 'renderer', `${page}.html`)}`
}

function createSplash() {
  splash = new BrowserWindow({
    width: 640,
    height: 460,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#00000000',
    icon: resourcePath('icon.png'),
    webPreferences: { preload: join(__dirname, '..', 'preload', 'preload.js'), sandbox: true, contextIsolation: true },
  })
  splash.once('ready-to-show', () => splash?.show())
  splash.loadURL(rendererUrl('splash'))
}

function createMain() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: '#0b0708',
    title: 'ANÁTEMA',
    icon: resourcePath('icon.png'),
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  mainWindow.on('maximize', () => send('window:maximized', true))
  mainWindow.on('unmaximize', () => send('window:maximized', false))
  // Links externos abrem no navegador padrão, nunca dentro do launcher.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL ?? 'file://')) e.preventDefault()
  })
  mainWindow.loadURL(rendererUrl('index'))
}

/** Chamado pela animação de abertura quando termina: troca a splash pela janela principal. */
let splashFinished = false
let mainReady = false
function maybeRevealMain() {
  if (!splashFinished || !mainReady || !mainWindow) return
  mainWindow.setOpacity(0)
  mainWindow.show()
  let o = 0
  const step = setInterval(() => {
    o = Math.min(1, o + 0.08)
    mainWindow?.setOpacity(o)
    if (o >= 1) clearInterval(step)
  }, 16)
  setTimeout(() => {
    splash?.close()
    splash = null
  }, 180)
}

async function bootstrap() {
  setFetch((url, init) => net.fetch(url, init))
  const p = paths()
  await log.init(p.logs)
  log.info(`ANÁTEMA Launcher ${app.getVersion()} · ${process.platform} ${process.arch} · ${systemMemoryMB()} MB RAM`)

  const settings = new SettingsStore(p.settings)
  const accounts = new AccountStore(p.accounts)
  await accounts.load()

  // Sem app Microsoft registrado, o ANÁTEMA usa o Minecraft Launcher oficial para o login.
  const playMode = loginConfigured() ? 'own' : 'official'
  let profileIcon: string | undefined
  try {
    profileIcon = `data:image/png;base64,${readFileSync(resourcePath('profile-icon.png')).toString('base64')}`
  } catch {
    /* sem ícone */
  }
  log.info(`Modo de jogo: ${playMode === 'official' ? 'Minecraft Launcher oficial' : 'login próprio'}`)

  const game = new GameService(p, settings, accounts, {
    onState: (s) => send('game:state', s),
    onPackStatus: (s) => send('pack:changed', s),
    onGameStarted: () => {
      const mode = settings.get().afterLaunch
      if (mode === 'minimize') mainWindow?.minimize()
      else if (mode === 'hide') mainWindow?.hide()
      else if (mode === 'close') setTimeout(() => app.quit(), 4000)
    },
    onGameExited: () => {
      if (mainWindow && !mainWindow.isVisible()) mainWindow.show()
      if (mainWindow?.isMinimized()) mainWindow.restore()
    },
  }, playMode, profileIcon)

  log.on((lines) => send('log:lines', lines))

  const broadcastSettings = (s: Settings) => send('settings:changed', s)

  // ───── IPC ─────
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    totalMemoryMB: systemMemoryMB(),
    dataDir: p.root,
    loginConfigured: loginConfigured(),
    isPackaged: app.isPackaged,
    playMode,
  }))
  ipcMain.handle('official:status', async () => {
    const l = await findOfficialLauncher()
    return { found: !!l, kind: l?.kind, minecraftDir: officialMinecraftDir() }
  })
  ipcMain.on('app:minimize', () => mainWindow?.minimize())
  ipcMain.on('app:toggleMaximize', () => (mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()))
  ipcMain.on('app:close', () => {
    if (game.getState().phase === 'running') mainWindow?.hide()
    else app.quit()
  })
  ipcMain.on('app:openExternal', (_e, url: string) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })
  ipcMain.on('app:openFolder', (_e, kind: string) => {
    const map: Record<string, string> = {
      game: p.game,
      logs: p.logs,
      mods: join(p.game, 'mods'),
      screenshots: join(p.game, 'screenshots'),
      crash: join(p.game, 'crash-reports'),
    }
    const target = map[kind]
    if (target) shell.openPath(target).catch(() => {})
  })
  ipcMain.on('app:splashDone', () => {
    splashFinished = true
    maybeRevealMain()
  })

  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:set', async (_e, patch: Partial<Settings>) => {
    const s = await settings.set(patch)
    broadcastSettings(s)
    return s
  })

  ipcMain.handle('accounts:list', () => accounts.list())
  ipcMain.handle('accounts:login', async () => {
    try {
      const session = await loginInteractive(mainWindow)
      const acc = await accounts.upsert(session)
      await settings.set({ selectedAccount: acc.id })
      broadcastSettings(settings.get())
      send('accounts:changed', accounts.list())
      log.info(`Conta conectada: ${acc.name}`)
      return acc
    } catch (e) {
      log.warn(`Login: ${errorMessage(e)}`)
      throw e
    }
  })
  ipcMain.handle('accounts:remove', async (_e, id: string) => {
    await accounts.remove(id)
    if (settings.get().selectedAccount === id) {
      await settings.set({ selectedAccount: accounts.list()[0]?.id ?? null })
      broadcastSettings(settings.get())
    }
    send('accounts:changed', accounts.list())
  })
  ipcMain.handle('accounts:select', async (_e, id: string) => {
    if (!accounts.has(id)) return
    broadcastSettings(await settings.set({ selectedAccount: id }))
  })

  ipcMain.handle('pack:status', (_e, refresh?: boolean) => game.packStatus(!!refresh))
  ipcMain.handle('pack:repair', () => {
    void game.repair()
  })
  ipcMain.handle('pack:reset', async () => {
    const res = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      buttons: ['Reinstalar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Reinstalar tudo',
      message: 'Remover Java, Minecraft, NeoForge e mods para baixar tudo de novo?',
      detail: 'Seus mundos, prints, opções e configurações são mantidos.',
    })
    if (res.response === 0) await game.reset()
  })

  ipcMain.handle('game:play', () => {
    if (!game.isBusy()) void game.play()
  })
  ipcMain.handle('game:cancel', () => game.cancel())
  ipcMain.handle('game:kill', () => game.kill())
  ipcMain.handle('game:state', () => game.getState())

  let lastPing: { at: number; value: Awaited<ReturnType<typeof pingServer>> } | null = null
  ipcMain.handle('server:status', async () => {
    if (lastPing && Date.now() - lastPing.at < 10_000) return lastPing.value
    const { manifest } = await game.manifest()
    const value = await pingServer(manifest.server.address)
    lastPing = { at: Date.now(), value }
    return value
  })

  ipcMain.handle('logs:history', () => log.history())
  ipcMain.handle('logs:clear', () => log.clear())
  ipcMain.handle('logs:export', async () => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'Exportar registros',
      defaultPath: `anatema-registros-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`,
      filters: [{ name: 'Registro', extensions: ['log', 'txt'] }],
    })
    if (res.canceled || !res.filePath) return null
    const text = log
      .history()
      .map((l) => `${new Date(l.t).toISOString()} [${l.source}/${l.level.toUpperCase()}] ${l.text}`)
      .join('\n')
    await writeFile(res.filePath, text)
    return res.filePath
  })

  const updater = setupUpdater((s) => send('updater:state', s))
  ipcMain.handle('updater:check', () => updater.check())
  ipcMain.on('updater:install', () => updater.install())

  createSplash()
  createMain()
  mainWindow!.once('ready-to-show', () => {
    mainReady = true
    maybeRevealMain()
  })
  // Segurança: se a animação não responder, abre mesmo assim.
  setTimeout(() => {
    splashFinished = true
    maybeRevealMain()
  }, 9000)
  setTimeout(() => void updater.check(), 5000)
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(bootstrap).catch((e) => {
  dialog.showErrorBox('ANÁTEMA', `Falha ao iniciar o launcher:\n${errorMessage(e)}`)
  app.quit()
})

app.on('window-all-closed', () => app.quit())
