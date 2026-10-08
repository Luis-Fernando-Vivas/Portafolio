/* Funciones de api/ en `npm run dev`, para probar el ingreso al panel con
   Google sin desplegar. Vercel las ejecuta solas en producción; aquí se
   sirven igual, con las variables del archivo .env (que no se sube a git).
   Solo atiende las rutas de este mapa. */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

const ROUTES = {
  '/api/auth': 'auth.js',
  '/api/callback': 'callback.js',
  '/api/blog-ai': 'blog-ai.js',
}

export default function apiDevPlugin() {
  return {
    name: 'automind-api-dev',
    apply: 'serve',

    configureServer(server) {
      const root = server.config.root
      Object.assign(process.env, loadEnv(server.config.mode, root, ''))
      // Permite a api/blog-ai.js escribir en content/blog sin token cuando
      // el panel usa el backend local (npm run cms).
      process.env.AUTOMIND_LOCAL_ROOT = root

      server.middlewares.use(async (req, res, next) => {
        const file = ROUTES[req.url.split('?')[0]]
        if (!file) {
          next()
          return
        }
        try {
          // ?t= evita la caché de import() para tomar cambios sin reiniciar.
          const url = pathToFileURL(path.join(root, 'api', file)).href + `?t=${Date.now()}`
          const { default: handler } = await import(url)
          await handler(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
