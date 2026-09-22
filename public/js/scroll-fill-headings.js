(function () {
  var FROM = [107, 114, 128] // muted gray, matches the resting #6B7280
  var TO = [0, 143, 177] // brand dark teal/blue #008FB1

  var targets = Array.prototype.slice.call(
    document.querySelectorAll('p[style*="font-family:Space Grotesk"]')
  )
  if (!targets.length) return

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    targets.forEach(function (el) {
      el.style.color = 'rgb(' + TO.join(',') + ')'
    })
    return
  }

  function lerp(a, b, t) {
    return a + (b - a) * t
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v))
  }

  var ticking = false

  function update() {
    var vh = window.innerHeight
    var start = vh * 0.85
    var end = vh * 0.35
    targets.forEach(function (el) {
      var rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return // hidden breakpoint variant
      var t = clamp((start - rect.top) / (start - end), 0, 1)
      var r = Math.round(lerp(FROM[0], TO[0], t))
      var g = Math.round(lerp(FROM[1], TO[1], t))
      var b = Math.round(lerp(FROM[2], TO[2], t))
      el.style.color = 'rgb(' + r + ',' + g + ',' + b + ')'
    })
    ticking = false
  }

  function onScroll() {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
})()
