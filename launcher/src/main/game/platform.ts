import type { PlatformKey } from '../../shared/types'

export function platformKey(): PlatformKey {
  const arm = process.arch === 'arm64'
  if (process.platform === 'win32') return arm ? 'windows-arm64' : 'windows-x64'
  if (process.platform === 'darwin') return arm ? 'macos-arm64' : 'macos-x64'
  return 'linux-x64'
}

/** Nome do SO no formato usado pelas regras do version.json da Mojang. */
export function mojangOs(): 'windows' | 'osx' | 'linux' {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'osx'
  return 'linux'
}
