#!/usr/bin/env bash
# Dublagem local (Chatterbox + Kokoro + Whisper), sem chave. Na primeira vez instala o ambiente Python
# em estudio/.voz (uns 6 GB) e baixa os modelos do Hugging Face (uns 4 GB).
# Uso: ferramentas/dublar.sh referencias cavaleiro | ferramentas/dublar.sh gerar cavaleiro [--cap 1]
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x .voz/bin/python ]; then
  echo "instalando o ambiente de voz (só na primeira vez)..."
  uv venv -q -p python3.12 .voz
  uv pip install -q -p .voz/bin/python chatterbox-tts kokoro "misaki[en]" faster-whisper soundfile pyloudnorm num2words "setuptools<81"
fi
export HF_HUB_DISABLE_XET=1
exec .voz/bin/python ferramentas/dublar.py "$@"
