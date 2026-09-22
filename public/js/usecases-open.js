(function () {
  var cardWrap = document.querySelector('[data-framer-name="Card Wrap"]')
  if (!cardWrap) return

  var rows = Array.prototype.slice.call(cardWrap.querySelectorAll(':scope > [data-framer-name="Cards"]'))
  var cards = []
  rows.forEach(function (row) {
    // Each card is wrapped in Framer's "ssr-variant" (display: contents), so
    // transform/opacity set on that wrapper never paint — grab the actual
    // boxed element inside it instead (same issue as the hero's buttons).
    Array.prototype.slice.call(row.children).forEach(function (wrapper) {
      var card = wrapper.classList.contains('ssr-variant') ? wrapper.firstElementChild : wrapper
      if (card) cards.push(card)
    })
  })
  if (cards.length < 2) return

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var hasOpened = false

  cards.forEach(function (card) {
    card.classList.add('automind-usecase-card')
  })

  // Positions each card at the wrap's center (scaled down, invisible) so the
  // "opening" animation has somewhere to animate FROM. Cards already sit in
  // their real, final grid position via normal layout — we just offset them
  // there with a transform until the reveal plays.
  function collapseToCenter() {
    var wrapRect = cardWrap.getBoundingClientRect()
    var centerX = wrapRect.left + wrapRect.width / 2
    var centerY = wrapRect.top + wrapRect.height / 2

    cards.forEach(function (card, i) {
      var rect = card.getBoundingClientRect()
      var dx = centerX - (rect.left + rect.width / 2)
      var dy = centerY - (rect.top + rect.height / 2)
      card.style.setProperty('--uc-tx', dx + 'px')
      card.style.setProperty('--uc-ty', dy + 'px')
      card.style.setProperty('--uc-scale', '0.55')
      card.style.setProperty('--uc-fade', '0')
      card.style.setProperty('--uc-delay', i * 70 + 'ms')
    })
  }

  function open() {
    if (hasOpened) return
    hasOpened = true
    cards.forEach(function (card) {
      card.style.setProperty('--uc-tx', '0px')
      card.style.setProperty('--uc-ty', '0px')
      card.style.setProperty('--uc-scale', '1')
      card.style.setProperty('--uc-fade', '1')
    })
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    return
  }

  collapseToCenter()
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (!hasOpened) collapseToCenter()
    })
  }

  var resizeTimer = null
  window.addEventListener('resize', function () {
    if (hasOpened) return
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(collapseToCenter, 150)
  })

  function init() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            open()
            observer.disconnect()
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    )
    observer.observe(cardWrap)
  }

  var overlay = document.getElementById('automind-loading')
  if (overlay) {
    window.addEventListener('automind:loaded', init, { once: true })
  } else {
    init()
  }
})()
