import { supabase } from '../supabaseClient'

/*
 * Envío de una notificación push a otros usuarios.
 *
 * Adjunta el token de la sesión: el endpoint ya no acepta peticiones
 * anónimas. Si no hay sesión no se intenta siquiera.
 *
 * Nunca lanza. Una notificación que no sale no debe romper la acción que
 * la provocó: si alguien se apunta a un evento y el push falla, el usuario
 * tiene que quedar apuntado igual.
 */
export const sendPushNotification = async (
  targetUserIds,
  title,
  message,
  urlPath = '/',
) => {
  const destinatarios = (
    Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds]
  ).filter(Boolean)

  if (destinatarios.length === 0) return { enviados: 0 }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      // Sin sesión no se puede notificar, y es correcto que así sea
      return { enviados: 0 }
    }

    const respuesta = await fetch('/.netlify/functions/sendPush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        targetUserIds: destinatarios,
        title,
        message,
        urlPath,
      }),
    })

    if (!respuesta.ok) {
      // En local no existen las funciones de Netlify salvo con "netlify dev",
      // así que un 404 aquí es lo normal y no merece un error en consola.
      if (respuesta.status !== 404 && import.meta.env.DEV) {
        console.warn('Push no enviada. Estado:', respuesta.status)
      }
      return { enviados: 0 }
    }

    return await respuesta.json()
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Push no disponible en este entorno:', error.message)
    }
    return { enviados: 0 }
  }
}
