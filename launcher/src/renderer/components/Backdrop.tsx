import { useEffect, useRef } from 'react'
import { useStore } from '../app/store'

/**
 * Fundo vivo: céu carmesim com névoa lenta, cinzas caindo e fagulhas subindo.
 * Desenhado em canvas, pausa quando a janela está oculta e respeita "Reduzir animações".
 */
export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useStore((s) => s.settings?.reduceMotion ?? false)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; ember: boolean; t: number }
    const parts: P[] = []
    const make = (initial = false): P => {
      const ember = Math.random() < 0.35
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : ember ? h + 10 : -10,
        vx: (Math.random() - 0.5) * 0.15,
        vy: ember ? -(0.15 + Math.random() * 0.45) : 0.12 + Math.random() * 0.3,
        r: ember ? 0.6 + Math.random() * 1.4 : 0.6 + Math.random() * 1.8,
        a: 0.15 + Math.random() * 0.5,
        ember,
        t: Math.random() * 1000,
      }
    }
    const count = () => Math.round((w * h) / 16000)
    for (let i = 0; i < count(); i++) parts.push(make(true))

    let raf = 0
    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.t += 1
        p.x += p.vx + Math.sin(p.t / 60) * 0.12
        p.y += p.vy
        if (p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > w + 20) {
          parts[i] = make()
          continue
        }
        if (p.ember) {
          const flicker = 0.7 + Math.sin(p.t / 7) * 0.3
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
          g.addColorStop(0, `rgba(255,160,110,${p.a * flicker})`)
          g.addColorStop(0.35, `rgba(220,50,66,${p.a * 0.5 * flicker})`)
          g.addColorStop(1, 'rgba(220,50,66,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = `rgba(200,180,170,${p.a * 0.35})`
          ctx.fillRect(p.x, p.y, p.r, p.r)
        }
      }
      while (parts.length < count()) parts.push(make())
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)
    if (!reduce) raf = requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, w, h)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reduce])

  return (
    <div className="backdrop" aria-hidden>
      <div className="sky" />
      <div className="mist mist-a" />
      <div className="mist mist-b" />
      <canvas ref={ref} className="particles" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  )
}
