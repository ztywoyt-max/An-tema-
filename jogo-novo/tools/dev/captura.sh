#!/bin/bash
# Tira uma captura de tela do jogo sem monitor (Xvfb + Vulkan por software).
# Uso: captura.sh saida.png "x,y,z" "olhar_x,y,z" [args extras do jogo...]
set -e
DIR="$(cd "$(dirname "$0")/../../game" && pwd)"
OUT="$1"; CAM="$2"; LOOK="$3"; shift 3
RES="${RES:-1280x720}"
xvfb-run -a -s "-screen 0 ${RES}x24" godot --path "$DIR" --audio-driver Dummy --resolution "$RES" \
  -- --shot="$OUT" --cam="$CAM" --look="$LOOK" "$@" 2>&1 | grep -vE "^$|ALSA|audio_driver|dummy driver|Godot Engine|Vulkan .* - Forward|at: " || true
