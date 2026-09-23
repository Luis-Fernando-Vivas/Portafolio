/* Cal.com embed: loader snippet from Cal.com's own public embed API
   (app.cal.com/embed/embed.js), namespaced as "30min" to match the booking
   link configured for automind. Two things run off this one init:
   1) an inline calendar mounted into #automind-cal-inline (the closing CTA
      section, replacing the old "Empezar / Ver servicios" buttons there),
   2) any element on the page carrying data-cal-link/data-cal-namespace
      (header CTA, hero CTA, mobile menu CTA) automatically becomes a
      click-to-open booking popup — Cal's script binds that itself once
      the namespace is initialized, no extra JS needed here for those. */
(function (C, A, L) {
  function p(a, ar) { a.q.push(ar) }
  var d = C.document
  C.Cal = C.Cal || function () {
    var cal = C.Cal
    var ar = arguments
    if (!cal.loaded) {
      cal.ns = {}
      cal.q = cal.q || []
      d.head.appendChild(d.createElement('script')).src = A
      cal.loaded = true
    }
    if (ar[0] === L) {
      var api = function () { p(api, arguments) }
      var namespace = ar[1]
      api.q = api.q || []
      if (typeof namespace === 'string') {
        cal.ns[namespace] = cal.ns[namespace] || api
        p(cal.ns[namespace], ar)
        p(cal, ['initNamespace', namespace])
      } else {
        p(cal, ar)
      }
      return
    }
    p(cal, ar)
  }
})(window, 'https://app.cal.com/embed/embed.js', 'init')

Cal('init', '30min', { origin: 'https://cal.com' })

Cal.ns['30min']('inline', {
  elementOrSelector: '#automind-cal-inline',
  calLink: 'automind-5oseyu/30min',
  config: { layout: 'month_view' },
})

Cal.ns['30min']('ui', {
  theme: 'light',
  hideEventTypeDetails: false,
  layout: 'month_view',
})
