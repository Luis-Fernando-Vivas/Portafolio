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

  // On mobile the cards stack into a single column (see brand.css), so the
  // "rows close in toward their own center" effect above -- built for the
  // desktop/tablet 2-and-3-per-row grid -- has nothing to converge: a lone
  // card in a "row" is already at its row's center, so dx/dy always came
  // out ~0 and it never visibly moved. Framer's original design (still
  // sitting unused in each card's own inline transform, see below) instead
  // slides each card in individually from alternating sides as it scrolls
  // into view -- closer to the source design's intent, and one that
  // actually reads as motion with only one card per row.
  var isMobile = window.matchMedia('(max-width: 809.98px)').matches
  if (isMobile) {
    initMobileReveal()
    return
  }

  function initMobileReveal() {
    var allCards = rows.reduce(function (acc, row) {
      return acc.concat(row.cards)
    }, [])
    var SLIDE = 48

    allCards.forEach(function (card, i) {
      var fromRight = i % 2 === 0
      card.style.setProperty('--uc-tx', (fromRight ? SLIDE : -SLIDE) + 'px')
      card.style.setProperty('--uc-ty', '0px')
      // Not card.style.opacity: the static interactivity helper's fallback
      // stylesheet force-resets any inline style whose text contains
      // "opacity: 0" back to 1 (same substring-match issue as --uc-tx vs.
      // a literal `transform:` inline style elsewhere in this file) --
      // route it through the --uc-op custom property instead, which
      // usecases-open.css reads into the real opacity.
      card.style.setProperty('--uc-op', '0')
    })

    function reveal(card) {
      card.style.setProperty('--uc-tx', '0px')
      card.style.setProperty('--uc-op', '1')
    }

    if (!window.IntersectionObserver) {
      allCards.forEach(reveal)
      return
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return
          reveal(entry.target)
          io.unobserve(entry.target)
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )
    allCards.forEach(function (card) {
      io.observe(card)
    })
  }

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
        // getBoundingClientRect() reflects the card's current *painted*
        // position, which already includes whatever --uc-tx/--uc-ty this
        // same effect applied on an earlier frame. Measuring while mid-
        // animation (the ResizeObserver below can fire well after scroll
        // has started, e.g. once a late lazy image finishes loading) would
        // read that already-offset position as if it were the card's rest
        // position, permanently corrupting the delta for that card. Zero
        // the transform out for the instant of the read, then restore it --
        // this all happens synchronously before the browser paints, so
        // there's nothing to see.
        var prevTx = card.style.getPropertyValue('--uc-tx')
        var prevTy = card.style.getPropertyValue('--uc-ty')
        card.style.setProperty('--uc-tx', '0px')
        card.style.setProperty('--uc-ty', '0px')
        var r = card.getBoundingClientRect()
        if (prevTx) card.style.setProperty('--uc-tx', prevTx)
        else card.style.removeProperty('--uc-tx')
        if (prevTy) card.style.setProperty('--uc-ty', prevTy)
        else card.style.removeProperty('--uc-ty')
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

  // The card images are loading="lazy", so on an uncached visit they can
  // still be downloading (or not yet requested at all, if their row starts
  // below the browser's lazy-load threshold) well after the measurements
  // above ran -- every one of those events fires at/near initial page load,
  // none of them tied to when a *lazy* image actually finishes. Once such an
  // image loads, its row's height/position changes and the previously
  // captured dx/dy deltas go stale, so the open/close effect plays from the
  // wrong starting point (this is the "works after a reload" bug: a reload
  // serves the images from cache, fast enough that the race never shows).
  // A ResizeObserver on each row catches that shift (and any other future
  // cause of reflow) directly, instead of trying to enumerate every image.
  if (window.ResizeObserver) {
    var roTimer = null
    var ro = new ResizeObserver(function () {
      clearTimeout(roTimer)
      roTimer = setTimeout(measure, 100)
    })
    rows.forEach(function (row) {
      ro.observe(row.el)
    })
  } else {
    cardWrap.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', onResize, { once: true })
    })
  }
})()
