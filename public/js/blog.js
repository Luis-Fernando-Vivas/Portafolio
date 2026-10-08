/* Blog: filtros por categoría (/blog) y, en cada artículo, barra de
   progreso de lectura y botones de compartir. Corre con defer después de
   i18n-dict.js. */
(function () {
  var t = window.amT || function (text) { return text }

  /* ---------- Filtros del índice ---------- */
  var filters = document.querySelectorAll('.am-filter')
  if (filters.length) {
    var group = filters[0].parentNode
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'))
    var empty = document.querySelector('.am-blog-empty')
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var animates = !reduced && typeof Element.prototype.animate === 'function'
    var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
    var run = 0

    /* Pastilla que se desliza bajo la categoría activa. */
    var pill = document.createElement('span')
    pill.className = 'am-filters__pill'
    pill.setAttribute('aria-hidden', 'true')
    group.insertBefore(pill, group.firstChild)
    var movePill = function (button, instant) {
      if (instant) pill.style.transition = 'none'
      pill.style.width = button.offsetWidth + 'px'
      pill.style.height = button.offsetHeight + 'px'
      pill.style.transform = 'translate(' + button.offsetLeft + 'px,' + button.offsetTop + 'px)'
      if (instant) {
        pill.getBoundingClientRect()
        pill.style.transition = ''
      }
    }
    var active = function () { return group.querySelector('[aria-pressed="true"]') || filters[0] }
    movePill(active(), true)
    group.classList.add('has-pill')
    window.addEventListener('resize', function () { movePill(active(), true) })
    if (document.fonts) document.fonts.ready.then(function () { movePill(active(), true) })

    var apply = function (value) {
      var shown = 0
      items.forEach(function (item) {
        var match = !value || item.getAttribute('data-cat') === value
        item.hidden = !match
        if (match) shown++
      })
      if (empty) empty.hidden = shown > 0
    }

    /* Salida de las tarjetas que sobran, luego FLIP de las que se quedan y
       entrada escalonada de las nuevas. */
    var animateTo = function (value) {
      var token = ++run
      items.forEach(function (item) {
        item.getAnimations().forEach(function (a) { if (a.id === 'am-filter') a.cancel() })
      })
      var visible = items.filter(function (item) { return !item.hidden })
      var leaving = visible.filter(function (item) {
        return value && item.getAttribute('data-cat') !== value
      })
      var before = new Map()
      visible.forEach(function (item) { before.set(item, item.getBoundingClientRect()) })

      var out = leaving.map(function (item) {
        var a = item.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(0.97)' }],
          { duration: 220, easing: 'ease-in', fill: 'forwards' }
        )
        a.id = 'am-filter'
        return a.finished.catch(function () {})
      })

      Promise.all(out).then(function () {
        if (token !== run) return
        apply(value)
        var delay = 0
        items.forEach(function (item) {
          item.getAnimations().forEach(function (a) { if (a.id === 'am-filter') a.cancel() })
          if (item.hidden) return
          var prev = before.get(item)
          var now = item.getBoundingClientRect()
          var a
          if (prev && leaving.indexOf(item) === -1) {
            var dx = prev.left - now.left
            var dy = prev.top - now.top
            if (!dx && !dy) return
            a = item.animate(
              [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
              { duration: 520, easing: EASE }
            )
          } else {
            a = item.animate(
              [{ opacity: 0, transform: 'translateY(18px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
              { duration: 480, delay: delay, easing: EASE, fill: 'backwards' }
            )
            delay += 60
          }
          a.id = 'am-filter'
        })
        if (empty && !empty.hidden) {
          empty.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
        }
      })
    }

    filters.forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.getAttribute('aria-pressed') === 'true') return
        var value = button.getAttribute('data-filter')
        filters.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === button))
        })
        movePill(button)
        // En móvil la barra se desplaza horizontalmente: centra la activa.
        if (group.scrollWidth > group.clientWidth) {
          group.scrollTo({
            left: button.offsetLeft - (group.clientWidth - button.offsetWidth) / 2,
            behavior: reduced ? 'auto' : 'smooth'
          })
        }
        if (animates) animateTo(value)
        else apply(value)
        if (window.amTrack) window.amTrack('blog_filter', { category: value || 'todas' })
      })
    })
  }

  var article = document.querySelector('.am-prose[data-article]')
  if (!article) return

  /* ---------- Progreso de lectura ---------- */
  var bar = document.querySelector('.am-progress')
  if (bar) {
    var ticking = false
    var update = function () {
      var rect = article.getBoundingClientRect()
      var total = rect.height - window.innerHeight * 0.6
      var progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0
      bar.style.setProperty('--am-progress', progress.toFixed(4))
      ticking = false
    }
    update()
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }, { passive: true })
    window.addEventListener('resize', update)
  }

  /* ---------- Compartir ---------- */
  var share = document.querySelector('.am-share')
  if (share) {
    var url = share.getAttribute('data-share-url')
    var whatsapp = share.querySelector('[data-share="whatsapp"]')
    if (whatsapp) whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + url)

    // Los clics en los enlaces de compartir los registra analytics.js.
    var copy = share.querySelector('[data-copy]')
    var toast = share.querySelector('.am-share__toast')
    if (copy) {
      copy.addEventListener('click', function () {
        var done = function () {
          toast.textContent = t('Enlace copiado')
          toast.classList.add('is-visible')
          setTimeout(function () { toast.classList.remove('is-visible') }, 1800)
          if (window.amTrack) window.amTrack('share', { method: 'copy_link' })
        }
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {})
      })
    }
  }
})()
