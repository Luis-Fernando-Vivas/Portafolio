(function () {
  // Tiempos de la animación, en milisegundos.
  var MAX_STAGGER_X = 250 // las partículas de la derecha salen un poco después
  var MAX_STAGGER_RANDOM = 350
  var MIN_FLIGHT = 1000
  var MAX_EXTRA_FLIGHT = 300
  var LOGO_HOLD = 550 // fundido a la imagen nítida + pausa antes de salir
  var IMAGE_TIMEOUT = 3000 // si el logo no llega a tiempo, no se bloquea la página

  var overlay = document.getElementById('automind-loading')
  if (!overlay) return
  var logo = overlay.querySelector('.automind-loading-logo')
  var canvas = overlay.querySelector('.automind-loading-canvas')

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

  function finish() {
    overlay.classList.add('is-hidden')
    document.documentElement.style.overflow = ''
    window.dispatchEvent(new Event('automind:loaded'))
    setTimeout(function () {
      overlay.remove()
    }, 650)
  }

  function showLogoAndFinish() {
    overlay.classList.add('is-formed')
    setTimeout(finish, LOGO_HOLD)
  }

  // Convierte el logo en partículas: se reduce a una rejilla donde cada píxel
  // visible es una partícula con su posición final y su color.
  function buildParticles(logoWidth, logoHeight) {
    var gap = Math.max(1.6, logoWidth / 240)
    var cols = Math.round(logoWidth / gap)
    var rows = Math.round(logoHeight / gap)

    var sampler = document.createElement('canvas')
    sampler.width = cols
    sampler.height = rows
    var sctx = sampler.getContext('2d', { willReadFrequently: true })
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(logo, 0, 0, cols, rows)
    var data = sctx.getImageData(0, 0, cols, rows).data

    var particles = []
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = (y * cols + x) * 4
        var r = data[i]
        var g = data[i + 1]
        var b = data[i + 2]
        if (data[i + 3] < 110 || Math.min(r, g, b) > 185) continue
        var u = (x + 0.5) / cols
        particles.push({
          u: u,
          v: (y + 0.5) / rows,
          startX: Math.random(),
          startY: Math.random(),
          delay: u * MAX_STAGGER_X + Math.random() * MAX_STAGGER_RANDOM,
          flight: MIN_FLIGHT + Math.random() * MAX_EXTRA_FLIGHT,
          curve: (Math.random() - 0.5) * 0.35,
          phase: Math.random() * Math.PI * 2,
          // Colores cuantizados y ordenados: menos cambios de fillStyle por frame.
          color: 'rgb(' + (r & 240) + ',' + (g & 240) + ',' + (b & 240) + ')',
        })
      }
    }
    particles.sort(function (a, b) {
      return a.color < b.color ? -1 : a.color > b.color ? 1 : 0
    })
    return { list: particles, cols: cols }
  }

  function easeInOutCubic(k) {
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
  }

  function animate() {
    var ctx = canvas.getContext('2d')
    var rect = logo.getBoundingClientRect()
    var built = buildParticles(rect.width, rect.height)
    var particles = built.list
    if (!ctx || !particles.length) {
      showLogoAndFinish()
      return
    }

    var width, height, dpr, size
    function measure() {
      width = overlay.clientWidth
      height = overlay.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      rect = logo.getBoundingClientRect()
      size = (rect.width / built.cols) * 0.92
    }
    measure()
    window.addEventListener('resize', measure)

    var start = null
    function frame(now) {
      if (start === null) start = now
      var elapsed = now - start
      var settled = true
      var color = null

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i]
        var k = (elapsed - p.delay) / p.flight
        if (k < 1) settled = false
        k = k < 0 ? 0 : k > 1 ? 1 : k
        var e = easeInOutCubic(k)

        var fromX = p.startX * width
        var fromY = p.startY * height
        var dx = rect.left + p.u * rect.width - fromX
        var dy = rect.top + p.v * rect.height - fromY
        var arc = p.curve * Math.sin(e * Math.PI)
        var drift = (1 - e) * 10
        var px = fromX + dx * e - dy * arc + Math.sin(elapsed * 0.002 + p.phase) * drift
        var py = fromY + dy * e + dx * arc + Math.cos(elapsed * 0.002 + p.phase) * drift
        var s = size * (1 + (1 - e) * 0.6)

        if (p.color !== color) {
          color = p.color
          ctx.fillStyle = color
        }
        ctx.fillRect(px - s / 2, py - s / 2, s, s)
      }

      if (settled) {
        window.removeEventListener('resize', measure)
        showLogoAndFinish()
      } else {
        requestAnimationFrame(frame)
      }
    }
    requestAnimationFrame(frame)
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showLogoAndFinish()
    return
  }

  var started = false
  function begin(run) {
    if (started) return
    started = true
    clearTimeout(timeout)
    run()
  }
  function start() {
    begin(function () {
      try {
        animate()
      } catch (e) {
        showLogoAndFinish()
      }
    })
  }
  function giveUp() {
    begin(showLogoAndFinish)
  }

  var timeout = setTimeout(giveUp, IMAGE_TIMEOUT)
  if (logo.complete && logo.naturalWidth) {
    start()
  } else {
    logo.addEventListener('load', start, { once: true })
    logo.addEventListener('error', giveUp, { once: true })
  }
})()
