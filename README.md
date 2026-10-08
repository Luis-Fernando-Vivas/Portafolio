# Automind — sitio web

Sitio estático con Vite: `index.html` (exportado de Framer), `precios.html`, `privacidad.html`, el blog y las landing pages generados desde Markdown, todo en español, inglés (`/en/...`) y francés (`/fr/...`). `scripts/site-plugin.js` lo orquesta y genera además `sitemap.xml`, `blog/rss.xml` y `llms.txt`.

```bash
npm run dev     # servidor local
npm run build   # genera dist/ (lo que publica Vercel)
npm run cms     # backend local del panel del blog (junto con npm run dev)
```

## Blog y panel de administración

- Cada noticia es `content/blog/<slug>.<idioma>.md` (`es` obligatorio, `en` y `fr` opcionales). `scripts/blog-plugin.js` genera `/blog`, `/blog/<slug>` y sus versiones `/en/...` y `/fr/...` (solo de los idiomas que existan).
- El panel está en **`/admin`** (Decap CMS, configurado en `public/admin/config.yml`). Guardar una noticia hace un commit en `main` y Vercel la publica sola.
- **En local:** `npm run cms` en una terminal, `npm run dev` en otra y abre `http://localhost:5173/admin/`. Los cambios se escriben directo en `content/blog/`.
- **En producción** se entra con **Google** (`api/auth.js`, `api/callback.js`): solo los correos autorizados, y el panel guarda en el repositorio con un token de GitHub que vive en Vercel. Configuración, una sola vez:
  1. **Google Cloud Console** → APIs y servicios → *Pantalla de consentimiento de OAuth* (tipo Externo, solo nombre y correo) → *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* → tipo **Aplicación web**, con el URI de redirección autorizado `https://www.automindco.com/api/callback`.
  2. **GitHub** → Settings → Developer settings → *Fine-grained tokens* → *Generate new token*: solo el repositorio `Portafolio`, permiso **Contents: Read and write**, y la vigencia más larga que quieras (al vencer hay que crear otro).
  3. **Vercel** → Project → Settings → Environment Variables:
     - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (del paso 1)
     - `ADMIN_EMAILS`: correos que pueden entrar, separados por comas
     - `GITHUB_TOKEN` (del paso 2)

     Luego vuelve a desplegar (*Deployments* → *Redeploy*).

### Noticias con IA (Gemini)

En el panel aparece un botón **✨ IA** (`api/blog-ai.js`) con dos opciones:

- **Nueva noticia:** Gemini busca en Google una noticia reciente (del tema que escribas o, si lo dejas vacío, la más relevante para el público de Automind), la redacta en español con el estilo del blog, agrega las fuentes reales de la búsqueda y la traduce a inglés y francés. Se guardan los tres archivos en un solo commit, **como borrador**.
- **Traducir existente:** traduce la versión en español de una noticia a los idiomas que elijas (por defecto, los que le faltan).

Antes de publicar, revisa el texto, agrega la portada y desmarca *Borrador*. Configuración: crea una clave en [Google AI Studio](https://aistudio.google.com/apikey) y agrégala en Vercel como `GEMINI_API_KEY` (y en `.env` para probar en local). Opcional: `GEMINI_MODEL` para cambiar el modelo (por defecto `gemini-flash-latest`).

## Idiomas (español, inglés, francés)

- Cada página se publica **ya traducida** en `/en/...` y `/fr/...` (por ejemplo `/en/precios`), para que Google y los asistentes de IA lean cada idioma sin ejecutar JavaScript. Al construir, `scripts/i18n-build.js` traduce el HTML en español con el diccionario y escribe `<html lang>`, canonical, `hreflang`, `og:locale` y el JSON-LD de cada idioma.
- Las traducciones están en `public/js/i18n-dict.js` como filas `[español, inglés, francés]`. **Si cambias un texto en español en el HTML (también los títulos, descripciones y textos del JSON-LD), actualiza su fila**; un texto sin fila se queda en español.
- `public/js/i18n.js` maneja el selector flotante (lleva a la otra versión de la página), recuerda la elección y, en las páginas en español, redirige a quien eligió otro idioma (o llega con `?lang=en`). También traduce lo que otros scripts agregan después (banner de cookies, etc.).
- Los artículos del blog se traducen desde el panel (pestañas ES / EN / FR). Lo marcado `data-i18n-skip` no pasa por el diccionario.
- Las páginas fijas nuevas necesitan en el `<head>` `<script src="/js/i18n.js"></script>` (al inicio) y `<script src="/js/i18n-dict.js" defer></script>` (antes de cualquier otro script con `defer`), y sumarse a `STATIC_PAGES` en `scripts/site-plugin.js` y a `rollupOptions.input` en `vite.config.js`.

## Landing pages (SEO local e internacional)

- Cada una es `content/paginas/<archivo>.md` con `lang`, `slug` y `group` en el encabezado (ver `scripts/landing-pages.js`). Se publica en `/<slug>` (español) o `/<idioma>/<slug>`; las del mismo `group` son traducciones entre sí.
- Hoy: Neiva/Huila, Colombia, automatización (es/en/fr), Estados Unidos (es/en) y Canadá (en/fr).
- Llevan datos estructurados `Service`, `FAQPage` y `BreadcrumbList`. Pon las frases del encabezado entre comillas (el francés usa " : ", que rompe el YAML sin ellas).

## SEO para IA

- `llms.txt` se arma con `content/llms.md` (datos del negocio, servicios y precios: **actualízalo si cambian**) más la lista de landing pages y artículos.
- `public/robots.txt` permite explícitamente a los rastreadores de buscadores con IA (ChatGPT, Claude, Perplexity, Gemini, Copilot, Apple).
