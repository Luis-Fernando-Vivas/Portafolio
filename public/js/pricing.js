/* Página de precios: estado "scrolled" del header (igual que sticky-nav.js
   en el index), pestaña activa según la categoría visible y animación de
   entrada de las tarjetas. */
(function () {
  var header = document.getElementById('am-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Los botones de agendar apuntan a /#contact como respaldo; si Cal.com
  // cargó, se quedan en esta página y Cal abre su popup.
  document.querySelectorAll('[data-cal-link]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (window.Cal && window.Cal.loaded) event.preventDefault();
    });
  });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.am-reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('.am-reveal').forEach(function (el) {
    // Escalonado suave entre tarjetas de una misma fila
    if (el.classList.contains('am-plan')) {
      var index = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = index * 90 + 'ms';
    }
    revealObserver.observe(el);
  });

  var tabs = document.querySelectorAll('.am-tabs a');
  if (!tabs.length) return;

  var byId = {};
  tabs.forEach(function (tab) {
    byId[tab.getAttribute('href').slice(1)] = tab;
  });

  function activate(id) {
    tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab === byId[id]);
    });
    var active = byId[id];
    if (active) {
      var bar = active.parentElement;
      if (bar.scrollWidth > bar.clientWidth) {
        bar.scrollTo({
          left: active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2,
          behavior: 'smooth'
        });
      }
    }
  }

  var tabObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) activate(entry.target.id);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  Object.keys(byId).forEach(function (id) {
    var section = document.getElementById(id);
    if (section) tabObserver.observe(section);
  });
})();
