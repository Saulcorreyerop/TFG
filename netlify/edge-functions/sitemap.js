/*
 * Sitemap generado al vuelo.
 *
 * El de antes era un archivo estático con cinco URLs: portada, mapa,
 * eventos, comunidad y contacto. Eso significa que Google nunca ha
 * llegado a ninguna ficha de evento, ni a ninguna crew, ni a ningún
 * perfil, que es justo el contenido que puede posicionar. Un sitio de
 * eventos sin los eventos en el sitemap es un sitio invisible.
 *
 * Aquí se consulta Supabase y se listan las páginas reales. Si Supabase
 * no responde, se devuelve el archivo estático de public/sitemap.xml,
 * que sigue existiendo justo para eso.
 */

const SITIO = 'https://carmeet.es'

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || 'https://stryumcmeavlvjaamcaw.supabase.co'
const SUPABASE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  'sb_publishable_2VNxDOShmzwkZNdPP774og_hp3TUb8g'

/* Google ignora los sitemaps de más de 50.000 URLs. No estamos ni cerca,
   pero conviene tener el tope escrito. */
const TOPE = 5000

const escapar = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const consultar = async (ruta) => {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    })
    if (!respuesta.ok) return []
    const filas = await respuesta.json()
    return Array.isArray(filas) ? filas : []
  } catch {
    return []
  }
}

const url = (ruta, prioridad, frecuencia, fecha) =>
  `  <url>\n` +
  `    <loc>${escapar(SITIO + ruta)}</loc>\n` +
  (fecha ? `    <lastmod>${fecha.slice(0, 10)}</lastmod>\n` : '') +
  `    <changefreq>${frecuencia}</changefreq>\n` +
  `    <priority>${prioridad}</priority>\n` +
  `  </url>`

/* Las páginas privadas no van: llevan noindex y no aportan nada. */
const FIJAS = [
  ['/', '1.0', 'daily'],
  ['/eventos', '0.9', 'daily'],
  ['/mapa', '0.9', 'daily'],
  ['/comunidad', '0.8', 'weekly'],
  ['/chat-global', '0.5', 'weekly'],
  ['/contacto', '0.4', 'monthly'],
]

export default async (request, context) => {
  const [eventos, crews, perfiles] = await Promise.all([
    consultar(
      `events?is_private=eq.false&select=id,fecha,ubicacion&order=fecha.desc&limit=${TOPE}`,
    ),
    consultar('crews?select=name&limit=1000'),
    consultar('profiles?select=username&limit=2000'),
  ])

  /* Si no hay ni un evento, algo va mal en la consulta: mejor servir el
     sitemap estático que uno vacío, que Google interpreta como que el
     sitio ha perdido su contenido. */
  if (!eventos.length && !crews.length && !perfiles.length) {
    return context.next()
  }

  const lineas = FIJAS.map(([ruta, p, f]) => url(ruta, p, f))

  /* Una página por provincia, sacada de las ubicaciones reales. Son las
     que compiten por búsquedas del tipo "quedadas coches Málaga". */
  const provincias = new Set()
  for (const e of eventos) {
    if (e.ubicacion) provincias.add(String(e.ubicacion).trim())
  }
  for (const p of provincias) {
    lineas.push(url(`/eventos/${encodeURIComponent(p)}`, '0.8', 'weekly'))
  }

  for (const e of eventos) {
    lineas.push(url(`/evento/${e.id}`, '0.7', 'weekly', e.fecha))
  }
  for (const c of crews) {
    if (c.name) lineas.push(url(`/crew/${encodeURIComponent(c.name)}`, '0.6', 'weekly'))
  }
  for (const u of perfiles) {
    if (u.username) {
      lineas.push(url(`/usuario/${encodeURIComponent(u.username)}`, '0.5', 'weekly'))
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${lineas.join('\n')}\n` +
    `</urlset>\n`

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

export const config = { path: '/sitemap.xml' }
