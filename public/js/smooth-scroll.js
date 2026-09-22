(function () {
  var script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js'
  script.onload = function () {
    var lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t))
      }
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }
  document.head.appendChild(script)
})()
