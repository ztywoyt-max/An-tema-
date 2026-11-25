#!/usr/bin/env bash
# Produz um filme inteiro de ponta a ponta:
# falas do roteiro -> vozes (ElevenLabs) -> vídeo completo -> texto do YouTube -> miniatura.
# Uso: ferramentas/produzir.sh cavaleiro ../roteiros/01-o-cavaleiro-sem-armadura.md [--escala 10]
set -euo pipefail
cd "$(dirname "$0")/.."
filme="${1:-cavaleiro}"
roteiro="${2:-../roteiros/01-o-cavaleiro-sem-armadura.md}"
shift 2 || true

echo "== falas"
node ferramentas/roteiro.mjs "$roteiro" "filmes/$filme/falas.json"

echo "== vozes"
if node ferramentas/vozes.mjs testar "$filme"; then
  node ferramentas/vozes.mjs escalar "$filme"
  node ferramentas/vozes.mjs gerar "$filme"
else
  echo "Sem chave da ElevenLabs: o filme sai sem vozes (durações estimadas)."
fi

echo "== vídeo"
node ferramentas/montar.mjs "$filme" --tudo "$@"

echo "== YouTube"
node ferramentas/youtube.mjs "$filme"
node render.mjs miniatura --quadros 0.5 >/dev/null
ffmpeg -v error -y -i saida/miniatura-0.5s.png -vf "scale=1280:720:flags=area" -q:v 2 "saida/$filme-miniatura.jpg"
echo "pronto: saida/$filme-completo.mp4, .srt, -youtube.txt e -miniatura.jpg"
