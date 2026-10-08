(function () {
  // A few sections (Resultados, Preguntas frecuentes, the closing CTA) never
  // got a stable id in the export, and some live inside multiple
  // responsive-variant copies — so instead of guessing at a specific class
  // name in the static markup, find each one by its heading text at runtime
  // and walk up to the nearest element that looks like a real section
  // (matches the same "*Section" / "Content" naming reveal.js already
  // relies on), then tag that with the id.
  function findSectionFor(headingText) {
    var heading = Array.prototype.slice.call(document.querySelectorAll('p, h2')).find(function (p) {
      return p.textContent.indexOf(headingText) !== -1
    })
    if (!heading) return null
    var el = heading
    for (var i = 0; i < 14 && el; i++) {
      var name = el.getAttribute && el.getAttribute('data-framer-name')
      if (name && (/Section$/.test(name) || name === 'Content')) return el
      el = el.parentElement
    }
    return null
  }

  // Headings are matched in the visitor's language (i18n.js translates the
  // page before this runs); amT falls back to the Spanish text.
  var t = window.amT || function (text) { return text }
  var idMap = {
    results: t('Resultados que se notan'),
    faq: t('Preguntas frecuentes'),
    contact: t('¿Listo para que tu negocio trabaje de forma más inteligente?'),
  }
  Object.keys(idMap).forEach(function (id) {
    if (document.getElementById(id)) return
    var el = findSectionFor(idMap[id])
    if (el) el.id = id
  })

  function getHeaderOffset() {
    var nav = document.querySelector('[data-framer-name="Navber"]')
    return (nav ? nav.offsetHeight : 0) + 16
  }

  function scrollToTarget(top) {
    if (window.lenis) {
      window.lenis.scrollTo(top, { duration: 1.2 })
    } else {
      window.scrollTo({ top: top, behavior: 'smooth' })
    }
  }

  // CTA buttons that open the Cal.com booking popup keep href="#contact" as
  // a plain fallback, but Cal's own embed script (cal-embed.js) binds its
  // own click listener directly on data-cal-link elements to open the
  // modal. That listener sits closer to the target than this one (which is
  // on document, bubble phase) and can call stopPropagation before our
  // listener ever runs -- so relying on a bubble-phase check here to block
  // the native href jump is a race: whenever Cal's own preventDefault call
  // doesn't win that race, the browser still falls through to the native
  // anchor jump. Block it in the capture phase instead, which always runs
  // before any bubble-phase (or same-target capture-less) listener on the
  // element itself, so the native jump can never fire regardless of what
  // Cal's script does downstream. This only calls preventDefault, so it
  // doesn't stop Cal's own listener from still opening the modal.
  document.addEventListener('click', function (e) {
    var calTrigger = e.target.closest && e.target.closest('[data-cal-link]')
    if (calTrigger) e.preventDefault()
  }, true)

  // Every in-page nav link (header, mobile menu, footer) uses a bare
  // "#id" href — intercept those so they glide there instead of relying on
  // the browser's instant hash jump, and so href="#contact" etc. never
  // triggers a real navigation/reload.
  document.addEventListener('click', function (e) {
    var calTrigger = e.target.closest && e.target.closest('[data-cal-link]')
    if (calTrigger) return

    var scrollButton = e.target.closest && e.target.closest('[data-scroll-target]')
    if (scrollButton) {
      e.preventDefault()
      var scrollHash = scrollButton.getAttribute('data-scroll-target').slice(1)
      var scrollTargetEl = document.getElementById(scrollHash)
      if (!scrollTargetEl) return
      var scrollTop = scrollTargetEl.getBoundingClientRect().top + window.pageYOffset - getHeaderOffset()
      scrollToTarget(Math.max(0, scrollTop))
      history.pushState(null, '', '#' + scrollHash)
      return
    }

    var link = e.target.closest && e.target.closest('a[href^="#"]')
    if (!link) return
    var hash = link.getAttribute('href').slice(1)
    e.preventDefault()

    var top
    if (!hash) {
      top = 0
    } else {
      var target = document.getElementById(hash)
      if (!target) return
      top = target.getBoundingClientRect().top + window.pageYOffset - getHeaderOffset()
    }
    scrollToTarget(Math.max(0, top))
    if (hash) history.pushState(null, '', '#' + hash)
    else history.pushState(null, '', location.pathname + location.search)
  })
})()
