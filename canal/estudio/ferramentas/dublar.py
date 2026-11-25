#!/usr/bin/env python3
"""Dublagem local, sem chave nem conta: Chatterbox multilíngue (Resemble AI, licença MIT, uso comercial).

Cada personagem tem uma voz de referência própria (feita com o Kokoro, licença Apache, misturando timbres e
ajustando o tom). O Chatterbox clona essa referência e fala cada linha com entonação natural. Cada fala é
conferida pelo Whisper: se a transcrição não bater com o roteiro, ela é gerada de novo.

  ferramentas/dublar.sh referencias cavaleiro          cria/atualiza as vozes de referência (vozes/refs/*.wav)
  ferramentas/dublar.sh gerar cavaleiro [--cap 1]      um MP3 por fala (só o que mudou) + duracoes.json
  ferramentas/dublar.sh gerar cavaleiro --so ab.01,c1.03 --refazer
  ferramentas/dublar.sh gerar cavaleiro --so 1.4.02 --refazer --variar 1 --tentativas 8 --exigir 0.97 --ouvido medium   (outra leitura, conferida com rigor)

A configuração de cada voz fica em filmes/<filme>/elenco.json, na chave "local" de cada personagem.
O Chatterbox põe uma marca d'água inaudível (Perth) em todo áudio gerado; ela continua ligada.
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
os.environ.setdefault('TRANSFORMERS_VERBOSITY', 'error')

import librosa  # noqa: E402
import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
VERSAO = 'chatterbox-mtl-v3'  # muda o hash: força refazer tudo se o processo mudar
LUFS = -19.0


def ler(p, padrao=None):
    return json.loads(Path(p).read_text()) if Path(p).exists() else padrao


def salvar(p, d):
    Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def normalizar(s):
    from num2words import num2words
    s = re.sub(r'\d+', lambda m: ' ' + num2words(int(m.group()), lang='pt_BR') + ' ', s)
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z ]+', ' ', s).split()


def parecido(a, b):
    """Semelhança letra a letra (um nome escrito diferente pelo Whisper pesa pouco; palavra trocada pesa)."""
    return difflib.SequenceMatcher(None, ' '.join(normalizar(a)), ' '.join(normalizar(b)), autojunk=False).ratio()


def texto_para_fala(t):
    t = t.strip()
    t = re.sub(r'^[.…\s]+', '', t)  # reticências no começo ("...Que diabo") só atrapalham
    t = t.replace('…', '...')
    return t


# ---------------------------------------------------------------- referências (Kokoro)

def referencias(filme, so=None):
    from kokoro import KPipeline
    pasta = RAIZ / 'filmes' / filme
    elenco = ler(pasta / 'elenco.json')
    refs = pasta / 'vozes' / 'refs'
    refs.mkdir(parents=True, exist_ok=True)
    pipe = KPipeline(lang_code='p', repo_id='hexgrad/Kokoro-82M')
    for nome, v in elenco['vozes'].items():
        loc = v.get('local')
        if not loc or (so and nome not in so):
            continue
        mistura = sum(pipe.load_voice(k) * peso for k, peso in loc['mistura'].items())
        mistura = mistura / sum(loc['mistura'].values())
        pedacos = [a.numpy() for _, _, a in pipe(loc['frase'], voice=mistura, speed=loc.get('velRef', 0.95))]
        a = np.concatenate(pedacos)
        if loc.get('tom'):
            a = librosa.effects.pitch_shift(a, sr=24000, n_steps=loc['tom'])
        a = a / (np.abs(a).max() + 1e-6) * 0.9
        sf.write(refs / f'{nome}.wav', a, 24000)
        f0 = tom_medio(a, 24000)
        print(f'{nome:12s} {len(a) / 24000:5.1f}s  tom {f0:5.0f} Hz')


def tom_medio(a, sr):
    f0, voz, _ = librosa.pyin(librosa.resample(a, orig_sr=sr, target_sr=16000), fmin=60, fmax=500, sr=16000)
    f0 = f0[voz] if voz is not None else f0
    return float(np.nanmedian(f0)) if np.any(~np.isnan(f0)) else 0.0


# ---------------------------------------------------------------- geração (Chatterbox + conferência)

class Dublador:
    def __init__(self, ouvido='small'):
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        from faster_whisper import WhisperModel
        torch.set_num_threads(os.cpu_count() or 4)
        self.tts = ChatterboxMultilingualTTS.from_pretrained('cpu')
        self.asr = WhisperModel(ouvido, device='cpu', compute_type='int8')
        self.ref_atual = None
        self.nomes = ''

    def transcrever(self, a, sr):
        a16 = librosa.resample(a, orig_sr=sr, target_sr=16000)
        segs, _ = self.asr.transcribe(a16, language='pt', beam_size=5, word_timestamps=True, vad_filter=False,
                                      initial_prompt=self.nomes or None)
        segs = list(segs)
        texto = ' '.join(s.text.strip() for s in segs)
        palavras = [p for s in segs for p in (s.words or [])]
        return texto, palavras

    def falar(self, texto, ref, loc, semente):
        if ref != self.ref_atual:
            self.tts.prepare_conditionals(str(ref), exaggeration=loc.get('exagero', 0.5))
            self.ref_atual = ref
        torch.manual_seed(semente)
        wav = self.tts.generate(texto, language_id='pt', exaggeration=loc.get('exagero', 0.5),
                                cfg_weight=loc.get('cfg', 0.45), temperature=loc.get('temperatura', 0.8))
        return wav.squeeze(0).numpy().astype(np.float32), self.tts.sr


def frases(t):
    """Divide a fala em frases (também nas reticências), com a pausa que vem depois de cada uma.
    Gerar frase por frase dá as pausas de quem conta uma história, em vez de tudo emendado."""
    pedacos = [x for x in re.split(r'(?<=[.!?])\s+', t.strip()) if x]
    juntos = []
    for x in pedacos:  # pedaço muito curto ("Ei!") vai junto com o seguinte
        if juntos and len(juntos[-1]) < 6:
            juntos[-1] += ' ' + x
        else:
            juntos.append(x)
    saida = []
    for i, x in enumerate(juntos):
        if i == len(juntos) - 1:
            pausa = 0.0
        elif x.endswith('...'):
            pausa = 0.6
        elif x.endswith(('?', '!')):
            pausa = 0.42
        else:
            pausa = 0.36
        saida.append((x, pausa))
    return saida


def volume(a, sr):
    import pyloudnorm as pyln
    try:
        alto = pyln.Meter(sr, block_size=min(0.4, len(a) / sr * 0.9)).integrated_loudness(a)
        if np.isfinite(alto):
            a = pyln.normalize.loudness(a, alto, LUFS)
    except ValueError:
        rms = np.sqrt(np.mean(a ** 2)) + 1e-9
        a = a * (0.08 / rms)
    pico = np.abs(a).max()
    return (a / pico * 0.97 if pico > 0.97 else a).astype(np.float32)


def recortar(a, sr, palavras):
    """Fica só com a fala: corta silêncio e qualquer ruído depois da última palavra."""
    if palavras:
        fim = min(len(a), int((palavras[-1].end + 0.22) * sr))
        ini = max(0, int((palavras[0].start - 0.1) * sr))
        a = a[ini:fim]
    a, _ = librosa.effects.trim(a, top_db=40, frame_length=1024, hop_length=256)
    n = int(0.012 * sr)
    if len(a) > 4 * n:
        a = a.copy()
        a[:n] *= np.linspace(0, 1, n)
        a[-2 * n:] *= np.linspace(1, 0, 2 * n)
    return a


def para_mp3(a, sr, destino, vel=1.0):
    with tempfile.NamedTemporaryFile(suffix='.wav') as t:
        sf.write(t.name, a, sr)
        filtro = ['-af', f'atempo={vel:.3f}'] if abs(vel - 1) > 0.005 else []
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', t.name, *filtro, '-ar', '44100', '-ac', '1', '-b:a', '128k', str(destino)], check=True)


def dublar_frase(d, texto, ref, loc, semente, tentativas, exigir=0.93):
    melhor = None
    for k in range(tentativas):
        a, sr = d.falar(texto, ref, loc, semente=semente + k * 7919)
        ouvido, palavras = d.transcrever(a, sr)
        nota = parecido(texto, ouvido)
        fala_s = (palavras[-1].end - palavras[0].start) if palavras else len(a) / sr
        ritmo = len(texto) / max(fala_s, 0.3)
        ok_ritmo = 5.5 <= ritmo <= 21.0
        pontos = nota - (0 if ok_ritmo else 0.25)
        if melhor is None or pontos > melhor[0]:
            melhor = (pontos, nota, recortar(a, sr, palavras), sr, ouvido, k + 1)
        if nota >= exigir and ok_ritmo:
            break
    return melhor[1:]


def gerar(filme, cap=None, so=None, refazer=False, tentativas=4, variar=0, exigir=0.93, ouvido='small'):
    pasta = RAIZ / 'filmes' / filme
    elenco = ler(pasta / 'elenco.json')
    falas = ler(pasta / 'falas.json')
    pv = pasta / 'vozes'
    pv.mkdir(exist_ok=True)
    arq_dur = pv / 'duracoes.json'
    dur = ler(arq_dur, {})
    alvo = [f for f in falas if (cap is None or str(f['capitulo']) == str(cap)) and (not so or f['id'] in so)]
    pendentes = []
    for f in alvo:
        loc = elenco['vozes'][f['voz']].get('local')
        if not loc:
            sys.exit(f'A voz "{f["voz"]}" não tem configuração "local" no elenco.json')
        ref = pv / 'refs' / f'{f["voz"]}.wav'
        if not ref.exists():
            sys.exit(f'Falta a referência {ref}. Rode: ferramentas/dublar.sh referencias {filme}')
        h = hashlib.sha1(json.dumps([f['texto'], loc, VERSAO, hashlib.sha1(ref.read_bytes()).hexdigest()],
                                    ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
        if not refazer and dur.get(f['id'], {}).get('hash') == h and (pv / f'{f["id"]}.mp3').exists():
            continue
        pendentes.append((f, loc, ref, h))
    if not pendentes:
        print('nada a fazer: todas as falas estão em dia')
        return
    print(f'{len(pendentes)} falas para dublar')
    d = Dublador(ouvido)
    d.nomes = elenco.get('nomesProprios', '')
    t0 = time.time()
    relatorio = ler(pv / 'conferencia.json', {})
    # agrupa por voz para preparar a referência uma vez só
    pendentes.sort(key=lambda x: (x[0]['voz'], falas.index(x[0])))
    for i, (f, loc, ref, h) in enumerate(pendentes, 1):
        texto = texto_para_fala(f['texto'])
        semente = 1000 + int(h[:6], 16) % 997 + variar * 104729
        partes, notas, ouvidos, n = [], [], [], 0
        sr = d.tts.sr
        for j, (frase, pausa) in enumerate(frases(texto)):
            nota, a, sr, ouvido, k = dublar_frase(d, frase, ref, loc, semente + j * 31, tentativas, exigir)
            partes += [volume(a, sr), np.zeros(int(pausa * loc.get('pausa', 1.0) * sr), np.float32)]
            notas.append((nota, len(frase)))
            ouvidos.append(ouvido)
            n += k
        nota = sum(x * c for x, c in notas) / sum(c for _, c in notas)
        ouvido = ' '.join(ouvidos)
        a = np.concatenate([np.zeros(int(0.04 * sr), np.float32), *partes])
        destino = pv / f'{f["id"]}.mp3'
        para_mp3(a, sr, destino, loc.get('vel', 1.0))
        segundos = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(destino)],
                                        capture_output=True, text=True).stdout)
        dur[f['id']] = {'dur': round(segundos, 3), 'hash': h}
        salvar(arq_dur, dur)
        relatorio[f['id']] = {'voz': f['voz'], 'nota': round(nota, 3), 'tentativas': n, 'ouvido': ouvido}
        salvar(pv / 'conferencia.json', relatorio)
        gasto = time.time() - t0
        resta = gasto / i * (len(pendentes) - i)
        aviso = '' if nota >= 0.85 else '  <-- conferir'
        print(f'[{i}/{len(pendentes)}] {f["id"]:7s} {f["voz"]:11s} {segundos:5.1f}s nota {nota:.2f} ({n}x)  ~{resta / 60:.0f} min restantes{aviso}', flush=True)
    ruins = [k for k, v in relatorio.items() if v['nota'] < 0.85]
    print(f'pronto em {(time.time() - t0) / 60:.0f} min. Falas com nota baixa: {ruins or "nenhuma"}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('comando', choices=['referencias', 'gerar'])
    ap.add_argument('filme', nargs='?', default='cavaleiro')
    ap.add_argument('--cap')
    ap.add_argument('--so', help='ids (ou nomes de voz, em "referencias") separados por vírgula')
    ap.add_argument('--refazer', action='store_true')
    ap.add_argument('--tentativas', type=int, default=4, help='tentativas por frase até passar na conferência')
    ap.add_argument('--variar', type=int, default=0, help='troca a semente (outra leitura da mesma fala)')
    ap.add_argument('--exigir', type=float, default=0.93, help='nota mínima da conferência para aceitar uma frase')
    ap.add_argument('--ouvido', default='small', help='modelo do Whisper que confere (small, medium)')
    a = ap.parse_args()
    so = set(a.so.split(',')) if a.so else None
    if a.comando == 'referencias':
        referencias(a.filme, so)
    else:
        gerar(a.filme, a.cap, so, a.refazer, a.tentativas, a.variar, a.exigir, a.ouvido)
