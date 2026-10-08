(function () {
  // Real, distinct destinations in page order. Anything whose href isn't in
  // here, or that duplicates an href already kept, gets dropped.
  var ORDER = ['#', '#works', '#feature', '#results', '#faq', '/blog', '#contact']

  function orderIndex(href) {
    var i = ORDER.indexOf(href)
    return i === -1 ? ORDER.length : i
  }

  // Dedupes a list of {wrapper, href} items and returns the survivors sorted
  // into page order. When two items share a target, the generic "Empezar"
  // CTA label loses to a more specific one (e.g. "Contacto") pointing at the
  // same place. Dropped wrappers are removed from the DOM outright.
  // Labels and footer blurb are matched in the visitor's language (i18n.js
  // translates the page before this runs); amT falls back to the Spanish.
  var t = window.amT || function (text) { return text }
  var START = t('Empezar')

  function dedupeAndSort(items) {
    var kept = {}
    items.forEach(function (item) {
      var label = (item.wrapper.textContent || '').trim()
      var existing = kept[item.href]
      if (!existing) {
        kept[item.href] = item
        return
      }
      var existingLabel = (existing.wrapper.textContent || '').trim()
      if (existingLabel === START && label !== START) {
        existing.wrapper.remove()
        kept[item.href] = item
      } else {
        item.wrapper.remove()
      }
    })
    var result = Object.keys(kept).map(function (href) {
      return kept[href]
    })
    result.sort(function (a, b) {
      return orderIndex(a.href) - orderIndex(b.href)
    })
    return result
  }

  function itemsFromContainer(container) {
    return Array.prototype.slice.call(container.children).map(function (wrapper) {
      var a = wrapper.tagName === 'A' ? wrapper : wrapper.querySelector('a')
      return a ? { wrapper: wrapper, href: a.getAttribute('href') } : null
    }).filter(Boolean)
  }

  // --- Header nav --- (its link wrapper is named "Nav Link Group" — the
  // "Nav Menu" name is only used by the footer's two columns)
  var headerMenu = document.querySelector('[data-framer-name="Navber"] [data-framer-name="Nav Link Group"]')
  if (headerMenu) {
    var headerItems = dedupeAndSort(itemsFromContainer(headerMenu))
    headerItems.forEach(function (item) {
      headerMenu.appendChild(item.wrapper)
    })
  }

  // --- Footer: two "Nav Menu" columns share the same class as the header's,
  // so scope the search to the footer itself (found via its unique blurb
  // text) instead of querying by class name alone. ---
  var blurbText = t('Diseño, automatización y marketing digital para negocios que quieren crecer sin depender de procesos manuales.')
  var blurb = Array.prototype.slice.call(document.querySelectorAll('p')).find(function (p) {
    return p.textContent.indexOf(blurbText) !== -1
  })
  if (blurb) {
    var footerRoot = blurb
    for (var i = 0; i < 20 && footerRoot; i++) {
      if (footerRoot.querySelectorAll('[data-framer-name="Nav Menu"]').length >= 2) break
      footerRoot = footerRoot.parentElement
    }
    if (footerRoot) {
      var footerMenus = footerRoot.querySelectorAll('[data-framer-name="Nav Menu"]')
      if (footerMenus.length >= 2) {
        var colA = footerMenus[0]
        var colB = footerMenus[1]
        var combined = itemsFromContainer(colA).concat(itemsFromContainer(colB))
        var footerItems = dedupeAndSort(combined)
        var mid = Math.ceil(footerItems.length / 2)
        footerItems.forEach(function (item, idx) {
          ;(idx < mid ? colA : colB).appendChild(item.wrapper)
        })
      }
    }
  }

  // --- Mobile menu: plain <a> tags, no wrapper divs; the trailing "Empezar"
  // CTA is a distinct button (not a regular nav item) and always stays last,
  // even though its href duplicates "Contacto". ---
  var mobileMenu = document.getElementById('automind-mobile-menu')
  if (mobileMenu) {
    var cta = mobileMenu.querySelector('a.automind-mobile-cta')
    var mobileItems = Array.prototype.slice
      .call(mobileMenu.querySelectorAll('a'))
      .filter(function (a) {
        return a !== cta
      })
      .map(function (a) {
        return { wrapper: a, href: a.getAttribute('href') }
      })
    var keptMobile = dedupeAndSort(mobileItems)
    keptMobile.forEach(function (item) {
      mobileMenu.insertBefore(item.wrapper, cta)
    })
  }
})()
