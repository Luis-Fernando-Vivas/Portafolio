/* Banner de cookies: aparece mientras el visitante no haya elegido (o su
   elección tenga más de un año) y guarda la respuesta con
   window.amConsent, que define analytics.js. Cualquier elemento con
   data-consent-open (el enlace "Preferencias de cookies" del footer) lo
   vuelve a mostrar. Trae su propia hoja de estilos para que una página
   nueva solo tenga que incluir este script. */
(function () {
  if (!window.amConsent) return;

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/js/consent.css';
  document.head.appendChild(css);

  var banner;

  function build() {
    banner = document.createElement('div');
    banner.className = 'am-consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Preferencias de cookies');
    banner.innerHTML =
      '<p class="am-consent__text">Usamos cookies de analítica y de Meta para entender cómo se usa el sitio, mejorarlo ' +
      'y medir nuestros anuncios. <a href="/privacidad">Política de privacidad</a></p>' +
      '<div class="am-consent__buttons">' +
      '<button type="button" class="am-consent__btn" data-choice="denied">Rechazar</button>' +
      '<button type="button" class="am-consent__btn am-consent__btn--accept" data-choice="granted">Aceptar</button>' +
      '</div>';

    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-choice]');
      if (!button) return;
      window.amConsent.set(button.getAttribute('data-choice'));
      hide();
    });

    document.body.appendChild(banner);
  }

  function show() {
    if (!banner) build();
    banner.hidden = false;
    // Un frame de espera para que la transición de entrada se ejecute.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { banner.classList.add('is-visible'); });
    });
  }

  function hide() {
    banner.classList.remove('is-visible');
    setTimeout(function () { banner.hidden = true; }, 400);
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest && event.target.closest('[data-consent-open]');
    if (!opener) return;
    event.preventDefault();
    show();
  });

  if (!window.amConsent.get()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show);
    } else {
      show();
    }
  }
})();
