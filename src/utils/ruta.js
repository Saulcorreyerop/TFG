/*
 * Cálculos sobre el trazado de una ruta.
 *
 * Viven aquí y no en DibujarRuta.jsx porque ese archivo exporta un
 * componente, y la recarga en caliente de React deja de funcionar en los
 * archivos que mezclan componentes con otras exportaciones.
 *
 * Los puntos son pares [lat, lng], que es el orden que espera Leaflet.
 * GeoJSON usa el contrario, [lng, lat], y esa inversión es la fuente
 * clásica de rutas dibujadas en mitad del mar.
 */

const RADIO_TIERRA = 6371000

/* Haversine: para tramos de unos pocos kilómetros el error frente a
   cálculos más finos es de centímetros. */
const distanciaEntre = ([lat1, lng1], [lat2, lng2]) => {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a))
}

export const longitudDe = (puntos) => {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0
  let total = 0
  for (let i = 1; i < puntos.length; i++) {
    total += distanciaEntre(puntos[i - 1], puntos[i])
  }
  return Math.round(total)
}

export const enKm = (metros) => {
  if (!metros) return '0 km'
  return metros < 1000
    ? `${metros} m`
    : `${(metros / 1000).toFixed(metros < 10000 ? 1 : 0).replace('.', ',')} km`
}

/* Lo que se guarda en la columna `ruta` puede venir de versiones
   distintas, o directamente mal. Se normaliza aquí para que ninguna
   pantalla tenga que comprobar la forma antes de pintar. */
export const leerRuta = (valor) => {
  const puntos = Array.isArray(valor?.puntos) ? valor.puntos : []
  const validos = puntos.filter(
    (p) =>
      Array.isArray(p) &&
      p.length === 2 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]),
  )

  if (validos.length < 2) return null

  return {
    puntos: validos,
    distancia: Number.isFinite(valor?.distancia)
      ? valor.distancia
      : longitudDe(validos),
  }
}
