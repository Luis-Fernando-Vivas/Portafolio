(function () {
  var SELECTOR =
    '[data-framer-name$="Section"], [data-framer-name="Card"], [data-framer-name^="Card "], [data-framer-name="Content"]';
  var targets = document.querySelectorAll(SELECTOR);
  if (!targets.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) {
      el.classList.add('reveal-on-scroll', 'is-revealed');
    });
    return;
  }

  targets.forEach(function (el) {
    el.classList.add('reveal-on-scroll');
  });

  function init() {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach(function (el) {
      io.observe(el);
    });
  }

  var overlay = document.getElementById('automind-loading');
  if (overlay) {
    window.addEventListener('automind:loaded', init, { once: true });
  } else {
    init();
  }
})();
