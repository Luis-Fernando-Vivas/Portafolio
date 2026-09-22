(function () {
  var wrap = document.querySelector('[data-framer-name="Cards"]')
  var imagesWrap = document.querySelector('[data-framer-name="Images"]')
  if (!wrap || !imagesWrap) return

  var cards = Array.prototype.slice.call(wrap.querySelectorAll('.framer-cZR4n'))
  var images = Array.prototype.slice.call(imagesWrap.querySelectorAll('.automind-tab-image'))
  if (!cards.length || cards.length !== images.length) return

  // Matches Framer's own inline-style mechanism for this component (see the
  // "Non Active" cards already in the markup) so switching cards looks
  // exactly like the original design's active/inactive states.
  var GRAY = 'var(--token-649b5a4e-5941-4f6a-93ac-ad82efc8f00b, rgb(153, 153, 153))'
  var ACTIVE_BG = 'rgb(255, 255, 255)'
  var INACTIVE_BG = 'rgba(0, 0, 0, 0)'

  function setCardActive(card, active) {
    var titleWrap = card.querySelector('.framer-1orppa9')
    var descWrap = card.querySelector('.framer-1n19wfh')
    var titleP = titleWrap && titleWrap.querySelector('p')
    var descP = descWrap && descWrap.querySelector('p')

    card.setAttribute('data-framer-name', active ? 'Active' : 'Non Active')
    card.setAttribute('aria-pressed', active ? 'true' : 'false')
    card.style.backgroundColor = active ? ACTIVE_BG : INACTIVE_BG

    if (active) {
      if (titleWrap) titleWrap.style.removeProperty('--extracted-r6o4lv')
      if (descWrap) descWrap.style.removeProperty('--extracted-r6o4lv')
      if (titleP) titleP.style.removeProperty('--framer-text-color')
      if (descP) descP.style.removeProperty('--framer-text-color')
    } else {
      if (titleWrap) titleWrap.style.setProperty('--extracted-r6o4lv', GRAY)
      if (descWrap) descWrap.style.setProperty('--extracted-r6o4lv', GRAY)
      if (titleP) titleP.style.setProperty('--framer-text-color', 'var(--extracted-r6o4lv, ' + GRAY + ')')
      if (descP) descP.style.setProperty('--framer-text-color', 'var(--extracted-r6o4lv, ' + GRAY + ')')
    }
  }

  // A real deck of cards: the active image sits in front, full color; the
  // rest fan out behind it, fully opaque (not faded) but grayed out like a
  // disabled control, so you can always see there's a stack, not just a
  // single image swapping out.
  // Pure translation (no scale) so each layer visibly pokes out past the
  // front card's edge by exactly its offset — a scale change here would
  // shrink the layer back toward its transform-origin and cancel out the
  // offset, hiding the peek entirely.
  // Most of each mockup is already gray/white browser chrome, so a light
  // desaturation barely reads as a change — brightness/contrast need to be
  // pushed hard for the washed-out "disabled" look to actually be visible.
  var STACK = [
    { x: 0, y: 0, filter: 'none', z: 10 },
    { x: 34, y: -28, filter: 'grayscale(1) brightness(1.35) contrast(0.7)', z: 9 },
    { x: 64, y: -52, filter: 'grayscale(1) brightness(1.5) contrast(0.6)', z: 8 },
    { x: 90, y: -74, filter: 'grayscale(1) brightness(1.65) contrast(0.5)', z: 7 },
  ]

  function applyStack() {
    var order = [activeIndex].concat(
      images.map(function (_, i) { return i }).filter(function (i) { return i !== activeIndex })
    )
    order.forEach(function (imgIndex, depth) {
      var s = STACK[depth] || STACK[STACK.length - 1]
      var el = images[imgIndex]
      // Set via custom properties, not the transform property directly:
      // this export's "Unframe Interactivity Helper" fallback CSS
      // force-resets any inline style whose text contains "transform"
      // (plain substring match) back to transform: none. Custom property
      // names don't match that text, so they're left alone; the real
      // transform is applied in tab-images.css from these vars.
      el.style.setProperty('--automind-tab-tx', s.x + 'px')
      el.style.setProperty('--automind-tab-ty', s.y + 'px')
      el.style.setProperty('--automind-tab-filter', s.filter)
      el.style.zIndex = s.z
    })
  }

  var activeIndex = images.findIndex(function (img) {
    return img.classList.contains('automind-tab-image-active')
  })
  if (activeIndex === -1) activeIndex = 0
  applyStack()

  // The cards' descriptions are different lengths, so each one's natural
  // height differs (2 vs 3 lines etc.) — measure the tallest and pin every
  // card to that height so the grid reads as four equal-size items.
  function equalizeCardHeights() {
    cards.forEach(function (card) {
      card.style.minHeight = ''
    })
    var maxHeight = cards.reduce(function (max, card) {
      return Math.max(max, card.offsetHeight)
    }, 0)
    cards.forEach(function (card) {
      card.style.minHeight = maxHeight + 'px'
    })
  }
  equalizeCardHeights()

  var resizeTimer = null
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(equalizeCardHeights, 150)
  })
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(equalizeCardHeights)
  }

  function setActive(index) {
    if (index === activeIndex) return
    setCardActive(cards[activeIndex], false)
    setCardActive(cards[index], true)
    activeIndex = index
    applyStack()
  }

  // A small progress bar under each card doubles as the autoplay clock: it
  // fills up over AUTOPLAY_MS while its card is active, and reaching full
  // advances to the next one — the same idea as story/carousel indicators.
  var AUTOPLAY_MS = 4500
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var progressFills = cards.map(function (card) {
    var track = document.createElement('div')
    track.className = 'automind-progress-track'
    var fill = document.createElement('div')
    fill.className = 'automind-progress-fill'
    track.appendChild(fill)
    card.appendChild(track)
    return fill
  })

  var rafId = null
  var elapsedMs = 0
  var lastFrameTs = null
  var isPaused = false

  function setFillPct(index, pct) {
    progressFills[index].style.width = pct * 100 + '%'
  }

  function resetFills() {
    progressFills.forEach(function (_, i) {
      setFillPct(i, 0)
    })
  }

  function tick(ts) {
    if (lastFrameTs !== null) elapsedMs += ts - lastFrameTs
    lastFrameTs = ts
    var pct = Math.min(1, elapsedMs / AUTOPLAY_MS)
    setFillPct(activeIndex, pct)
    if (pct >= 1) {
      goNext()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  function startCycle() {
    cancelAnimationFrame(rafId)
    elapsedMs = 0
    lastFrameTs = null
    isPaused = false
    resetFills()
    if (reduceMotion) return
    rafId = requestAnimationFrame(tick)
  }

  function goNext() {
    setActive((activeIndex + 1) % cards.length)
    startCycle()
  }

  function activate(index) {
    setActive(index)
    startCycle()
  }

  function pauseCycle() {
    if (isPaused || reduceMotion) return
    isPaused = true
    cancelAnimationFrame(rafId)
    lastFrameTs = null
  }

  function resumeCycle() {
    if (!isPaused || reduceMotion) return
    isPaused = false
    rafId = requestAnimationFrame(tick)
  }

  cards.forEach(function (card, index) {
    card.addEventListener('click', function () {
      activate(index)
    })
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        activate(index)
      }
    })
    // Hovering a card lifts its matching image a bit, wherever it currently
    // sits in the stack — a little preview nudge, independent of the stack
    // ordering itself. It also pauses the autoplay clock so it doesn't
    // advance out from under someone who's looking at a specific card.
    card.addEventListener('mouseenter', function () {
      images[index].style.setProperty('--automind-tab-hover', '-14px')
      pauseCycle()
    })
    card.addEventListener('mouseleave', function () {
      images[index].style.setProperty('--automind-tab-hover', '0px')
      resumeCycle()
    })
  })

  startCycle()
})()
