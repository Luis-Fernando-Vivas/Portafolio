/* Vuelta de Google tras iniciar sesión en el panel /admin (ver api/auth.js).

   Cambia el código por la identidad de la cuenta y, si el correo está en
   ADMIN_EMAILS, entrega a la ventana de Decap CMS el GITHUB_TOKEN con el
   que el panel guarda las noticias en el repositorio. Decap habla el
   protocolo de su backend "github", por eso el mensaje dice github. Solo
   se entrega a una ventana de este mismo dominio. */
import { siteOrigin } from './auth.js'

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

function allowedEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

// El id_token llega directo del endpoint de Google por HTTPS, así que basta
// con leer sus datos (OpenID Connect, sección 3.1.3.7) y validar a quién
// fue emitido.
function readIdToken(idToken) {
  const payload = String(idToken || '').split('.')[1]
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function authorize(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await response.json()
  const claims = readIdToken(data.id_token)
  if (!claims) return { error: data.error_description || 'No se pudo iniciar sesión con Google.' }
  if (claims.aud !== clientId || !GOOGLE_ISSUERS.includes(claims.iss) || claims.exp * 1000 < Date.now()) {
    return { error: 'La respuesta de Google no es válida. Vuelve a intentarlo.' }
  }

  const email = String(claims.email || '').toLowerCase()
  if (!claims.email_verified || !allowedEmails().includes(email)) {
    return { error: `La cuenta ${email || 'de Google'} no tiene acceso al panel.` }
  }
  if (!process.env.GITHUB_TOKEN) return { error: 'Falta la variable GITHUB_TOKEN en Vercel.' }
  return { token: process.env.GITHUB_TOKEN }
}

export default async function handler(req, res) {
  const origin = siteOrigin(req)
  const url = new URL(req.url, origin)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = (req.headers.cookie || '').match(/(?:^|;\s*)am_oauth_state=([a-f0-9]+)/)?.[1]

  let result
  if (url.searchParams.get('error')) {
    result = { error: 'Se canceló el inicio de sesión con Google.' }
  } else if (!code || !state || state !== cookieState) {
    result = { error: 'La sesión expiró o no es válida. Vuelve a intentarlo.' }
  } else {
    try {
      result = await authorize(code, `${origin}/api/callback`)
    } catch {
      result = { error: 'No se pudo conectar con Google. Vuelve a intentarlo.' }
    }
  }

  const message = result.token
    ? `authorization:github:success:${JSON.stringify({ token: result.token, provider: 'github' })}`
    : `authorization:github:error:${JSON.stringify({ message: result.error })}`
  const notice = result.token ? 'Conectando con el panel…' : result.error

  res.setHeader('Set-Cookie', 'am_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Panel — Automind</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eff0f4;color:#1a1a1a;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}</style>
</head><body><p id="msg"></p><script>
(function () {
  var origin = ${JSON.stringify(origin)};
  var message = ${JSON.stringify(message).replace(/</g, '\\u003c')};
  document.getElementById('msg').textContent = ${JSON.stringify(notice).replace(/</g, '\\u003c')};
  if (!window.opener) return;
  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return;
    window.opener.postMessage(message, origin);
  });
  window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`)
}
