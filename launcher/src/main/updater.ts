import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/types'
import { log, errorMessage } from './logger'

/** Atualização automática do launcher a partir das versões publicadas no GitHub. */
export function setupUpdater(emit: (s: UpdateState) => void) {
  if (!app.isPackaged) {
    emit({ state: 'disabled' })
    return { check: async () => emit({ state: 'disabled' }), install: () => {} }
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => emit({ state: 'none' }))
  autoUpdater.on('update-available', (i) => {
    log.info(`Nova versão do launcher disponível: ${i.version}`)
    emit({ state: 'available', version: i.version })
  })
  autoUpdater.on('download-progress', (p) =>
    emit({ state: 'downloading', version: autoUpdater.currentVersion.version, progress: p.percent / 100 }),
  )
  autoUpdater.on('update-downloaded', (i) => {
    log.info(`Atualização ${i.version} pronta para instalar.`)
    emit({ state: 'ready', version: i.version })
  })
  autoUpdater.on('error', (e) => {
    log.warn(`Atualizador: ${errorMessage(e)}`)
    emit({ state: 'error', message: errorMessage(e) })
  })
  return {
    check: async () => {
      try {
        await autoUpdater.checkForUpdates()
      } catch (e) {
        emit({ state: 'error', message: errorMessage(e) })
      }
    },
    install: () => autoUpdater.quitAndInstall(false, true),
  }
}
