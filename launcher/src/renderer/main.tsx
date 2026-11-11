import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import { useStore } from './app/store'
import { Backdrop } from './components/Backdrop'
import { TitleBar } from './components/TitleBar'
import { PlayBar } from './components/PlayBar'
import { Toasts } from './components/ui'
import { Inicio } from './pages/Inicio'
import { Modpack } from './pages/Modpack'
import { Ajustes } from './pages/Ajustes'
import { Registros } from './pages/Registros'

function App() {
  const ready = useStore((s) => s.ready)
  const page = useStore((s) => s.page)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const initial = params.get('pagina')
    if (initial) useStore.setState({ page: initial as never })
    void useStore.getState().init()
  }, [])

  return (
    <div className="app">
      <Backdrop />
      <TitleBar />
      <main className="content">
        {ready && (
          <div key={page} className="page-enter">
            {page === 'inicio' && <Inicio />}
            {page === 'modpack' && <Modpack />}
            {page === 'ajustes' && <Ajustes />}
            {page === 'registros' && <Registros />}
          </div>
        )}
      </main>
      <PlayBar />
      <Toasts />
      <div className="legal">Projeto da comunidade ANÁTEMA. Sem afiliação com Mojang ou Microsoft.</div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
