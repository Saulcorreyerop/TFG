export const sendPushNotification = async (
  targetUserIds,
  title,
  message,
  urlPath = '/',
) => {
  if (!targetUserIds || targetUserIds.length === 0) return

  try {
    await fetch('/.netlify/functions/sendPush', {
      method: 'POST',
      body: JSON.stringify({ targetUserIds, title, message, urlPath }),
    })
    console.log('Orden de notificación enviada al servidor.')
  } catch (error) {
    console.error(
      'Error al contactar con el servidor de notificaciones:',
      error,
    )
  }
}
