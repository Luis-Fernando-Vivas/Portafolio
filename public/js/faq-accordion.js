(function () {
  var rows = document.querySelectorAll('.framer-kKgxV')
  rows.forEach(function (row) {
    var textWrap = row.querySelector('.framer-cpl5hy')
    if (!textWrap) return
    var children = Array.prototype.slice.call(textWrap.children)
    if (children.length < 2) return
    var answer = children[1]

    answer.classList.add('automind-faq-answer')
    answer.style.overflow = 'hidden'
    answer.style.maxHeight = '0px'
    answer.style.opacity = '0'
    row.setAttribute('aria-expanded', 'false')
    row.style.cursor = 'pointer'

    // Framer's native plus/minus icon relies on its editor runtime to swap
    // variants; in this static export one of its bars is stuck at opacity:0,
    // so it never animates. Replace it with a small icon we fully control.
    var iconContainer = row.querySelector('.framer-1pnbkcm-container')
    if (iconContainer) {
      iconContainer.innerHTML = ''
      var iconWrap = document.createElement('div')
      iconWrap.className = 'automind-faq-icon-wrap'
      var icon = document.createElement('span')
      icon.className = 'automind-faq-icon'
      icon.setAttribute('aria-hidden', 'true')
      iconWrap.appendChild(icon)
      iconContainer.appendChild(iconWrap)
    }

    row.addEventListener('click', function (e) {
      e.stopPropagation()
      var isOpen = row.getAttribute('aria-expanded') === 'true'
      if (isOpen) {
        answer.style.maxHeight = '0px'
        answer.style.opacity = '0'
        row.setAttribute('aria-expanded', 'false')
        row.classList.remove('automind-faq-open')
      } else {
        answer.style.maxHeight = answer.scrollHeight + 'px'
        answer.style.opacity = '1'
        row.setAttribute('aria-expanded', 'true')
        row.classList.add('automind-faq-open')
      }
    })
  })
})()
