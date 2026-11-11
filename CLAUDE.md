# ANÁTEMA — contexto do projeto

Repositório: https://github.com/ztywoyt-max/An-tema- (público — os launchers dos jogadores baixam dele o manifesto).

Servidor de roleplay e sobrevivência em Minecraft Java **1.21.1 + NeoForge 21.1.256** (Java 21).
Tema: domínio sombrio sob um céu carmesim. Lema: "O céu sangra. A terra recorda." Jogadores são "Condenados".
O dono do projeto fala português (Brasil). Responda e escreva textos de interface em pt-BR.
O dono não quer mexer em nada fora do Minecraft e do Claude: automatize tudo o que for possível.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `launcher/` | Launcher oficial (Electron + React + Vite + TypeScript) |
| `modpack/pack.json` | **Fonte da verdade** da lista de mods (slugs do Modrinth, categoria, descrição pt-BR) |
| `modpack/manifest.json` | Gerado: links, tamanhos e hashes. Não editar à mão |
| `modpack/legado-mods.lock.json` | Trava antiga (versões já testadas), usada como reserva |
| `tools/modpack/build-manifest.mjs` | Gera o manifesto (`--offline` usa só a trava antiga) |
| `.github/workflows/` | `launcher.yml` (instalador Windows, release em tag `launcher-vX.Y.Z`), `modpack.yml` (resolve mods no Modrinth) |

## Decisões tomadas

- **Login apenas com conta Microsoft** (OAuth + PKCE → Xbox → XSTS → Minecraft). Nada de modo offline/pirata.
  O Client ID do Azure entra no build pela variável `MS_CLIENT_ID` do repositório (`ANATEMA_MS_CLIENT_ID`).
- NeoForge é instalado com o instalador oficial em modo `--install-client` (testado: funciona).
- Minecraft "puro" é baixado direto da Mojang pelo próprio launcher (`src/main/game/vanilla.ts`).
- Java: Temurin 21 JRE baixado do GitHub da Adoptium, com hash fixo no manifesto.
- Mods fora do manifesto na pasta `mods/` são movidos para `mods_retirados/`.
- Dados do jogador ficam em `%APPDATA%\.anatema` (`jogo/`, `runtime/`, `registros/`, `ajustes.json`, `contas.json`).
- Tokens da Microsoft são cifrados com `safeStorage` (DPAPI no Windows).
- O workflow Modpack instala tudo do zero e abre o jogo até o menu (Xvfb) antes de publicar o manifesto.
  Se um mod quebrar a abertura, o manifesto não é salvo. Para fixar versões em `pack.json`: `version`,
  `below` (limite superior) e `alternatives` (outros slugs do Modrinth).
- Celestial removido (quebrava a abertura no 1.21.1). O céu carmesim será feito no mod ANÁTEMA.
- Os 8 sistemas próprios (Forja, Ficha RP, Corvo, Ilusões, Anatomia, Três Vidas, Inventário, Mídias) serão
  reescritos do zero num mod único "ANÁTEMA". As versões antigas são consideradas ruins pelo dono.

## Identidade visual

Paleta escura vinho/carmesim (`launcher/src/renderer/styles/tokens.css`). Fontes: Cinzel (títulos),
Cormorant Garamond itálico (frases), Inter (interface), JetBrains Mono (registros).
Marca vetorizada em `launcher/resources/brand/` (`corvo.svg`, `anatema-wordmark.svg`).

## Comandos do launcher

```bash
cd launcher && npm ci
npm run dev          # Vite + Electron com recarga
npm run typecheck && npm test
npm run build        # gera dist/
```

Para ver a interface sem Electron, sirva `dist/renderer` e abra `index.html?pagina=modpack`
(parâmetros de simulação: `conta=0`, `estado=baixando|erro`, `pendente=1`, `servidor=0`).

## Pendências

- Registrar o app no Microsoft Entra e pedir liberação da API do Minecraft à Mojang (só o dono pode fazer).
- Publicar a primeira versão do launcher (tag `launcher-v1.0.0`) assim que o login estiver liberado.
- Painel do servidor (iniciar/parar, console, comandos, avisos) — próximo passo após o launcher.
- Reescrita dos mods próprios.
