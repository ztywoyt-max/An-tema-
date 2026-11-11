#!/bin/bash
# Roda os testes automáticos do jogo (sem janela, em tempo acelerado).
# Uso: testes.sh [nome_do_teste|all]
DIR="$(cd "$(dirname "$0")/../../game" && pwd)"
godot --headless --fixed-fps 120 --path "$DIR" -- --test="${1:-all}" 2>&1 \
  | grep -vE "^$|Godot Engine|RID alloc|leaked|PagedAllocator|resources still|ObjectDB|^\s+at: |~List|Leaked"
exit "${PIPESTATUS[0]}"
