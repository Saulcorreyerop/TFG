import { useEffect } from 'react'

/*
 * Metadatos de la página en el navegador.
 *
 * Antes esto era react-helmet-async. Se ha quitado porque su versión
 * 2.0.5 declara React 16-18 como dependencia par: con React 19 el
 * proveedor monta pero el contexto no llega, y las etiquetas
 * sencillamente no se inyectaban. La web llevaba meses sirviendo el
 * título genérico del index.html en todas las rutas.
 *
 * En vez de una librería, se tocan las etiquetas a mano. Se busca la que
 * ya existe y se le cambia el contenido, en lugar de añadir una nueva:
 * así nunca hay dos <meta name="description"> peleándose, que es el fallo
 * clásico cuando se mezcla el HTML inicial con lo que pinta React.
 *
 * Ojo: esto es solo para el navegador. Los rastreadores de WhatsApp,
 * Twitter y compañía no ejecutan JavaScript y nunca ven nada de esto;
 * a ellos les sirve las etiquetas netlify/edge-functions/og.js.
 */

const SITIO = 'https://carmeet.es'
const IMAGEN_POR_DEFECTO = `${SITIO}/og-carmeet.png`

/* Busca la etiqueta por su atributo identificador y la actualiza. Si no
   existe, la crea. Nunca duplica. */
const etiqueta = (atributo, nombre, contenido) => {
  const selector = `meta[${atributo}="${nombre}"]`
  let el = document.head.querySelector(selector)

  if (!contenido) {
    el?.remove()
    return
  }

  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(atributo, nombre)
    document.head.appendChild(el)
  }
  el.setAttribute('content', contenido)
}

const canonica = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

const SEO = ({
  title,
  description,
  image = IMAGEN_POR_DEFECTO,
  type = 'website',
  /* Páginas que no deben salir en Google: login, perfil propio, garaje,
     administración, recuperar contraseña y el 404. */
  noindex = false,
}) => {
  const completo = title?.includes('CarMeet')
    ? title
    : `${title} | CarMeet ESP`

  useEffect(() => {
    document.title = completo

    /* La canónica se construye siempre sobre carmeet.es, nunca sobre
       window.location.origin. Si no, los despliegues de rama publican
       canónicas apuntando a la URL de previsualización y Google acaba
       indexando el sitio equivocado. */
    const ruta = window.location.pathname.replace(/\/+$/, '') || '/'
    const url = `${SITIO}${ruta}`

    canonica(url)

    etiqueta('name', 'description', description)
    etiqueta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')

    etiqueta('property', 'og:site_name', 'CarMeet ESP')
    etiqueta('property', 'og:locale', 'es_ES')
    etiqueta('property', 'og:type', type)
    etiqueta('property', 'og:url', url)
    etiqueta('property', 'og:title', completo)
    etiqueta('property', 'og:description', description)
    etiqueta('property', 'og:image', image)

    etiqueta('name', 'twitter:card', 'summary_large_image')
    etiqueta('name', 'twitter:title', completo)
    etiqueta('name', 'twitter:description', description)
    etiqueta('name', 'twitter:image', image)
  }, [completo, description, image, type, noindex])

  return null
}

export default SEO
