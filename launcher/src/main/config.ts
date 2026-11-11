// Configuração fixa do launcher. Valores podem ser injetados no build (variáveis de ambiente
// lidas pelo esbuild) para que o executável final aponte para o repositório oficial.

export const LAUNCHER_NAME = 'ANATEMA'

/**
 * Onde o launcher busca o manifesto do modpack (lista de mods, versão do NeoForge, Java…).
 * Publicado no repositório do projeto; se ficar indisponível o launcher usa a cópia em cache
 * e, por último, a cópia embutida no instalador.
 */
export const DISTRIBUTION_URL: string = process.env.ANATEMA_DIST_URL || ''

/**
 * Client ID do aplicativo registrado no Microsoft Entra (Azure) para o login Microsoft.
 * Enquanto estiver vazio, o botão de login informa que o login ainda não foi configurado.
 */
export const MS_CLIENT_ID: string = process.env.ANATEMA_MS_CLIENT_ID || ''

export const MS_REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient'

export const MINECRAFT_PROTOCOL_1_21_1 = 767

export const USER_AGENT = 'ANATEMA-Launcher'
