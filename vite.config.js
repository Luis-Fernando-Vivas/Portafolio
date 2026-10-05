import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import blogPlugin from './scripts/blog-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), blogPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        precios: resolve(import.meta.dirname, 'precios.html'),
        privacidad: resolve(import.meta.dirname, 'privacidad.html'),
      },
    },
  },
})
