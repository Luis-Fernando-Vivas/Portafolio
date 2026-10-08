/* Noticias con IA para el panel /admin (botón "IA" de public/admin/index.html).

   POST /api/blog-ai con JSON:
   - { action: "list" }: noticias con sus idiomas, estado, categoría, fechas y
     portada (tablero del panel y lista para traducir).
   - { action: "generate", topic? }: Gemini busca una noticia (del tema, o la
     más relevante de los últimos días), la redacta en español, la traduce
     a inglés y francés y guarda los tres archivos como borrador.
   - { action: "translate", slug, langs }: traduce una noticia existente.

   Solo responde a quien entró al panel (ver resolveTarget en _lib/blog-ai.js).
   Variables en Vercel: GEMINI_API_KEY (Google AI Studio) y, opcional,
   GEMINI_MODEL (por defecto gemini-flash-latest). */
import { HttpError, generatePost, listPosts, resolveTarget, translatePost } from './_lib/blog-ai.js'

// Vercel ya entrega req.body leído; el servidor de `npm run dev` no.
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición no es JSON.')
  }
}

function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Usa POST.')
    const store = resolveTarget(req)
    const input = await readJson(req)

    if (input.action === 'list') return send(res, 200, { posts: await listPosts(store) })
    if (input.action === 'generate') return send(res, 200, await generatePost(store, String(input.topic || '').trim().slice(0, 500)))
    if (input.action === 'translate') return send(res, 200, await translatePost(store, input.slug, input.langs))
    throw new HttpError(400, 'Acción desconocida.')
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error)
    send(res, error.status || 500, { error: error instanceof HttpError ? error.message : 'Error inesperado. Revisa los registros del servidor.' })
  }
}
