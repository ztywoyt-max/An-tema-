// Áudio do filme, mixado offline no navegador (Web Audio):
// vozes (MP3 gerados), trilha sonora e ambiente gerados por código, efeitos sonoros sintetizados.
// A música abaixa sozinha enquanto alguém fala.
import { contexto } from './linha.js';

const SR = 48000;

function rng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nota = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz
const N = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const hz = (s) => {
  const m = s.match(/^([A-G][#b]?)(-?\d)$/);
  return nota(12 * (Number(m[2]) + 1) + N[m[1]]);
};

class Mesa {
  constructor(ctx, dur) {
    this.ctx = ctx;
    this.dur = dur;
    const r = rng(7);
    // ruído branco reutilizável
    this.ruido = ctx.createBuffer(1, SR * 4, SR);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    // reverb: resposta ao impulso sintética (cauda de ruído decaindo)
    const ir = ctx.createBuffer(2, SR * 3, SR);
    for (let c = 0; c < 2; c++) {
      const x = ir.getChannelData(c);
      for (let i = 0; i < x.length; i++) x[i] = (r() * 2 - 1) * Math.pow(1 - i / x.length, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const ret = ctx.createGain();
    ret.gain.value = 0.55;
    this.reverb.connect(ret);
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -14;
    this.master.ratio.value = 3;
    this.master.attack.value = 0.01;
    this.master.release.value = 0.25;
    // corta o sub-grave (zumbidos e tambores não embolam)
    const corte = ctx.createBiquadFilter();
    corte.type = 'highpass';
    corte.frequency.value = 45;
    this.master.connect(corte).connect(ctx.destination);
    ret.connect(this.master);
    this.bus = {};
    for (const [nome, vol] of Object.entries({ voz: 1.0, musica: 0.34, ambiente: 0.28, efeitos: 0.62 })) {
      const g = ctx.createGain();
      g.gain.value = vol;
      g.connect(this.master);
      this.bus[nome] = g;
    }
    this.envioReverb = {};
    for (const [nome, k] of Object.entries({ musica: 0.6, efeitos: 0.25, voz: 0.06 })) {
      const g = ctx.createGain();
      g.gain.value = k;
      this.bus[nome].connect(g);
      g.connect(this.reverb);
    }
    this.ks = new Map();
  }

  fonteRuido(t0, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruido;
    s.loop = true;
    s.loopStart = Math.random() * 3;
    s.start(Math.max(0, t0), (t0 * 7.13) % 3.5);
    s.stop(Math.max(0, t0 + dur + 0.05));
    return s;
  }

  env(t0, ataque, sustenta, solta, pico = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, Math.max(0, t0));
    g.gain.linearRampToValueAtTime(pico, Math.max(0, t0 + ataque));
    g.gain.setValueAtTime(pico, Math.max(0, t0 + ataque + sustenta));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(0, t0 + ataque + sustenta + solta));
    return g;
  }

  filtro(tipo, freq, q = 0.8) {
    const f = this.ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  pan(v) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = v;
    return p;
  }

  // corda dedilhada (Karplus-Strong): harpa/alaúde
  cordaBuf(freq, decai = 0.996, dur = 3) {
    const k = `${freq.toFixed(2)}-${decai}`;
    if (this.ks.has(k)) return this.ks.get(k);
    const r = rng(Math.round(freq * 13));
    const b = this.ctx.createBuffer(1, Math.round(SR * dur), SR);
    const x = b.getChannelData(0);
    const P = Math.max(2, Math.round(SR / freq));
    const fila = new Float32Array(P);
    for (let i = 0; i < P; i++) fila[i] = r() * 2 - 1;
    let ant = 0;
    for (let i = 0; i < x.length; i++) {
      const j = i % P;
      const v = fila[j];
      x[i] = v;
      fila[j] = decai * 0.5 * (v + ant);
      ant = v;
    }
    this.ks.set(k, b);
    return b;
  }

  corda(t, freq, { vol = 0.4, decai = 0.996, destino = this.bus.musica, pan = 0, brilho = 3000 } = {}) {
    if (t < 0) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.cordaBuf(freq, decai);
    const f = this.filtro('lowpass', brilho);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.pan(pan)).connect(destino);
    s.start(t);
  }

  // acorde sustentado: osciladores levemente desafinados passando por um passa-baixa
  pad(t0, dur, freqs, { tipo = 'sawtooth', corte = 900, vol = 0.12, ataque = 2, solta = 2.5, destino = this.bus.musica, detune = 8 } = {}) {
    if (t0 + dur < 0) return;
    const f = this.filtro('lowpass', corte, 0.5);
    const e = this.env(t0, ataque, Math.max(0, dur - ataque), solta, vol);
    f.connect(e).connect(destino);
    freqs.forEach((fr, i) => {
      for (const d of [-detune, detune]) {
        const o = this.ctx.createOscillator();
        o.type = tipo;
        o.frequency.value = fr;
        o.detune.value = d + i * 1.3;
        o.connect(f);
        o.start(Math.max(0, t0));
        o.stop(Math.max(0, t0 + dur + solta + 0.1));
      }
    });
  }

  zumbido(t0, dur, freq, { vol = 0.15, destino = this.bus.musica } = {}) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.003;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;
    const e = this.env(t0, 3, Math.max(0, dur - 3), 3, vol);
    // pulsação lenta
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = this.ctx.createGain();
    lg.gain.value = vol * 0.3;
    lfo.connect(lg).connect(e.gain);
    o.connect(e);
    o2.connect(g2).connect(e);
    e.connect(destino);
    for (const x of [o, o2, lfo]) {
      x.start(Math.max(0, t0));
      x.stop(Math.max(0, t0 + dur + 3.2));
    }
  }

  sino(t, freq, { vol = 0.12, destino = this.bus.musica } = {}) {
    if (t < 0) return;
    for (const [m, a, d] of [[1, 1, 4], [2.76, 0.5, 2.2], [5.4, 0.25, 1.2], [8.93, 0.12, 0.7]]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = freq * m;
      const e = this.env(t, 0.005, 0, d, vol * a);
      o.connect(e).connect(destino);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  tambor(t, { vol = 0.6, freq = 110, destino = this.bus.musica } = {}) {
    if (t < 0) return;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.42, t + 0.25);
    const e = this.env(t, 0.003, 0.02, 0.5, vol);
    o.connect(e).connect(destino);
    o.start(t);
    o.stop(t + 0.6);
    const n = this.fonteRuido(t, 0.12);
    const f = this.filtro('lowpass', 900);
    n.connect(f).connect(this.env(t, 0.001, 0, 0.1, vol * 0.4)).connect(destino);
  }

  ruidoFiltrado(t, dur, { tipo = 'bandpass', freq = 1000, freq2, q = 1, vol = 0.3, ataque = 0.01, solta = 0.1, destino = this.bus.efeitos, pan = 0 } = {}) {
    if (t + dur < 0) return;
    const n = this.fonteRuido(t, dur + solta);
    const f = this.filtro(tipo, freq, q);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, Math.max(0.001, t + dur));
    const e = this.env(t, ataque, Math.max(0, dur - ataque), solta, vol);
    n.connect(f).connect(e).connect(this.pan(pan)).connect(destino);
  }
}

// ---------------- trilha sonora ----------------
// Cada clima gera música para [t0, t0+dur]. Tudo original e determinístico.

const CLIMAS = {
  abertura(m, t0, dur, r) {
    m.zumbido(t0, dur, hz('D2'), { vol: 0.11 });
    const acordes = [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3'], ['G2', 'A#2', 'D3'], ['A2', 'C#3', 'E3']];
    for (let i = 0, t = t0; t < t0 + dur; i++, t += 8) m.pad(t, 8.5, acordes[i % 4].map(hz), { corte: 700, vol: 0.09 });
    const melodia = ['D4', 'F4', 'E4', 'C4', 'D4', 'A3', 'A#3', 'A3'];
    for (let i = 0, t = t0 + 3; t < t0 + dur - 2; i++, t += 2.6 + r() * 0.8) m.corda(t, hz(melodia[i % melodia.length]), { vol: 0.35, pan: (r() - 0.5) * 0.6 });
  },
  noite(m, t0, dur, r) {
    m.zumbido(t0, dur, hz('A1'), { vol: 0.12 });
    const ac = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3']];
    for (let i = 0, t = t0; t < t0 + dur; i++, t += 10) m.pad(t, 10.5, ac[i % 2].map(hz), { corte: 500, vol: 0.07, tipo: 'triangle' });
    for (let t = t0 + 4; t < t0 + dur - 3; t += 5 + r() * 4) m.corda(t, hz(['E3', 'A3', 'C4', 'B3'][Math.floor(r() * 4)]), { vol: 0.22, brilho: 1800 });
  },
  tensao(m, t0, dur, r) {
    m.zumbido(t0, dur, hz('E1'), { vol: 0.16 });
    m.pad(t0, dur, [hz('E2'), hz('F2')], { corte: 380, vol: 0.1 });
    // pulsação grave
    for (let t = t0 + 0.5; t < t0 + dur; t += 0.75) m.tambor(t, { vol: 0.18, freq: 70 });
    for (let t = t0 + 3; t < t0 + dur - 2; t += 6) m.sino(t, hz('A#4'), { vol: 0.035 });
  },
  presenca(m, t0, dur, r) {
    m.zumbido(t0, dur, hz('D1'), { vol: 0.2 });
    m.pad(t0, dur, ['D3', 'E3', 'A3'].map(hz), { tipo: 'triangle', corte: 1100, vol: 0.08, ataque: 4 });
    for (let t = t0 + 1; t < t0 + dur; t += 1.6) {
      m.tambor(t, { vol: 0.22, freq: 60 });
      m.tambor(t + 0.28, { vol: 0.13, freq: 55 });
    }
  },
  impacto(m, t0, dur, r) {
    m.tambor(t0 + 0.1, { vol: 0.9, freq: 80 });
    m.pad(t0 + 0.1, 1.5, ['D2', 'G#2', 'D3'].map(hz), { corte: 1400, vol: 0.14, ataque: 0.02, solta: 3 });
    m.zumbido(t0, dur, hz('C#2'), { vol: 0.14 });
    m.pad(t0 + 1, dur - 1, ['D3', 'D#3'].map(hz), { tipo: 'triangle', corte: 900, vol: 0.06, ataque: 3 });
  },
  acao(m, t0, dur, r) {
    const bpm = 132, b = 60 / bpm;
    const baixo = ['D2', 'D2', 'F2', 'D2', 'E2', 'D2', 'C2', 'D2'];
    for (let i = 0, t = t0; t < t0 + dur; i++, t += b / 2) {
      if (i % 4 === 0 || i % 8 === 3) m.tambor(t, { vol: 0.5, freq: 95 });
      if (i % 8 === 6) m.tambor(t, { vol: 0.35, freq: 140 });
      m.pad(t, b / 2 - 0.02, [hz(baixo[i % 8])], { corte: 650, vol: 0.09, ataque: 0.01, solta: 0.08 });
    }
    m.pad(t0, dur, ['D3', 'A3'].map(hz), { corte: 1200, vol: 0.06, ataque: 0.5 });
  },
  calma(m, t0, dur, r) {
    const ac = [['F2', 'A2', 'C3'], ['C2', 'E2', 'G2'], ['D2', 'F2', 'A2'], ['A#1', 'D2', 'F2']];
    for (let i = 0, t = t0; t < t0 + dur; i++, t += 6) {
      m.pad(t, 6.5, ac[i % 4].map(hz), { tipo: 'triangle', corte: 900, vol: 0.1 });
      const arp = ac[i % 4].map((s) => s.replace(/\d$/, (d) => String(Number(d) + 2)));
      arp.forEach((s, k) => m.corda(t + 0.5 + k * 0.7, hz(s), { vol: 0.22, brilho: 2500, pan: (k - 1) * 0.3 }));
    }
  },
  aurora(m, t0, dur, r) {
    const ac = [['D3', 'F#3', 'A3'], ['G2', 'B2', 'D3'], ['B2', 'D3', 'F#3'], ['A2', 'C#3', 'E3']];
    for (let i = 0, t = t0; t < t0 + dur; i++, t += 5) m.pad(t, 5.5, ac[i % 4].map(hz), { tipo: 'triangle', corte: 1500, vol: 0.1 });
    const mel = ['A4', 'F#4', 'D4', 'E4', 'F#4', 'A4', 'B4', 'A4', 'F#4', 'E4', 'D4'];
    for (let i = 0, t = t0 + 1; t < t0 + dur - 1; i++, t += 0.9 + (i % 3 === 2 ? 0.6 : 0)) m.corda(t, hz(mel[i % mel.length]), { vol: 0.28, brilho: 4000, pan: Math.sin(i) * 0.4 });
  },
};

// ---------------- ambiente ----------------
const AMBIENTES = {
  vento(m, t0, dur, r) {
    for (const lado of [-0.6, 0.6]) {
      const n = m.fonteRuido(t0, dur);
      const f = m.filtro('lowpass', 500, 0.7);
      const lfo = m.ctx.createOscillator();
      lfo.frequency.value = 0.07 + r() * 0.05;
      const lg = m.ctx.createGain();
      lg.gain.value = 300;
      lfo.connect(lg).connect(f.frequency);
      const e = m.env(t0, 1.5, Math.max(0, dur - 1.5), 1.5, 0.5);
      n.connect(f).connect(e).connect(m.pan(lado)).connect(m.bus.ambiente);
      lfo.start(Math.max(0, t0));
      lfo.stop(Math.max(0, t0 + dur + 2));
    }
  },
  grilos(m, t0, dur, r) {
    for (let k = 0; k < 4; k++) {
      const freq = 4200 + r() * 900, pan = (r() - 0.5) * 1.6;
      for (let t = t0 + r() * 2; t < t0 + dur - 0.3; t += 0.9 + r() * 1.5) {
        for (let i = 0; i < 3; i++) {
          const o = m.ctx.createOscillator();
          o.frequency.value = freq;
          const e = m.env(t + i * 0.06, 0.005, 0.02, 0.02, 0.05);
          o.connect(e).connect(m.pan(pan)).connect(m.bus.ambiente);
          o.start(Math.max(0, t + i * 0.06));
          o.stop(Math.max(0, t + i * 0.06 + 0.08));
        }
      }
    }
  },
  passaros(m, t0, dur, r) {
    for (let t = t0 + 1; t < t0 + dur - 1; t += 0.6 + r() * 2.2) {
      const o = m.ctx.createOscillator();
      const f0 = 2400 + r() * 1500;
      o.frequency.setValueAtTime(f0, Math.max(0, t));
      o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + r() * 0.5), Math.max(0, t + 0.08));
      o.frequency.exponentialRampToValueAtTime(f0 * 0.9, Math.max(0, t + 0.16));
      const e = m.env(t, 0.01, 0.06, 0.08, 0.06);
      o.connect(e).connect(m.pan((r() - 0.5) * 1.4)).connect(m.bus.ambiente);
      o.start(Math.max(0, t));
      o.stop(Math.max(0, t + 0.3));
    }
  },
  chuva(m, t0, dur) {
    m.ruidoFiltrado(t0, dur, { tipo: 'highpass', freq: 1500, vol: 0.5, ataque: 1.5, solta: 1.5, destino: m.bus.ambiente });
    m.ruidoFiltrado(t0, dur, { tipo: 'lowpass', freq: 400, vol: 0.4, ataque: 1.5, solta: 1.5, destino: m.bus.ambiente });
  },
  fogo(m, t0, dur, r) {
    m.ruidoFiltrado(t0, dur, { tipo: 'lowpass', freq: 600, vol: 0.25, ataque: 1, solta: 1, destino: m.bus.ambiente });
    for (let t = t0; t < t0 + dur; t += 0.05 + r() * 0.25) m.ruidoFiltrado(t, 0.01, { tipo: 'highpass', freq: 2000 + r() * 3000, vol: 0.1 + r() * 0.2, ataque: 0.001, solta: 0.03, destino: m.bus.ambiente, pan: (r() - 0.5) });
  },
};

// ---------------- efeitos ----------------
const EFEITOS = {
  arrastoEspada(m, t, { dur = 3, longe = 0 }, r) {
    const vol = longe ? 0.12 : 0.3;
    for (let k = t; k < t + dur; k += 0.64) {
      m.ruidoFiltrado(k, 0.45, { freq: 2600 + r() * 600, q: 6, vol, ataque: 0.05, solta: 0.15 });
      m.ruidoFiltrado(k + 0.05, 0.3, { freq: 4300, q: 12, vol: vol * 0.5, ataque: 0.05, solta: 0.1 });
    }
  },
  passosDescalco(m, t, { dur = 3 }, r) {
    for (let k = t; k < t + dur; k += 0.64) m.ruidoFiltrado(k, 0.04, { tipo: 'lowpass', freq: 260, vol: 0.5, ataque: 0.004, solta: 0.08 });
  },
  carroca(m, t, { dur = 4 }, r) {
    m.ruidoFiltrado(t, dur, { tipo: 'lowpass', freq: 140, vol: 0.35, ataque: 0.5, solta: 0.5 });
    for (let k = t; k < t + dur - 0.2; k += 0.36) m.ruidoFiltrado(k, 0.015, { freq: 700 + r() * 300, q: 3, vol: 0.4, ataque: 0.001, solta: 0.05, pan: -0.2 });
    for (let k = t + 0.5; k < t + dur - 0.5; k += 1.2 + r() * 1.5) m.ruidoFiltrado(k, 0.25, { freq: 380, freq2: 520, q: 18, vol: 0.18, ataque: 0.05, solta: 0.1 });
  },
  relincho(m, t) {
    m.ruidoFiltrado(t, 0.25, { freq: 600, q: 2, vol: 0.5, ataque: 0.02, solta: 0.15 });
    m.ruidoFiltrado(t + 0.4, 0.35, { freq: 500, q: 2, vol: 0.4, ataque: 0.02, solta: 0.2 });
  },
  passosMato(m, t, op, r) {
    for (let k = t; k < t + 2; k += 0.25 + r() * 0.2) m.ruidoFiltrado(k, 0.08, { tipo: 'highpass', freq: 2500, vol: 0.18, ataque: 0.01, solta: 0.06, pan: (r() - 0.5) });
  },
  risada() {},
  arcoTensao(m, t) {
    m.ruidoFiltrado(t, 1.9, { freq: 800, freq2: 1150, q: 25, vol: 0.12, ataque: 0.4, solta: 0.1 });
  },
  disparo(m, t) {
    m.corda(t, 196, { vol: 0.7, decai: 0.99, destino: m.bus.efeitos, brilho: 2500 });
    m.ruidoFiltrado(t, 0.25, { tipo: 'highpass', freq: 1200, freq2: 4000, vol: 0.25, ataque: 0.01, solta: 0.1 });
  },
  impactoFlecha(m, t) {
    m.tambor(t, { vol: 0.7, freq: 95, destino: m.bus.efeitos });
    m.ruidoFiltrado(t, 0.04, { freq: 1800, q: 1, vol: 0.4, ataque: 0.001, solta: 0.05 });
  },
  arrancar(m, t) {
    m.ruidoFiltrado(t, 0.25, { freq: 600, freq2: 250, q: 3, vol: 0.4, ataque: 0.01, solta: 0.1 });
  },
  cura(m, t, { dur = 2.5 }) {
    const o = m.ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(220, t + dur);
    const e = m.env(t, dur * 0.5, 0, dur * 0.6, 0.08);
    o.connect(e).connect(m.bus.efeitos);
    o.start(t);
    o.stop(t + dur * 1.2);
    m.ruidoFiltrado(t, dur, { tipo: 'lowpass', freq: 900, vol: 0.06, ataque: dur * 0.4, solta: 0.6 });
  },
  golpe(m, t) {
    m.ruidoFiltrado(t, 0.22, { freq: 400, freq2: 2200, q: 1.5, vol: 0.45, ataque: 0.05, solta: 0.08 });
  },
  madeiraQuebra(m, t, op, r) {
    for (let i = 0; i < 5; i++) m.ruidoFiltrado(t + i * 0.018, 0.01, { freq: 900 + r() * 1500, q: 4, vol: 0.6, ataque: 0.001, solta: 0.04 });
    m.tambor(t, { vol: 0.3, freq: 160, destino: m.bus.efeitos });
  },
  pancada(m, t) {
    m.tambor(t, { vol: 0.8, freq: 130, destino: m.bus.efeitos });
  },
  queda(m, t) {
    m.tambor(t, { vol: 0.7, freq: 70, destino: m.bus.efeitos });
    m.ruidoFiltrado(t, 0.3, { tipo: 'lowpass', freq: 500, vol: 0.4, ataque: 0.005, solta: 0.2 });
  },
  tochaCai(m, t) {
    m.tambor(t, { vol: 0.3, freq: 120, destino: m.bus.efeitos });
    m.ruidoFiltrado(t, 0.6, { tipo: 'highpass', freq: 2500, vol: 0.2, ataque: 0.001, solta: 0.4 });
  },
  corrida(m, t, { dur = 3 }, r) {
    for (let k = t, i = 0; k < t + dur; k += 0.17, i++) m.ruidoFiltrado(k, 0.03, { tipo: 'lowpass', freq: 400, vol: 0.4 * (1 - (k - t) / dur), ataque: 0.003, solta: 0.06, pan: Math.sin(i) * 0.5 });
  },
  troncoArrasta(m, t, { dur = 2.5 }) {
    m.ruidoFiltrado(t, dur, { tipo: 'lowpass', freq: 350, vol: 0.5, ataque: 0.3, solta: 0.3 });
    m.ruidoFiltrado(t, dur, { freq: 180, q: 4, vol: 0.3, ataque: 0.3, solta: 0.3 });
  },
  trovao(m, t, op, r) {
    m.ruidoFiltrado(t, 2.6, { tipo: 'lowpass', freq: 180, vol: 0.9, ataque: 0.05, solta: 1.8 });
    m.ruidoFiltrado(t, 0.25, { tipo: 'lowpass', freq: 1200, vol: 0.5, ataque: 0.005, solta: 0.3 });
    for (let i = 0; i < 4; i++) m.tambor(t + 0.1 + r() * 0.8, { vol: 0.35, freq: 50 + r() * 20, destino: m.bus.efeitos });
  },
  respingo(m, t) {
    m.ruidoFiltrado(t, 0.35, { tipo: 'lowpass', freq: 1800, freq2: 400, vol: 0.6, ataque: 0.005, solta: 0.4 });
    m.tambor(t, { vol: 0.3, freq: 80, destino: m.bus.efeitos });
  },
  chiado(m, t) {
    m.ruidoFiltrado(t, 1.0, { tipo: 'highpass', freq: 3000, vol: 0.35, ataque: 0.01, solta: 0.8 });
  },
  metal(m, t, op, r) {
    for (const [f, a, d] of [[1240, 0.5, 0.6], [1870, 0.35, 0.5], [2930, 0.25, 0.35], [4120, 0.15, 0.25]]) {
      const o = m.ctx.createOscillator();
      o.frequency.value = f * (0.97 + r() * 0.06);
      const e = m.env(t, 0.002, 0, d, a * 0.5);
      o.connect(e).connect(m.bus.efeitos);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    m.ruidoFiltrado(t, 0.04, { tipo: 'highpass', freq: 2500, vol: 0.5, ataque: 0.001, solta: 0.05 });
  },
  metalQuebra(m, t, op, r) {
    EFEITOS.metal(m, t, op, r);
    for (let i = 0; i < 4; i++) m.ruidoFiltrado(t + 0.02 + i * 0.015, 0.01, { freq: 3000 + r() * 3000, q: 3, vol: 0.5, ataque: 0.001, solta: 0.04 });
  },
  blip(m, t) {
    const o = m.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 520;
    const e = m.env(t, 0.002, 0.02, 0.02, 0.05);
    o.connect(e).connect(m.bus.efeitos);
    o.start(t);
    o.stop(t + 0.06);
  },
};

// Junta planos seguidos que têm a mesma trilha/ambiente em blocos contínuos.
function blocos(planos, chave) {
  const out = [];
  for (const p of planos) {
    const v = p[chave];
    const ids = v ? (Array.isArray(v) ? v : [v]) : [];
    for (const id of ids) {
      const ult = out.findLast((b) => b.id === id);
      if (ult && Math.abs(ult.fim - p.inicio) < 0.01) ult.fim = p.fim;
      else out.push({ id, inicio: p.inicio, fim: p.fim });
    }
  }
  return out;
}

/**
 * Mistura o áudio do trecho [de, ate] da linha do tempo.
 * base: pasta do filme (para achar vozes/<id>.mp3). Retorna partes de um WAV em base64.
 */
export async function mixar(linha, base, de = 0, ate = linha.duracao) {
  const dur = ate - de;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
  const m = new Mesa(ctx, dur);
  const r = rng(42);
  const T = (t) => t - de; // tempo do filme -> tempo do trecho

  // vozes
  const falas = [];
  for (const p of linha.planos) for (const f of p.falasT) falas.push({ ...f, abs: p.inicio + f.t0, fimAbs: p.inicio + f.t1 });
  const ativas = [];
  for (const f of falas) {
    if (f.fimAbs < de || f.abs > ate) continue;
    let tocou = false;
    if (f.real) {
      try {
        const resp = await fetch(`${base}/vozes/${f.id}.mp3`);
        if (resp.ok) {
          const buf = await ctx.decodeAudioData(await resp.arrayBuffer());
          const s = ctx.createBufferSource();
          s.buffer = buf;
          s.connect(m.bus.voz);
          const t = T(f.abs);
          if (t >= 0) s.start(t);
          else s.start(0, -t);
          tocou = true;
        }
      } catch (e) {
        console.warn('voz não tocou:', f.id, e.message);
      }
    }
    // sem voz gravada: bipes de texto, como nos jogos da época (só falas de personagens)
    if (!tocou && f.voz !== 'narrador') for (let t = f.abs; t < f.abs + (f.fimAbs - f.abs) * 0.75; t += 0.075) EFEITOS.blip(m, T(t));
    if (tocou) ativas.push([T(f.abs), T(f.fimAbs)]);
  }

  // abaixa a música e o ambiente enquanto alguém fala
  for (const [bus, nivel, base0] of [[m.bus.musica, 0.4, 0.34], [m.bus.ambiente, 0.65, 0.28]]) {
    bus.gain.setValueAtTime(base0, 0);
    for (const [a, b] of ativas) {
      bus.gain.setTargetAtTime(base0 * nivel, Math.max(0, a - 0.15), 0.08);
      bus.gain.setTargetAtTime(base0, Math.max(0, b + 0.2), 0.3);
    }
  }

  // trilha sonora (com transições suaves entre climas)
  for (const b of blocos(linha.planos, 'musica')) {
    if (b.fim < de || b.inicio > ate) continue;
    const gerar = CLIMAS[b.id];
    if (!gerar) { console.warn('clima desconhecido:', b.id); continue; }
    const g = ctx.createGain();
    const t0 = T(b.inicio), t1 = T(b.fim);
    g.gain.setValueAtTime(0, Math.max(0, t0));
    g.gain.linearRampToValueAtTime(1, Math.max(0, t0 + 1.2));
    g.gain.setValueAtTime(1, Math.max(0, t1 - 1.2));
    g.gain.linearRampToValueAtTime(0, Math.max(0, t1 + 0.8));
    g.connect(m.bus.musica);
    const destino = m.bus.musica;
    m.bus.musica = g; // os geradores tocam no bloco com fade
    gerar(m, t0, t1 - t0 + 0.8, rng(b.inicio * 1000));
    m.bus.musica = destino;
  }

  // ambiente
  for (const b of blocos(linha.planos, 'ambiente')) {
    if (b.fim < de || b.inicio > ate) continue;
    AMBIENTES[b.id]?.(m, T(b.inicio), b.fim - b.inicio, rng(b.inicio * 77));
  }

  // efeitos marcados nos planos
  for (const p of linha.planos) {
    if (!p.sons || p.fim < de || p.inicio > ate) continue;
    const P = contexto(p, 0);
    for (const s of p.sons(P)) {
      const ef = EFEITOS[s.som];
      if (!ef) { console.warn('efeito desconhecido:', s.som); continue; }
      ef(m, T(p.inicio + s.t), s, r);
    }
  }

  const buf = await ctx.startRendering();
  return wavBase64(buf);
}

function wavBase64(buf) {
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = ch[0].length;
  const bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++) {
    for (let c = 0; c < 2; c++, o += 2) dv.setInt16(o, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
  }
  const partes = [];
  const passo = 3 * 1024 * 1024;
  for (let i = 0; i < bytes.length; i += passo) {
    let s = '';
    const fatia = bytes.subarray(i, i + passo);
    for (let j = 0; j < fatia.length; j += 0x8000) s += String.fromCharCode.apply(null, fatia.subarray(j, j + 0x8000));
    partes.push(btoa(s));
  }
  return partes;
}
