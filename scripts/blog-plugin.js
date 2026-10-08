/* Blog generado desde Markdown (lo conecta scripts/site-plugin.js).

   Cada artículo vive en content/blog/<slug>.<idioma>.md (es, en, fr) y se
   publica en /blog/<slug>, /en/blog/<slug> y /fr/blog/<slug>; el índice
   vive en /blog, /en/blog y /fr/blog. El español es obligatorio; el inglés
   y el francés son opcionales y, si faltan, esa versión del artículo no se
   publica (el índice en ese idioma lo muestra en español). Los archivos
   los crea y edita el panel /admin (Decap CMS, ver
   public/admin/config.yml), pero también se pueden escribir a mano.
   Encabezado del archivo (YAML):

     ---
     title: Título del artículo
     description: Resumen de una o dos frases (Google y redes sociales)
     date: 2026-10-01
     category: Automatización
     cover: /images/blog/<slug>.webp     (opcional)
     updated: 2026-10-15                 (opcional)
     draft: true                         (opcional: solo se ve en local)
     ---

   date, cover, updated y draft se toman del archivo en español.

   Cada página se escribe ya en su idioma: los textos del artículo salen del
   .md de ese idioma (marcados data-i18n-skip) y los fijos de la plantilla
   ("Leer artículo", el header, el footer…) los traduce finalizePage() con
   public/js/i18n-dict.js (ver scripts/i18n-build.js).

   El header, el footer y la barra móvil se copian de privacidad.html, así
   que cualquier cambio en ellos llega solo al blog y a las landing pages. */
import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'
import { parse as parseYaml } from 'yaml'
import { DATE_LOCALES, LANGS, SITE } from './i18n-build.js'

export const GA_ID = 'G-TDSLWGEYQ2'
export const WHATSAPP = 'https://wa.me/573014315587'
export const CAL_ATTRS = 'data-cal-namespace="30min" data-cal-link="automind-5oseyu/30min" data-cal-config=\'{"layout":"month_view"}\''

export function escape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso, lang) {
  const format = new Intl.DateTimeFormat(DATE_LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return format.format(new Date(`${iso}T00:00:00Z`))
}

// YAML da Date si la fecha va sin comillas en algunos esquemas, o string;
// se normaliza siempre a AAAA-MM-DD.
export function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value == null ? '' : String(value).trim().slice(0, 10)
}

export function parseFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) throw new Error(`${file}: falta el encabezado --- al inicio`)
  return { data: parseYaml(match[1]) || {}, body: match[2] }
}

// null si el archivo no tiene título o descripción: el panel crea los .en.md
// y .fr.md con solo la fecha y la portada cuando la traducción está vacía.
function readLocale(file, name) {
  const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'), name)
  if (!data.title || !data.description) return null
  const words = body.split(/\s+/).filter(Boolean).length
  return {
    data,
    title: String(data.title),
    description: String(data.description),
    category: data.category ? String(data.category) : '',
    html: marked.parse(body),
    minutes: Math.max(1, Math.round(words / 200)),
  }
}

export function readPosts(dir, { includeDrafts }) {
  if (!fs.existsSync(dir)) return []
  const bySlug = new Map()
  fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .forEach((name) => {
      // <slug>.<idioma>.md; un <slug>.md sin idioma cuenta como español.
      const match = name.match(/^(.+?)(?:\.(es|en|fr))?\.md$/)
      const slug = match[1]
      const lang = match[2] || 'es'
      if (!bySlug.has(slug)) bySlug.set(slug, {})
      const locale = readLocale(path.join(dir, name), name)
      if (locale) bySlug.get(slug)[lang] = locale
      else if (lang !== 'es') console.warn(`[blog] ${name}: sin título o descripción, esa traducción no se publica`)
    })

  // Un artículo incompleto se salta (con aviso en el log) en vez de detener
  // la construcción de todo el sitio.
  const skip = (message) => {
    console.warn(`[blog] ${message}: el artículo no se publica`)
    return null
  }
  return [...bySlug]
    .map(([slug, locales]) => {
      const es = locales.es
      if (!es) return skip(`${slug}: falta la versión en español con título y descripción (${slug}.es.md)`)
      if (!es.category) return skip(`${slug}.es.md: falta "category" en el encabezado`)
      const date = isoDate(es.data.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return skip(`${slug}.es.md: "date" debe ser AAAA-MM-DD`)
      // Una traducción sin categoría usa la del español.
      LANGS.forEach((lang) => {
        if (locales[lang] && !locales[lang].category) locales[lang].category = es.category
      })
      return {
        slug,
        locales,
        title: es.title,
        description: es.description,
        category: es.category,
        date,
        updated: es.data.updated ? isoDate(es.data.updated) : '',
        cover: es.data.cover ? String(es.data.cover) : '',
        draft: es.data.draft === true || es.data.draft === 'true',
      }
    })
    .filter((post) => post && (includeDrafts || !post.draft))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// Idiomas en los que se publica el artículo.
export function postLangs(post) {
  return LANGS.filter((lang) => post.locales[lang])
}

// Textos del artículo en `lang` (o en español si no hay traducción),
// marcados para que el diccionario no los toque.
function text(post, lang, render, tag = 'span') {
  const own = post.locales[lang]
  const locale = own || post.locales.es
  const mark = !own && lang !== 'es' ? ' lang="es"' : ''
  return `<${tag} data-i18n-skip${mark}>${render(locale)}</${tag}>`
}

// Header y footer (con la barra móvil y los scripts del final) de la página
// de privacidad, que no marca ningún enlace del menú como activo.
export function readShell(root, current = '') {
  const html = fs.readFileSync(path.join(root, 'privacidad.html'), 'utf8')
  const bodyStart = html.indexOf('<body>') + '<body>'.length
  const header = html.slice(bodyStart, html.indexOf('<main>'))
  return {
    header: current ? header.replace(`<a href="${current}">`, `<a href="${current}" aria-current="page">`) : header,
    footer: html.slice(html.indexOf('</main>') + '</main>'.length, html.indexOf('</body>')),
  }
}

export function head({ title, description, url, image, type, extra = '', css = [] }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/js/i18n.js"></script>
${extra}  <!-- Google tag (gtag.js); la configuración y los eventos están en analytics.js -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script src="/js/analytics.js"></script>
  <script src="/js/i18n-dict.js" defer></script>
  <script src="/js/consent.js" defer></script>
  <script src="/js/blog.js" defer></script>
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link href="/favicon.svg" rel="icon" type="image/svg+xml">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Automind">
  <meta property="og:locale" content="es_CO">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${image}">
  <link rel="alternate" type="application/rss+xml" title="Blog de Automind" href="${SITE}/blog/rss.xml">
  <link rel="preload" href="/fonts/ClashDisplay-Variable.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="stylesheet" href="/js/page-transition.css">
  <link rel="stylesheet" href="/js/footer.css">
  <link rel="stylesheet" href="/js/bottom-nav.css">
  <link rel="stylesheet" href="/js/pricing.css">
  <link rel="stylesheet" href="/js/mobile-menu.css">
  <link rel="stylesheet" href="/js/font.css">
  <link rel="stylesheet" href="/js/blog.css">
${css.map((href) => `  <link rel="stylesheet" href="${href}">\n`).join('')}</head>
<body>
`
}

export function jsonLd(data) {
  return `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n`
}

export function absolute(src) {
  return src.startsWith('http') ? src : SITE + src
}

function dateTag(iso, lang) {
  return `<time datetime="${iso}">${formatDate(iso, lang)}</time>`
}

const MINUTES = { es: 'min de lectura', en: 'min read', fr: 'min de lecture' }

function minutesTag(post, lang) {
  const locale = post.locales[lang] || post.locales.es
  return `<span data-i18n-skip>${locale.minutes} ${MINUTES[lang]}</span>`
}

// Identificador de la categoría (en español), para los filtros del índice.
function categorySlug(post) {
  return post.category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const ARROW = '<svg class="am-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

function cover(post, lang, className, attrs = 'loading="lazy"') {
  if (!post.cover) return `<div class="${className} am-cover--empty" aria-hidden="true"></div>`
  const locale = post.locales[lang] || post.locales.es
  return `<img class="${className}" src="${escape(post.cover)}" alt="${escape(locale.title)}" width="1600" height="900" ${attrs} data-i18n-skip>`
}

function card(post, lang) {
  const draft = post.draft ? '<span class="am-draft">Borrador</span>' : ''
  return `<a class="am-card" href="/blog/${post.slug}" data-cat="${categorySlug(post)}">
        <div class="am-card__media">
          ${cover(post, lang, 'am-card__img')}
          <span class="am-chip am-chip--glass">${text(post, lang, (t) => escape(t.category))}</span>${draft}
        </div>
        <div class="am-card__body">
          <p class="am-meta">${dateTag(post.date, lang)}<span class="am-meta__sep" aria-hidden="true"></span>${minutesTag(post, lang)}</p>
          <h3 class="am-card__title">${text(post, lang, (t) => escape(t.title))}</h3>
          <p class="am-card__desc">${text(post, lang, (t) => escape(t.description))}</p>
          <span class="am-more">Leer artículo ${ARROW}</span>
        </div>
      </a>`
}

function featured(post, lang) {
  const draft = post.draft ? ' <span class="am-draft">Borrador</span>' : ''
  return `<a class="am-feature" href="/blog/${post.slug}" data-cat="${categorySlug(post)}">
        <div class="am-feature__media">${cover(post, lang, 'am-feature__img', 'fetchpriority="high"')}</div>
        <div class="am-feature__body">
          <div class="am-feature__tags">
            <span class="am-chip am-chip--brand"><span class="am-chip__dot" aria-hidden="true"></span>Más reciente</span>
            <span class="am-chip">${text(post, lang, (t) => escape(t.category))}</span>${draft}
          </div>
          <h2 class="am-feature__title">${text(post, lang, (t) => escape(t.title))}</h2>
          <p class="am-feature__desc">${text(post, lang, (t) => escape(t.description))}</p>
          <p class="am-meta">${dateTag(post.date, lang)}<span class="am-meta__sep" aria-hidden="true"></span>${minutesTag(post, lang)}</p>
          <span class="am-more am-more--button">Leer artículo ${ARROW}</span>
        </div>
      </a>`
}

// Filtros por categoría: una pastilla por cada categoría, con su nombre en
// el idioma de la página tomado de los propios artículos.
function filters(posts, lang) {
  const seen = new Map()
  posts.forEach((post) => {
    const slug = categorySlug(post)
    if (!seen.has(slug)) seen.set(slug, post)
  })
  if (seen.size < 2) return ''
  const chips = [...seen].map(
    ([slug, post]) => `<button type="button" class="am-filter" data-filter="${slug}" aria-pressed="false">${text(post, lang, (t) => escape(t.category))}</button>`
  )
  return `<div class="am-filters" role="group" aria-label="Filtrar por categoría">
      <button type="button" class="am-filter" data-filter="" aria-pressed="true">Todas</button>
      ${chips.join('\n      ')}
    </div>`
}

const WHATSAPP_TEXT = {
  es: 'Hola Automind, leí su blog y quiero saber más',
  en: 'Hi Automind, I read your blog and I would like to know more',
  fr: 'Bonjour Automind, j’ai lu votre blog et j’aimerais en savoir plus',
}

export function ctaBand(whatsappText, {
  title = '<span class="am-accent">¿Quieres aplicarlo</span> en tu negocio?',
  lead = 'Agenda una llamada de diagnóstico sin costo y te decimos qué se puede automatizar en tu caso.',
  book = 'Agendar llamada',
  write = 'Escríbenos',
} = {}) {
  return `<section class="am-band" id="cta-blog">
      <div class="am-band__bg" aria-hidden="true"></div>
      <div class="am-band__content">
        <h2 class="am-band__title">${title}</h2>
        <p class="am-band__lead">${lead}</p>
        <div class="am-band__buttons">
          <a href="/#contact" class="am-btn am-btn--glow" ${CAL_ATTRS}><span class="am-roll"><span>${book}</span><span aria-hidden="true">${book}</span></span></a>
          <a href="${WHATSAPP}?text=${encodeURIComponent(whatsappText)}" class="am-btn am-btn--ghost" target="_blank" rel="noopener noreferrer"><span class="am-roll"><span>${write}</span><span aria-hidden="true">${write}</span></span></a>
        </div>
      </div>
    </section>`
}

// El índice usa textos del diccionario: finalizePage() los traduce.
export function renderIndex(posts, shell, lang) {
  const title = 'Blog de automatización, IA y sitios web — Automind'
  const description = 'Ideas prácticas sobre automatización, sitios web e inteligencia artificial para que tu negocio trabaje solo.'
  const url = `${SITE}/blog`
  const [first, ...rest] = posts
  const list = posts.length
    ? `${filters(posts, lang)}
    ${featured(first, lang)}
    ${rest.length ? `<div class="am-grid">\n      ${rest.map((post) => card(post, lang)).join('\n      ')}\n    </div>` : ''}
    <p class="am-blog-empty" hidden>No hay artículos en esta categoría.</p>`
    : '<p class="am-blog-empty">Pronto publicaremos nuestros primeros artículos.</p>'
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${url}#blog`,
    name: 'Blog de Automind',
    url,
    description,
    inLanguage: 'es',
    publisher: { '@id': `${SITE}/#organization` },
  }

  return `${head({ title, description, url, image: absolute(first?.cover || '/images/og-image.png'), type: 'website', extra: jsonLd(data) })}${shell.header}<main class="am-blog">
  <div class="am-frame">

    <section class="am-blog-hero">
      <div class="am-blog-hero__bg" aria-hidden="true"></div>
      <p class="am-pill"><span class="am-pill__dot" aria-hidden="true"></span>Blog</p>
      <h1 class="am-blog-hero__title"><span class="am-accent">Ideas para que</span> tu negocio trabaje solo</h1>
      <p class="am-blog-hero__lead">${description}</p>
    </section>

    <div class="am-divider"></div>
    <section class="am-blog-list" id="articulos">
    ${list}
    </section>

    <div class="am-divider"></div>
    ${ctaBand(WHATSAPP_TEXT[lang])}
  </div>
</main>${shell.footer}</body>
</html>
`
}

const SHARE_ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3V9.5zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21.95V14h2.65l.4-3.1H13.5V8.92c0-.9.25-1.5 1.54-1.5h1.64V4.65a22 22 0 0 0-2.39-.12c-2.37 0-3.99 1.45-3.99 4.1v2.27H7.63V14h2.67v7.95"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
}

function shareButtons(url) {
  const u = encodeURIComponent(url)
  return `<div class="am-share" data-share-url="${url}">
          <a class="am-share__btn" href="https://wa.me/?text=${u}" target="_blank" rel="noopener noreferrer" aria-label="Compartir en WhatsApp" data-share="whatsapp">${SHARE_ICONS.whatsapp}</a>
          <a class="am-share__btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer" aria-label="Compartir en LinkedIn" data-share="linkedin">${SHARE_ICONS.linkedin}</a>
          <a class="am-share__btn" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener noreferrer" aria-label="Compartir en Facebook" data-share="facebook">${SHARE_ICONS.facebook}</a>
          <button class="am-share__btn" type="button" aria-label="Copiar enlace" data-copy>${SHARE_ICONS.link}</button>
          <span class="am-share__toast" role="status" aria-live="polite"></span>
        </div>`
}

// El último párrafo "Fuentes:" / "Sources:" de cada artículo va como nota.
function decorateProse(html) {
  return html.replace(/<p><strong>(Fuentes|Sources)(\s*:)<\/strong>/g, '<p class="am-sources"><strong>$1$2</strong>')
}

// Lateral del artículo: primero los de la misma categoría y luego los más
// recientes (posts ya viene ordenado por fecha).
function sidePosts(post, posts, lang) {
  const others = posts.filter((other) => other.slug !== post.slug)
  const related = others.filter((other) => other.category === post.category)
  const picks = [...related, ...others.filter((other) => other.category !== post.category)].slice(0, 4)
  if (!picks.length) return ''
  const items = picks.map((other) => `<li>
            <a class="am-side-post" href="/blog/${other.slug}">
              ${cover(other, lang, 'am-side-post__img')}
              <span class="am-side-post__body">
                <span class="am-side-post__cat">${text(other, lang, (t) => escape(t.category))}</span>
                <span class="am-side-post__title">${text(other, lang, (t) => escape(t.title))}</span>
                <span class="am-side-post__meta">${dateTag(other.date, lang)}</span>
              </span>
            </a>
          </li>`)
  return `<nav class="am-side-posts" aria-label="Más artículos">
          <p class="am-aside-label">Más artículos</p>
          <ul class="am-side-posts__list">
          ${items.join('\n          ')}
          </ul>
        </nav>`
}

const ARTICLE_WHATSAPP = {
  es: (title) => `Hola Automind, leí el artículo "${title}" y quiero saber más`,
  en: (title) => `Hi Automind, I read the article "${title}" and I would like to know more`,
  fr: (title) => `Bonjour Automind, j’ai lu l’article « ${title} » et j’aimerais en savoir plus`,
}

// `url` es la dirección pública del artículo en `lang`.
export function renderPost(post, posts, shell, lang, url) {
  const locale = post.locales[lang]
  const image = absolute(post.cover || '/images/og-image.png')
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: locale.title,
        description: locale.description,
        image,
        inLanguage: lang,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        articleSection: locale.category,
        wordCount: locale.minutes * 200,
        mainEntityOfPage: url,
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
        isPartOf: { '@id': `${SITE}/blog#blog` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Automind', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: locale.title, item: url },
        ],
      },
    ],
  }
  // analytics.js lee estas metas para etiquetar cada evento con el artículo.
  const extra = `  <meta name="am-article" content="${escape(post.slug)}" data-category="${escape(post.category)}">
  <meta property="article:published_time" content="${post.date}">
  <meta property="article:modified_time" content="${post.updated || post.date}">
  <meta property="article:section" content="${escape(locale.category)}">
${jsonLd(data)}`
  const more = posts.filter((other) => other.slug !== post.slug).slice(0, 3)
  const moreSection = more.length
    ? `
    <div class="am-divider"></div>
    <section class="am-blog-list" id="mas-articulos">
      <div class="am-section-head">
        <p class="am-pill"><span class="am-pill__dot" aria-hidden="true"></span>Blog</p>
        <h2 class="am-section-head__title">Sigue leyendo</h2>
      </div>
      <div class="am-grid">
      ${more.map((other) => card(other, lang)).join('\n      ')}
      </div>
    </section>`
    : ''

  return `${head({ title: `${locale.title} — Automind`, description: locale.description, url, image, type: 'article', extra })}${shell.header}<div class="am-progress" aria-hidden="true"><span></span></div>
<main class="am-blog">
  <div class="am-frame">

    <header class="am-post-hero" id="cabecera">
      <div class="am-blog-hero__bg" aria-hidden="true"></div>
      <div class="am-post-hero__grid">
        <div class="am-post-hero__text">
          <div class="am-post-hero__top">
            <a class="am-back" href="/blog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Volver al blog</a>
            <div class="am-post-hero__tags">
              <span class="am-chip am-chip--brand"><span class="am-chip__dot" aria-hidden="true"></span>${text(post, lang, (t) => escape(t.category))}</span>${post.draft ? '<span class="am-draft">Borrador</span>' : ''}
            </div>
          </div>
          <h1 class="am-post-hero__title">${text(post, lang, (t) => escape(t.title))}</h1>
          <p class="am-post-hero__lead">${text(post, lang, (t) => escape(t.description))}</p>
          <div class="am-byline">
            <span class="am-byline__avatar" aria-hidden="true"><img src="/favicon.svg" alt="" width="22" height="22"></span>
            <span class="am-byline__text"><strong>Automind</strong><span class="am-meta">${dateTag(post.date, lang)}<span class="am-meta__sep" aria-hidden="true"></span>${minutesTag(post, lang)}</span></span>
          </div>
        </div>
        <figure class="am-post-cover">${cover(post, lang, 'am-post-cover__img', 'fetchpriority="high"')}</figure>
      </div>
    </header>

    <div class="am-divider"></div>

    <div class="am-post-layout">
      <aside class="am-post-aside" id="lateral">
${sidePosts(post, posts, lang)}
        <div class="am-aside-share">
          <p class="am-aside-label">Compartir</p>
          ${shareButtons(url)}
        </div>
      </aside>

      <article class="am-prose" id="articulo" data-article>
${text(post, lang, (t) => `\n${decorateProse(t.html)}`, 'div')}
      </article>
    </div>

    ${ctaBand(ARTICLE_WHATSAPP[lang](locale.title))}${moreSection}
  </div>
</main>${shell.footer}</body>
</html>
`
}

export function renderRss(posts) {
  const items = posts.map((post) => `    <item>
      <title>${escape(post.title)}</title>
      <link>${SITE}/blog/${post.slug}</link>
      <guid>${SITE}/blog/${post.slug}</guid>
      <description>${escape(post.description)}</description>
      <category>${escape(post.category)}</category>
      <pubDate>${new Date(`${post.date}T12:00:00-05:00`).toUTCString()}</pubDate>
    </item>`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog de Automind</title>
    <link>${SITE}/blog</link>
    <description>Ideas prácticas sobre automatización, sitios web e inteligencia artificial.</description>
    <language>es-co</language>
${items.join('\n')}
  </channel>
</rss>
`
}
