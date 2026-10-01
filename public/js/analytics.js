/* Google Analytics 4: configuración base + eventos propios de Automind.
   Se carga en el <head> de cada página (index, precios y, a futuro, cada
   artículo del blog) justo después del gtag.js de Google, así que basta con
   incluir estas dos líneas en una página nueva para que quede medida.

   - content_group separa el tráfico por tipo de página (home / precios /
     blog) en los informes de GA4.
   - En localhost no se envía nada, para no ensuciar los datos; añadir
     ?ga_debug=1 a la URL lo activa en modo debug (se ve en GA4 > DebugView).
   - window.amTrack(evento, parámetros) queda disponible para otros scripts
     (cal-embed.js lo usa para las reservas). */
(function () {
  var GA_ID = 'G-TDSLWGEYQ2';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var debug = /[?&]ga_debug=1\b/.test(location.search);
  if (isLocal && !debug) window['ga-disable-' + GA_ID] = true;

  function contentGroup() {
    var path = location.pathname;
    if (path.indexOf('/blog') === 0) return 'blog';
    if (path.indexOf('/precios') === 0) return 'precios';
    if (path === '/' || path === '/index.html') return 'home';
    return 'otros';
  }

  var config = { content_group: contentGroup() };
  if (debug) config.debug_mode = true;

  gtag('js', new Date());
  gtag('config', GA_ID, config);

  function track(name, params) {
    gtag('event', name, params || {});
  }
  window.amTrack = track;

  // Sección de la página donde ocurrió el clic (hero, works, footer...),
  // para saber qué botón concreto convierte.
  function locationOf(el) {
    var box = el.closest('section[id], header[id], footer[id], nav[id], [data-framer-name$=" Section"]');
    if (box) {
      return box.id || box.getAttribute('data-framer-name').replace(/ Section$/, '').toLowerCase().replace(/\s+/g, '_');
    }
    if (el.closest('header, nav')) return 'header';
    if (el.closest('footer')) return 'footer';
    return 'otro';
  }

  // Los enlaces de WhatsApp de precios llevan el plan en el mensaje:
  // "...me interesa el plan Landing Pro (Landing & Product page)"
  function whatsappParams(url) {
    var params = {};
    try {
      var text = new URL(url).searchParams.get('text') || '';
      var match = text.match(/el plan (.+?) \((.+)\)\s*$/);
      if (match) {
        params.plan = match[1];
        params.category = match[2];
      } else if (/cotizaci/i.test(text)) {
        params.plan = 'cotizacion';
      } else if (/pregunta/i.test(text)) {
        params.plan = 'pregunta';
      }
    } catch (e) {}
    return params;
  }

  function linkText(el) {
    return (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  // Delegación en document: cubre también los botones que se crean después
  // por JS (menú móvil, barra inferior) y no depende de que el DOM esté listo.
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('a, [data-cal-link]');
    if (!el) return;

    var href = el.getAttribute('href') || '';
    var where = locationOf(el);

    if (el.hasAttribute('data-cal-link')) {
      track('booking_open', { location: where });
      return;
    }

    if (/wa\.me|api\.whatsapp\.com/.test(href)) {
      var wa = whatsappParams(el.href);
      wa.location = where;
      track('whatsapp_click', wa);
      return;
    }

    if (/instagram\.com/.test(href)) {
      track('instagram_click', {
        link_type: /instagram\.com\/p\//.test(href) ? 'post' : 'perfil',
        location: where
      });
      return;
    }

    if (/precios(\.html)?($|[#?])/.test(href) || /#contact$/.test(href)) {
      track('cta_click', {
        cta_text: linkText(el),
        destination: href,
        location: where
      });
    }
  }, true);

  // Precios: qué categorías llegan a ver (una vez por categoría y visita).
  function watchPricingCategories() {
    var tabs = document.querySelectorAll('.am-tabs a[href^="#"]');
    if (!tabs.length || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        track('pricing_category_view', { category: entry.target.id });
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    tabs.forEach(function (tab) {
      var section = document.getElementById(tab.getAttribute('href').slice(1));
      if (section) observer.observe(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchPricingCategories);
  } else {
    watchPricingCategories();
  }
})();
