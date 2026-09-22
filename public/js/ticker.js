(function () {
  var track = document.querySelector('.automind-ticker-track')
  if (!track) return

  var items = Array.prototype.slice.call(track.children)
  if (!items.length) return

  items.forEach(function (item) {
    var clone = item.cloneNode(true)
    clone.setAttribute('aria-hidden', 'true')
    track.appendChild(clone)
  })

  track.style.width = 'max-content'
  track.style.maxWidth = 'none'
  track.style.flexWrap = 'nowrap'
  track.classList.add('automind-ticker-animate')
})()
