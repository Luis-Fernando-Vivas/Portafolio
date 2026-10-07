/* Pain points scroll scene (#dolores). Everything is driven by scroll
   position, so it scrubs both ways:
   1) enter: while the section rises into view, the brand-blue panel grows
      from the 1224px container out to full-bleed and the intro fades up,
      with the title filling in letter by letter (same per-letter split as
      scroll-fill-headings.js, but white-on-blue);
   2) pinned: the messages arrive one at a time, each preceded by a
      "typing..." bubble; the list slides up like a chat so older messages
      drift into the top fade and disappear.
   Without JS or with reduced motion the section stays static (see
   pain-points.css), with every message visible. */
(function () {
  var section = document.querySelector('.automind-pain')
  if (!section) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  var bg = section.querySelector('.automind-pain__bg')
  var container = section.querySelector('.automind-pain__container')
  var title = section.querySelector('.automind-pain__title')
  var introEls = Array.prototype.slice.call(
    section.querySelectorAll('.automind-pain__intro > :not(.automind-pain__title)')
  )
  var actions = section.querySelector('.automind-pain__actions')
  var feed = section.querySelector('.automind-pain__feed')
  var list = section.querySelector('.automind-pain__list')
  var typing = section.querySelector('.automind-pain__typing')
  var msgs = Array.prototype.slice.call(section.querySelectorAll('.automind-pain__msg'))
  if (!bg || !container || !title || !feed || !list || !typing || !msgs.length) return

  section.classList.add('is-scrolly')

  var N = msgs.length
  // Pinned progress budget: messages are reached between LEAD and MSG_END,
  // all of them are forced in by FORCE_ALL (so the last one never misses the
  // pin on a fast scroll), then a hold for the CTA and the exit from EXIT on.
  var LEAD = 0.03
  var MSG_END = 0.55
  var FORCE_ALL = 0.62
  var EXIT = 0.8
  var SLOT = (MSG_END - LEAD) / N
  var FROM_ALPHA = 0.28 // title letters start as translucent white
  var BAND = 0.25

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v))
  }
  function range(v, a, b) {
    return clamp((v - a) / (b - a), 0, 1)
  }
  // Opacity/transform go through custom properties (read by pain-points.css)
  // instead of inline opacity/transform: the static interactivity helper at
  // the end of index.html forces `opacity: 1` / `transform: none` on any
  // element whose inline style mentions them.
  function setVars(el, o, y, s) {
    el.style.setProperty('--pain-o', o.toFixed(3))
    el.style.setProperty('--pain-y', y.toFixed(1) + 'px')
    el.style.setProperty('--pain-s', s.toFixed(3))
  }
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // ---- Title: split into per-letter spans, keeping the text for screen readers.
  var letters = []
  ;(function splitTitle() {
    var text = title.textContent
    var visual = document.createElement('span')
    visual.setAttribute('aria-hidden', 'true')
    text.split(/(\s+)/).forEach(function (chunk) {
      if (!chunk) return
      if (/^\s+$/.test(chunk)) {
        visual.appendChild(document.createTextNode(chunk))
        return
      }
      var word = document.createElement('span')
      word.style.display = 'inline-block'
      for (var i = 0; i < chunk.length; i++) {
        var l = document.createElement('span')
        l.className = 'automind-pain__letter'
        l.textContent = chunk[i]
        word.appendChild(l)
        letters.push(l)
      }
      visual.appendChild(word)
    })
    var sr = document.createElement('span')
    sr.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'
    sr.textContent = text
    title.textContent = ''
    title.appendChild(visual)
    title.appendChild(sr)
  })()

  // ---- Layout measurements (re-taken on resize / font load).
  var spans = [] // vertical space each message adds to the chat, gap included
  var typingSpan = 0
  var actionsSpan = 0
  var actionsFloat = false // phones: buttons overlay the bottom of the chat

  function measure() {
    var prevBottom = 0
    var gap = parseFloat(getComputedStyle(list).rowGap) || 0
    spans = msgs.map(function (m) {
      var bottom = m.offsetTop + m.offsetHeight
      var s = bottom - prevBottom
      prevBottom = bottom
      return s
    })
    typingSpan = typing.offsetHeight + gap
    actionsFloat = !!actions && getComputedStyle(actions).position === 'absolute'
    actionsSpan = actionsFloat ? actions.offsetHeight + 20 : 0
  }

  var ticking = false

  function update() {
    ticking = false
    var vh = window.innerHeight
    var vw = document.documentElement.clientWidth
    var rect = section.getBoundingClientRect()
    if (rect.bottom < -vh || rect.top > vh * 1.5) return

    // 1) Enter: 0 when the section top hits the viewport bottom, 1 when pinned.
    var enter = range(vh - rect.top, 0, vh)
    var grow = ease(range(enter, 0.1, 1))

    // 2) Pinned progress over the section's extra scroll length.
    var pinLen = section.offsetHeight - vh
    var p = pinLen > 0 ? range(-rect.top, 0, pinLen) : 1

    // 3) Exit: the panel folds back into a rounded card (the mirror of the
    // entrance) while the content lifts, blurs and fades out, then the
    // whole stage unpins and scrolls away into the next section.
    var exit = ease(range(p, EXIT, 1))
    var open = Math.min(grow, 1 - exit)
    var startX = Math.max(16, (vw - 1224) / 2)
    bg.style.setProperty('--pain-clip-x', (startX * (1 - open)).toFixed(1) + 'px')
    bg.style.setProperty('--pain-clip-t', (14 * (1 - grow) + 4 * exit).toFixed(2) + '%')
    bg.style.setProperty('--pain-clip-b', (14 * (1 - grow) + 10 * exit).toFixed(2) + '%')
    bg.style.setProperty('--pain-clip-r', (28 * (1 - open)).toFixed(1) + 'px')
    container.style.setProperty('--pain-xo', (1 - exit).toFixed(3))
    container.style.setProperty('--pain-xy', (-60 * exit).toFixed(1) + 'px')
    container.style.setProperty('--pain-xs', (1 - 0.04 * exit).toFixed(3))
    // Only while exiting: any filter on the container would cut the glass
    // bubbles' backdrop-filter off from the blue panel behind it.
    container.style.setProperty('--pain-xf', exit > 0 ? 'blur(' + (8 * exit).toFixed(1) + 'px)' : 'none')

    // Intro: fades up as the panel opens.
    var intro = ease(range(enter, 0.45, 0.95))
    introEls.forEach(function (el, i) {
      // Phones: the floating buttons are shown by .is-done (CSS) instead.
      if (el === actions && actionsFloat) return
      var t = range(intro, i * 0.12, 0.7 + i * 0.1)
      setVars(el, t, (1 - t) * 24, 1)
    })
    setVars(title, intro, (1 - intro) * 32, 1)

    // Title letters: translucent -> solid white, left to right.
    var fill = range(enter, 0.5, 1) * 0.8 + range(p, 0, 0.05) * 0.2
    var n = letters.length
    var step = n > 1 ? (1 - BAND) / (n - 1) : 0
    letters.forEach(function (l, i) {
      var a = FROM_ALPHA + (1 - FROM_ALPHA) * range(fill, i * step, i * step + BAND)
      l.style.color = 'rgba(255,255,255,' + a.toFixed(3) + ')'
    })

    // Messages: scroll only decides how many should be on screen; the
    // arrivals themselves are time-based CSS transitions (see
    // pain-points.css), so they stay smooth however jerky the scroll is.
    var reached = 0
    for (var k = 0; k < N; k++) {
      if (p >= LEAD + k * SLOT + 0.3 * SLOT) reached = k + 1
    }
    rushing = p >= FORCE_ALL
    if (rushing) reached = N
    setTarget(reached)
  }

  // ---- Chat sequencer: "typing..." then the message, one at a time.
  var shown = 0
  var target = 0
  var typingOn = false
  var timer = null
  var rushing = false // past FORCE_ALL: no typing, just cascade the rest in

  function layout() {
    var done = shown === N
    section.classList.toggle('is-done', done)
    var content = typingOn ? typingSpan : 0
    for (var i = 0; i < shown; i++) content += spans[i]
    var cta = done && actionsFloat ? actionsSpan : 0
    typing.style.bottom = 4 + cta + 'px'
    list.style.setProperty('--pain-y', (feed.clientHeight - 4 - content - cta).toFixed(1) + 'px')
  }

  function setTyping(on, out) {
    typingOn = on
    if (on) typing.classList.toggle('is-out', out)
    typing.classList.toggle('is-visible', on)
  }

  function pump() {
    if (timer || target <= shown) return
    // Behind after a fast scroll (or out of pin time): skip the typing
    // bubble and cascade the pending messages in quickly.
    if (rushing || target - shown > 1) {
      setTyping(false)
      msgs[shown].classList.add('is-in')
      shown++
      layout()
      timer = setTimeout(function () {
        timer = null
        pump()
      }, 110)
      return
    }
    setTyping(true, msgs[shown].classList.contains('automind-pain__msg--out'))
    layout()
    timer = setTimeout(function () {
      setTyping(false)
      msgs[shown].classList.add('is-in')
      shown++
      layout()
      timer = setTimeout(function () {
        timer = null
        pump()
      }, 320)
    }, 850)
  }

  function setTarget(k) {
    if (k === target && (timer || k === shown)) return
    target = k
    if (target <= shown && (timer || typingOn)) {
      clearTimeout(timer)
      timer = null
      setTyping(false)
    }
    if (target < shown) {
      for (var i = target; i < shown; i++) msgs[i].classList.remove('is-in')
      shown = target
    }
    layout()
    pump()
  }

  function onScroll() {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }

  function onResize() {
    measure()
    layout()
    update()
  }

  measure()
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('load', onResize)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize)
})()
