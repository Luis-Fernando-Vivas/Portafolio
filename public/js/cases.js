/* Casos de éxito: interacciones propias de la página. pricing.js ya maneja
   el header, el scroll suave a las anclas, .am-reveal y las pestañas fijas.

   - Scrollytelling: el paso visible (franja central de la pantalla) activa
     su captura en el escenario fijo y su punto en el indicador.
   - "¿Te suena?": cuenta lo marcado, llena el medidor y ajusta el mensaje.
   - Cifras: cuentan desde 0 al aparecer.
   - Visor: cualquier [data-zoom] abre la imagen ampliada en un <dialog>.
   - Portadas del índice: se inclinan siguiendo el puntero.
   - Barra de lectura: si el navegador no soporta animation-timeline. */
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var hasIO = 'IntersectionObserver' in window
  var t = function (text) {
    return window.amT ? window.amT(text) : text
  }

  // ---------- Scrollytelling ----------
  document.querySelectorAll('.cs-scrolly').forEach(function (scrolly) {
    var steps = Array.prototype.slice.call(scrolly.querySelectorAll('.cs-step'))
    var shots = Array.prototype.slice.call(scrolly.querySelectorAll('.cs-shot'))
    var dotsBox = scrolly.querySelector('.cs-stage__dots')
    var dots = []
    if (dotsBox) {
      shots.forEach(function () {
        dots.push(dotsBox.appendChild(document.createElement('span')))
      })
    }

    function activate(index) {
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === index)
      })
      shots.forEach(function (shot, i) {
        shot.classList.toggle('is-active', i === index)
      })
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index)
      })
    }

    activate(0)
    if (!hasIO) return
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) activate(steps.indexOf(entry.target))
        })
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    steps.forEach(function (step) {
      observer.observe(step)
    })
  })

  // ---------- Historia: la línea se dibuja y los actos suben al entrar ----------
  var acts = document.querySelectorAll('.cs-acts')
  if (hasIO && !reduceMotion) {
    var actsObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove('is-pending')
            actsObserver.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -15% 0px' }
    )
    acts.forEach(function (list) {
      list.classList.add('is-pending')
      actsObserver.observe(list)
    })
  }

  // ---------- ¿Te suena? ----------
  var MESSAGES = [
    'Marca lo que te pasa y te decimos qué tanto se parece tu negocio a este caso.',
    'Ya hay un punto en común. Con una llamada de 30 minutos sabrás si algo así te sirve.',
    'Tu negocio se parece bastante a este caso. Te mostramos cómo se vería en el tuyo.',
    'Es casi tu misma historia. Hablemos de cómo resolverlo en tu negocio.',
  ]
  document.querySelectorAll('.cs-match').forEach(function (box) {
    var inputs = Array.prototype.slice.call(box.querySelectorAll('input[type="checkbox"]'))
    var meter = box.querySelector('.cs-meter')
    var value = box.querySelector('.cs-meter__value')
    var msg = box.querySelector('.cs-match__msg')
    var total = inputs.length

    function update() {
      var checked = inputs.filter(function (input) {
        return input.checked
      }).length
      var ratio = total ? checked / total : 0
      if (meter) meter.style.setProperty('--p', String(Math.round(ratio * 100)))
      if (value) value.textContent = checked + '/' + total
      var tier = checked === 0 ? 0 : checked === total ? 3 : ratio >= 0.5 ? 2 : 1
      if (msg) msg.textContent = t(MESSAGES[tier])
    }

    inputs.forEach(function (input) {
      input.addEventListener('change', update)
    })
    update()
  })

  // ---------- Cifras ----------
  var counters = document.querySelectorAll('[data-count]')
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'))
    if (reduceMotion || !isFinite(target)) {
      el.textContent = el.getAttribute('data-count')
      return
    }
    var start = null
    var duration = 1400
    function frame(now) {
      if (start === null) start = now
      var p = Math.min(1, (now - start) / duration)
      var eased = 1 - Math.pow(1 - p, 3)
      el.textContent = String(Math.round(target * eased))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  if (hasIO) {
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target)
            countObserver.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.6 }
    )
    counters.forEach(function (el) {
      el.textContent = '0'
      countObserver.observe(el)
    })
  }

  // ---------- Visor ampliado ----------
  var dialog = document.getElementById('cs-lightbox')
  if (dialog && typeof dialog.showModal === 'function') {
    var big = dialog.querySelector('img')
    var caption = dialog.querySelector('p')
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest && event.target.closest('[data-zoom]')
      if (!trigger) return
      var img = trigger.querySelector('img')
      if (!img) return
      event.preventDefault()
      big.src = img.currentSrc || img.src
      big.alt = img.alt || ''
      caption.textContent = trigger.hasAttribute('data-caption') ? t(trigger.getAttribute('data-caption')) : img.alt || ''
      dialog.showModal()
    })
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.closest('.cs-lightbox__close')) dialog.close()
    })
  }

  // ---------- Portadas del índice: inclinación con el puntero ----------
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.cs-index__card').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect()
        var x = (event.clientX - rect.left) / rect.width - 0.5
        var y = (event.clientY - rect.top) / rect.height - 0.5
        card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg')
        card.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg')
      })
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
      })
    })
  }

  // ---------- Barra de lectura sin animation-timeline ----------
  var bar = document.querySelector('.cs-progress')
  var supportsTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()')
  if (bar && !supportsTimeline) {
    var onScroll = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  }
})()
