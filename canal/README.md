# Canal de histórias em gráfico de PS1

Projeto separado do jogo ANÁTEMA: vídeos longos de histórias originais, narradas, com visual de PlayStation 1.

| Pasta | Conteúdo |
|---|---|
| `roteiros/` | Roteiros completos em Markdown (fonte única das falas) |
| `estudio/` | **Estúdio PS1**: motor 3D, cenários, personagens, áudio e renderização |
| `estudio/filmes/<nome>/` | Um filme: planos por capítulo (`filme.js`, `cap*.js`), elenco, falas e vozes |

## Fluxo de um filme

```bash
cd estudio && npm ci
# 1. falas: extraídas do roteiro (narração e personagens)
node ferramentas/roteiro.mjs ../roteiros/01-o-cavaleiro-sem-armadura.md filmes/cavaleiro/falas.json
# 2. vozes (ElevenLabs): precisa da chave no ambiente (Network secret de api.elevenlabs.io,
#    cabeçalho xi-api-key, ou variável ELEVENLABS_API_KEY)
node ferramentas/vozes.mjs testar cavaleiro     # confere a chave
node ferramentas/vozes.mjs escalar cavaleiro    # escolhe uma voz humana por personagem
node ferramentas/vozes.mjs gerar cavaleiro      # um MP3 por fala (só o que mudou)
# 3. vídeo: cada capítulo se ajusta sozinho à duração real das vozes
node ferramentas/linha.mjs cavaleiro 1          # linha do tempo de um capítulo
node render.mjs --filme cavaleiro --cap 1       # um capítulo (MP4 + legendas .srt)
node ferramentas/montar.mjs cavaleiro --tudo    # filme completo
node ferramentas/exportar.mjs cavaleiro         # arquivo para o PC/YouTube, menos de 500 MB
node ferramentas/youtube.mjs cavaleiro          # título, descrição com capítulos e tags
node render.mjs miniatura --quadros 0.5         # miniatura
```

Tudo de uma vez (é o que usar quando o dono pedir para "aplicar as vozes"):

```bash
cd estudio && ferramentas/produzir.sh cavaleiro ../roteiros/01-o-cavaleiro-sem-armadura.md
```

Entrega: `saida/<filme>-youtube.mp4` (o app só envia arquivos de até 500 MiB; o `-completo.mp4` tem
mais de 1 GB), `saida/<filme>-youtube.txt` e `saida/<filme>-miniatura-a/b.jpg`.

Sem vozes, as durações são estimadas e o filme sai sem falas (não há legendas nem caixas de texto:
o dono não quer). Ao gerar as vozes, basta renderizar de novo: tudo se reajusta.
A chave da ElevenLabs só vale em sessões abertas depois de salva no ambiente.

## Estúdio PS1

Three.js num navegador sem janela (Playwright) + ffmpeg. Imita o PlayStation 1 de verdade: luz por vértice,
textura sem correção de perspectiva, vértices presos à grade, neblina por vértice, cor em 15 bits com pontilhado,
resolução interna 384×216 (ampliada sem borrar para 1920×1080; `--escala 10` gera 4K).

| Arquivo | O quê |
|---|---|
| `motor/ps1.js` | shader PS1, pós-processamento (pontilhado, vinheta, fade, tom de lembrança) e luzes |
| `motor/filme.js`, `motor/linha.js` | executa um filme: planos ligados às falas, caixas de diálogo, telas de título |
| `motor/audio.js` | mixagem offline: vozes, trilha e ambiente gerados por código, efeitos, abaixamento sob a fala |
| `motor/personagem.js`, `motor/roupas.js` | personagens de peças rígidas, rostos com boca animada, figurinos e poses |
| `motor/texturas.js`, `motor/objetos.js`, `motor/aldeia.js`, `motor/animais.js` | texturas, cenário, construções, cavalo |
| `motor/hud.js` | títulos e caixas de diálogo (fonte Jersey 15: nítida em 15 px) |
| `cenarios/*.js` | sets reutilizáveis (estrada, Pedralva, castelo, Brumal) |
| `cenas/*.js` | cenas soltas e testes (elenco, poses, texto, miniatura) |
| `ferramentas/folha.sh` | junta quadros numa folha de contato para revisão |
