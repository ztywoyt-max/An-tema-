#!/usr/bin/env bash
# Produz um filme inteiro de ponta a ponta:
# falas do roteiro -> vozes (dublagem local) -> vídeo completo -> arquivo para o PC -> texto do YouTube -> miniatura.
# Uso: ferramentas/produzir.sh cavaleiro ../roteiros/01-o-cavaleiro-sem-armadura.md [--escala 10]
set -euo pipefail
cd "$(dirname "$0")/.."
filme="${1:-cavaleiro}"
roteiro="${2:-../roteiros/01-o-cavaleiro-sem-armadura.md}"
shift 2 || true

echo "== falas"
node ferramentas/roteiro.mjs "$roteiro" "filmes/$filme/falas.json"

echo "== vozes (dublagem local, sem chave: Chatterbox + Kokoro, conferida pelo Whisper)"
[ -d "filmes/$filme/vozes/refs" ] || ferramentas/dublar.sh referencias "$filme"
ferramentas/dublar.sh gerar "$filme"

echo "== vídeo"
node ferramentas/montar.mjs "$filme" --tudo "$@"

echo "== arquivo para o PC (menos de 500 MB, o limite de envio)"
node ferramentas/exportar.mjs "$filme"

echo "== YouTube"
node ferramentas/youtube.mjs "$filme"
# duas miniaturas (A e B) para o "Testar e comparar" do YouTube, em 1280x720
for v in a b; do
  node render.mjs miniatura --q "res=640x360&v=$v" --escala 2 --quadros 0.5 >/dev/null
  ffmpeg -v error -y -i saida/miniatura-0.5s.png -q:v 2 "saida/$filme-miniatura-$v.jpg"
done
echo "pronto: saida/$filme-youtube.mp4 (para enviar), -youtube.txt e -miniatura-a/b.jpg"
