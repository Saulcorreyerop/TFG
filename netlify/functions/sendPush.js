export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { targetUserIds, title, message, urlPath } = JSON.parse(event.body)

  const APP_ID = '47ff2ef2-cd67-40c7-9c3c-ba31d7c86f22'
  // eslint-disable-next-line no-undef
  const REST_API_KEY = process.env.ONESIGNAL_API_KEY

  // 🕵️‍♂️ EL CHIVATO DEL SERVIDOR (Añadido para depurar)
  console.log('--- TEST DE SEGURIDAD ---')
  console.log('¿Netlify detecta la variable?:', REST_API_KEY ? 'SÍ' : 'NO')
  console.log(
    'Longitud de la clave leída:',
    REST_API_KEY ? REST_API_KEY.length : 0,
  )
  if (REST_API_KEY) {
    console.log('Los primeros 4 caracteres son:', REST_API_KEY.substring(0, 4))
  }
  console.log('-------------------------')

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_external_user_ids: Array.isArray(targetUserIds)
          ? targetUserIds
          : [targetUserIds],
        channel_for_external_user_ids: 'push',
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        url: `https://carmeetesp.netlify.app${urlPath}`,
      }),
    })

    const data = await response.json()
    console.log('Respuesta de OneSignal:', data)

    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (error) {
    console.error('Error en Netlify Function:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    }
  }
}
