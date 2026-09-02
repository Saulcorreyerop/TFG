/*
 * Envío de notificaciones push.
 *
 * ANTES: este endpoint aceptaba cualquier POST sin comprobar nada. El
 * cuerpo llevaba la lista de destinatarios, el título y el mensaje, así
 * que cualquiera que abriese las DevTools podía mandar una notificación
 * con el texto que quisiera a todos los usuarios, en nombre de CarMeet.
 *
 * AHORA hay cuatro barreras:
 *
 *   1. Sesión válida. Se exige el token de Supabase y se valida contra
 *      /auth/v1/user. Se valida contra Supabase en lugar de descifrar el
 *      JWT aquí para no tener que guardar el secreto de firma en Netlify:
 *      si el usuario ha cerrado sesión o se le ha revocado el token, deja
 *      de valer al momento.
 *   2. Origen. Solo se aceptan peticiones desde los dominios propios.
 *   3. Forma del cuerpo. Tipos, longitudes y número de destinatarios.
 *      Antes se hacía JSON.parse a pelo, y un cuerpo mal formado tumbaba
 *      la función con un 502 sin mensaje.
 *   4. Ruta de destino. Solo se aceptan rutas internas, para que nadie
 *      pueda mandar una notificación que lleve a un sitio de fuera.
 *
 * Lo que NO cubre todavía: un límite de envíos por usuario y hora. Las
 * funciones de Netlify no comparten memoria entre invocaciones, así que
 * hace falta contarlo en la base de datos. Anotado en
 * docs/estado-base-de-datos.md.
 */

const SUPABASE_URL = 'https://stryumcmeavlvjaamcaw.supabase.co'
const APP_ID = '47ff2ef2-cd67-40c7-9c3c-ba31d7c86f22'

const ORIGENES = ['https://carmeet.es', 'https://www.carmeet.es']

const MAX_DESTINATARIOS = 200
const MAX_TITULO = 80
const MAX_MENSAJE = 240

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
})

/* Un uuid v4 tal y como los emite Supabase */
const esUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respuesta(405, { error: 'Método no permitido' })
  }

  // --- 1. Origen ---------------------------------------------------------
  const origen = event.headers.origin || event.headers.Origin
  const enProduccion = process.env.CONTEXT === 'production'
  if (enProduccion && origen && !ORIGENES.includes(origen)) {
    return respuesta(403, { error: 'Origen no permitido' })
  }

  // --- 2. Configuración del servidor -------------------------------------
  const restApiKey = process.env.ONESIGNAL_API_KEY
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!restApiKey || !supabaseKey) {
    // Sin detalles al cliente: el detalle va al log del servidor
    console.error(
      'Faltan variables de entorno:',
      !restApiKey ? 'ONESIGNAL_API_KEY' : '',
      !supabaseKey ? 'SUPABASE_ANON_KEY' : '',
    )
    return respuesta(500, { error: 'Servicio no disponible' })
  }

  // --- 3. Sesión ---------------------------------------------------------
  const auth = event.headers.authorization || event.headers.Authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) {
    return respuesta(401, { error: 'Falta la sesión' })
  }

  let emisor
  try {
    const verificacion = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
    })
    if (!verificacion.ok) {
      return respuesta(401, { error: 'Sesión no válida' })
    }
    emisor = await verificacion.json()
  } catch (error) {
    console.error('No se pudo verificar la sesión:', error.message)
    return respuesta(503, { error: 'Servicio no disponible' })
  }

  if (!emisor?.id) {
    return respuesta(401, { error: 'Sesión no válida' })
  }

  // --- 4. Cuerpo ---------------------------------------------------------
  let cuerpo
  try {
    cuerpo = JSON.parse(event.body || '{}')
  } catch {
    return respuesta(400, { error: 'Cuerpo mal formado' })
  }

  const { targetUserIds, title, message, urlPath = '/' } = cuerpo

  const destinatarios = [
    ...new Set(
      (Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds])
        .filter(esUuid)
        // Nadie se notifica a sí mismo
        .filter((id) => id !== emisor.id),
    ),
  ]

  if (destinatarios.length === 0) {
    return respuesta(200, { enviados: 0, motivo: 'Sin destinatarios válidos' })
  }

  if (destinatarios.length > MAX_DESTINATARIOS) {
    return respuesta(400, {
      error: `Demasiados destinatarios (máximo ${MAX_DESTINATARIOS})`,
    })
  }

  if (typeof title !== 'string' || typeof message !== 'string') {
    return respuesta(400, { error: 'Título y mensaje son obligatorios' })
  }

  const titulo = title.trim().slice(0, MAX_TITULO)
  const texto = message.trim().slice(0, MAX_MENSAJE)

  if (!titulo || !texto) {
    return respuesta(400, { error: 'Título y mensaje no pueden ir vacíos' })
  }

  // Solo rutas internas: nada de "https://otro-sitio.com" ni "//evil.com"
  const ruta =
    typeof urlPath === 'string' &&
    urlPath.startsWith('/') &&
    !urlPath.startsWith('//')
      ? urlPath
      : '/'

  // --- 5. Envío ----------------------------------------------------------
  try {
    const envio = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_external_user_ids: destinatarios,
        channel_for_external_user_ids: 'push',
        headings: { en: titulo, es: titulo },
        contents: { en: texto, es: texto },
        url: `https://carmeet.es${ruta}`,
      }),
    })

    const datos = await envio.json()

    if (!envio.ok) {
      // Los errores de OneSignal se registran, pero no se devuelven al
      // cliente: pueden incluir detalles de la cuenta.
      console.error('OneSignal devolvió error:', envio.status, datos?.errors)
      return respuesta(502, { error: 'No se pudo enviar la notificación' })
    }

    return respuesta(200, {
      enviados: datos?.recipients ?? destinatarios.length,
    })
  } catch (error) {
    console.error('Error al contactar con OneSignal:', error.message)
    return respuesta(503, { error: 'Servicio no disponible' })
  }
}
