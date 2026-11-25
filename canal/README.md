# Canal de histórias em gráfico de PS1

| Pasta | Conteúdo |
|---|---|
| `roteiros/` | Roteiros completos, cena por cena (narração, falas, luz, som) |
| `estudio/` | **Estúdio PS1**: motor que monta as cenas em 3D low-poly e grava o vídeo |

## Estúdio PS1

Feito com Three.js num navegador sem janela (Playwright) e ffmpeg. Imita o PlayStation 1 de verdade:
luz por vértice, textura sem correção de perspectiva, vértices presos à grade de pixels, neblina por vértice,
cor em 15 bits com pontilhado, resolução interna 384×216 (ampliada sem borrar para 1920×1080).

```bash
cd estudio && npm ci
node render.mjs cap1-estrada                     # vídeo em saida/cap1-estrada.mp4
node render.mjs cap1-estrada --quadros 6,12,20   # quadros soltos em PNG
node render.mjs cap1-estrada --escala 10         # 4K (o YouTube comprime menos vídeos 4K)
```

Para ver ao vivo: sirva a pasta `estudio/` e abra `index.html?cena=cap1-estrada`.

| Arquivo | O quê |
|---|---|
| `motor/ps1.js` | shader PS1, pós-processamento (pontilhado, vinheta, fade) e luzes |
| `motor/texturas.js` | texturas geradas por código (pele, pano, ferrugem, capacete com riscos, terra, mato…) |
| `motor/personagem.js` | personagens de peças rígidas, caminhada e pose parada |
| `motor/objetos.js` | cenário: estrada, chão, pinheiros, árvores secas, carroça, lanterna, halos, lua, neblina |
| `motor/hud.js` | tela de capítulo e caixa de diálogo com texto em pixel duro |
| `cenas/*.js` | uma cena por arquivo: monta o cenário e anima por tempo (`atualizar(t)`) |
