(function () {
  var FROM = [26, 26, 26] // brand black, matches the resting button color
  var TO = [0, 143, 177] // brand dark teal/blue #008FB1
  var BAND = 0.12 // fraction of the scroll range each letter takes to change color

  var paragraphs = Array.prototype.slice.call(
    document.querySelectorAll(':is(p, h2)[style*="font-family:Space Grotesk"], [data-scroll-fill]')
  )
  if (!paragraphs.length) return

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function lerp(a, b, t) {
    return a + (b - a) * t
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v))
  }
  function toRgb(c) {
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'
  }

  // Build: <p><span class="sfh-visual" aria-hidden="true">[word spans]</span><span class="sfh-sr-only">original text</span></p>
  function buildTitle(p) {
    var text = p.textContent
    var words = text.split(/(\s+)/) // keep whitespace chunks so we can rebuild spacing

    var visual = document.createElement('span')
    visual.className = 'sfh-visual'
    visual.setAttribute('aria-hidden', 'true')

    var wordEls = []
    words.forEach(function (chunk) {
      if (/^\s+$/.test(chunk)) {
        visual.appendChild(document.createTextNode(chunk))
        return
      }
      if (!chunk.length) return
      var wordEl = document.createElement('span')
      wordEl.className = 'sfh-word'
      wordEl.style.display = 'inline-block'
      var letterEls = []
      for (var i = 0; i < chunk.length; i++) {
        var letterEl = document.createElement('span')
        letterEl.className = 'sfh-letter'
        letterEl.style.color = 'rgb(' + FROM.join(',') + ')'
        if (!reduceMotion) letterEl.style.transition = 'color 80ms linear'
        letterEl.textContent = chunk[i]
        wordEl.appendChild(letterEl)
        letterEls.push(letterEl)
      }
      visual.appendChild(wordEl)
      wordEls.push({ el: wordEl, letters: letterEls })
    })

    var srOnly = document.createElement('span')
    srOnly.className = 'sfh-sr-only'
    srOnly.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'
    srOnly.textContent = text

    p.textContent = ''
    p.appendChild(visual)
    p.appendChild(srOnly)

    return { p: p, words: wordEls, animateLetters: [] }
  }

  var titles = paragraphs.map(buildTitle)

  // Group word spans into visual lines (top-to-bottom) and split into a static
  // part (first line, or first word when there's only one line) and an
  // animated part (the rest).
  function classify(title) {
    var lines = []
    title.words.forEach(function (word) {
      var top = word.el.getBoundingClientRect().top
      var line = lines[lines.length - 1]
      if (line && Math.abs(line.top - top) < 2) {
        line.words.push(word)
      } else {
        lines.push({ top: top, words: [word] })
      }
    })

    var staticWords, animateWords
    if (lines.length > 1) {
      staticWords = lines[0].words
      animateWords = lines.slice(1).reduce(function (acc, l) {
        return acc.concat(l.words)
      }, [])
    } else {
      staticWords = title.words.slice(0, 1)
      animateWords = title.words.slice(1)
    }

    staticWords.forEach(function (word) {
      word.letters.forEach(function (letter) {
        letter.style.color = toRgb(TO)
      })
    })

    title.animateLetters = animateWords.reduce(function (acc, word) {
      return acc.concat(word.letters)
    }, [])

    if (reduceMotion) {
      title.animateLetters.forEach(function (letter) {
        letter.style.color = toRgb(TO)
      })
    }
  }

  function classifyAll() {
    titles.forEach(classify)
  }

  classifyAll()
  if (reduceMotion) return

  var ticking = false

  function update() {
    var vh = window.innerHeight
    var start = vh * 0.5
    var end = vh * 0.3
    titles.forEach(function (title) {
      var n = title.animateLetters.length
      if (!n) return
      var rect = title.p.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return // hidden breakpoint variant
      var t = clamp((start - rect.top) / (start - end), 0, 1)
      var span = n > 1 ? (1 - BAND) / (n - 1) : 0
      title.animateLetters.forEach(function (letter, i) {
        var localStart = i * span
        var letterT = clamp((t - localStart) / BAND, 0, 1)
        letter.style.color = toRgb([
          lerp(FROM[0], TO[0], letterT),
          lerp(FROM[1], TO[1], letterT),
          lerp(FROM[2], TO[2], letterT),
        ])
      })
    })
    ticking = false
  }

  function onScroll() {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }

  function onResize() {
    classifyAll()
    onScroll()
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('load', onResize)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onResize)
  }
  update()
})()
