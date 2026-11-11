#!/bin/bash
# Várias animações numa imagem só (uma faixa por clipe, vista 3/4 de frente).
# Uso: folhas.sh saida.png clipe1 clipe2 ...   (variáveis: N=6 VIEW=frente|tras|lado)
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$1"; shift
N="${N:-6}"; VIEW="${VIEW:-frente}"
TMP="$(mktemp -d)"
D=$(python3 -c "print($N*1.3*0.5+1.2)")
i=0
for CLIP in "$@"; do
  case "$VIEW" in
    tras)  CAM="1.0,1.9,$(python3 -c "print(14+$D)")"; REV="" ;;
    lado)  CAM="$(python3 -c "print(-$D*0.9)"),1.4,$(python3 -c "print(14-$D*0.45)")"; REV="--rev=1" ;;
    *)     CAM="1.6,1.5,$(python3 -c "print(14-$D)")"; REV="--rev=1" ;;
  esac
  RES=1500x430 "$HERE/captura.sh" "$TMP/$i.png" "$CAM" "0,0.95,14" --anim="$CLIP" --n="$N" --fov=30 $REV > "$TMP/$i.log" 2>&1 &
  i=$((i+1))
  if [ $((i % 4)) -eq 0 ]; then wait; fi
done
wait
grep -hE "ERROR|SCRIPT|não encontrado" "$TMP"/*.log | sort | uniq -c | head -20
python3 - "$TMP" "$OUT" "$@" <<'PY'
import sys, os
from PIL import Image, ImageDraw
t, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
ims = []
for i, n in enumerate(names):
    p = f"{t}/{i}.png"
    if os.path.exists(p):
        im = Image.open(p).convert("RGB")
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 190, 26], fill=(20, 20, 60))
        d.text((6, 6), n, fill=(255, 255, 255))
        ims.append(im)
if ims:
    s = Image.new("RGB", (ims[0].width, sum(im.height for im in ims)))
    y = 0
    for im in ims:
        s.paste(im, (0, y)); y += im.height
    s.save(out)
PY
rm -rf "$TMP"
