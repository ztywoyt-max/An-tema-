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
| `.github/workflows/` | `launcher.yml` (instalador Windows + release), `modpack.yml` (resolve mods no Modrinth e testa a abertura) |

Publicar nova versão do launcher: subir `version` em `launcher/package.json` e dar push na main — o workflow cria
a release `vX.Y.Z` sozinho (o proxy desta sessão bloqueia push de tags). Os launchers instalados se atualizam sozinhos.

## Decisões tomadas

- **Jogar exige conta Minecraft original.** Nada de modo offline, login por nick/senha ou launcher pirata
  (o dono pediu; foi recusado — não implementar).
- **Modo padrão (`official`)**: o ANÁTEMA instala NeoForge na `.minecraft` do Minecraft Launcher oficial,
  sincroniza os mods em `%APPDATA%\.anatema\jogo`, cria o perfil "ANÁTEMA" (`launcher_profiles.json`,
  `gameDir` apontando para a pasta do ANÁTEMA), põe o servidor no `servers.dat` e abre o launcher oficial.
  Código: `launcher/src/main/game/official.ts`.
- **Modo `own`** (login Microsoft dentro do ANÁTEMA) liga sozinho se `microsoftClientId` for preenchido em
  `launcher/launcher.config.json` (exige app no Azure aprovado pela Mojang; ver `docs/LOGIN_MICROSOFT.md`).
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

- (Opcional) Login Microsoft dentro do próprio ANÁTEMA — só se o dono registrar o app no Azure.
- Servidor precisa de `online-mode=true` (EasyLogin não é mais necessário).
- Painel do servidor (iniciar/parar, console, comandos, avisos) — próximo passo após o launcher.
- Reescrita dos mods próprios.
