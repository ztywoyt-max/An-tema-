// Animação de abertura: janela transparente, só o corvo e o título de ANÁTEMA flutuando na tela.
import '../styles/tokens.css'
import './splash.css'
import corvo from '@brand/corvo.svg?raw'
import wordmark from '@brand/anatema-wordmark.svg?raw'

const root = document.getElementById('splash')!
root.innerHTML = `
  <div class="stage">
    <canvas class="embers"></canvas>
    <div class="halo"></div>
    <div class="crow">${corvo}</div>
    <div class="word">
      <div class="word-ghost">${wordmark}</div>
      <div class="word-fill">${wordmark}</div>
      <div class="word-sheen">${wordmark}</div>
    </div>
    <div class="rule"><span></span><i></i><span></span></div>
    <p class="tagline">O céu sangra. A terra recorda.</p>
    <p class="status"><span class="dot"></span><span class="status-text">Despertando os condenados</span></p>
  </div>
`

// Fagulhas subindo — desenhadas num canvas para ficar leve.
const canvas = root.querySelector<HTMLCanvasElement>('canvas.embers')!
const ctx = canvas.getContext('2d')!
const dpr = window.devicePixelRatio || 1
const W = 640
const H = 460
canvas.width = W * dpr
canvas.height = H * dpr
ctx.scale(dpr, dpr)
type Spark = { x: number; y: number; vy: number; vx: number; r: number; life: number; max: number }
const sparks: Spark[] = []
const spawn = () =>
  sparks.push({
    x: W / 2 + (Math.random() - 0.5) * 300,
    y: H * 0.6 + Math.random() * 60,
    vy: -(0.25 + Math.random() * 0.7),
    vx: (Math.random() - 0.5) * 0.25,
    r: 0.6 + Math.random() * 1.6,
    life: 0,
    max: 120 + Math.random() * 140,
  })
let running = true
const tick = () => {
  if (!running) return
  ctx.clearRect(0, 0, W, H)
  if (sparks.length < 70) spawn()
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    s.life++
    s.x += s.vx + Math.sin((s.life + i) / 18) * 0.15
    s.y += s.vy
    const t = s.life / s.max
    const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
    if (s.life > s.max) {
      sparks.splice(i, 1)
      continue
    }
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4)
    g.addColorStop(0, `rgba(255,170,120,${0.9 * a})`)
    g.addColorStop(0.4, `rgba(226,57,77,${0.45 * a})`)
    g.addColorStop(1, 'rgba(226,57,77,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2)
    ctx.fill()
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

const messages = ['Despertando os condenados', 'Acendendo as forjas', 'Ouvindo o corvo']
let m = 0
const statusText = root.querySelector('.status-text')!
const rotate = setInterval(() => {
  m = (m + 1) % messages.length
  statusText.classList.add('swap')
  setTimeout(() => {
    statusText.textContent = messages[m]
    statusText.classList.remove('swap')
  }, 220)
}, 1100)

// Sequência total ~3,6 s; depois some e avisa o processo principal.
const stage = root.querySelector('.stage')!
setTimeout(() => stage.classList.add('out'), 3600)
setTimeout(() => {
  running = false
  clearInterval(rotate)
  ;(window as unknown as { anatema?: { app: { splashDone(): void } } }).anatema?.app.splashDone()
}, 4150)
