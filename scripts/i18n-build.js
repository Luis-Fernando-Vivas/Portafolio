/* Versiones en inglés y francés escritas en el HTML (no solo en el navegador).

   public/js/i18n.js traduce en el navegador, pero Google y los rastreadores
   de IA (ChatGPT, Claude, Perplexity…) leen sobre todo el HTML que entrega
   el servidor. Por eso el sitio publica cada página también en /en/... y
   /fr/... ya traducida con el mismo diccionario (public/js/i18n-dict.js),
   con hreflang, canonical, og:locale y datos estructurados por idioma.

   finalizePage() recibe el HTML en español de una página y devuelve el de
   cualquier idioma:
   - traduce nodos de texto, atributos (alt, title, aria-label, placeholder),
     <title>, las metas de descripción/redes y los textos del JSON-LD, con
     las mismas reglas que i18n.js (se salta script, style, svg, code, pre y
     todo lo marcado data-i18n-skip o translate="no");
   - cambia los enlaces internos por los del idioma (si la página existe en
     ese idioma; si no, deja el enlace en español);
   - escribe <html lang>, canonical, og:url, og:locale y los <link hreflang>.

   El HTML se recorre con un tokenizador mínimo que solo reemplaza textos y
   atributos: el resto del archivo (el export de Framer) queda byte a byte. */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

export const SITE = 'https://www.automindco.com'
export const LANGS = ['es', 'en', 'fr']
// Colombia para el español, EE. UU. para el inglés y Canadá (Quebec) para
// el francés: son los mercados del sitio.
export const OG_LOCALES = { es: 'es_CO', en: 'en_US', fr: 'fr_CA' }
export const DATE_LOCALES = { es: 'es-CO', en: 'en-US', fr: 'fr-CA' }
// @id del JSON-LD que no cambian con el idioma.
const STABLE_IDS = [`${SITE}/#organization`, `${SITE}/#website`]

export function loadDictionaries(root) {
  const code = fs.readFileSync(path.join(root, 'public', 'js', 'i18n-dict.js'), 'utf8')
  let dictionaries = { en: {}, fr: {} }
  vm.runInNewContext(code, { window: { amI18n: { register: (value) => { dictionaries = value } } } })
  return dictionaries
}

/* ---------- Rutas por idioma ---------- */

// Un grupo es la misma página en varios idiomas: { es: '/precios', en: '/en/precios', ... }.
export class Routes {
  constructor() {
    this.groups = []
    this.byPath = new Map()
  }

  add(paths, extra = {}) {
    const group = { paths, ...extra }
    this.groups.push(group)
    Object.values(paths).forEach((p) => this.byPath.set(p, group))
    return group
  }

  find(pathname) {
    return this.byPath.get(pathname) || null
  }

  // La versión en `lang` de un enlace interno ("/precios#faq" → "/en/precios#faq").
  localize(href, lang) {
    const match = href.match(/^([^?#]*)(.*)$/)
    const base = match[1] || '/'
    const group = this.find(base)
    const target = group && group.paths[lang]
    return target ? target + match[2] : href
  }
}

// Ruta con prefijo de idioma para las páginas que existen en los tres.
export function prefixed(pathname, lang) {
  return lang === 'es' ? pathname : `/${lang}${pathname}`
}

/* ---------- Tokenizador ---------- */

const TOKEN = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g
const ATTR = /(\s+)([^\s"'>/=]+)(?:(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param'])
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript'])
const SKIP_TAGS = new Set(['svg', 'code', 'pre'])
const TRANSLATED_ATTRS = new Set(['alt', 'title', 'aria-label', 'placeholder'])
const TRANSLATED_METAS = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt'])

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', mdash: '—', ndash: '–',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', copy: '©', middot: '·', laquo: '«', raquo: '»', bull: '•',
}

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] !== '#') return ENTITIES[name] ?? entity
    return String.fromCodePoint(name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10))
  })
}

function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function parseAttrs(source) {
  const attrs = []
  ATTR.lastIndex = 0
  let match
  while ((match = ATTR.exec(source))) {
    const raw = match[4] ?? match[5] ?? match[6]
    attrs.push({ space: match[1], name: match[2], eq: match[3], value: raw == null ? null : decode(raw), raw: match[0] })
  }
  return attrs
}

// Valor del atributo; '' si está sin valor (<article data-i18n-skip>), null si no está.
function attr(attrs, name) {
  const found = attrs.find((a) => a.name.toLowerCase() === name)
  return found ? (found.value ?? '') : null
}

function buildTag(name, attrs, closing) {
  const body = attrs
    .map((a) => (a.changed ? `${a.space}${a.name}="${escapeAttr(a.value)}"` : a.raw))
    .join('')
  return `<${name}${body}${closing}>`
}

// Recorre el HTML y deja que `onText`, `onTag` y `onRaw` reemplacen piezas.
// onTag recibe skipped = true dentro de lo que no se traduce.
function rewrite(html, { onText, onTag, onRaw }) {
  let out = ''
  let last = 0
  let skip = null
  TOKEN.lastIndex = 0
  let match
  while ((match = TOKEN.exec(html))) {
    const between = html.slice(last, match.index)
    out += skip ? between : onText(between)
    last = TOKEN.lastIndex
    const full = match[0]
    if (!match[1]) {
      out += full
      continue
    }
    const name = match[1].toLowerCase()
    const closing = full[1] === '/'
    const selfClosing = full.endsWith('/>')

    if (closing) {
      out += full
      if (skip && name === skip.name && --skip.depth === 0) skip = null
      continue
    }

    const attrs = parseAttrs(match[2])
    // Dentro de lo que no se traduce, los enlaces sí cambian de idioma.
    if (skip) {
      out += onTag(name, attrs, full, selfClosing ? ' /' : '', true)
      if (name === skip.name && !selfClosing && !VOID.has(name)) skip.depth++
    } else {
      out += onTag(name, attrs, full, selfClosing ? ' /' : '', false)
      const skipped = SKIP_TAGS.has(name) || attr(attrs, 'data-i18n-skip') !== null || attr(attrs, 'translate') === 'no'
      if (skipped && !selfClosing && !VOID.has(name)) skip = { name, depth: 1 }
    }

    // El contenido de script, style, etc. es texto plano hasta su cierre.
    if (RAW.has(name) && !selfClosing) {
      const end = html.toLowerCase().indexOf(`</${name}`, last)
      const stop = end === -1 ? html.length : end
      const content = html.slice(last, stop)
      out += skip ? content : onRaw(name, attrs, content)
      last = stop
      TOKEN.lastIndex = stop
    }
  }
  return out + (skip ? html.slice(last) : onText(html.slice(last)))
}

/* ---------- Página final ---------- */

/**
 * @param {string} html  HTML de la página (en español, o ya escrito en `lang`)
 * @param {object} options
 * @param {string} options.lang  idioma de salida
 * @param {object} options.group  grupo de Routes de esta página
 * @param {Routes} options.routes
 * @param {object} [options.dict]  diccionario español → lang (si hay que traducir)
 */
export function finalizePage(html, { lang, group, routes, dict }) {
  const has = (key) => dict && key && Object.prototype.hasOwnProperty.call(dict, key)
  const lookup = (text) => {
    const key = normalize(text)
    return has(key) ? dict[key] : null
  }
  const localizeUrl = (value) => {
    // La empresa y el sitio son los mismos en todos los idiomas.
    if (STABLE_IDS.includes(value)) return value
    if (value.startsWith(SITE + '/')) return SITE + routes.localize(value.slice(SITE.length), lang)
    return value
  }

  const translateValue = (value) => {
    if (typeof value === 'string') {
      const translated = lookup(value)
      return localizeUrl(translated ?? value)
    }
    if (Array.isArray(value)) return value.map(translateValue)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateValue(item)]))
    }
    return value
  }

  let out = rewrite(html, {
    onText(raw) {
      if (!dict || !/\S/.test(raw)) return raw
      const decoded = decode(raw)
      const translated = lookup(decoded)
      if (translated === null) return raw
      const lead = decoded.match(/^\s*/)[0]
      const trail = decoded.match(/\s*$/)[0]
      return escapeText(lead + translated + trail)
    },
    onTag(name, attrs, full, selfClose, skipped) {
      const translate = dict && !skipped
      let changed = false
      const set = (a, value) => {
        if (value === a.value) return
        a.value = value
        a.changed = true
        changed = true
      }
      for (const a of attrs) {
        const key = a.name.toLowerCase()
        if (a.value == null) continue
        if (translate && TRANSLATED_ATTRS.has(key)) {
          const translated = lookup(a.value)
          if (translated !== null) set(a, translated)
        }
        // En el texto ya escrito en un idioma (artículos, landing pages), un
        // enlace a otra versión de esta misma página ("Read in English") es
        // un cambio de idioma explícito: se deja tal cual. En el menú y el
        // resto de la plantilla, todos los enlaces van al idioma de la página.
        if (key === 'href' && (name === 'a' || name === 'area') && a.value.startsWith('/') && !a.value.startsWith('//')) {
          const self = routes.find(a.value.match(/^[^?#]*/)[0] || '/') === group
          if (!(skipped && self)) set(a, routes.localize(a.value, lang))
        }
      }
      if (name === 'meta' && translate) {
        const kind = attr(attrs, 'name') || attr(attrs, 'property')
        const content = attrs.find((a) => a.name.toLowerCase() === 'content')
        if (kind && content && TRANSLATED_METAS.has(kind)) {
          const translated = lookup(content.value)
          if (translated !== null) set(content, translated)
        }
      }
      return changed ? buildTag(full.slice(1, 1 + name.length), attrs, selfClose) : full
    },
    onRaw(name, attrs, content) {
      if (name === 'title' && dict) {
        const translated = lookup(decode(content))
        return translated === null ? content : escapeText(translated)
      }
      if (name === 'script' && attr(attrs, 'type') === 'application/ld+json') {
        const data = translateValue(JSON.parse(content))
        if (lang !== 'es' && data && typeof data === 'object') setLanguage(data, lang)
        return JSON.stringify(data, null, 2).replace(/</g, '\\u003c')
      }
      return content
    },
  })

  const url = SITE + group.paths[lang]
  const langs = LANGS.filter((code) => group.paths[code])
  const alternates = langs
    .map((code) => `<link rel="alternate" hreflang="${code}" href="${SITE}${group.paths[code]}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}${group.xDefault || group.paths.es || group.paths[langs[0]]}">`)
    .join('\n  ')
  const ogLocales = [`<meta property="og:locale" content="${OG_LOCALES[lang]}">`]
    .concat(langs.filter((code) => code !== lang).map((code) => `<meta property="og:locale:alternate" content="${OG_LOCALES[code]}">`))
    .join('\n  ')

  out = out
    .replace(/<html\b([^>]*?)\blang="[^"]*"/, `<html$1lang="${lang}"`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:locale" content="[^"]*">/, ogLocales)

  // Antes de i18n.js, que los lee para cambiar de idioma y redirigir.
  const anchor = out.indexOf('<script src="/js/i18n.js">')
  const at = anchor === -1 ? out.indexOf('</head>') : anchor
  return `${out.slice(0, at)}${alternates}\n  ${out.slice(at)}`
}

// inLanguage del JSON-LD en las páginas traducidas.
function setLanguage(data, lang) {
  const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data]
  nodes.forEach((node) => {
    if (node && typeof node === 'object' && 'inLanguage' in node) node.inLanguage = lang
  })
}
