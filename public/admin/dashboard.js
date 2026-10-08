/* Tablero de noticias del panel (/admin, colección "Noticias").

   Reemplaza la lista de Decap por una vista con más información: resumen
   (total, publicadas, borradores, traducciones pendientes), búsqueda,
   filtros y una fila por noticia con portada, estado, categoría, fechas,
   idiomas y acciones (editar, ver en el sitio, traducir con IA).

   Los datos salen de /api/blog-ai ({ action: "list" }), que lee el
   repositorio directamente: así ve también lo que guardan la IA y otros
   usuarios sin recargar. Si la API falla, se deja la lista original de
   Decap. Las clases e1sogrfi2, ei8nkzc4, etc. son los nombres estables de
   los componentes de Decap (CollectionMain, CollectionTopContainer…). */
;(function () {
  var MAIN = '.e1sogrfi2' // CollectionMain
  var TOP = '.ei8nkzc4' // CollectionTopContainer
  var LANGS = [['es', 'Español'], ['en', 'Inglés'], ['fr', 'Francés']]
  var FILTERS = [
    ['all', 'Todas'],
    ['published', 'Publicadas'],
    ['draft', 'Borradores'],
    ['untranslated', 'Sin traducir'],
  ]
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

  var state = { posts: null, error: '', loading: false, filter: 'all', query: '', loadedAt: 0 }
  var root = null

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }

  function formatDate(iso) {
    var parts = String(iso || '').split('-')
    if (parts.length !== 3) return ''
    return Number(parts[2]) + ' ' + MONTHS[Number(parts[1]) - 1] + ' ' + parts[0]
  }

  function onCollection() {
    return /^#\/collections\/blog\/?(\?.*)?$/.test(location.hash) || /^#\/collections\/blog\/(filter|groupBy|search)/.test(location.hash)
  }

  function missing(post) {
    return LANGS.filter(function (lang) { return post.langs.indexOf(lang[0]) === -1 }).map(function (lang) { return lang[0] })
  }

  function matches(post) {
    if (state.filter === 'published' && post.draft) return false
    if (state.filter === 'draft' && !post.draft) return false
    if (state.filter === 'untranslated' && !missing(post).length) return false
    if (!state.query) return true
    var haystack = (post.title + ' ' + post.description + ' ' + post.category).toLowerCase()
    return haystack.indexOf(state.query.toLowerCase()) !== -1
  }

  function count(kind) {
    var posts = state.posts || []
    if (kind === 'all') return posts.length
    if (kind === 'published') return posts.filter(function (p) { return !p.draft }).length
    if (kind === 'draft') return posts.filter(function (p) { return p.draft }).length
    return posts.filter(function (p) { return missing(p).length }).length
  }

  /* ---------- HTML ---------- */

  var ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    translate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9M8.5 3v2M6 5c.6 3 3 5.5 6 6.5M11 5c-.8 3.6-3.4 6.5-7 7.5"/><path d="M13 21l4-9 4 9M14.5 18h5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  }

  function row(post) {
    var editUrl = '#/collections/blog/entries/' + encodeURIComponent(post.slug)
    var lacking = missing(post)
    var thumb = post.cover
      ? '<img src="' + escapeHtml(post.cover) + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'is-empty\');this.remove()">'
      : ''
    var langs = LANGS.map(function (lang) {
      var has = post.langs.indexOf(lang[0]) !== -1
      return '<span class="am-dash-lang' + (has ? ' is-on' : '') + '" title="' + lang[1] + (has ? ': traducida' : ': falta') + '">' + lang[0].toUpperCase() + '</span>'
    }).join('')
    var dates = (post.draft ? 'Fecha: ' : 'Publicada el ') + formatDate(post.date) + (post.updated ? ' · Actualizada el ' + formatDate(post.updated) : '')
    var actions = '<a class="am-dash-btn am-dash-btn--primary" href="' + editUrl + '">' + ICONS.edit + 'Editar</a>'
    if (!post.draft) actions += '<a class="am-dash-btn" href="/blog/' + encodeURIComponent(post.slug) + '" target="_blank" rel="noopener">' + ICONS.external + 'Ver en el sitio</a>'
    if (lacking.some(function (lang) { return lang !== 'es' })) actions += '<button type="button" class="am-dash-btn" data-translate="' + escapeHtml(post.slug) + '">' + ICONS.translate + 'Traducir</button>'

    return '<article class="am-dash-row" data-status="' + (post.draft ? 'draft' : 'published') + '">' +
      '<a class="am-dash-thumb' + (post.cover ? '' : ' is-empty') + '" href="' + editUrl + '" tabindex="-1" aria-hidden="true">' + thumb + '</a>' +
      '<div class="am-dash-body">' +
        '<div class="am-dash-tags">' +
          '<span class="am-dash-status am-dash-status--' + (post.draft ? 'draft' : 'published') + '">' + (post.draft ? 'Borrador' : 'Publicada') + '</span>' +
          (post.category ? '<span class="am-dash-category">' + escapeHtml(post.category) + '</span>' : '') +
          (post.cover ? '' : '<span class="am-dash-warning">Sin portada</span>') +
        '</div>' +
        '<a class="am-dash-title" href="' + editUrl + '">' + escapeHtml(post.title) + '</a>' +
        (post.description ? '<p class="am-dash-desc">' + escapeHtml(post.description) + '</p>' : '') +
        '<p class="am-dash-meta">' + dates + '</p>' +
      '</div>' +
      '<div class="am-dash-side">' +
        '<div class="am-dash-langs" aria-label="Idiomas">' + langs + '</div>' +
        '<div class="am-dash-actions">' + actions + '</div>' +
      '</div>' +
    '</article>'
  }

  function render() {
    if (!root) return
    var stats = FILTERS.map(function (filter) {
      var active = state.filter === filter[0]
      return '<button type="button" class="am-dash-stat am-dash-stat--' + filter[0] + (active ? ' is-active' : '') + '" data-filter="' + filter[0] + '" aria-pressed="' + active + '">' +
        '<span class="am-dash-stat__value">' + (state.posts ? count(filter[0]) : '–') + '</span>' +
        '<span class="am-dash-stat__label">' + filter[1] + '</span></button>'
    }).join('')

    var list
    if (state.posts) {
      var visible = state.posts.filter(matches)
      list = visible.length
        ? visible.map(row).join('')
        : '<p class="am-dash-empty">' + (state.query || state.filter !== 'all' ? 'No hay noticias con ese filtro.' : 'Todavía no hay noticias. Crea la primera con “+ Noticia” o con ✨ IA.') + '</p>'
    } else if (state.error) {
      list = '<p class="am-dash-empty am-dash-empty--error">No se pudo cargar el tablero (' + escapeHtml(state.error) + '). Abajo está la lista normal del panel.</p>'
    } else {
      list = '<div class="am-dash-skeleton"></div><div class="am-dash-skeleton"></div><div class="am-dash-skeleton"></div>'
    }

    var search = root.querySelector('.am-dash-search input')
    var focused = search && document.activeElement === search
    root.innerHTML =
      '<div class="am-dash-stats">' + stats + '</div>' +
      '<div class="am-dash-toolbar">' +
        '<label class="am-dash-search">' + ICONS.search + '<input type="search" placeholder="Buscar por título, categoría o descripción" value="' + escapeHtml(state.query) + '"></label>' +
        '<button type="button" class="am-dash-btn am-dash-btn--ghost" data-refresh title="Volver a cargar"' + (state.loading ? ' disabled' : '') + '>' + ICONS.refresh + 'Actualizar</button>' +
        '<button type="button" class="am-dash-btn am-dash-btn--ai" data-ai>✨ Crear con IA</button>' +
      '</div>' +
      '<div class="am-dash-list" aria-busy="' + state.loading + '">' + list + '</div>'
    if (focused) {
      var input = root.querySelector('.am-dash-search input')
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
    document.body.classList.toggle('am-dash-on', !!state.posts)
  }

  /* ---------- Datos ---------- */

  function load(force) {
    if (!window.amAI || state.loading) return
    if (!force && state.posts && Date.now() - state.loadedAt < 15000) return render()
    state.loading = true
    render()
    window.amAI.api({ action: 'list' }).then(function (data) {
      state.posts = data.posts || []
      state.error = ''
      state.loadedAt = Date.now()
    }).catch(function (error) {
      state.error = error.message
    }).then(function () {
      state.loading = false
      render()
    })
  }

  /* ---------- Montaje sobre la vista de Decap ---------- */

  function mount() {
    var main = document.querySelector(MAIN)
    var active = onCollection() && main && window.amAI && window.amAI.session()
    if (!active) {
      if (root && root.parentNode) root.parentNode.removeChild(root)
      document.body.classList.remove('am-dash-on')
      return
    }
    if (root && main.contains(root)) return
    root = root || createRoot()
    var top = main.querySelector(TOP)
    if (top && top.nextSibling) main.insertBefore(root, top.nextSibling)
    else main.appendChild(root)
    load(false)
  }

  function createRoot() {
    var element = document.createElement('section')
    element.className = 'am-dash'
    element.setAttribute('aria-label', 'Noticias del blog')

    element.addEventListener('click', function (event) {
      var target = event.target.closest('button, a')
      if (!target) return
      if (target.hasAttribute('data-filter')) {
        state.filter = target.getAttribute('data-filter')
        render()
      } else if (target.hasAttribute('data-refresh')) {
        load(true)
      } else if (target.hasAttribute('data-ai')) {
        window.amAI.open('generate')
      } else if (target.hasAttribute('data-translate')) {
        window.amAI.open('translate', target.getAttribute('data-translate'))
      }
    })

    element.addEventListener('input', function (event) {
      if (!event.target.matches('.am-dash-search input')) return
      state.query = event.target.value
      var list = element.querySelector('.am-dash-list')
      var visible = (state.posts || []).filter(matches)
      list.innerHTML = visible.length ? visible.map(row).join('') : '<p class="am-dash-empty">No hay noticias con ese filtro.</p>'
    })
    return element
  }

  var scheduled = false
  new MutationObserver(function () {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(function () {
      scheduled = false
      mount()
    })
  }).observe(document.body, { childList: true, subtree: true })

  window.addEventListener('hashchange', function () {
    mount()
    // Al volver de editar una noticia, los datos pueden haber cambiado.
    if (onCollection()) load(true)
  })
  window.addEventListener('am-posts-changed', function () { load(true) })
  mount()
})()
