# Canal de histórias narradas

Projeto separado do jogo ANÁTEMA: vídeos longos de histórias originais, narradas. O visual atual é o **motor HD**
(estilo PS2/PS3, souls like); o Estúdio PS1 ficou como referência (o dono achou a qualidade baixa demais).

| Pasta | Conteúdo |
|---|---|
| `roteiros/` | Roteiros completos em Markdown (fonte única das falas) |
| `estudio/` | **Estúdio PS1**: motor 3D, cenários, personagens, áudio e renderização |
| `estudio/filmes/<nome>/` | Um filme: planos por capítulo (`filme.js`, `cap*.js`), elenco, falas e vozes |

## Fluxo de um filme no motor HD (atual)

A imagem é travada antes das vozes: cada fala tem um espaço fixo (`filmes/<filme>/tempos.json`) e a dublagem
é encaixada nele depois. Sem vozes, o filme sai com trilha, ambiente e efeitos.

```bash
cd estudio && npm ci
# 1. imagem (1080p, 24 quadros/s; ~10 s por quadro por processo; retomável)
node ferramentas/render-hd.mjs cavaleiro-hd --cap todos                  # pode rodar 3 de uma vez
node ferramentas/render-hd.mjs cavaleiro-hd --cap todos --ordem reversa  # (cada plano é travado por quem o faz)
node ferramentas/render-hd.mjs cavaleiro-hd --cap 2 --previa             # 640x360 para conferir
node ferramentas/foto-hd.mjs ...                                         # um quadro solto / folha de contato
# 2. vozes (ElevenLabs; chave no ambiente: Network secret de api.elevenlabs.io, cabeçalho xi-api-key)
node ferramentas/vozes.mjs tudo cavaleiro-hd     # confere a chave, escolhe as vozes, gera e encaixa as falas
# 3. som: música e ambiente por plano + efeitos sincronizados (filmes/<filme>/som.js) + vozes, se houver
node ferramentas/som-hd.mjs cavaleiro-hd --tabela   # ordem dos planos (para a exportação)
node ferramentas/som-hd.mjs cavaleiro-hd            # saida/hd/<filme>/som.wav
# 4. arquivo para o YouTube (280 MiB, -14 LUFS; sem vozes use --lufs -16)
node ferramentas/exportar-hd.mjs cavaleiro-hd
```

Entrega: `saida/hd/<filme>-youtube.mp4`, `saida/hd/<filme>-youtube.txt` e `saida/hd/<filme>-miniatura-a/b.jpg`
(as miniaturas saem de `cenas-hd/miniatura-hd.js`).

| Arquivo (motor HD) | O quê |
|---|---|
| `motor-hd/filme.js`, `hd.html` | executa um filme: cenários e atores montados uma vez, troca por plano |
| `motor-hd/boneco.js`, `pessoa.js`, `cabeca.js`, `maos.js`, `roupas.js` | corpo por SDF com esqueleto, rosto, mãos e roupas |
| `motor-hd/natureza.js`, `aldeia.js`, `efeitos.js`, `cavalo.js` | terreno, mato, árvores, céu, casas, fogo, chuva, cavalo |
| `motor-hd/materiais.js`, `texturas.js`, `pos.js` | texturas PBR por código, névoa, pós (AO, bloom, cor, grão) |
| `filmes/cavaleiro-hd/` | planos (`filme.js`), cenários, elenco, poses, som e espaços das falas |

## Fluxo de um filme no Estúdio PS1 (antigo)

```bash
cd estudio && npm ci
# 1. falas: extraídas do roteiro (narração e personagens)
node ferramentas/roteiro.mjs ../roteiros/01-o-cavaleiro-sem-armadura.md filmes/cavaleiro/falas.json
# 2. vozes: dublagem local, sem chave nem conta (Chatterbox multilíngue, MIT, uso comercial).
#    Cada personagem tem uma voz de referência (Kokoro, Apache) configurada em elenco.json -> "local".
#    Cada frase é gerada e conferida pelo Whisper; se não bater com o roteiro, é gerada de novo.
#    Precisa do Hugging Face liberado na rede do ambiente (huggingface.co e us.aws.cdn.hf.co).
ferramentas/dublar.sh referencias cavaleiro     # vozes de referência (filmes/<filme>/vozes/refs)
ferramentas/dublar.sh gerar cavaleiro           # um MP3 por fala (só o que mudou); ~15 s de CPU por s de fala
#    (alternativa paga: ferramentas/vozes.mjs, pela ElevenLabs, com a chave salva no ambiente)
# 3. vídeo: cada capítulo se ajusta sozinho à duração real das vozes
node ferramentas/linha.mjs cavaleiro 1          # linha do tempo de um capítulo
node render.mjs --filme cavaleiro --cap 1       # um capítulo (MP4 + legendas .srt)
node ferramentas/montar.mjs cavaleiro --tudo    # filme completo
node ferramentas/exportar.mjs cavaleiro         # arquivo para o PC/YouTube, uns 280 MB, volume -14 LUFS
node ferramentas/youtube.mjs cavaleiro          # título, descrição com capítulos e tags
node render.mjs miniatura --quadros 0.5         # miniatura
```

Tudo de uma vez (é o que usar quando o dono pedir para "aplicar as vozes"):

```bash
cd estudio && ferramentas/produzir.sh cavaleiro ../roteiros/01-o-cavaleiro-sem-armadura.md
```

Entrega: `saida/<filme>-youtube.mp4` (o app recusou 462 MiB, então o alvo é 280 MiB; o `-completo.mp4` tem
mais de 1 GB), `saida/<filme>-youtube.txt` e `saida/<filme>-miniatura-a/b.jpg`.

Sem vozes, as durações são estimadas e o filme sai sem falas (não há legendas nem caixas de texto:
o dono não quer). Ao gerar as vozes, basta renderizar de novo: tudo se reajusta.
O relatório da conferência de cada fala fica em `filmes/<filme>/vozes/conferencia.json`.

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
