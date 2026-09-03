/*
 * Etiquetas Open Graph en el HTML que sirve el servidor.
 *
 * El problema que resuelve: CarMeet es una SPA. El HTML que sale de
 * Netlify es el mismo para todas las rutas y solo lleva el título
 * genérico; las etiquetas por página las pone React al montarse. Los
 * rastreadores de WhatsApp, Twitter, Telegram, Discord y compañía NO
 * ejecutan JavaScript: leen el HTML crudo y se van. Por eso hasta ahora
 * cualquier enlace compartido de carmeet.es salía con el mismo texto, o
 * directamente pelado.
 *
 * Esta función se ejecuta en el borde, antes de entregar el HTML.
 * Reconoce la ruta, pide a Supabase los datos del evento, la crew o el
 * perfil, y sustituye el bloque marcado con <!--og--> del index.html.
 *
 * Coste para un visitante normal: una comparación de cadena. Si el
 * agente no es un rastreador, la función devuelve undefined y Netlify
 * sigue como si no existiera.
 */

/* Rastreadores que leen tarjetas. Googlebot y Bingbot sí ejecutan
   JavaScript, pero les ahorramos el trabajo y de paso nos aseguramos de
   que indexan el título correcto. */
const RASTREADORES =
  /facebookexternalhit|facebookcatalog|Facebot|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|Pinterest|redditbot|Googlebot|bingbot|DuckDuckBot|Applebot|SkypeUriPreview|vkShare|embedly|Iframely|SnapchatAds|Bluesky|Mastodon/i

const SITIO = 'https://carmeet.es'
const IMAGEN_POR_DEFECTO = `${SITIO}/og-carmeet.png`
const MAX_DESC = 200

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || 'https://stryumcmeavlvjaamcaw.supabase.co'
/* Clave publicable: es la misma que ya viaja en el bundle del navegador,
   no hay nada que proteger aquí. */
const SUPABASE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  'sb_publishable_2VNxDOShmzwkZNdPP774og_hp3TUb8g'

/* ---------- Utilidades ---------- */

/* Los títulos y biografías los escriben los usuarios. Sin escapar, un
   evento llamado `"><script>` se convierte en una inyección en el HTML
   que servimos nosotros. */
const escapar = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const recortar = (texto, max = MAX_DESC) => {
  const limpio = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (limpio.length <= max) return limpio
  return `${limpio.slice(0, max - 1).trimEnd()}…`
}

const titulo = (texto) =>
  texto.includes('CarMeet') ? texto : `${texto} | CarMeet ESP`

/* Consulta a la API REST de Supabase, con tope de tiempo: si tarda, el
   rastreador no se queda colgado, se le sirven los valores por defecto. */
const consultar = async (ruta) => {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (!respuesta.ok) return null
    const filas = await respuesta.json()
    return Array.isArray(filas) && filas.length ? filas[0] : null
  } catch {
    return null
  }
}

/* Corta, porque va en el título y Google corta por los 60 caracteres.
   "22 feb 2026" en vez de "22 de febrero de 2026". */
const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})

const fechaLegible = (valor) => {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return FECHA.format(d).replace(/\./g, '')
}

/* ---------- Metadatos por ruta ---------- */

const POR_DEFECTO = {
  titulo: 'CarMeet ESP | Eventos y Rutas de Coches en España',
  descripcion:
    'La mayor comunidad de coches en España. Encuentra quedadas, rutas y trackdays cerca de ti, comparte tu garaje y únete a una crew.',
  imagen: IMAGEN_POR_DEFECTO,
  tipo: 'website',
}

const ESTATICAS = {
  '/eventos': {
    titulo: 'Eventos y quedadas de coches en España',
    descripcion:
      'Agenda completa de KDDs, rutas, trackdays y concentraciones de coches en España. Filtra por provincia, fecha y tipo de evento.',
  },
  '/mapa': {
    titulo: 'Mapa de eventos de coches en vivo',
    descripcion:
      'Mapa interactivo con todas las quedadas y rutas de coches de España. Descubre lo que hay cerca de ti en tiempo real.',
  },
  '/comunidad': {
    titulo: 'Comunidad de aficionados al motor',
    descripcion:
      'Pilotos, crews y garajes de toda España. Descubre coches, sigue a otros aficionados y encuentra tu crew.',
  },
  '/chat-global': {
    titulo: 'Chat global del motor',
    descripcion:
      'El canal abierto de CarMeet. Habla de coches, quedadas y rutas con el resto de la comunidad.',
  },
  '/contacto': {
    titulo: 'Contacto',
    descripcion:
      'Escríbenos para proponer un evento, resolver una duda o hablar de colaboraciones con CarMeet.',
  },
  '/garaje': {
    titulo: 'Tu garaje',
    descripcion:
      'Sube tus coches, sus fotos y sus datos. Enséñale tu garaje a la comunidad de CarMeet.',
  },
  '/login': {
    titulo: 'Entrar en CarMeet',
    descripcion:
      'Entra o crea tu cuenta para apuntarte a eventos, montar tu garaje y unirte a una crew.',
  },
}

/* Las provincias con tilde llegan a veces sin ella, porque el enlace se
   arma desde la ubicación que escribió el organizador. Se les devuelve
   para que el título indexado esté bien escrito. */
const TILDES = {
  alava: 'Álava',
  almeria: 'Almería',
  avila: 'Ávila',
  caceres: 'Cáceres',
  cadiz: 'Cádiz',
  cordoba: 'Córdoba',
  coruna: 'A Coruña',
  'a coruna': 'A Coruña',
  gijon: 'Gijón',
  jaen: 'Jaén',
  leon: 'León',
  malaga: 'Málaga',
  'alcala de henares': 'Alcalá de Henares',
  logrono: 'Logroño',
  merida: 'Mérida',
}

const PROVINCIA = (segmento) => {
  const crudo = decodeURIComponent(segmento).replace(/-/g, ' ').trim()
  const conTilde = TILDES[crudo.toLowerCase()]
  if (conTilde) return conTilde
  return crudo.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

const metadatos = async (ruta) => {
  if (ruta === '/' || ruta === '') return POR_DEFECTO

  const limpia = ruta.replace(/\/+$/, '') || '/'
  if (ESTATICAS[limpia]) return { ...POR_DEFECTO, ...ESTATICAS[limpia] }

  const partes = limpia.split('/').filter(Boolean)

  /* /eventos/:provincia */
  if (partes[0] === 'eventos' && partes[1]) {
    const nombre = PROVINCIA(partes[1])
    return {
      ...POR_DEFECTO,
      titulo: `Eventos de coches en ${nombre}`,
      descripcion: `Quedadas, rutas y concentraciones de coches en ${nombre}. Consulta la agenda de CarMeet y apúntate.`,
    }
  }

  /* /evento/:id */
  if (partes[0] === 'evento' && partes[1]) {
    const id = partes[1].replace(/[^0-9]/g, '')
    if (!id) return POR_DEFECTO

    const evento = await consultar(
      `events?id=eq.${id}&select=titulo,description,image_url,fecha,ubicacion,tipo,is_private&limit=1`,
    )
    if (!evento) return POR_DEFECTO

    /* Un evento privado no filtra ni su nombre ni su sitio */
    if (evento.is_private) {
      return {
        ...POR_DEFECTO,
        titulo: 'Evento privado',
        descripcion: 'Este evento de CarMeet solo es visible para su crew.',
      }
    }

    const cuando = fechaLegible(evento.fecha)
    const donde = evento.ubicacion ? ` · ${evento.ubicacion}` : ''
    const contexto = [cuando, evento.ubicacion].filter(Boolean).join(' · ')

    return {
      titulo: `${evento.titulo}${cuando ? ` · ${cuando}` : ''}${donde}`,
      descripcion:
        recortar(evento.description) ||
        `${evento.tipo || 'Evento'} de coches en CarMeet${contexto ? `. ${contexto}` : ''}.`,
      imagen: evento.image_url || IMAGEN_POR_DEFECTO,
      tipo: 'article',
    }
  }

  /* /crew/:nombre */
  if (partes[0] === 'crew' && partes[1]) {
    const nombre = decodeURIComponent(partes[1])
    const crew = await consultar(
      `crews?name=eq.${encodeURIComponent(nombre)}&select=name,description,profile_image_url&limit=1`,
    )
    if (!crew) return POR_DEFECTO

    return {
      titulo: `Crew ${crew.name}`,
      descripcion:
        recortar(crew.description) ||
        `${crew.name} en CarMeet. Mira sus miembros, su garaje y sus próximos eventos.`,
      imagen: crew.profile_image_url || IMAGEN_POR_DEFECTO,
      tipo: 'profile',
    }
  }

  /* /usuario/:username */
  if (partes[0] === 'usuario' && partes[1]) {
    const usuario = decodeURIComponent(partes[1])
    const perfil = await consultar(
      `profiles?username=eq.${encodeURIComponent(usuario)}&select=username,bio,avatar_url&limit=1`,
    )
    if (!perfil) return POR_DEFECTO

    return {
      titulo: `${perfil.username} en CarMeet`,
      descripcion:
        recortar(perfil.bio) ||
        `El garaje y los eventos de ${perfil.username} en CarMeet.`,
      imagen: perfil.avatar_url || IMAGEN_POR_DEFECTO,
      tipo: 'profile',
    }
  }

  return POR_DEFECTO
}

/* ---------- Bloque de etiquetas ---------- */

const bloque = ({ titulo: t, descripcion, imagen, tipo }, url) => {
  const T = escapar(titulo(t))
  const D = escapar(descripcion)
  const I = escapar(imagen)
  const U = escapar(url)

  return `<!--og-->
    <title>${T}</title>
    <meta name="description" content="${D}" />
    <link rel="canonical" href="${U}" />

    <meta property="og:site_name" content="CarMeet ESP" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:type" content="${escapar(tipo)}" />
    <meta property="og:url" content="${U}" />
    <meta property="og:title" content="${T}" />
    <meta property="og:description" content="${D}" />
    <meta property="og:image" content="${I}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${T}" />
    <meta name="twitter:description" content="${D}" />
    <meta name="twitter:image" content="${I}" />
    <!--/og-->`
}

/* ---------- Punto de entrada ---------- */

export default async (request, context) => {
  const agente = request.headers.get('user-agent') || ''

  /* Visitante normal: ni tocamos la respuesta. React ya pone las
     etiquetas al montar, y así esta función no añade latencia. */
  if (!RASTREADORES.test(agente)) return

  const respuesta = await context.next()

  const tipo = respuesta.headers.get('content-type') || ''
  if (!tipo.includes('text/html')) return respuesta

  const html = await respuesta.text()
  if (!html.includes('<!--og-->')) return new Response(html, respuesta)

  const url = new URL(request.url)
  const datos = await metadatos(url.pathname)
  const canonica = `${SITIO}${url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')}`

  const cabeceras = new Headers(respuesta.headers)
  /* El cuerpo cambia de tamaño: si dejamos el original, algunos
     rastreadores truncan el HTML. */
  cabeceras.delete('content-length')

  return new Response(
    html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, bloque(datos, canonica)),
    { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras },
  )
}

export const config = {
  path: '/*',
  excludedPath: [
    '/assets/*',
    '/themes/*',
    '/.netlify/*',
    '/*.png',
    '/*.jpg',
    '/*.svg',
    '/*.ico',
    '/*.json',
    '/*.txt',
    '/*.xml',
    '/*.js',
    '/*.css',
  ],
}
