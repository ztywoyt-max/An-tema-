// Monta as opções de inicialização do Minecraft (separado para poder ser testado sem Electron).
import type { LaunchOption } from '@xmcl/core'
import type { PackManifest, Settings } from '../../shared/types'
import { LAUNCHER_NAME } from '../config'
import { neoforgeVersionId } from './neoforge'

export interface LaunchInput {
  manifest: PackManifest
  settings: Settings
  gameDir: string
  javaPath: string
  profile: { id: string; name: string }
  accessToken: string
  userType?: string
}

export function buildLaunchOptions(i: LaunchInput): LaunchOption {
  const { manifest, settings } = i
  const jvm = [...(manifest.jvmArgs ?? []), ...settings.jvmArgs.split(/\s+/).filter(Boolean)]
  return {
    gamePath: i.gameDir,
    resourcePath: i.gameDir,
    javaPath: i.javaPath,
    version: neoforgeVersionId(manifest),
    gameProfile: i.profile,
    accessToken: i.accessToken,
    userType: (i.userType ?? 'msa') as LaunchOption['userType'],
    launcherName: LAUNCHER_NAME,
    launcherBrand: LAUNCHER_NAME,
    versionType: `ANÁTEMA ${manifest.pack.version}`,
    maxMemory: settings.memoryMB,
    minMemory: Math.min(2048, settings.memoryMB),
    resolution: { width: settings.width, height: settings.height, fullscreen: settings.fullscreen },
    quickPlayMultiplayer: settings.autoConnect ? manifest.server.address : undefined,
    extraJVMArgs: jvm,
    extraExecOption: { detached: false, windowsHide: false },
  }
}
