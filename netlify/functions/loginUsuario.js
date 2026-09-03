/*
 * Entrar con nombre de usuario en lugar de con el correo.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * La tabla `profiles` es de lectura pública (tiene que serlo: es el
 * directorio de la comunidad) y guardaba una columna `email`. Es decir,
 * cualquiera, sin cuenta siquiera, podía pedir
 *
 *     GET /rest/v1/profiles?select=email
 *
 * y descargarse el correo de todos los usuarios registrados. Bajo el
 * RGPD eso es una brecha notificable.
 *
 * La columna existía por un solo motivo: el formulario de entrada acepta
 * el nombre de usuario, y Supabase necesita el correo para autenticar.
 * El navegador resolvía usuario -> correo leyendo `profiles`.
 *
 * POR QUÉ AQUÍ Y NO CON UNA FUNCIÓN RPC
 *
 * La solución evidente sería una función SECURITY DEFINER que reciba el
 * usuario y devuelva el correo. No sirve: los nombres de usuario son
 * públicos (están en /comunidad), así que quien quisiera los correos
 * solo tendría que recorrer esa lista llamando a la función. Se pasa de
 * "descárgalos todos de golpe" a "descárgalos de uno en uno", que no es
 * arreglarlo.
 *
 * La única forma de que el correo no salga nunca del servidor es que la
 * autenticación entera ocurra aquí. El navegador manda usuario y
 * contraseña, esta función busca el correo con la clave de servicio,
 * pide el token a Supabase y devuelve la sesión. El correo no aparece en
 * ninguna respuesta.
 *
 * MIENTRAS NO ESTÉN LAS VARIABLES DE ENTORNO
 *
 * Si falta la configuración se responde 501 con `sinConfigurar: true`, y
 * AuthPage vuelve al camino antiguo. Así se puede desplegar este código
 * antes de tocar nada en Netlify ni en la base de datos, sin romper la
 * entrada a nadie. El orden es: desplegar esto, añadir las variables,
 * y solo entonces eliminar la columna `profiles.email`.
 */

const SUPABASE_URL = 'https://stryumcmeavlvjaamcaw.supabase.co'

const ORIGENES = ['https://carmeet.es', 'https://www.carmeet.es']

const MAX_USUARIO = 40
const MAX_CONTRASENA = 200

/* Mismo texto para "no existe" y para "contraseña incorrecta". Si fueran
   distintos, este endpoint serviría para averiguar qué usuarios existen. */
const CREDENCIALES = 'Usuario o contraseña incorrectos.'

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
})

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
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  const claveAnon = process.env.SUPABASE_ANON_KEY

  if (!claveServicio || !claveAnon) {
    console.error(
      'Faltan variables de entorno:',
      !claveServicio ? 'SUPABASE_SERVICE_ROLE_KEY' : '',
      !claveAnon ? 'SUPABASE_ANON_KEY' : '',
    )
    /* El cliente lo interpreta y usa el camino antiguo */
    return respuesta(501, {
      error: 'Entrada por usuario no disponible',
      sinConfigurar: true,
    })
  }

  // --- 3. Forma del cuerpo -----------------------------------------------
  let cuerpo
  try {
    cuerpo = JSON.parse(event.body || '{}')
  } catch {
    return respuesta(400, { error: 'Cuerpo mal formado' })
  }

  const usuario = typeof cuerpo.usuario === 'string' ? cuerpo.usuario.trim() : ''
  const contrasena = typeof cuerpo.password === 'string' ? cuerpo.password : ''

  if (!usuario || !contrasena) {
    return respuesta(400, { error: 'Faltan el usuario o la contraseña' })
  }
  if (usuario.length > MAX_USUARIO || contrasena.length > MAX_CONTRASENA) {
    return respuesta(400, { error: 'Datos demasiado largos' })
  }
  /* Si lleva arroba es un correo: eso lo resuelve el navegador solo, sin
     pasar por aquí. */
  if (usuario.includes('@')) {
    return respuesta(400, { error: 'Para entrar con correo no hace falta esta ruta' })
  }

  try {
    // --- 4. Usuario -> id, con la clave de servicio ----------------------
    const perfil = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(usuario)}&select=id&limit=1`,
      {
        headers: {
          apikey: claveServicio,
          Authorization: `Bearer ${claveServicio}`,
          Accept: 'application/json',
        },
      },
    )

    if (!perfil.ok) {
      console.error('Fallo al consultar profiles:', perfil.status)
      return respuesta(502, { error: 'No se pudo comprobar el usuario' })
    }

    const filas = await perfil.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return respuesta(401, { error: CREDENCIALES })
    }

    // --- 5. id -> correo, desde auth.users -------------------------------
    const cuenta = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${filas[0].id}`,
      {
        headers: {
          apikey: claveServicio,
          Authorization: `Bearer ${claveServicio}`,
          Accept: 'application/json',
        },
      },
    )

    if (!cuenta.ok) return respuesta(401, { error: CREDENCIALES })

    const { email } = await cuenta.json()
    if (!email) return respuesta(401, { error: CREDENCIALES })

    // --- 6. Autenticar de verdad -----------------------------------------
    /* Con la clave pública, no con la de servicio: así se aplican los
       límites de intentos que ya trae Supabase. */
    const token = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: claveAnon,
          Authorization: `Bearer ${claveAnon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: contrasena }),
      },
    )

    const sesion = await token.json()

    if (!token.ok || !sesion.access_token) {
      /* Nunca se devuelve el mensaje de Supabase tal cual: distingue
         entre correo sin confirmar y contraseña mala, y eso confirmaría
         que la cuenta existe. La excepción es el correo sin confirmar,
         que el usuario necesita saber para poder actuar. */
      const codigo = sesion?.error_code || sesion?.error || ''
      if (String(codigo).includes('email_not_confirmed')) {
        return respuesta(401, {
          error: 'Tienes que confirmar tu correo antes de entrar.',
        })
      }
      return respuesta(401, { error: CREDENCIALES })
    }

    // --- 7. Sesión al navegador -------------------------------------------
    /* Solo los dos tokens. Ni el correo ni el resto del objeto de
       usuario: el cliente los obtiene por su cuenta al abrir la sesión. */
    return respuesta(200, {
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
    })
  } catch (error) {
    console.error('Fallo en loginUsuario:', error.message)
    return respuesta(502, { error: 'No se pudo completar la entrada' })
  }
}
