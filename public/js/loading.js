(function () {
  var MIN_DURATION = 900
  var FILL_DURATION = 1100

  var overlay = document.getElementById('automind-loading')
  if (!overlay) return
  var fillImg = overlay.querySelector('.automind-loading-logo-fill')
  var percentEl = overlay.querySelector('.automind-loading-percent')

  // La pantalla de carga solo se muestra en la primera visita de la sesión.
  // Al volver a la home desde el blog (u otra página) se quita al instante
  // para que la transición entre páginas se sienta continua.
  var seen = false
  try {
    seen = sessionStorage.getItem('automind:loaded') === '1'
    sessionStorage.setItem('automind:loaded', '1')
  } catch (e) {}
  if (!seen && document.referrer) {
    try {
      seen = new URL(document.referrer).origin === location.origin
    } catch (e) {}
  }
  if (seen) {
    overlay.remove()
    return
  }

  document.documentElement.style.overflow = 'hidden'

  function setProgress(p) {
    var soft = Math.min(p + 8, 100)
    var mask =
      'linear-gradient(to right, #000 0%, #000 ' + p + '%, transparent ' + soft + '%, transparent 100%)'
    fillImg.style.webkitMaskImage = mask
    fillImg.style.maskImage = mask
    percentEl.textContent = Math.round(p) + '%'
  }

  function finish() {
    setProgress(100)
    setTimeout(function () {
      overlay.classList.add('is-hidden')
      document.documentElement.style.overflow = ''
      window.dispatchEvent(new Event('automind:loaded'))
      setTimeout(function () {
        overlay.remove()
      }, 650)
    }, 200)
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    finish()
    return
  }

  setProgress(0)

  var start = null
  function tick(ts) {
    if (start === null) start = ts
    var elapsed = ts - start
    var p = Math.min(100, (elapsed / FILL_DURATION) * 100)
    setProgress(p)
    if (p < 100) {
      requestAnimationFrame(tick)
    } else {
      finish()
    }
  }

  setTimeout(function () {
    requestAnimationFrame(tick)
  }, MIN_DURATION)
})()
