(function () {
  var btn = document.getElementById('automind-hamburger')
  var menu = document.getElementById('automind-mobile-menu')
  if (!btn || !menu) return

  function close() {
    btn.setAttribute('aria-expanded', 'false')
    menu.classList.remove('is-open')
    document.documentElement.style.overflow = ''
    setTimeout(function () {
      if (!menu.classList.contains('is-open')) menu.hidden = true
    }, 300)
  }

  function open() {
    menu.hidden = false
    requestAnimationFrame(function () {
      btn.setAttribute('aria-expanded', 'true')
      menu.classList.add('is-open')
      document.documentElement.style.overflow = 'hidden'
    })
  }

  btn.addEventListener('click', function () {
    var isOpen = btn.getAttribute('aria-expanded') === 'true'
    if (isOpen) close()
    else open()
  })

  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close)
  })

  window.addEventListener('resize', function () {
    // Hamburger + overlay only apply in the 810-1023px tablet range now
    // (mobile uses the sticky bottom icon bar instead) -- close on either
    // side so it can't be left open while CSS hides the trigger button.
    if (window.innerWidth >= 1024 || window.innerWidth < 810) close()
  })
})()
