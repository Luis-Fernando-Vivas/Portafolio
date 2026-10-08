/* Lógica de api/blog-ai.js: redactar y traducir noticias del blog con
   Gemini y guardarlas en content/blog.

   Los archivos de api/ que empiezan por _ no son rutas en Vercel; este es
   un módulo compartido.

   - Gemini se llama por REST (sin SDK). La redacción usa la herramienta
     google_search para que la noticia sea real y reciente; las fuentes se
     toman de los resultados de esa búsqueda, no de lo que escriba el
     modelo, para no inventar enlaces.
   - Se guarda en GitHub (un solo commit con todos los idiomas) o, en
     `npm run dev` con `npm run cms`, directo en content/blog. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const BLOG_DIR = 'content/blog'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Los mismos idiomas de public/admin/config.yml (i18n.locales).
export const DEFAULT_LOCALE = 'es'
export const TRANSLATIONS = { en: 'inglés', fr: 'francés' }

const CATEGORIES = ['Automatización', 'Sitios web', 'Inteligencia artificial', 'Marketing digital', 'Pagos']

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---------------------------------------------------------------- acceso

/* El panel recibe el GITHUB_TOKEN al iniciar sesión con Google (ver
   api/callback.js) y lo manda aquí: que coincida prueba que quien llama
   entró al panel con un correo autorizado. Sin token solo se acepta en
   `npm run dev` (scripts/api-dev-plugin.js), y entonces se escribe en
   disco, como hace el backend local de Decap. */
export function resolveTarget(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const expected = process.env.GITHUB_TOKEN || ''
  if (token && expected && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return githubStore(expected)
  }
  if (!token && process.env.AUTOMIND_LOCAL_ROOT) return localStore(path.join(process.env.AUTOMIND_LOCAL_ROOT, BLOG_DIR))
  throw new HttpError(401, 'Inicia sesión en el panel para usar la IA.')
}

// ---------------------------------------------------------------- almacenamiento

function localStore(dir) {
  return {
    async list() {
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.md')) : []
    },
    async read(name) {
      return fs.readFileSync(path.join(dir, name), 'utf8')
    },
    async write(files) {
      for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content)
    },
  }
}

function githubStore(token) {
  const repo = process.env.GITHUB_REPO || 'Luis-Fernando-Vivas/Portafolio'
  const branch = process.env.GITHUB_BRANCH || 'main'

  async function api(route, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${repo}${route}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: options.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!response.ok) throw new HttpError(502, `GitHub respondió ${response.status} en ${route}.`)
    return options.raw ? response.text() : response.json()
  }

  return {
    async list() {
      const entries = await api(`/contents/${BLOG_DIR}?ref=${branch}`)
      return entries.filter((entry) => entry.type === 'file' && entry.name.endsWith('.md')).map((entry) => entry.name)
    },
    read(name) {
      return api(`/contents/${BLOG_DIR}/${name}?ref=${branch}`, { raw: true })
    },
    // Todos los idiomas en un solo commit: Vercel despliega una sola vez.
    async write(files, message) {
      const ref = await api(`/git/ref/heads/${branch}`)
      const parent = await api(`/git/commits/${ref.object.sha}`)
      const tree = await api('/git/trees', {
        method: 'POST',
        body: JSON.stringify({
          base_tree: parent.tree.sha,
          tree: Object.entries(files).map(([name, content]) => ({ path: `${BLOG_DIR}/${name}`, mode: '100644', type: 'blob', content })),
        }),
      })
      const commit = await api('/git/commits', {
        method: 'POST',
        body: JSON.stringify({ message, tree: tree.sha, parents: [parent.sha] }),
      })
      await api(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) })
    },
  }
}

// ---------------------------------------------------------------- archivos .md

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) throw new HttpError(422, 'El archivo no tiene encabezado ---.')
  return { data: parseYaml(match[1]) || {}, body: match[2] }
}

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value == null ? '' : String(value).trim().slice(0, 10)
}

// Los textos van entre comillas dobles de JSON, que también son YAML válido.
function toMarkdown(meta, body) {
  const lines = [`title: ${JSON.stringify(meta.title)}`, `description: ${JSON.stringify(meta.description)}`, `date: ${meta.date}`, `category: ${JSON.stringify(meta.category)}`]
  if (meta.cover) lines.push(`cover: ${meta.cover}`)
  if (meta.updated) lines.push(`updated: ${meta.updated}`)
  if (meta.draft) lines.push('draft: true')
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

function postName(slug, lang) {
  return `${slug}.${lang}.md`
}

// Noticias agrupadas por slug, con los idiomas que tienen y el título en español.
export async function listPosts(store) {
  const names = await store.list()
  const bySlug = new Map()
  for (const name of names) {
    const match = name.match(/^(.+?)(?:\.(es|en|fr))?\.md$/)
    if (!match) continue
    const [, slug, lang = DEFAULT_LOCALE] = match
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, langs: [], file: null })
    const post = bySlug.get(slug)
    post.langs.push(lang)
    if (lang === DEFAULT_LOCALE) post.file = name
  }
  const posts = [...bySlug.values()].filter((post) => post.file)
  await Promise.all(
    posts.map(async (post) => {
      const { data } = parseFrontmatter(await store.read(post.file))
      post.title = String(data.title || post.slug)
      post.date = isoDate(data.date)
      post.draft = data.draft === true || data.draft === 'true'
      delete post.file
    }),
  )
  return posts.sort((a, b) => b.date.localeCompare(a.date))
}

// ---------------------------------------------------------------- Gemini

async function gemini(body) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new HttpError(500, 'Falta la variable GEMINI_API_KEY.')
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const response = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new HttpError(502, `Gemini: ${data.error?.message || `error ${response.status}`}`)
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('')
  if (!text) throw new HttpError(502, `Gemini no devolvió texto (${candidate?.finishReason || 'sin respuesta'}).`)
  return { text, grounding: candidate.groundingMetadata }
}

// Con google_search Gemini no admite respuesta JSON forzada; se pide JSON
// en el texto y se recorta lo que haya fuera de las llaves.
function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new HttpError(502, 'Gemini devolvió un formato inesperado. Vuelve a intentarlo.')
  }
}

// Los enlaces de la búsqueda son redirecciones temporales de Google; se
// sigue la redirección para guardar el enlace real de cada fuente.
async function resolveSources(grounding, limit = 4) {
  const chunks = (grounding?.groundingChunks || []).map((chunk) => chunk.web).filter((web) => web?.uri)
  const resolved = await Promise.all(
    chunks.map(async (web) => {
      try {
        const response = await fetch(web.uri, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
        const url = response.headers.get('location') || web.uri
        return url.includes('vertexaisearch.cloud.google.com') ? null : { url, title: web.title || new URL(url).hostname }
      } catch {
        return null
      }
    }),
  )
  const seen = new Set()
  return resolved.filter((source) => source && !seen.has(source.url) && seen.add(source.url)).slice(0, limit)
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '')
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

const STYLE = `Escribes para el blog de Automind (automindco.com), una agencia colombiana que crea sitios web, automatiza procesos y conecta herramientas de IA para pequeñas y medianas empresas.
Estilo de los artículos:
- Español neutro de Colombia, tuteando al lector. Claro, cercano y sin tecnicismos innecesarios.
- Entre 450 y 750 palabras. Empieza con un párrafo que cuente la noticia (qué pasó, cuándo, a quién afecta) sin título inicial.
- Secciones con "## " (2 a 4), listas cuando ayuden, **negritas** para lo clave y una cita destacada con "> ".
- Explica qué significa la noticia para un negocio y qué puede hacer al respecto.
- Termina con una invitación breve a agendar una llamada de diagnóstico sin costo con Automind, relacionada con el tema.
- No incluyas una sección de fuentes ni enlaces: las fuentes se agregan aparte.
- Solo datos que confirmen las búsquedas; no inventes cifras, fechas ni citas.`

export async function generatePost(store, topic) {
  const existing = await listPosts(store)
  const prompt = `${topic ? `Tema pedido: ${topic}\nBusca noticias recientes y confiables sobre este tema.` : 'Busca una noticia de los últimos días que sea relevante para negocios en Colombia y América Latina sobre automatización, inteligencia artificial, sitios web, marketing digital o pagos digitales.'}

Ya están publicados estos artículos; no repitas sus temas:
${existing.map((post) => `- ${post.title}`).join('\n') || '- (ninguno)'}

Hoy es ${today()}. Responde SOLO con un objeto JSON, sin texto antes ni después, con estas claves:
{"title": "título atractivo de máximo 90 caracteres", "description": "una o dos frases (máx. 160 caracteres) para la tarjeta del blog y Google", "category": "una de: ${CATEGORIES.join(', ')}", "slug": "slug-corto-en-espanol-sin-tildes", "body": "artículo completo en Markdown"}`

  const { text, grounding } = await gemini({
    systemInstruction: { parts: [{ text: STYLE }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.7 },
  })
  const article = parseJson(text)
  if (!article.title || !article.body) throw new HttpError(502, 'Gemini devolvió un artículo incompleto. Vuelve a intentarlo.')

  const sources = await resolveSources(grounding)
  let body = String(article.body).trim()
  if (sources.length) body += `\n\n**Fuentes:** ${sources.map((source) => `[${source.title}](${source.url})`).join(' · ')}`

  // Un slug repetido sobrescribiría otra noticia: se le agrega -2, -3…
  const taken = new Set(existing.map((post) => post.slug))
  const base = slugify(article.slug || article.title) || `noticia-${today()}`
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`

  const meta = {
    title: String(article.title).trim(),
    description: String(article.description || '').trim(),
    category: CATEGORIES.includes(article.category) ? article.category : CATEGORIES[0],
    date: today(),
    draft: true,
  }
  const files = { [postName(slug, DEFAULT_LOCALE)]: toMarkdown(meta, body) }
  const translated = await translateAll(meta, body, Object.keys(TRANSLATIONS))
  for (const [lang, version] of Object.entries(translated)) files[postName(slug, lang)] = toMarkdown({ ...meta, ...version }, version.body)

  await store.write(files, `Blog: nueva noticia con IA "${slug}"`)
  return { slug, title: meta.title, langs: [DEFAULT_LOCALE, ...Object.keys(translated)] }
}

async function translate(meta, body, lang) {
  const { text } = await gemini({
    systemInstruction: {
      parts: [
        {
          text: `Traduces artículos del blog de Automind del español al ${TRANSLATIONS[lang]}. Traducción natural y profesional, no literal, con el mismo tono cercano. Conserva intacto el Markdown: encabezados, listas, negritas, citas y enlaces (traduce el texto de los enlaces, nunca las URL). "Automind" no se traduce. Los nombres propios de leyes, productos o entidades se dejan como están, con una breve aclaración si hace falta.`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ title: meta.title, description: meta.description, category: meta.category, body }) }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, category: { type: 'STRING' }, body: { type: 'STRING' } },
        required: ['title', 'description', 'category', 'body'],
      },
    },
  })
  return parseJson(text)
}

function translateAll(meta, body, langs) {
  return Promise.all(langs.map((lang) => translate(meta, body, lang))).then((versions) => Object.fromEntries(langs.map((lang, i) => [lang, versions[i]])))
}

// Traduce la versión en español de una noticia ya guardada. Fecha, portada,
// actualización y borrador se copian del español, como hace el panel.
export async function translatePost(store, slug, langs) {
  const wanted = (langs || []).filter((lang) => TRANSLATIONS[lang])
  if (!/^[a-z0-9-]+$/.test(slug || '') || !wanted.length) throw new HttpError(400, 'Elige una noticia y al menos un idioma.')
  const names = await store.list()
  const source = [postName(slug, DEFAULT_LOCALE), `${slug}.md`].find((name) => names.includes(name))
  if (!source) throw new HttpError(404, `No existe la noticia "${slug}" en español.`)

  const { data, body } = parseFrontmatter(await store.read(source))
  const meta = {
    title: String(data.title || ''),
    description: String(data.description || ''),
    category: String(data.category || ''),
    date: isoDate(data.date),
    cover: data.cover ? String(data.cover) : '',
    updated: data.updated ? isoDate(data.updated) : '',
    draft: data.draft === true || data.draft === 'true',
  }
  const translated = await translateAll(meta, body, wanted)
  const files = Object.fromEntries(Object.entries(translated).map(([lang, version]) => [postName(slug, lang), toMarkdown({ ...meta, ...version }, version.body)]))
  await store.write(files, `Blog: traduce "${slug}" con IA (${wanted.join(', ')})`)
  return { slug, langs: wanted }
}
