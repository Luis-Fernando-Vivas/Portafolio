/* Google Analytics 4: configuración base + eventos propios de Automind.
   Se carga en el <head> de cada página (index, precios y, a futuro, cada
   artículo del blog) justo después del gtag.js de Google, así que basta con
   incluir estas dos líneas en una página nueva para que quede medida.

   - content_group separa el tráfico por tipo de página (home / precios /
     blog) en los informes de GA4.
   - En localhost no se envía nada, para no ensuciar los datos; añadir
     ?ga_debug=1 a la URL lo activa en modo debug (se ve en GA4 > DebugView).
   - window.amTrack(evento, parámetros) queda disponible para otros scripts
     (cal-embed.js lo usa para las reservas).

   Consentimiento (Ley 1581): hasta que el visitante acepta en el banner
   (consent.js), GA4 y Clarity funcionan sin cookies — GA4 envía pings
   anónimos (Consent Mode v2) y Clarity mide cada página por separado.
   Meta Pixel se carga siempre pero retiene los eventos (fbq consent
   revoke) hasta que el visitante acepta.
   window.amConsent.set('granted' | 'denied') guarda la elección y la
   aplica a las tres herramientas sin recargar. */
(function () {
  var GA_ID = 'G-TDSLWGEYQ2';
  var CLARITY_ID = 'yr00zjsiu0';
  var META_PIXEL_ID = '1344401088759615';
  var CONSENT_KEY = 'am-consent';
  var CONSENT_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var debug = /[?&]ga_debug=1\b/.test(location.search);
  if (isLocal && !debug) window['ga-disable-' + GA_ID] = true;

  // Elección guardada: null si nunca respondió o pasó más de un año.
  function storedConsent() {
    try {
      var saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (saved && Date.now() - saved.t < CONSENT_MAX_AGE) return saved.v;
    } catch (e) {}
    return null;
  }

  var consent = storedConsent();

  // Debe ir antes de gtag('config'). Los permisos de anuncios de Google
  // quedan negados siempre: el sitio no usa Google Ads (si se activa, se
  // revisan aquí).
  gtag('consent', 'default', {
    analytics_storage: consent === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  if (CLARITY_ID && !(isLocal && !debug)) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  // El consent revoke va antes del init: sin aceptación no se envía nada a
  // Meta ni se crea la cookie _fbp.
  if (META_PIXEL_ID && !(isLocal && !debug)) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('consent', consent === 'granted' ? 'grant' : 'revoke');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  function applyConsent(state) {
    var value = state === 'granted' ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: value });
    if (window.clarity) window.clarity('consentv2', { analytics_Storage: value, ad_Storage: 'denied' });
    if (window.fbq) window.fbq('consent', value === 'granted' ? 'grant' : 'revoke');
  }

  // También sin elección: fuera de Europa Clarity usa cookies por defecto
  // si no recibe la señal de "denied".
  applyConsent(consent);

  window.amConsent = {
    get: function () { return consent; },
    set: function (state) {
      consent = state;
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: state, t: Date.now() }));
      } catch (e) {}
      applyConsent(state);
    }
  };

  function contentGroup() {
    var path = location.pathname;
    if (path.indexOf('/blog') === 0) return 'blog';
    if (path.indexOf('/precios') === 0) return 'precios';
    if (path.indexOf('/privacidad') === 0) return 'legal';
    if (path === '/' || path === '/index.html') return 'home';
    return 'otros';
  }

  var config = { content_group: contentGroup() };
  if (debug) config.debug_mode = true;

  // Artículos del blog: la meta am-article (la escribe blog-plugin.js antes
  // de este script) añade el artículo y su categoría a todos los eventos de
  // la página, page_view incluido. Así un whatsapp_click o booking_open
  // dice desde qué artículo llegó el contacto.
  var article = document.querySelector('meta[name="am-article"]');
  var articleParams = null;
  if (article) {
    articleParams = {
      article_slug: article.getAttribute('content'),
      article_category: article.getAttribute('data-category')
    };
    gtag('set', articleParams);
  }

  gtag('js', new Date());
  gtag('config', GA_ID, config);

  // Eventos estándar de Meta para las conversiones que importan en anuncios;
  // el resto llega a Meta como evento personalizado (trackCustom) con el
  // mismo nombre que en GA4.
  var META_EVENTS = { whatsapp_click: 'Contact', booking_open: 'Schedule', article_read: 'ViewContent' };

  function track(name, params) {
    params = params || {};
    gtag('event', name, params);
    if (window.fbq) {
      // gtag('set') no llega a Meta: el artículo se añade a mano.
      var metaParams = {};
      var key;
      for (key in articleParams) metaParams[key] = articleParams[key];
      for (key in params) metaParams[key] = params[key];
      if (META_EVENTS[name]) window.fbq('track', META_EVENTS[name], metaParams);
      else window.fbq('trackCustom', name, metaParams);
    }
    if (window.clarity) window.clarity('event', name);
  }
  window.amTrack = track;

  // Sección de la página donde ocurrió el clic (hero, works, footer...),
  // para saber qué botón concreto convierte.
  function locationOf(el) {
    var box = el.closest('section[id], article[id], header[id], footer[id], nav[id], aside[id], [data-framer-name$=" Section"]');
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

  // Botones que registra su propio script (filtros y copiar enlace del blog,
  // idioma) o que no aportan nada medirlos (banner de cookies).
  var SELF_TRACKED = '.am-filter, [data-copy], .am-lang__toggle, .am-lang__option, [data-choice], [data-consent-open]';

  // Delegación en document: cubre también los botones que se crean después
  // por JS (menú móvil, barra inferior) y no depende de que el DOM esté listo.
  // Todo enlace o botón deja un evento: los que no encajan en uno concreto
  // caen en nav_click, outbound_click o button_click.
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('a, button, [data-cal-link]');
    if (!el || el.matches(SELF_TRACKED)) return;

    // data-scroll-target: botones de Framer que bajan a una sección (hero).
    var href = el.getAttribute('href') || el.getAttribute('data-scroll-target') || '';
    var where = locationOf(el);

    if (el.hasAttribute('data-cal-link')) {
      track('booking_open', { location: where });
      return;
    }

    // Compartir del blog: va antes que WhatsApp y Facebook para no contarlo
    // como contacto (wa.me/?text=...) ni como visita al perfil.
    if (el.closest('[data-share-url]')) {
      track('share', { method: el.getAttribute('data-share') || linkText(el), location: where });
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

    if (/facebook\.com/.test(href)) {
      track('facebook_click', { location: where });
      return;
    }

    if (/^mailto:/.test(href)) {
      track('email_click', { location: where });
      return;
    }

    if (/precios(\.html)?($|[#?])/.test(href) || /#contact$/.test(href)) {
      track('cta_click', {
        cta_text: linkText(el),
        destination: href,
        location: where
      });
      return;
    }

    // Enlaces a un artículo: tarjetas del índice, "Sigue leyendo" y lateral.
    var post = href.match(/^(?:https?:\/\/[^/]+)?\/blog\/([^/?#.]+)/);
    if (post) {
      track('article_click', { article_target: post[1], location: where });
      return;
    }

    if (el.id === 'automind-hamburger') {
      if (el.getAttribute('aria-expanded') !== 'true') track('menu_open', { location: where });
      return;
    }

    if (!href) {
      if (el.tagName === 'BUTTON') track('button_click', { button_text: linkText(el), location: where });
      return;
    }
    if (href === '#') return;

    if (el.host && el.host !== location.host) {
      track('outbound_click', { link_url: el.href, link_text: linkText(el), location: where });
      return;
    }

    // Navegación interna: anclas (#works, #faq...), /blog, /privacidad...
    track('nav_click', { link_text: linkText(el), destination: href, location: where });
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

  // Blog: article_read cuando el lector pasa del 75% del texto y lleva al
  // menos 20 segundos en la página (descarta a quien solo baja rápido).
  function watchArticleRead() {
    var body = document.querySelector('[data-article]');
    if (!body) return;
    var start = Date.now();
    var sent = false;

    function check() {
      if (sent) return;
      var rect = body.getBoundingClientRect();
      var seen = (window.innerHeight - rect.top) / rect.height;
      if (seen >= 0.75 && Date.now() - start >= 20000) {
        sent = true;
        track('article_read', { read_seconds: Math.round((Date.now() - start) / 1000) });
        window.removeEventListener('scroll', check);
        clearInterval(timer);
      }
    }

    // El intervalo cubre a quien llega al 75% antes de los 20 s y se queda
    // leyendo sin volver a hacer scroll.
    var timer = setInterval(check, 5000);
    window.addEventListener('scroll', check, { passive: true });
  }

  function onReady() {
    watchPricingCategories();
    watchArticleRead();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
