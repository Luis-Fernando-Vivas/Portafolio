/* Blog generado desde Markdown.

   Cada archivo content/blog/<slug>.md es un artículo publicado en
   /blog/<slug>; el índice vive en /blog. Encabezado del archivo:

     ---
     title: Título del artículo
     description: Resumen de una o dos frases (Google y redes sociales)
     date: 2026-10-01
     category: Automatización
     cover: /images/blog/<slug>.webp     (opcional)
     updated: 2026-10-15                 (opcional)
     draft: true                         (opcional: solo se ve en local)
     ---

   - En `npm run dev` las páginas se generan en cada visita (los borradores
     también, marcados como tal) y el navegador se recarga al guardar un .md.
   - En `npm run build` se escriben dist/blog.html y dist/blog/<slug>.html
     (Vercel las sirve sin .html por cleanUrls) y se regenera sitemap.xml
     con las páginas fijas + los artículos publicados.

   El header, el footer y la barra móvil se copian de privacidad.html, así
   que cualquier cambio en ellos llega solo al blog. */
import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const SITE = 'https://www.automindco.com'
const GA_ID = 'G-TDSLWGEYQ2'
const STATIC_PAGES = ['/', '/precios', '/privacidad']
const WHATSAPP = 'https://wa.me/573014315587'
const CAL_ATTRS = 'data-cal-namespace="30min" data-cal-link="automind-5oseyu/30min" data-cal-config=\'{"layout":"month_view"}\''

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function escape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} de ${MONTHS[month - 1]} de ${year}`
}

// Encabezado "clave: valor" entre dos líneas ---. No hace falta YAML
// completo para estos campos.
function parseFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) throw new Error(`${file}: falta el encabezado --- al inicio`)
  const data = {}
  match[1].split(/\r?\n/).forEach((line) => {
    const pair = line.match(/^(\w+):\s*(.*)$/)
    if (pair) data[pair[1]] = pair[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  })
  return { data, body: match[2] }
}

function readPosts(dir, { includeDrafts }) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const file = path.join(dir, name)
      const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'), name)
      for (const field of ['title', 'description', 'date', 'category']) {
        if (!data[field]) throw new Error(`${name}: falta "${field}" en el encabezado`)
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error(`${name}: "date" debe ser AAAA-MM-DD`)
      const words = body.split(/\s+/).filter(Boolean).length
      return {
        ...data,
        slug: name.replace(/\.md$/, ''),
        draft: data.draft === 'true',
        html: marked.parse(body),
        minutes: Math.max(1, Math.round(words / 200)),
      }
    })
    .filter((post) => includeDrafts || !post.draft)
    .sort((a, b) => b.date.localeCompare(a.date))
}

// Header y footer (con la barra móvil y los scripts del final) de la página
// de privacidad, que no marca ningún enlace del menú como activo.
function readShell(root) {
  const html = fs.readFileSync(path.join(root, 'privacidad.html'), 'utf8')
  const bodyStart = html.indexOf('<body>') + '<body>'.length
  return {
    header: html.slice(bodyStart, html.indexOf('<main>')).replace('<a href="/blog">', '<a href="/blog" aria-current="page">'),
    footer: html.slice(html.indexOf('</main>') + '</main>'.length, html.indexOf('</body>')),
  }
}

function head({ title, description, url, image, type, extra = '' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${extra}  <!-- Google tag (gtag.js); la configuración y los eventos están en analytics.js -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script src="/js/analytics.js"></script>
  <script src="/js/consent.js" defer></script>
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
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
  <meta name="twitter:image" content="${image}">
  <link rel="alternate" type="application/rss+xml" title="Blog de Automind" href="${SITE}/blog/rss.xml">
  <link rel="preload" href="/fonts/ClashDisplay-Variable.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="stylesheet" href="/js/footer.css">
  <link rel="stylesheet" href="/js/bottom-nav.css">
  <link rel="stylesheet" href="/js/pricing.css">
  <link rel="stylesheet" href="/js/font.css">
  <link rel="stylesheet" href="/js/blog.css">
</head>
<body>
`
}

function absolute(src) {
  return src.startsWith('http') ? src : SITE + src
}

function card(post) {
  const cover = post.cover
    ? `<img class="am-post-card__cover" src="${escape(post.cover)}" alt="" loading="lazy">`
    : ''
  return `<a class="am-post-card am-reveal" href="/blog/${post.slug}">
        ${cover}<div class="am-post-card__body">
          <p class="am-post-meta">${escape(post.category)} · ${formatDate(post.date)}${post.draft ? ' · <span class="am-draft">Borrador</span>' : ''}</p>
          <h2>${escape(post.title)}</h2>
          <p>${escape(post.description)}</p>
          <span class="am-post-card__more">Leer artículo <span aria-hidden="true">→</span></span>
        </div>
      </a>`
}

function renderIndex(posts, shell) {
  const title = 'Blog — Automind'
  const description = 'Ideas prácticas sobre automatización, sitios web e inteligencia artificial para que tu negocio trabaje solo.'
  const list = posts.length
    ? `<div class="am-post-grid">\n      ${posts.map(card).join('\n      ')}\n    </div>`
    : '<p class="am-blog-empty">Pronto publicaremos nuestros primeros artículos.</p>'

  return `${head({ title, description, url: `${SITE}/blog`, image: `${SITE}/images/og-image.png`, type: 'website' })}${shell.header}<main>
  <div class="am-frame">

    <section class="am-hero">
      <p class="am-eyebrow">Blog</p>
      <h1 class="am-title">Ideas para que tu negocio trabaje solo</h1>
      <p class="am-lead">${description}</p>
    </section>

    <div class="am-divider"></div>
    <section class="am-section">
    ${list}
    </section>
  </div>
</main>${shell.footer}</body>
</html>
`
}

function renderPost(post, posts, shell) {
  const url = `${SITE}/blog/${post.slug}`
  const image = absolute(post.cover || '/images/og-image.png')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'Automind', url: `${SITE}/` },
    publisher: {
      '@type': 'Organization',
      name: 'Automind',
      logo: { '@type': 'ImageObject', url: `${SITE}/automind_logo_final_10_1.webp` },
    },
  }
  // analytics.js lee estas metas para etiquetar cada evento con el artículo.
  const extra = `  <meta name="am-article" content="${escape(post.slug)}" data-category="${escape(post.category)}">
  <meta property="article:published_time" content="${post.date}">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
`
  const cover = post.cover
    ? `\n    <img class="am-article__cover" src="${escape(post.cover)}" alt="" fetchpriority="high">\n`
    : ''
  const whatsappText = encodeURIComponent(`Hola Automind, leí el artículo "${post.title}" y quiero saber más`)
  const more = posts.filter((other) => other.slug !== post.slug).slice(0, 3)
  const moreSection = more.length
    ? `
    <div class="am-divider"></div>
    <section class="am-section" id="mas-articulos">
      <h2 class="am-title am-blog-more__title"><span class="am-accent">Sigue leyendo</span></h2>
      <div class="am-post-grid">
      ${more.map(card).join('\n      ')}
      </div>
    </section>`
    : ''

  return `${head({ title: `${post.title} — Automind`, description: post.description, url, image, type: 'article', extra })}${shell.header}<main>
  <div class="am-frame">

    <header class="am-hero am-article__hero">
      <a class="am-article__back" href="/blog"><span aria-hidden="true">←</span> Blog</a>
      <p class="am-eyebrow">${escape(post.category)}${post.draft ? ' · <span class="am-draft">Borrador</span>' : ''}</p>
      <h1 class="am-title">${escape(post.title)}</h1>
      <p class="am-lead">${escape(post.description)}</p>
      <p class="am-post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time> · ${post.minutes} min de lectura</p>
    </header>
${cover}
    <div class="am-divider"></div>
    <article class="am-prose" id="articulo" data-article>
${post.html}
    </article>

    <div class="am-divider"></div>
    <section class="am-cta" id="cta-articulo">
      <h2 class="am-title"><span class="am-accent">¿Quieres aplicarlo</span> en tu negocio?</h2>
      <p class="am-lead">Agenda una llamada de diagnóstico sin costo y te decimos qué se puede automatizar en tu caso.</p>
      <div class="am-hero__buttons">
        <a href="/#contact" class="am-btn am-btn--dark" ${CAL_ATTRS}><span class="am-roll"><span>Agendar llamada</span><span aria-hidden="true">Agendar llamada</span></span></a>
        <a href="${WHATSAPP}?text=${whatsappText}" class="am-btn am-btn--light" target="_blank" rel="noopener noreferrer"><span class="am-roll"><span>Escríbenos</span><span aria-hidden="true">Escríbenos</span></span></a>
      </div>
    </section>${moreSection}
  </div>
</main>${shell.footer}</body>
</html>
`
}

function renderSitemap(posts) {
  const urls = STATIC_PAGES.map((page) => `  <url>\n    <loc>${SITE}${page}</loc>\n  </url>`)
  const lastPost = posts[0]
  urls.push(`  <url>\n    <loc>${SITE}/blog</loc>${lastPost ? `\n    <lastmod>${lastPost.updated || lastPost.date}</lastmod>` : ''}\n  </url>`)
  posts.forEach((post) => {
    urls.push(`  <url>\n    <loc>${SITE}/blog/${post.slug}</loc>\n    <lastmod>${post.updated || post.date}</lastmod>\n  </url>`)
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por scripts/blog-plugin.js: para agregar una página fija,
     súmala a STATIC_PAGES allí; los artículos se agregan solos. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

function renderRss(posts) {
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

export default function blogPlugin() {
  let root
  let contentDir

  return {
    name: 'automind-blog',

    configResolved(config) {
      root = config.root
      contentDir = path.join(root, 'content', 'blog')
    },

    configureServer(server) {
      server.watcher.add(contentDir)
      server.watcher.on('change', (file) => {
        if (file.endsWith('.md') && file.startsWith(contentDir)) server.ws.send({ type: 'full-reload' })
      })

      server.middlewares.use((req, res, next) => {
        const pathname = req.url.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/$/, '')
        let html
        try {
          const posts = readPosts(contentDir, { includeDrafts: true })
          const shell = readShell(root)
          if (pathname === '/blog') {
            html = renderIndex(posts, shell)
          } else if (pathname === '/blog/rss.xml') {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8')
            res.end(renderRss(posts))
            return
          } else if (pathname.startsWith('/blog/')) {
            const post = posts.find((p) => p.slug === pathname.slice('/blog/'.length))
            if (post) html = renderPost(post, posts, shell)
          }
        } catch (error) {
          next(error)
          return
        }
        if (!html) {
          next()
          return
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      })
    },

    generateBundle() {
      const posts = readPosts(contentDir, { includeDrafts: false })
      const shell = readShell(root)
      this.emitFile({ type: 'asset', fileName: 'blog.html', source: renderIndex(posts, shell) })
      posts.forEach((post) => {
        this.emitFile({ type: 'asset', fileName: `blog/${post.slug}.html`, source: renderPost(post, posts, shell) })
      })
      this.emitFile({ type: 'asset', fileName: 'blog/rss.xml', source: renderRss(posts) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap(posts) })
    },
  }
}
