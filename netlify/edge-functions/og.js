/*
 * Lo que ven los rastreadores: etiquetas, datos estructurados y
 * contenido de verdad.
 *
 * EL PROBLEMA
 *
 * CarMeet es una SPA. El HTML que sale de Netlify es el mismo para todas
 * las rutas y su cuerpo entero es esto:
 *
 *     <body><div id="root"></div></body>
 *
 * Los rastreadores de WhatsApp, Twitter y Telegram no ejecutan
 * JavaScript, y tampoco lo ejecutan GPTBot, PerplexityBot, ClaudeBot ni
 * el primer pase de Googlebot. O sea que hasta ahora, cualquiera de
 * ellos veía un título y ni una sola palabra de contenido. No es que la
 * web posicionara mal: es que para ellos estaba vacía. Por eso no salía
 * citada en ChatGPT ni en Perplexity, y por eso Google no tenía nada que
 * enseñar más allá del título.
 *
 * LO QUE HACE
 *
 * Se ejecuta en el borde, antes de entregar el HTML, y solo cuando quien
 * pide es un rastreador. Consulta Supabase y devuelve tres cosas:
 *
 *   1. Las etiquetas Open Graph y Twitter de esa página concreta.
 *   2. Datos estructurados JSON-LD. Para las fichas de evento eso es
 *      schema.org/Event, que es lo que Google necesita para meter una
 *      quedada en su carrusel de eventos. Es, con diferencia, lo que más
 *      tráfico puede traer a una web de este tipo.
 *   3. El contenido en texto dentro de #root: título, fecha, sitio,
 *      descripción y enlaces. Es lo que un modelo puede leer y citar.
 *
 * SOBRE SERVIR ALGO DISTINTO A LOS RASTREADORES
 *
 * Google llama a esto renderizado dinámico y lo permite mientras la
 * información sea la misma que ve una persona. Aquí lo es: son los
 * mismos datos de la misma consulta, en texto plano en vez de pintados
 * por React. Lo que NO se puede hacer nunca es meter aquí palabras que
 * no estén en la página real; eso sí es encubrimiento y se penaliza.
 *
 * La solución definitiva es renderizar en servidor de verdad, con React
 * Router en modo framework. Esto es el puente hasta entonces, y cuesta
 * cero latencia a las personas: si el agente no es un rastreador, la
 * función se aparta sin consultar nada.
 */

const RASTREADORES =
  /facebookexternalhit|facebookcatalog|Facebot|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|Pinterest|redditbot|Googlebot|Google-Extended|bingbot|DuckDuckBot|Applebot|SkypeUriPreview|vkShare|embedly|Iframely|SnapchatAds|Bluesky|Mastodon|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Perplexity-User|Amazonbot|Bytespider|CCBot|cohere-ai|YouBot|Diffbot|meta-externalagent/i

import { PROVINCIAS, buscarProvincia } from '../../src/utils/provincias.js'

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

/* JSON dentro de <script>: si el texto llevara </script>, cerraría la
   etiqueta antes de tiempo y el resto se pintaría como HTML. */
const jsonSeguro = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

const consultar = async (ruta) => {
  const filas = await consultarLista(ruta)
  return filas.length ? filas[0] : null
}

/* Consulta a la API REST de Supabase, con tope de tiempo: si tarda, el
   rastreador no se queda colgado, se le sirven los valores por defecto. */
const consultarLista = async (ruta) => {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    })
    if (!respuesta.ok) return []
    const filas = await respuesta.json()
    return Array.isArray(filas) ? filas : []
  } catch {
    return []
  }
}

/* Corta, porque va en el título y Google corta por los 60 caracteres. */
const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})

const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
})

const fechaLegible = (valor) => {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return FECHA.format(d).replace(/\./g, '')
}

const fechaLarga = (valor) => {
  if (!valor) return ''
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : FECHA_LARGA.format(d)
}

const SOLO_DIA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  timeZone: 'Europe/Madrid',
})

const mismoDiaEs = (a, b) => {
  const k = (d) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  return k(a) === k(b)
}

/*
 * "7 y 8 nov 2026" en vez de "7 nov 2026".
 *
 * Un gran premio o el EMF de Jerez duran un fin de semana. Anunciarlos
 * con un solo dia en el titulo que se comparte por WhatsApp es dar mal
 * la informacion que mas importa.
 */
const rangoCorto = (inicio, fin) => {
  const a = inicio ? new Date(inicio) : null
  if (!a || Number.isNaN(a.getTime())) return ''
  const b = fin ? new Date(fin) : null

  if (!b || Number.isNaN(b.getTime()) || mismoDiaEs(a, b)) {
    return fechaLegible(a)
  }

  const mismoMes =
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()

  return mismoMes
    ? `${SOLO_DIA.format(a)} y ${fechaLegible(b)}`
    : `${fechaLegible(a)} - ${fechaLegible(b)}`
}

const TIPOS = {
  Stance: 'Stance / Expo',
  Ruta: 'Ruta / Tramo',
  Racing: 'Circuito / Trackday',
  Clasicos: 'Clásicos',
  Offroad: 'Off-road / 4x4',
}

/* ---------- Piezas de contenido ---------- */

const listaEventos = (eventos, encabezado) => {
  if (!eventos.length) {
    return `<h2>${escapar(encabezado)}</h2><p>Ahora mismo no hay eventos publicados en esta zona.</p>`
  }

  const filas = eventos
    .map((e) => {
      const cuando = e.fecha_fin
        ? rangoCorto(e.fecha, e.fecha_fin)
        : fechaLarga(e.fecha)
      const donde = e.ubicacion ? ` en ${escapar(e.ubicacion)}` : ''
      const tipo = TIPOS[e.tipo] || e.tipo || 'Evento'
      return (
        `<li><a href="${SITIO}/evento/${e.id}">${escapar(e.titulo)}</a>` +
        ` — ${escapar(tipo)}${donde}${cuando ? `, ${escapar(cuando)}` : ''}</li>`
      )
    })
    .join('')

  return `<h2>${escapar(encabezado)}</h2><ul>${filas}</ul>`
}

const listaJsonLd = (eventos, nombre) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: nombre,
  numberOfItems: eventos.length,
  itemListElement: eventos.map((e, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITIO}/evento/${e.id}`,
    name: e.titulo,
  })),
})

const eventoJsonLd = (evento, organizador) => {
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: evento.titulo,
    url: `${SITIO}/evento/${evento.id}`,
    /* Google avisa si faltan estos dos, y sin ellos no entra en el
       carrusel de eventos. */
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'es-ES',
  }

  if (evento.fecha) datos.startDate = evento.fecha
  /* Google lo pide como recomendado y sin el no da por bueno un evento
     de varios dias: lo trataria como si acabara el mismo dia. */
  if (evento.fecha_fin) datos.endDate = evento.fecha_fin
  if (evento.description) datos.description = recortar(evento.description, 500)
  if (evento.image_url) datos.image = [evento.image_url]

  /* La ubicación es obligatoria para que Google lo trate como evento. */
  const lugar = { '@type': 'Place', name: evento.ubicacion || 'España' }
  if (evento.ubicacion) {
    lugar.address = {
      '@type': 'PostalAddress',
      addressLocality: evento.ubicacion,
      addressCountry: 'ES',
    }
  }
  if (evento.lat && evento.lng) {
    lugar.geo = {
      '@type': 'GeoCoordinates',
      latitude: evento.lat,
      longitude: evento.lng,
    }
  }
  datos.location = lugar

  if (organizador) {
    datos.organizer = {
      '@type': 'Person',
      name: organizador,
      url: `${SITIO}/usuario/${encodeURIComponent(organizador)}`,
    }
  }

  return datos
}

const SITIO_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CarMeet ESP',
    url: `${SITIO}/`,
    inLanguage: 'es-ES',
    /* Con esto Google puede pintar un buscador propio del sitio debajo
       del resultado principal. */
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITIO}/eventos?buscar={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CarMeet ESP',
    url: `${SITIO}/`,
    logo: `${SITIO}/icon-512.png`,
    description:
      'Comunidad española de aficionados al motor: agenda de quedadas, rutas y trackdays, mapa en vivo, garajes y crews.',
    areaServed: { '@type': 'Country', name: 'España' },
  },
]

const migas = (partes) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: partes.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.nombre,
    item: `${SITIO}${p.ruta}`,
  })),
})

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

/*
 * Eventos próximos, opcionalmente de una provincia.
 *
 * El filtro es por la columna `provincia`, que guarda el slug de una de
 * las 50 españolas. Antes se hacía con un ilike sobre el texto libre de
 * `ubicacion`, y eso daba una página por municipio: /eventos/Casar de
 * Cáceres, Extremadura con un solo evento dentro. Nadie busca eso.
 */
const proximos = async (limite = 12, filtro = '') => {
  const ahora = new Date().toISOString()
  const cola = `${filtro}&order=fecha.asc&limit=${limite}`

  const conFin = await consultarLista(
    `events?is_private=eq.false&fecha_hasta=gte.${ahora}` +
      `&select=id,titulo,fecha,fecha_fin,ubicacion,tipo${cola}`,
  )
  if (conFin.length) return conFin

  return consultarLista(
    `events?is_private=eq.false&fecha=gte.${ahora}` +
      `&select=id,titulo,fecha,ubicacion,tipo${cola}`,
  )
}

const metadatos = async (ruta) => {
  const limpia = ruta.replace(/\/+$/, '') || '/'

  /* --- Portada --- */
  if (limpia === '/') {
    const eventos = await proximos(8)
    return {
      ...POR_DEFECTO,
      jsonld: [...SITIO_JSONLD, listaJsonLd(eventos, 'Próximos eventos')],
      contenido:
        `<h1>CarMeet ESP</h1>` +
        `<p>La comunidad del motor en España. Encuentra concentraciones, ` +
        `rutas y trackdays cerca de ti, monta tu garaje y conecta con otros ` +
        `aficionados.</p>` +
        listaEventos(eventos, 'Próximos eventos de coches en España') +
        `<h2>Secciones</h2><ul>` +
        `<li><a href="${SITIO}/eventos">Agenda de eventos</a></li>` +
        `<li><a href="${SITIO}/mapa">Mapa de eventos en vivo</a></li>` +
        `<li><a href="${SITIO}/comunidad">Comunidad, crews y garajes</a></li>` +
        `</ul>`,
    }
  }

  const partes = limpia.split('/').filter(Boolean)

  /* --- /eventos --- */
  if (limpia === '/eventos') {
    const eventos = await proximos(20)
    return {
      ...POR_DEFECTO,
      ...ESTATICAS['/eventos'],
      jsonld: [
        listaJsonLd(eventos, 'Agenda de eventos de coches en España'),
        migas([
          { nombre: 'Inicio', ruta: '/' },
          { nombre: 'Eventos', ruta: '/eventos' },
        ]),
      ],
      contenido:
        `<h1>Eventos y quedadas de coches en España</h1>` +
        `<p>Agenda de KDDs, rutas, trackdays, exposiciones de clásicos y ` +
        `salidas off-road organizadas por la comunidad de CarMeet.</p>` +
        listaEventos(eventos, 'Próximos eventos'),
    }
  }

  /* --- /eventos/:provincia --- */
  if (partes[0] === 'eventos' && partes[1]) {
    const prov = buscarProvincia(decodeURIComponent(partes[1]))

    /*
     * Zona que no es una provincia española.
     *
     * No se inventa una página: se sirve la agenda general y se apunta
     * la canónica a /eventos. Sin eso, cualquier cadena inventada en la
     * URL daría una página indexable, con contenido flojo y compitiendo
     * consigo misma. Es la trampa clásica de las rutas con parámetro
     * libre.
     */
    if (!prov) {
      return {
        ...(await metadatos('/eventos')),
        canonica: `${SITIO}/eventos`,
      }
    }

    const eventos = await proximos(20, `&provincia=eq.${prov.slug}`)

    /* El título lleva las palabras con las que se busca de verdad:
       "quedadas de coches en Cáceres", "KDD". Antes decía solo "Eventos
       de coches en...", que nadie escribe en Google. */
    const titulo = `Quedadas y KDDs de coches en ${prov.nombre}`

    /* Provincias vecinas, para que el rastreador tenga por dónde seguir
       y las zonas nuevas no queden aisladas. */
    const vecinas = PROVINCIAS.filter(
      (p) => p.comunidad === prov.comunidad && p.slug !== prov.slug,
    ).slice(0, 6)

    return {
      ...POR_DEFECTO,
      titulo,
      descripcion:
        `Todas las quedadas de coches, KDDs, rutas y trackdays en ${prov.nombre}. ` +
        `Agenda actualizada por la comunidad de CarMeet: fecha, sitio y cómo apuntarse.`,
      jsonld: [
        listaJsonLd(eventos, titulo),
        migas([
          { nombre: 'Inicio', ruta: '/' },
          { nombre: 'Eventos', ruta: '/eventos' },
          { nombre: prov.nombre, ruta: `/eventos/${prov.slug}` },
        ]),
      ],
      contenido:
        `<h1>Quedadas y KDDs de coches en ${escapar(prov.nombre)}</h1>` +
        `<p>Agenda de quedadas de coches, KDDs, rutas, trackdays y ` +
        `concentraciones en la provincia de ${escapar(prov.nombre)} ` +
        `(${escapar(prov.comunidad)}), publicadas por la propia comunidad ` +
        `de aficionados. Cada evento indica fecha, hora, sitio exacto y ` +
        `quién lo organiza.</p>` +
        listaEventos(eventos, `Próximas quedadas en ${prov.nombre}`) +
        (vecinas.length
          ? `<h2>Otras provincias de ${escapar(prov.comunidad)}</h2><ul>` +
            vecinas
              .map(
                (p) =>
                  `<li><a href="${SITIO}/eventos/${p.slug}">Quedadas de coches en ${escapar(p.nombre)}</a></li>`,
              )
              .join('') +
            `</ul>`
          : '') +
        `<p><a href="${SITIO}/eventos">Ver la agenda completa de España</a> · ` +
        `<a href="${SITIO}/mapa">Verlo en el mapa</a></p>`,
    }
  }

  /* --- /evento/:id --- */
  if (partes[0] === 'evento' && partes[1]) {
    const id = partes[1].replace(/[^0-9]/g, '')
    if (!id) return POR_DEFECTO

    const base = 'id,titulo,description,image_url,fecha,ubicacion,tipo,lat,lng,is_private,profiles(username)'

    /* Igual que en proximos: si el bloque 14 aún no se ha ejecutado, las
       columnas nuevas no existen y la consulta entera falla. */
    const evento =
      (await consultar(
        `events?id=eq.${id}&select=${base},fecha_fin,ruta&limit=1`,
      )) || (await consultar(`events?id=eq.${id}&select=${base}&limit=1`))

    if (!evento) return POR_DEFECTO

    /* Un evento privado no filtra ni su nombre ni su sitio */
    if (evento.is_private) {
      return {
        ...POR_DEFECTO,
        titulo: 'Evento privado',
        descripcion: 'Este evento de CarMeet solo es visible para su crew.',
        contenido:
          `<h1>Evento privado</h1>` +
          `<p>Este evento solo es visible para los miembros de su crew.</p>`,
      }
    }

    const organizador = evento.profiles?.username || ''
    const cuando = rangoCorto(evento.fecha, evento.fecha_fin)
    const donde = evento.ubicacion ? ` · ${evento.ubicacion}` : ''
    const contexto = [cuando, evento.ubicacion].filter(Boolean).join(' · ')
    const tipo = TIPOS[evento.tipo] || evento.tipo || 'Evento'

    return {
      titulo: `${evento.titulo}${cuando ? ` · ${cuando}` : ''}${donde}`,
      descripcion:
        recortar(evento.description) ||
        `${tipo} de coches en CarMeet${contexto ? `. ${contexto}` : ''}.`,
      imagen: evento.image_url || IMAGEN_POR_DEFECTO,
      tipo: 'article',
      jsonld: [
        eventoJsonLd(evento, organizador),
        migas([
          { nombre: 'Inicio', ruta: '/' },
          { nombre: 'Eventos', ruta: '/eventos' },
          { nombre: evento.titulo, ruta: `/evento/${evento.id}` },
        ]),
      ],
      contenido:
        `<h1>${escapar(evento.titulo)}</h1>` +
        `<dl>` +
        `<dt>Tipo</dt><dd>${escapar(tipo)}</dd>` +
        (evento.fecha
          ? `<dt>Fecha</dt><dd>${escapar(
              evento.fecha_fin
                ? `de ${fechaLarga(evento.fecha)} a ${fechaLarga(evento.fecha_fin)}`
                : fechaLarga(evento.fecha),
            )}</dd>`
          : '') +
        (Array.isArray(evento.ruta?.puntos) && evento.ruta.puntos.length > 1
          ? `<dt>Recorrido</dt><dd>${escapar(
              `${(Number(evento.ruta.distancia || 0) / 1000).toFixed(1).replace('.', ',')} km`,
            )}</dd>`
          : '') +
        (evento.ubicacion
          ? `<dt>Ubicación</dt><dd>${escapar(evento.ubicacion)}</dd>`
          : '') +
        (organizador
          ? `<dt>Organiza</dt><dd><a href="${SITIO}/usuario/${encodeURIComponent(organizador)}">${escapar(organizador)}</a></dd>`
          : '') +
        `</dl>` +
        (evento.description
          ? `<h2>Sobre el evento</h2><p>${escapar(recortar(evento.description, 1200))}</p>`
          : '') +
        `<p><a href="${SITIO}/eventos">Ver todos los eventos de CarMeet</a></p>`,
    }
  }

  /* --- /crew/:nombre --- */
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
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: crew.name,
          url: `${SITIO}/crew/${encodeURIComponent(crew.name)}`,
          ...(crew.description
            ? { description: recortar(crew.description, 400) }
            : {}),
          ...(crew.profile_image_url ? { logo: crew.profile_image_url } : {}),
          memberOf: { '@type': 'Organization', name: 'CarMeet ESP', url: `${SITIO}/` },
        },
      ],
      contenido:
        `<h1>Crew ${escapar(crew.name)}</h1>` +
        (crew.description
          ? `<p>${escapar(recortar(crew.description, 800))}</p>`
          : `<p>Crew de aficionados al motor en CarMeet.</p>`) +
        `<p><a href="${SITIO}/comunidad">Ver todas las crews de CarMeet</a></p>`,
    }
  }

  /* --- /usuario/:username --- */
  if (partes[0] === 'usuario' && partes[1]) {
    const usuario = decodeURIComponent(partes[1])
    const perfil = await consultar(
      `profiles?username=eq.${encodeURIComponent(usuario)}&select=id,username,bio,avatar_url&limit=1`,
    )
    if (!perfil) return POR_DEFECTO

    /* El garaje es lo que da contenido de verdad a un perfil: marcas y
       modelos concretos, que es justo por lo que la gente busca. */
    const coches = await consultarLista(
      `vehicles?user_id=eq.${perfil.id}&select=marca,modelo,anio,cv&limit=12`,
    )

    return {
      titulo: `${perfil.username} en CarMeet`,
      descripcion:
        recortar(perfil.bio) ||
        `El garaje y los eventos de ${perfil.username} en CarMeet.`,
      imagen: perfil.avatar_url || IMAGEN_POR_DEFECTO,
      tipo: 'profile',
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: perfil.username,
            url: `${SITIO}/usuario/${encodeURIComponent(perfil.username)}`,
            ...(perfil.avatar_url ? { image: perfil.avatar_url } : {}),
            ...(perfil.bio ? { description: recortar(perfil.bio, 400) } : {}),
          },
        },
      ],
      contenido:
        `<h1>${escapar(perfil.username)}</h1>` +
        (perfil.bio ? `<p>${escapar(recortar(perfil.bio, 600))}</p>` : '') +
        `<p>Perfil de la comunidad de CarMeet: su garaje y los eventos que organiza.</p>` +
        (coches.length
          ? `<h2>Su garaje</h2><ul>` +
            coches
              .map((c) => {
                const ficha = [
                  c.anio ? `${c.anio}` : '',
                  c.cv ? `${c.cv} CV` : '',
                ]
                  .filter(Boolean)
                  .join(', ')
                return `<li>${escapar(`${c.marca || ''} ${c.modelo || ''}`.trim())}${
                  ficha ? ` (${escapar(ficha)})` : ''
                }</li>`
              })
              .join('') +
            `</ul>`
          : '') +
        `<p><a href="${SITIO}/comunidad">Ver la comunidad</a></p>`,
    }
  }

  /* --- Resto de páginas fijas --- */
  if (ESTATICAS[limpia]) {
    const m = { ...POR_DEFECTO, ...ESTATICAS[limpia] }
    return {
      ...m,
      contenido: `<h1>${escapar(m.titulo)}</h1><p>${escapar(m.descripcion)}</p>`,
    }
  }

  return POR_DEFECTO
}

/* ---------- Bloque de etiquetas ---------- */

const bloque = (datos, url) => {
  const { titulo: t, descripcion, imagen, tipo, jsonld } = datos
  const T = escapar(titulo(t))
  const D = escapar(descripcion)
  const I = escapar(imagen)
  const U = escapar(url)

  /* El tamaño solo se declara para nuestra tarjeta, que sabemos que mide
     1200x630. Las fotos que suben los usuarios miden cualquier cosa, y
     anunciar unas medidas que no son hace que Twitter recorte mal la
     vista previa o directamente la descarte. */
  const medidas =
    imagen === IMAGEN_POR_DEFECTO
      ? `\n    <meta property="og:image:width" content="1200" />` +
        `\n    <meta property="og:image:height" content="630" />`
      : ''

  const datosEstructurados = (jsonld || [])
    .map(
      (d) =>
        `\n    <script type="application/ld+json">${jsonSeguro(d)}</script>`,
    )
    .join('')

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
    <meta property="og:image" content="${I}" />${medidas}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${T}" />
    <meta name="twitter:description" content="${D}" />
    <meta name="twitter:image" content="${I}" />${datosEstructurados}
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
  /* Normalmente la canónica es la propia dirección. Algunas páginas la
     mandan explícitamente para no competir consigo mismas: es el caso de
     una zona inventada en la URL, que se canoniza a /eventos. */
  const canonica =
    datos.canonica ||
    `${SITIO}${url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')}`

  let salida = html.replace(
    /<!--og-->[\s\S]*?<!--\/og-->/,
    bloque(datos, canonica),
  )

  /* El contenido va DENTRO de #root. React lo borra al montar, así que
     una persona no llega a verlo, pero está en el HTML que sirve el
     servidor, que es lo único que leen los rastreadores. */
  if (datos.contenido) {
    salida = salida.replace(
      '<div id="root"></div>',
      `<div id="root"><main>${datos.contenido}</main></div>`,
    )
  }

  const cabeceras = new Headers(respuesta.headers)
  /* El cuerpo cambia de tamaño: si dejamos el original, algunos
     rastreadores truncan el HTML. */
  cabeceras.delete('content-length')

  return new Response(salida, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  })
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
