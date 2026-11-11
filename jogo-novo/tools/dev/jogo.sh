#!/bin/bash
# Captura o jogo pela câmera do jogador (com HUD), sem monitor.
# Uso: jogo.sh saida.png [args extras, ex.: --bot=combo --wait=3]
set -e
DIR="$(cd "$(dirname "$0")/../../game" && pwd)"
OUT="$1"; shift
RES="${RES:-1600x900}"
xvfb-run -a -s "-screen 0 ${RES}x24" godot --path "$DIR" --audio-driver Dummy --resolution "$RES" \
  -- --play --shot="$OUT" "$@" 2>&1 | grep -vE "^$|ALSA|audio_driver|dummy driver|Godot Engine|Vulkan .* - Forward|at: " || true
