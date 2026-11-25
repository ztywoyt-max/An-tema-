#!/usr/bin/env bash
# Junta várias imagens numa folha de contato 2 colunas (cada quadro reduzido a 768x432).
# Uso: ferramentas/folha.sh saida.png img1.png img2.png ...
set -e
out="$1"; shift
n=$#
args=(); f=""; lay=""
i=0
for img in "$@"; do
  args+=(-i "$img")
  f+="[$i]scale=768:432:flags=neighbor[s$i];"
  col=$((i % 2)); lin=$((i / 2))
  lay+="$((col*768))_$((lin*432))|"
  i=$((i+1))
done
ins=""; for ((k=0;k<n;k++)); do ins+="[s$k]"; done
if [ $n -eq 1 ]; then cp "$1" "$out"; exit 0; fi
ffmpeg -v error -y "${args[@]}" -filter_complex "${f}${ins}xstack=inputs=$n:layout=${lay%|}:fill=black" "$out"
