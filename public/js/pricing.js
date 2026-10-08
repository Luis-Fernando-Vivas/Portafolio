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

  // Enlaces internos (#seccion): con Lenis activo se deslizan con él,
  // descontando el header fijo; sin Lenis, el navegador usa scroll-behavior.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (!link || !window.lenis || link.hasAttribute('data-cal-link')) return;
    var id = decodeURIComponent(link.getAttribute('href').slice(1));
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    event.preventDefault();
    // Se pasa la posición (no el elemento) para que el margen sea uno solo:
    // el scroll-margin-top del CSS si lo hay, o el alto del header + 24px.
    var margin = parseFloat(getComputedStyle(target).scrollMarginTop) || (header ? header.offsetHeight : 0) + 24;
    var top = target.getBoundingClientRect().top + window.scrollY - margin;
    window.lenis.scrollTo(Math.max(0, top), { duration: 1.2 });
    history.pushState(null, '', '#' + id);
  });

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
