/* Idioma del sitio (español, inglés, francés) y el selector flotante.

   Cómo funciona:
   - Cada página existe ya traducida en /en/... y /fr/... (las genera
     scripts/site-plugin.js al construir el sitio, para que Google y los
     asistentes de IA lean cada idioma). El idioma lo dice la URL; las
     versiones de la página están en los <link rel="alternate" hreflang>
     que van justo antes de este script.
   - Este archivo va al inicio del <head> (sin defer). En una página en
     español, si el visitante eligió antes otro idioma con el selector (o
     llega con ?lang=en), lo lleva a esa versión.
   - i18n-dict.js (con defer, antes que cualquier otro script diferido)
     trae los diccionarios y llama a amI18n.register(). Ahí se repasa el
     DOM — textos y atributos alt/title/aria-label/placeholder — ANTES de
     que hero-blur-reveal.js, scroll-fill-headings.js, pain-chat.js, etc.
     partan los textos en palabras y letras para sus animaciones, y luego
     se traduce lo que otros scripts agregan (banner de cookies, etc.).
   - Los diccionarios usan como clave el texto en español tal cual se ve
     (espacios colapsados). Un texto sin traducción se queda en español.
   - window.amT('texto en español') devuelve su traducción: la usan los
     scripts que buscan elementos por su texto (nav-anchors.js, etc.). */
(function () {
  var LANGS = ['es', 'en', 'fr']
  var NAMES = { es: 'Español', en: 'English', fr: 'Français' }
  var STORAGE_KEY = 'am-lang'
  var root = document.documentElement

  var pathMatch = location.pathname.match(/^\/(en|fr)(\/|$)/)
  var lang = pathMatch ? pathMatch[1] : 'es'

  // Dirección de esta página en otro idioma (o null si no existe).
  function alternate(code) {
    var link = document.querySelector('link[rel="alternate"][hreflang="' + code + '"]')
    return link ? new URL(link.getAttribute('href'), location.href).pathname : null
  }

  // ?lang= (enlaces antiguos) manda; si no, en las páginas en español se
  // respeta el idioma que el visitante eligió antes con el selector.
  var wanted = null
  try {
    var fromUrl = new URLSearchParams(location.search).get('lang')
    if (LANGS.indexOf(fromUrl) !== -1) {
      wanted = fromUrl
      localStorage.setItem(STORAGE_KEY, fromUrl)
    } else if (lang === 'es') {
      var saved = localStorage.getItem(STORAGE_KEY)
      if (LANGS.indexOf(saved) !== -1) wanted = saved
    }
  } catch {
    // Sin localStorage (modo privado estricto): manda la URL.
  }
  var target = wanted && wanted !== lang ? alternate(wanted) : null
  if (target) {
    var params = new URLSearchParams(location.search)
    params.delete('lang')
    var query = params.toString()
    root.style.visibility = 'hidden'
    location.replace(target + (query ? '?' + query : '') + location.hash)
    return
  }

  root.lang = lang
  root.setAttribute('data-am-lang', lang)

  var css = document.createElement('link')
  css.rel = 'stylesheet'
  css.href = '/js/i18n.css'
  document.head.appendChild(css)

  var dict = {}
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, svg: 1, SVG: 1 }
  var ATTRS = ['alt', 'title', 'aria-label', 'placeholder']

  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim()
  }

  function lookup(text) {
    var key = normalize(text)
    return key && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : null
  }

  window.amT = function (text) {
    return lookup(text) || text
  }

  function skipped(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP_TAGS[el.tagName] || el.hasAttribute('data-i18n-skip') || el.getAttribute('translate') === 'no') return true
    }
    return false
  }

  function translateText(node) {
    var value = node.nodeValue
    var translated = lookup(value)
    if (translated === null) return
    var lead = value.match(/^\s*/)[0]
    var trail = value.match(/\s*$/)[0]
    node.nodeValue = lead + translated + trail
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var value = el.getAttribute(ATTRS[i])
      if (!value) continue
      var translated = lookup(value)
      if (translated !== null) el.setAttribute(ATTRS[i], translated)
    }
  }

  function translateTree(node) {
    if (node.nodeType === 3) {
      if (!skipped(node.parentNode)) translateText(node)
      return
    }
    if (node.nodeType !== 1 || skipped(node)) return
    translateAttrs(node)
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          return SKIP_TAGS[n.tagName] || n.hasAttribute('data-i18n-skip') || n.getAttribute('translate') === 'no'
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })
    var current
    while ((current = walker.nextNode())) {
      if (current.nodeType === 3) translateText(current)
      else translateAttrs(current)
    }
  }

  // Textos que otros scripts agregan después (banner de cookies, etc.).
  // Se ignora lo marcado aria-hidden: son las copias palabra por palabra o
  // letra por letra de las animaciones, que ya salen del texto traducido.
  function observe() {
    if (!('MutationObserver' in window)) return
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes
        for (var j = 0; j < added.length; j++) {
          var node = added[j]
          var el = node.nodeType === 1 ? node : node.parentNode
          if (el && el.closest && el.closest('[aria-hidden="true"]')) continue
          translateTree(node)
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  }

  /* ---------- Selector de idioma ---------- */

  var GLOBE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path>' +
    '<path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"></path></svg>'
  var CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'

  function buildSwitcher() {
    var wrap = document.createElement('div')
    wrap.className = 'am-lang'
    wrap.setAttribute('data-i18n-skip', '')
    wrap.setAttribute('translate', 'no')

    var options = LANGS.map(function (code) {
      var active = code === lang
      return (
        '<li role="none"><button type="button" role="menuitemradio" class="am-lang__option' + (active ? ' is-active' : '') +
        '" data-lang-set="' + code + '" lang="' + code + '" aria-checked="' + active + '">' +
        '<span class="am-lang__badge">' + code.toUpperCase() + '</span>' +
        '<span class="am-lang__name">' + NAMES[code] + '</span>' +
        '<span class="am-lang__check">' + CHECK + '</span></button></li>'
      )
    }).join('')

    wrap.innerHTML =
      '<ul class="am-lang__menu" role="menu" id="am-lang-menu" aria-label="Idioma · Language · Langue">' + options + '</ul>' +
      '<button type="button" class="am-lang__toggle" aria-haspopup="true" aria-expanded="false" aria-controls="am-lang-menu" ' +
      'aria-label="' + NAMES[lang] + ' — Idioma · Language · Langue">' +
      '<span class="am-lang__ring" aria-hidden="true"></span>' +
      '<span class="am-lang__globe">' + GLOBE + '</span>' +
      '<span class="am-lang__code">' + lang.toUpperCase() + '</span>' +
      '<span class="am-lang__chevron" aria-hidden="true"></span></button>'

    var toggle = wrap.querySelector('.am-lang__toggle')
    var items = Array.prototype.slice.call(wrap.querySelectorAll('.am-lang__option'))

    function setOpen(open) {
      wrap.classList.toggle('is-open', open)
      toggle.setAttribute('aria-expanded', String(open))
      if (open) {
        var active = wrap.querySelector('.am-lang__option.is-active') || items[0]
        requestAnimationFrame(function () { active.focus() })
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!wrap.classList.contains('is-open'))
    })

    wrap.addEventListener('click', function (event) {
      var option = event.target.closest('[data-lang-set]')
      if (!option) return
      var code = option.getAttribute('data-lang-set')
      if (code === lang) {
        setOpen(false)
        toggle.focus()
        return
      }
      switchTo(code)
    })

    wrap.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && wrap.classList.contains('is-open')) {
        setOpen(false)
        toggle.focus()
        return
      }
      var index = items.indexOf(document.activeElement)
      if (index === -1) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        var next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next].focus()
      }
    })

    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) setOpen(false)
    })

    document.body.appendChild(wrap)
    // Entrada con un pequeño retraso para que se note sin estorbar la carga.
    setTimeout(function () { wrap.classList.add('is-ready') }, 600)
  }

  function switchTo(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Sin almacenamiento: la próxima visita en español no redirige.
    }
    if (window.amTrack) window.amTrack('language_change', { language: code, previous_language: lang })

    var veil = document.createElement('div')
    veil.className = 'am-lang-veil'
    veil.setAttribute('aria-hidden', 'true')
    veil.innerHTML = '<span class="am-lang-veil__label">' + NAMES[code] + '</span>'
    document.body.appendChild(veil)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { veil.classList.add('is-visible') })
    })

    // Si esta página no existe en ese idioma, va a su inicio.
    var href = alternate(code) || (code === 'es' ? '/' : '/' + code + '/')
    setTimeout(function () {
      location.assign(href + location.hash)
    }, 320)
  }

  function apply() {
    if (lang !== 'es') {
      translateTree(document.body)
      observe()
    }
    buildSwitcher()
  }

  window.amI18n = {
    lang: lang,
    languages: LANGS.slice(),
    // Lo llama i18n-dict.js con { en: {...}, fr: {...} }.
    register: function (dictionaries) {
      dict = (dictionaries && dictionaries[lang]) || {}
      if (document.body) apply()
      else document.addEventListener('DOMContentLoaded', apply)
    },
    set: switchTo,
  }
})()
