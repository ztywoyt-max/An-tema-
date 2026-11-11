import { useEffect, useRef } from 'react'

/** Rosto do jogador recortado da própria skin (camada base + chapéu), em pixel art nítido. */
export function SkinFace({ url, name, size = 32 }: { url?: string; name: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const fallback = () => {
      // Sem skin: um rosto carmesim com a inicial do nome.
      const g = ctx.createLinearGradient(0, 0, size, size)
      g.addColorStop(0, '#9b1c2c')
      g.addColorStop(1, '#3d0911')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#f2e7dd'
      ctx.font = `600 ${Math.round(size * 0.5)}px Cinzel, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name.slice(0, 1).toUpperCase(), size / 2, size / 2 + 1)
    }
    if (!url) return fallback()
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size)
    }
    img.onerror = fallback
    img.src = url
  }, [url, name, size])
  return <canvas ref={ref} width={size} height={size} className="skin-face" style={{ width: size, height: size }} />
}
