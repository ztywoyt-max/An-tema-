#!/bin/bash
# Folha de contato de uma animação: vista de frente (3/4) em cima, de trás embaixo.
# Uso: folha.sh clipe saida.png [n] [args extras]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
CLIP="$1"; OUT="$2"; N="${3:-6}"; shift 3 || shift $#
TMP="$(mktemp -d)"
D=$(python3 -c "print($N*1.3*0.56+0.9)")
RES=1800x600 "$HERE/captura.sh" "$TMP/a.png" "1.2,1.5,$(python3 -c "print(14-$D)")" "0,0.92,14" --anim="$CLIP" --n="$N" --fov=30 --rev=1 "$@" > "$TMP/a.log" 2>&1 &
RES=1800x600 "$HERE/captura.sh" "$TMP/b.png" "0.8,1.9,$(python3 -c "print(14+$D)")" "0,0.92,14" --anim="$CLIP" --n="$N" --fov=30 "$@" > "$TMP/b.log" 2>&1 &
wait
grep -hE "ERROR|error|clipe" "$TMP/a.log" | head -20 || true
python3 - "$TMP" "$OUT" <<'PY'
import sys
from PIL import Image
t, out = sys.argv[1], sys.argv[2]
a = Image.open(t + "/a.png"); b = Image.open(t + "/b.png")
s = Image.new("RGB", (a.width, a.height + b.height))
s.paste(a, (0, 0)); s.paste(b, (0, a.height))
s.save(out)
PY
rm -rf "$TMP"
