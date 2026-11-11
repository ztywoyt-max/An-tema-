import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [
    react(),
    {
      // No modo de desenvolvimento o Vite injeta scripts inline; a CSP fica só no build final.
      name: 'anatema-dev-csp',
      apply: 'serve',
      transformIndexHtml: (html) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
    },
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@brand': resolve(__dirname, 'resources/brand'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'chrome130',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/renderer/index.html'),
        splash: resolve(__dirname, 'src/renderer/splash.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true },
})
