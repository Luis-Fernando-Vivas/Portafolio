(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  var buttons = document.querySelectorAll('[data-reset="button"]')

  buttons.forEach(function (button) {
    var textWrap = button.querySelector('[data-framer-name="Text"]')
    if (!textWrap) return

    var candidates = textWrap.querySelectorAll('p.framer-text')
    var label = null
    for (var i = 0; i < candidates.length; i++) {
      var p = candidates[i]
      if (p.getClientRects().length) {
        label = p
        break
      }
    }
    if (!label) label = candidates[0]
    if (!label) return

    var text = label.textContent.trim()
    if (!text) return

    var labelColor = getComputedStyle(label).color

    Array.prototype.forEach.call(textWrap.children, function (child) {
      child.style.display = 'none'
    })

    var roll = document.createElement('span')
    roll.className = 'automind-roll'

    var line1 = document.createElement('span')
    line1.className = 'automind-roll-line'
    line1.textContent = text
    line1.style.color = labelColor

    var line2 = document.createElement('span')
    line2.className = 'automind-roll-line automind-roll-2'
    line2.textContent = text
    line2.setAttribute('aria-hidden', 'true')
    line2.style.color = labelColor

    roll.appendChild(line1)
    roll.appendChild(line2)
    textWrap.appendChild(roll)

    button.classList.add('automind-rolling')
  })
})()
