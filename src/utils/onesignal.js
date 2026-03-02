export const sendPushNotification = async (
  targetUserIds,
  title,
  message,
  urlPath = '/',
) => {
  console.log(
    '1. Entrando a sendPushNotification. Usuarios destino:',
    targetUserIds,
  )

  if (!targetUserIds || targetUserIds.length === 0) {
    console.warn('2. Cancelado: No hay usuarios a los que enviar.')
    return
  }

  try {
    console.log('3. Disparando fetch a Netlify...')
    const response = await fetch('/.netlify/functions/sendPush', {
      method: 'POST',
      body: JSON.stringify({ targetUserIds, title, message, urlPath }),
    })

    // 🚀 AHORA LEEMOS EL JSON QUE NOS DEVUELVE NETLIFY
    const data = await response.json()
    console.log('4. Respuesta exacta de OneSignal:', data)
  } catch (error) {
    console.error('❌ Error al contactar con Netlify:', error)
  }
}
