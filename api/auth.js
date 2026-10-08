/* Inicio de sesión del panel /admin (Decap CMS) con Google.

   Decap abre esta ruta en una ventana emergente; aquí se redirige a Google
   y Google vuelve a /api/callback, que comprueba que el correo esté
   autorizado. Variables en Vercel:
   - GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET: cliente OAuth "Aplicación web"
     de Google Cloud con el URI de redirección
     https://www.automindco.com/api/callback
   - ADMIN_EMAILS: correos que pueden entrar, separados por comas.
   - GITHUB_TOKEN: token de GitHub con permiso de escritura en el
     repositorio; es con el que el panel guarda las noticias. */
import crypto from 'node:crypto'

// https en Vercel; http solo para probar en localhost (npm run dev).
export function siteOrigin(req) {
  const host = req.headers.host
  return `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https'}://${host}`
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Falta la variable GOOGLE_CLIENT_ID en Vercel.')
    return
  }

  // El state viaja a Google y en una cookie; /api/callback comprueba que
  // coincidan para que nadie pueda inyectar un código ajeno.
  const state = crypto.randomBytes(16).toString('hex')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${siteOrigin(req)}/api/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email')
  url.searchParams.set('prompt', 'select_account')
  url.searchParams.set('state', state)

  res.setHeader('Set-Cookie', `am_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  res.statusCode = 302
  res.setHeader('Location', url.toString())
  res.end()
}
