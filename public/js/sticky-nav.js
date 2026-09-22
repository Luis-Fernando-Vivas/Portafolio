(function () {
  var nav = document.querySelector('.framer-1bobvvz-container[data-framer-name="Navber"]')
  if (!nav) return

  function update() {
    if (window.scrollY > 8) {
      nav.classList.add('automind-nav-scrolled')
    } else {
      nav.classList.remove('automind-nav-scrolled')
    }
  }

  update()
  window.addEventListener('scroll', update, { passive: true })
})()
