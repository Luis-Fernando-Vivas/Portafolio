/* Carrusel móvil de "Últimas noticias" (estilos en home-blog.css).
   En móvil la lista se desliza de lado con scroll-snap; aquí se dibuja un
   punto por tarjeta, se marca el de la tarjeta visible y al tocar un punto
   se desliza hasta su tarjeta. Los puntos son solo visuales (aria-hidden):
   las tarjetas siguen siendo enlaces normales que se recorren con Tab. */
(function () {
  var list = document.querySelector('.automind-news__list')
  var dots = document.querySelector('.automind-news__dots')
  if (!list || !dots) return

  var items = Array.prototype.slice.call(list.querySelectorAll('.automind-news__item'))
  if (items.length < 2) return

  var buttons = items.map(function (item) {
    var button = document.createElement('button')
    button.type = 'button'
    button.tabIndex = -1
    button.addEventListener('click', function () {
      var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      list.scrollTo({ left: item.offsetLeft - list.offsetLeft - 20, behavior: reduceMotion ? 'auto' : 'smooth' })
    })
    dots.appendChild(button)
    return button
  })

  var current = -1
  function update() {
    // La tarjeta activa es la que tiene su borde izquierdo más cerca del inicio.
    var start = list.getBoundingClientRect().left
    var best = 0
    var bestDistance = Infinity
    items.forEach(function (item, index) {
      var distance = Math.abs(item.getBoundingClientRect().left - start - 20)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    // Al final del recorrido la última no llega al inicio: se marca igual.
    if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 2) best = items.length - 1
    if (best === current) return
    current = best
    buttons.forEach(function (button, index) {
      button.setAttribute('aria-current', index === best ? 'true' : 'false')
    })
  }

  var ticking = false
  list.addEventListener(
    'scroll',
    function () {
      if (ticking) return
      ticking = true
      requestAnimationFrame(function () {
        ticking = false
        update()
      })
    },
    { passive: true }
  )
  window.addEventListener('resize', update)
  update()
})()
