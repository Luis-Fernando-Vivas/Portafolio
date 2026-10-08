(function () {
  // scroll-fill-headings.js rewrites this same paragraph into a visual span
  // plus a duplicate screen-reader-only span, so its textContent ends up as
  // "Resultados que se notanResultados que se notan" — match with indexOf,
  // not an exact-equality check.
  // In the visitor's language: i18n.js translates the page before this runs.
  var headingText = window.amT ? window.amT('Resultados que se notan') : 'Resultados que se notan'
  var heading = Array.prototype.slice.call(document.querySelectorAll('p, h2')).find(function (p) {
    return p.textContent.indexOf(headingText) !== -1
  })
  if (!heading) return

  var section = heading
  for (var i = 0; i < 6 && section; i++) section = section.parentElement
  if (!section) return

  // Each stat number is rendered as two identical <p> tags (Framer's own
  // width-measuring trick: one invisible for layout sizing, one visible on
  // top of it) sharing the same font-size:48px signature and parent — group
  // them so both get updated together as the count animates.
  var numberEls = Array.prototype.slice.call(section.querySelectorAll('p')).filter(function (p) {
    var style = p.getAttribute('style')
    return style && style.indexOf('font-size:48px') !== -1
  })
  if (!numberEls.length) return

  var groups = []
  var parents = []
  numberEls.forEach(function (p) {
    var idx = parents.indexOf(p.parentElement)
    if (idx === -1) {
      parents.push(p.parentElement)
      groups.push([p])
    } else {
      groups[idx].push(p)
    }
  })

  var stats = groups
    .map(function (els) {
      var text = els[0].textContent.trim()
      var match = text.match(/^(\d+(?:\.\d+)?)(.*)$/)
      if (!match) return null
      var decimals = (match[1].split('.')[1] || '').length
      return { els: els, target: parseFloat(match[1]), decimals: decimals, suffix: match[2] }
    })
    .filter(Boolean)
  if (!stats.length) return

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || !('IntersectionObserver' in window)) return

  function setText(stat, value) {
    var text = value.toFixed(stat.decimals) + stat.suffix
    stat.els.forEach(function (el) {
      el.textContent = text
    })
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3)
  }

  var DURATION = 1400
  function animate(stat) {
    setText(stat, 0)
    var start = null
    function frame(ts) {
      if (start === null) start = ts
      var t = Math.min(1, (ts - start) / DURATION)
      setText(stat, stat.target * easeOutCubic(t))
      if (t < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  var played = false
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !played) {
          played = true
          stats.forEach(animate)
          observer.disconnect()
        }
      })
    },
    { threshold: 0.4 }
  )
  observer.observe(section)
})()
