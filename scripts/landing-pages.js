/* Landing pages de servicio + ubicación (SEO local e internacional).

   Cada página vive en content/paginas/<archivo>.md y se publica en /<slug>
   (español) o /<idioma>/<slug> (inglés, francés). Las páginas con el mismo
   `group` son traducciones entre sí: se enlazan con hreflang. Encabezado:

     ---
     lang: es                      (es, en o fr)
     slug: diseno-web-neiva        (dirección, sin el prefijo de idioma)
     group: neiva                  (mismo valor en sus traducciones)
     title: Título para Google (≈ 60 caracteres)
     description: Resumen para Google (≈ 155 caracteres)
     eyebrow: Neiva · Huila
     h1: Título grande de la página
     lead: Párrafo bajo el título
     service: Nombre del servicio (datos estructurados)
     area: [Neiva, Huila, Colombia]     (dónde se presta el servicio)
     date: 2026-10-07
     updated: 2026-10-20                (opcional)
     x_default: true                    (opcional: versión por defecto del grupo)
     faq:
       - q: Pregunta
         a: Respuesta
     ---
     Cuerpo en Markdown.

   Los textos de la página van ya en su idioma (data-i18n-skip); el header y
   el footer los traduce finalizePage() con el diccionario. */
import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'
import { absolute, ARROW, CAL_ATTRS, ctaBand, escape, head, isoDate, jsonLd, parseFrontmatter } from './blog-plugin.js'
import { LANGS, SITE } from './i18n-build.js'

const COUNTRIES = {
  Colombia: 'CO', 'Estados Unidos': 'US', 'United States': 'US', 'États-Unis': 'US',
  Canadá: 'CA', Canada: 'CA',
}

const UI = {
  es: {
    book: 'Agendar llamada', write: 'Escríbenos', prices: 'Ver precios', faq: 'Preguntas frecuentes', related: 'También te puede interesar',
    ctaTitle: '<span class="am-accent">¿Hablamos</span> de tu proyecto?',
    ctaLead: 'Agenda una llamada de diagnóstico sin costo: revisamos tu caso y te enviamos una propuesta con precio y plazos.',
    whatsapp: (title) => `Hola Automind, vi la página "${title}" y quiero una cotización`,
    home: 'Inicio',
  },
  en: {
    book: 'Book a call', write: 'Message us', prices: 'See pricing', faq: 'Frequently asked questions', related: 'You may also be interested in',
    ctaTitle: '<span class="am-accent">Let’s talk</span> about your project',
    ctaLead: 'Book a free discovery call: we review your case and send you a proposal with pricing and timelines.',
    whatsapp: (title) => `Hi Automind, I saw the page "${title}" and I would like a quote`,
    home: 'Home',
  },
  fr: {
    book: 'Réserver un appel', write: 'Écrivez-nous', prices: 'Voir les tarifs', faq: 'Questions fréquentes', related: 'Ça pourrait aussi vous intéresser',
    ctaTitle: '<span class="am-accent">Parlons</span> de votre projet',
    ctaLead: 'Réservez un appel de diagnostic gratuit : nous étudions votre cas et vous envoyons une proposition avec prix et délais.',
    whatsapp: (title) => `Bonjour Automind, j’ai vu la page « ${title} » et j’aimerais un devis`,
    home: 'Accueil',
  },
}

export function landingPath(page) {
  return page.lang === 'es' ? `/${page.slug}` : `/${page.lang}/${page.slug}`
}

export function readLandings(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, name), 'utf8'), name)
      for (const field of ['lang', 'slug', 'title', 'description', 'h1', 'lead', 'service', 'date']) {
        if (!data[field]) throw new Error(`${name}: falta "${field}" en el encabezado`)
      }
      if (!LANGS.includes(data.lang)) throw new Error(`${name}: "lang" debe ser ${LANGS.join(', ')}`)
      return {
        file: name,
        lang: data.lang,
        slug: String(data.slug),
        group: String(data.group || data.slug),
        title: String(data.title),
        description: String(data.description),
        eyebrow: data.eyebrow ? String(data.eyebrow) : '',
        h1: String(data.h1),
        lead: String(data.lead),
        service: String(data.service),
        area: Array.isArray(data.area) ? data.area.map(String) : [],
        date: isoDate(data.date),
        updated: data.updated ? isoDate(data.updated) : '',
        xDefault: data.x_default === true,
        faq: Array.isArray(data.faq) ? data.faq.map((item) => ({ q: String(item.q), a: String(item.a) })) : [],
        html: marked.parse(body),
      }
    })
}

function place(name) {
  const country = COUNTRIES[name]
  return country ? { '@type': 'Country', name, identifier: country } : { '@type': 'Place', name }
}

export function renderLanding(page, landings, shell) {
  const ui = UI[page.lang]
  const url = SITE + landingPath(page)
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: page.lang,
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${url}#service` },
        datePublished: page.date,
        dateModified: page.updated || page.date,
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: page.service,
        serviceType: page.service,
        description: page.description,
        url,
        provider: { '@id': `${SITE}/#organization` },
        areaServed: page.area.map(place),
        availableChannel: { '@type': 'ServiceChannel', serviceUrl: url, availableLanguage: ['es', 'en', 'fr'] },
        offers: { '@type': 'Offer', url: `${SITE}/precios`, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ui.home, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: page.h1, item: url },
        ],
      },
      ...(page.faq.length
        ? [{
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: page.faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }]
        : []),
    ],
  }

  const faq = page.faq.length
    ? `
    <div class="am-divider"></div>
    <section class="am-landing-faq" id="preguntas" data-i18n-skip>
      <div class="am-section-head">
        <p class="am-pill"><span class="am-pill__dot" aria-hidden="true"></span>FAQ</p>
        <h2 class="am-section-head__title">${ui.faq}</h2>
      </div>
      <div class="am-landing-faq__list">
      ${page.faq.map((item) => `<details class="am-landing-faq__item">
          <summary><h3>${escape(item.q)}</h3><span class="am-landing-faq__icon" aria-hidden="true"></span></summary>
          <p>${escape(item.a)}</p>
        </details>`).join('\n      ')}
      </div>
    </section>`
    : ''

  // Otras landing pages en el mismo idioma (enlazado interno).
  const others = landings.filter((other) => other.lang === page.lang && other !== page)
  const related = others.length
    ? `
    <div class="am-divider"></div>
    <nav class="am-landing-related" aria-label="${ui.related}" data-i18n-skip>
      <p class="am-aside-label">${ui.related}</p>
      <ul>
      ${others.map((other) => `<li><a href="${landingPath(other)}">${escape(other.h1)} ${ARROW}</a></li>`).join('\n      ')}
      </ul>
    </nav>`
    : ''

  return `${head({ title: page.title, description: page.description, url, image: absolute('/images/og-image.png'), type: 'website', extra: jsonLd(data), css: ['/js/landing.css'] })}${shell.header}<main class="am-blog am-landing">
  <div class="am-frame">

    <section class="am-blog-hero" data-i18n-skip>
      <div class="am-blog-hero__bg" aria-hidden="true"></div>
      ${page.eyebrow ? `<p class="am-pill"><span class="am-pill__dot" aria-hidden="true"></span>${escape(page.eyebrow)}</p>` : ''}
      <h1 class="am-blog-hero__title">${escape(page.h1)}</h1>
      <p class="am-blog-hero__lead">${escape(page.lead)}</p>
      <div class="am-landing-hero__buttons">
        <a href="/#contact" class="am-btn am-btn--dark" ${CAL_ATTRS}><span class="am-roll"><span>${ui.book}</span><span aria-hidden="true">${ui.book}</span></span></a>
        <a href="/precios" class="am-btn am-btn--light"><span class="am-roll"><span>${ui.prices}</span><span aria-hidden="true">${ui.prices}</span></span></a>
      </div>
    </section>

    <div class="am-divider"></div>

    <article class="am-prose am-landing__body" data-i18n-skip>
${page.html}
    </article>
${faq}${related}
    <div class="am-divider"></div>
    <div data-i18n-skip>
    ${ctaBand(ui.whatsapp(page.h1), { title: ui.ctaTitle, lead: ui.ctaLead, book: ui.book, write: ui.write })}
    </div>
  </div>
</main>${shell.footer}</body>
</html>
`
}
