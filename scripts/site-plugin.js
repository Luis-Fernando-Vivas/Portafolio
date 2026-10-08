/* Páginas del sitio en los tres idiomas, blog, landing pages, sitemap,
   RSS y llms.txt.

   - Páginas fijas (index, precios, privacidad): Vite construye la versión
     en español; aquí se escriben además /en/... y /fr/... traducidas (ver
     scripts/i18n-build.js). Para agregar una, súmala a STATIC_PAGES y a
     rollupOptions.input en vite.config.js.
   - Blog: scripts/blog-plugin.js. Landing pages: scripts/landing-pages.js.
   - Todas llevan hreflang, canonical y og:locale de su idioma, y salen en
     sitemap.xml con sus alternativas.
   - llms.txt (resumen del sitio para asistentes de IA) se arma con
     content/llms.md y la lista de páginas y artículos.

   En `npm run dev` las páginas se generan en cada visita (los borradores
   del blog también) y el navegador se recarga al guardar un .md. En
   `npm run build` se escriben en dist/ (Vercel las sirve sin .html por
   cleanUrls). */
import fs from 'node:fs'
import path from 'node:path'
import { postLangs, readPosts, readShell, renderIndex, renderPost, renderRss } from './blog-plugin.js'
import { finalizePage, LANGS, loadDictionaries, prefixed, Routes, SITE } from './i18n-build.js'
import { landingPath, readLandings, renderLanding } from './landing-pages.js'

const STATIC_PAGES = [
  { path: '/', file: 'index.html', priority: '1.0' },
  { path: '/precios', file: 'precios.html', priority: '0.9' },
  { path: '/privacidad', file: 'privacidad.html', priority: '0.2' },
]

// '/' → 'index.html', '/en/' → 'en/index.html', '/en/precios' → 'en/precios.html'
function fileFor(pathname) {
  return pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : `${pathname.slice(1)}.html`
}

function collect(root, { includeDrafts }) {
  const posts = readPosts(path.join(root, 'content', 'blog'), { includeDrafts })
  const landings = readLandings(path.join(root, 'content', 'paginas'))
  const routes = new Routes()
  const all = (pathname) => Object.fromEntries(LANGS.map((lang) => [lang, prefixed(pathname, lang)]))

  // Cada entrada sabe generar su HTML en un idioma (en español o ya en el
  // idioma; finalizePage hace el resto).
  const pages = []
  STATIC_PAGES.forEach((page) => {
    const group = routes.add(all(page.path), { priority: page.priority })
    pages.push({ group, static: page.file })
  })

  const lastPost = posts[0]
  const blog = routes.add(all('/blog'), { lastmod: lastPost && (lastPost.updated || lastPost.date), priority: '0.7' })
  pages.push({ group: blog, render: (lang, shell) => renderIndex(posts, shell.blog, lang) })

  posts.forEach((post) => {
    const paths = Object.fromEntries(postLangs(post).map((lang) => [lang, prefixed(`/blog/${post.slug}`, lang)]))
    const group = routes.add(paths, { lastmod: post.updated || post.date, priority: '0.6' })
    pages.push({ group, render: (lang, shell) => renderPost(post, posts, shell.blog, lang, SITE + paths[lang]) })
  })

  const byGroup = new Map()
  landings.forEach((page) => {
    if (!byGroup.has(page.group)) byGroup.set(page.group, [])
    byGroup.get(page.group).push(page)
  })
  byGroup.forEach((list) => {
    const paths = Object.fromEntries(list.map((page) => [page.lang, landingPath(page)]))
    const lastmod = list.map((page) => page.updated || page.date).sort().pop()
    const xDefault = list.find((page) => page.xDefault)
    const group = routes.add(paths, { lastmod, priority: '0.8', xDefault: xDefault && landingPath(xDefault) })
    list.forEach((page) => {
      pages.push({ group, lang: page.lang, render: (lang, shell) => renderLanding(page, landings, shell.plain) })
    })
  })

  return { posts, landings, routes, pages }
}

function renderSitemap(routes) {
  const urls = []
  routes.groups.forEach((group) => {
    const langs = LANGS.filter((lang) => group.paths[lang])
    const links = langs
      .map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${group.paths[lang]}"/>`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${group.xDefault || group.paths.es || group.paths[langs[0]]}"/>`)
      .join('\n')
    langs.forEach((lang) => {
      const lastmod = group.lastmod ? `\n    <lastmod>${group.lastmod}</lastmod>` : ''
      const priority = group.priority ? `\n    <priority>${group.priority}</priority>` : ''
      urls.push(`  <url>\n    <loc>${SITE}${group.paths[lang]}</loc>${lastmod}${priority}\n${links}\n  </url>`)
    })
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por scripts/site-plugin.js: las páginas fijas están en
     STATIC_PAGES; los artículos y las landing pages se agregan solos. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
}

function renderLlms(root, { posts, landings }) {
  // Sin los comentarios de la plantilla.
  const template = fs.readFileSync(path.join(root, 'content', 'llms.md'), 'utf8').replace(/<!--[\s\S]*?-->\n*/g, '')
  const NAMES = { es: 'Español', en: 'English', fr: 'Français' }
  const pages = LANGS.map((lang) => {
    const list = landings.filter((page) => page.lang === lang)
    if (!list.length) return ''
    return `### ${NAMES[lang]}\n\n${list.map((page) => `- [${page.h1}](${SITE}${landingPath(page)}): ${page.description}`).join('\n')}`
  })
    .filter(Boolean)
    .join('\n\n')
  const articles = posts
    .map((post) => {
      const langs = postLangs(post)
      const others = langs.filter((lang) => lang !== 'es').map((lang) => `[${lang.toUpperCase()}](${SITE}${prefixed(`/blog/${post.slug}`, lang)})`)
      return `- [${post.title}](${SITE}/blog/${post.slug}) (${post.date}): ${post.description}${others.length ? ` · ${others.join(' · ')}` : ''}`
    })
    .join('\n')
  return template.replace('{{paginas}}', pages).replace('{{articulos}}', articles)
}

export default function sitePlugin() {
  let root
  let dicts

  const shells = () => ({ blog: readShell(root, '/blog'), plain: readShell(root) })

  // HTML final de una página en `lang`.
  function finalize(page, html, lang, routes) {
    return finalizePage(html, { lang, group: page.group, routes, dict: lang === 'es' ? null : dicts[lang] })
  }

  // Idiomas en los que se escribe cada entrada.
  function langsOf(page) {
    return page.lang ? [page.lang] : LANGS.filter((lang) => page.group.paths[lang])
  }

  return {
    name: 'automind-site',

    configResolved(config) {
      root = config.root
    },

    configureServer(server) {
      const contentDir = path.join(root, 'content')
      server.watcher.add(contentDir)
      const reload = (file) => {
        const dict = file.endsWith('i18n-dict.js')
        if ((file.endsWith('.md') && file.startsWith(contentDir)) || dict) {
          if (dict) dicts = null
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('change', reload)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)

      server.middlewares.use(async (req, res, next) => {
        let pathname = req.url.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '/')
        if (/^\/(en|fr)$/.test(pathname)) pathname += '/'
        if (pathname.length > 1 && pathname.endsWith('/') && !/^\/(en|fr)\/$/.test(pathname)) pathname = pathname.slice(0, -1)

        // Panel del blog (public/admin): Vite respondería con el index.
        if (pathname === '/admin' || pathname === '/admin/') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(path.join(root, 'public', 'admin', 'index.html')))
          return
        }

        // Archivos (js, css, imágenes, módulos de Vite): no son páginas.
        const special = ['/blog/rss.xml', '/sitemap.xml', '/llms.txt'].includes(pathname)
        if (!special && (/\.[a-z0-9]+$/i.test(pathname) || pathname.startsWith('/@') || pathname.startsWith('/node_modules/'))) {
          next()
          return
        }

        try {
          const site = collect(root, { includeDrafts: true })
          if (pathname === '/blog/rss.xml') {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8')
            res.end(renderRss(site.posts))
            return
          }
          if (pathname === '/sitemap.xml') {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8')
            res.end(renderSitemap(site.routes))
            return
          }
          if (pathname === '/llms.txt') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(renderLlms(root, site))
            return
          }

          const group = site.routes.find(pathname)
          if (!group) {
            next()
            return
          }
          const lang = LANGS.find((code) => group.paths[code] === pathname)
          const page = site.pages.find((item) => item.group === group && (!item.lang || item.lang === lang))
          dicts ||= loadDictionaries(root)
          let html
          if (page.static) {
            const raw = fs.readFileSync(path.join(root, page.static), 'utf8')
            html = await server.transformIndexHtml(`/${page.static}`, raw, req.originalUrl)
          } else {
            html = page.render(lang, shells())
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(finalize(page, html, lang, site.routes))
        } catch (error) {
          next(error)
        }
      })
    },

    // Después de que Vite escribe el HTML de las páginas fijas.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const site = collect(root, { includeDrafts: false })
        const shell = shells()
        dicts = loadDictionaries(root)
        const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })

        site.pages.forEach((page) => {
          const asset = page.static && bundle[page.static]
          if (page.static && !asset) throw new Error(`Falta ${page.static} en el build (rollupOptions.input en vite.config.js)`)
          // El HTML en español de Vite, antes de reemplazarlo por su versión final.
          const source = asset && String(asset.source)
          langsOf(page).forEach((lang) => {
            const fileName = fileFor(page.group.paths[lang])
            if (page.static) {
              const html = finalize(page, source, lang, site.routes)
              if (lang === 'es') asset.source = html
              else emit(fileName, html)
            } else {
              emit(fileName, finalize(page, page.render(lang, shell), lang, site.routes))
            }
          })
        })

        emit('blog/rss.xml', renderRss(site.posts))
        emit('sitemap.xml', renderSitemap(site.routes))
        emit('llms.txt', renderLlms(root, site))
      },
    },
  }
}
