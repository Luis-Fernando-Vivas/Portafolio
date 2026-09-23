(function () {
  var cardWrap = document.querySelector('[data-framer-name="Card Wrap"]')
  if (!cardWrap) return

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || !window.requestAnimationFrame) return

  var rowEls = Array.prototype.slice.call(cardWrap.querySelectorAll(':scope > [data-framer-name="Cards"]'))
  if (!rowEls.length) return

  // Each row opens around its OWN center, not the whole card grid's center,
  // so the top two cards close in on each other independently from the
  // bottom three — and each row's progress is scrubbed by its own position
  // in the viewport, so the bottom row (being lower on the page) naturally
  // starts opening later, once the user has actually scrolled to it.
  var rows = rowEls
    .map(function (rowEl) {
      var cards = Array.prototype.slice
        .call(rowEl.children)
        .map(function (wrapper) {
          // Each card is wrapped in Framer's "ssr-variant" (display: contents),
          // so transform/opacity set on that wrapper never paint — grab the
          // actual boxed element inside it instead.
          var card = wrapper.classList.contains('ssr-variant') ? wrapper.firstElementChild : wrapper
          if (card) card.classList.add('automind-usecase-card')
          return card
        })
        .filter(Boolean)
      return { el: rowEl, cards: cards, deltas: [], smoothed: 0 }
    })
    .filter(function (row) {
      return row.cards.length > 0
    })
  if (!rows.length) return

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v))
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  function measure() {
    rows.forEach(function (row) {
      var rowRect = row.el.getBoundingClientRect()
      var centerX = rowRect.left + rowRect.width / 2
      var centerY = rowRect.top + rowRect.height / 2
      row.deltas = row.cards.map(function (card) {
        var r = card.getBoundingClientRect()
        return {
          dx: centerX - (r.left + r.width / 2),
          dy: centerY - (r.top + r.height / 2),
        }
      })
    })
  }

  // Progress window: a row starts opening once its top crosses 85% down the
  // viewport, and finishes once its top reaches 35% down — i.e. it plays out
  // gradually while the row scrolls through the lower half of the screen.
  var START_FRACTION = 0.85
  var END_FRACTION = 0.35
  // How quickly the visible position catches up to the raw scroll-derived
  // target each frame (0–1, lower = smoother/laggier, higher = snappier).
  // This turns a direct, one-to-one scroll mapping — which reads as jumpy —
  // into a gentle trailing motion.
  var SMOOTHING = 0.09

  function targetFor(row) {
    var vh = window.innerHeight
    var startPx = vh * START_FRACTION
    var endPx = vh * END_FRACTION
    var rect = row.el.getBoundingClientRect()
    return clamp((startPx - rect.top) / (startPx - endPx), 0, 1)
  }

  function frame() {
    rows.forEach(function (row) {
      var target = targetFor(row)
      row.smoothed += (target - row.smoothed) * SMOOTHING
      if (Math.abs(target - row.smoothed) < 0.0005) row.smoothed = target

      var eased = easeInOutCubic(row.smoothed)
      row.cards.forEach(function (card, i) {
        var d = row.deltas[i]
        if (!d) return
        card.style.setProperty('--uc-tx', (d.dx * (1 - eased)).toFixed(2) + 'px')
        card.style.setProperty('--uc-ty', (d.dy * (1 - eased)).toFixed(2) + 'px')
      })
    })
    requestAnimationFrame(frame)
  }

  measure()
  requestAnimationFrame(frame)

  var resizeTimer = null
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(measure, 150)
  }

  window.addEventListener('resize', onResize)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure)
  }

  var overlay = document.getElementById('automind-loading')
  if (overlay) {
    window.addEventListener('automind:loaded', measure, { once: true })
  }
})()
