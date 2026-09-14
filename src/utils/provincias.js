/*
 * Las 50 provincias españolas, que son la unidad con la que busca la
 * gente.
 *
 * POR QUÉ HACE FALTA ESTO
 *
 * La ubicación de un evento se guarda como la devuelve Nominatim, y eso
 * da cadenas de granularidad distinta:
 *
 *   "Zafra, Badajoz"                  ciudad, provincia
 *   "Cáceres, Extremadura"            ciudad, comunidad autónoma
 *   "Casar de Cáceres, Extremadura"   pueblo, comunidad autónoma
 *
 * Construir las páginas de zona con esas cadenas daba una página por
 * municipio, con direcciones como
 * /eventos/Casar%20de%20C%C3%A1ceres%2C%20Extremadura, y el contenido
 * repartido en migajas. Nadie busca "quedadas coches Casar de Cáceres":
 * busca "quedadas coches Cáceres".
 *
 * Con una lista cerrada de provincias, cada evento cae en una sola, las
 * direcciones quedan /eventos/caceres, y todos los eventos de la zona se
 * juntan en la misma página. Que es lo que puede posicionar.
 *
 * Sin dependencias a propósito: lo usa el navegador y también la función
 * de borde, que corre en Deno.
 */

export const PROVINCIAS = [
  { nombre: 'A Coruña', slug: 'a-coruna', comunidad: 'Galicia' },
  { nombre: 'Álava', slug: 'alava', comunidad: 'País Vasco' },
  { nombre: 'Albacete', slug: 'albacete', comunidad: 'Castilla-La Mancha' },
  { nombre: 'Alicante', slug: 'alicante', comunidad: 'Comunidad Valenciana' },
  { nombre: 'Almería', slug: 'almeria', comunidad: 'Andalucía' },
  { nombre: 'Asturias', slug: 'asturias', comunidad: 'Asturias' },
  { nombre: 'Ávila', slug: 'avila', comunidad: 'Castilla y León' },
  { nombre: 'Badajoz', slug: 'badajoz', comunidad: 'Extremadura' },
  { nombre: 'Baleares', slug: 'baleares', comunidad: 'Islas Baleares' },
  { nombre: 'Barcelona', slug: 'barcelona', comunidad: 'Cataluña' },
  { nombre: 'Burgos', slug: 'burgos', comunidad: 'Castilla y León' },
  { nombre: 'Cáceres', slug: 'caceres', comunidad: 'Extremadura' },
  { nombre: 'Cádiz', slug: 'cadiz', comunidad: 'Andalucía' },
  { nombre: 'Cantabria', slug: 'cantabria', comunidad: 'Cantabria' },
  { nombre: 'Castellón', slug: 'castellon', comunidad: 'Comunidad Valenciana' },
  { nombre: 'Ciudad Real', slug: 'ciudad-real', comunidad: 'Castilla-La Mancha' },
  { nombre: 'Córdoba', slug: 'cordoba', comunidad: 'Andalucía' },
  { nombre: 'Cuenca', slug: 'cuenca', comunidad: 'Castilla-La Mancha' },
  { nombre: 'Girona', slug: 'girona', comunidad: 'Cataluña' },
  { nombre: 'Granada', slug: 'granada', comunidad: 'Andalucía' },
  { nombre: 'Guadalajara', slug: 'guadalajara', comunidad: 'Castilla-La Mancha' },
  { nombre: 'Gipuzkoa', slug: 'gipuzkoa', comunidad: 'País Vasco' },
  { nombre: 'Huelva', slug: 'huelva', comunidad: 'Andalucía' },
  { nombre: 'Huesca', slug: 'huesca', comunidad: 'Aragón' },
  { nombre: 'Jaén', slug: 'jaen', comunidad: 'Andalucía' },
  { nombre: 'La Rioja', slug: 'la-rioja', comunidad: 'La Rioja' },
  { nombre: 'Las Palmas', slug: 'las-palmas', comunidad: 'Canarias' },
  { nombre: 'León', slug: 'leon', comunidad: 'Castilla y León' },
  { nombre: 'Lleida', slug: 'lleida', comunidad: 'Cataluña' },
  { nombre: 'Lugo', slug: 'lugo', comunidad: 'Galicia' },
  { nombre: 'Madrid', slug: 'madrid', comunidad: 'Comunidad de Madrid' },
  { nombre: 'Málaga', slug: 'malaga', comunidad: 'Andalucía' },
  { nombre: 'Murcia', slug: 'murcia', comunidad: 'Murcia' },
  { nombre: 'Navarra', slug: 'navarra', comunidad: 'Navarra' },
  { nombre: 'Ourense', slug: 'ourense', comunidad: 'Galicia' },
  { nombre: 'Palencia', slug: 'palencia', comunidad: 'Castilla y León' },
  { nombre: 'Pontevedra', slug: 'pontevedra', comunidad: 'Galicia' },
  { nombre: 'Salamanca', slug: 'salamanca', comunidad: 'Castilla y León' },
  { nombre: 'Santa Cruz de Tenerife', slug: 'santa-cruz-de-tenerife', comunidad: 'Canarias' },
  { nombre: 'Segovia', slug: 'segovia', comunidad: 'Castilla y León' },
  { nombre: 'Sevilla', slug: 'sevilla', comunidad: 'Andalucía' },
  { nombre: 'Soria', slug: 'soria', comunidad: 'Castilla y León' },
  { nombre: 'Tarragona', slug: 'tarragona', comunidad: 'Cataluña' },
  { nombre: 'Teruel', slug: 'teruel', comunidad: 'Aragón' },
  { nombre: 'Toledo', slug: 'toledo', comunidad: 'Castilla-La Mancha' },
  { nombre: 'Valencia', slug: 'valencia', comunidad: 'Comunidad Valenciana' },
  { nombre: 'Valladolid', slug: 'valladolid', comunidad: 'Castilla y León' },
  { nombre: 'Bizkaia', slug: 'bizkaia', comunidad: 'País Vasco' },
  { nombre: 'Zamora', slug: 'zamora', comunidad: 'Castilla y León' },
  { nombre: 'Zaragoza', slug: 'zaragoza', comunidad: 'Aragón' },
]

export const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export const aSlug = (texto) =>
  sinTildes(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/*
 * Nombres alternativos con los que llega la misma provincia.
 *
 * Unos vienen de Nominatim en el idioma cooficial, otros son la
 * comunidad autónoma en los casos en que solo tiene una provincia, y
 * ahí "Madrid" o "Murcia" significan la provincia sin ambigüedad.
 */
const ALIAS = {
  'la coruna': 'a-coruna',
  coruna: 'a-coruna',
  'provincia da coruna': 'a-coruna',
  araba: 'alava',
  'araba/alava': 'alava',
  guipuzcoa: 'gipuzkoa',
  'gipuzkoa/guipuzcoa': 'gipuzkoa',
  vizcaya: 'bizkaia',
  'bizkaia/vizcaya': 'bizkaia',
  gerona: 'girona',
  lerida: 'lleida',
  orense: 'ourense',
  'islas baleares': 'baleares',
  'illes balears': 'baleares',
  'comunidad de madrid': 'madrid',
  'region de murcia': 'murcia',
  'principado de asturias': 'asturias',
  'comunidad foral de navarra': 'navarra',
  nafarroa: 'navarra',
  cantabria: 'cantabria',
  'castello': 'castellon',
  'valencia/valencia': 'valencia',
  'alacant': 'alicante',
  'alicante/alacant': 'alicante',
  'santa cruz de tenerife': 'santa-cruz-de-tenerife',
  tenerife: 'santa-cruz-de-tenerife',
}

const PORSLUG = new Map(PROVINCIAS.map((p) => [p.slug, p]))
const PORNOMBRE = new Map(PROVINCIAS.map((p) => [sinTildes(p.nombre), p]))

/*
 * Convierte cualquier texto en una provincia de la lista, o null.
 *
 * Acepta el slug ("caceres"), el nombre ("Cáceres"), un alias
 * ("Vizcaya") y también la cadena completa que guardábamos antes
 * ("Zafra, Badajoz"), de la que prueba cada trozo. Eso último es lo que
 * permite que los enlaces viejos sigan funcionando.
 */
export const buscarProvincia = (texto) => {
  if (!texto) return null

  /* Nominatim devuelve "Provincia de Cáceres", "Província de Barcelona"
     o "Provincia da Coruña". El prefijo sobra siempre. */
  const sinPrefijo = String(texto).replace(
    /^\s*prov[íi]ncia\s*(?:de|da|d')?\s*/i,
    '',
  )
  const limpio = sinTildes(sinPrefijo)

  const directo =
    PORSLUG.get(aSlug(sinPrefijo)) ||
    PORNOMBRE.get(limpio) ||
    PORSLUG.get(ALIAS[limpio] || '')
  if (directo) return directo

  /* "Zafra, Badajoz" -> se prueba "Badajoz" y luego "Zafra". Del final
     al principio porque lo genérico va detrás. */
  const trozos = String(sinPrefijo)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .reverse()

  for (const trozo of trozos) {
    const t = sinTildes(trozo)
    const hallado =
      PORNOMBRE.get(t) || PORSLUG.get(ALIAS[t] || '') || PORSLUG.get(aSlug(trozo))
    if (hallado) return hallado
  }

  return null
}

/*
 * La provincia a partir de la respuesta de Nominatim.
 *
 * El orden importa. `county` es lo que más se parece a la provincia
 * española, y suele venir como "Provincia de Cáceres". `state` es la
 * comunidad autónoma, que solo sirve cuando tiene una única provincia.
 * `city` al final, para Madrid, Murcia o Zaragoza, donde la capital se
 * llama igual que la provincia.
 */
export const provinciaDeNominatim = (direccion = {}) => {
  const candidatos = [
    direccion.province,
    direccion.county,
    direccion.state_district,
    direccion.state,
    direccion.city,
    direccion.town,
  ]

  for (const c of candidatos) {
    if (!c) continue
    const limpio = String(c).replace(/^provincia\s+(de|da|d')\s*/i, '')
    const hallada = buscarProvincia(limpio)
    if (hallada) return hallada
  }

  return null
}
