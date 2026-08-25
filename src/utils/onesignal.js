export const sendPushNotification = async (
  targetUserIds,
  title,
  message,
  urlPath = '/',
) => {
  if (!targetUserIds || targetUserIds.length === 0) {
    console.warn('Push cancelado: no hay usuarios destino.')
    return
  }

  try {
    const response = await fetch('/.netlify/functions/sendPush', {
      method: 'POST',
      body: JSON.stringify({ targetUserIds, title, message, urlPath }),
    })

    // Si no hay function (local) o falla, salimos limpio sin reventar
    if (!response.ok) {
      console.warn(
        `Push no enviado (status ${response.status}). Normal en local sin "netlify dev".`,
      )
      return
    }

    const data = await response.json()
    console.log('Respuesta de OneSignal:', data)
  } catch (error) {
    console.warn('Push no disponible en este entorno:', error.message)
  }
}