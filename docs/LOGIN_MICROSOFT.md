# (Opcional) Login Microsoft dentro do launcher

> Não é necessário. Por padrão o ANÁTEMA abre o Minecraft Launcher oficial, onde o jogador já entra com a
> própria conta. Este guia só serve para, no futuro, o ANÁTEMA iniciar o jogo sozinho sem o launcher oficial.

O Minecraft Java só aceita login de launchers registrados na Microsoft. O registro precisa ser feito
com a conta Microsoft do dono do projeto — é o único passo que não dá para automatizar. Leva ~5 minutos.

## 1. Registrar o aplicativo (gratuito)

1. Acesse **https://entra.microsoft.com** e entre com sua conta Microsoft.
2. Menu **Aplicativos → Registros de aplicativo → Novo registro**.
3. Preencha:
   - **Nome:** `ANÁTEMA Launcher`
   - **Tipos de conta com suporte:** *Somente contas pessoais da Microsoft*
   - **URI de redirecionamento:** plataforma *Cliente público/nativo (móvel e desktop)* com o endereço
     `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. Clique em **Registrar**.
5. Em **Autenticação**, ative **Permitir fluxos de clientes públicos** e salve.
6. Copie o **ID do aplicativo (cliente)** — um código como `1a2b3c4d-...`. Ele não é secreto.

## 2. Pedir a liberação da Mojang

Aplicativos novos precisam de aprovação para usar a API do Minecraft:

- Formulário: **https://aka.ms/mce-reviewappid**
- Informe o ID do aplicativo do passo 1 e descreva: *"Launcher próprio do servidor ANÁTEMA (NeoForge 1.21.1)
  que autentica jogadores com a conta Microsoft para iniciar o Minecraft Java."*
- A análise pode levar alguns dias. Até lá o login mostra "ainda não foi liberado pela Mojang".

## 3. Enviar o ID ao Claude

Cole o ID do aplicativo na conversa. Ele vai para `launcher/launcher.config.json` e entra no próximo build.
