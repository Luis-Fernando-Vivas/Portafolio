(function () {
  var rows = document.querySelectorAll('.framer-kKgxV')
  rows.forEach(function (row) {
    var textWrap = row.querySelector('.framer-cpl5hy')
    if (!textWrap) return
    var children = Array.prototype.slice.call(textWrap.children)
    if (children.length < 2) return
    var answer = children[1]

    answer.style.overflow = 'hidden'
    answer.style.transition = 'max-height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease'
    answer.style.maxHeight = '0px'
    answer.style.opacity = '0'
    row.setAttribute('aria-expanded', 'false')
    row.style.cursor = 'pointer'

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
