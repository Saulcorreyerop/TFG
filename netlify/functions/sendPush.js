export const handler = async (event) => {
  // Solo permitimos peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { targetUserIds, title, message, urlPath } = JSON.parse(event.body)

  const APP_ID = '47ff2ef2-cd67-40c7-9c3c-ba31d7c86f22'
  // eslint-disable-next-line no-undef
  const REST_API_KEY = process.env.ONESIGNAL_API_KEY

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
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        url: `https://carmeetesp.netlify.app${urlPath}`,
      }),
    })

    const data = await response.json()
    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (error) {
    console.error('Error en Netlify Function:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    }
  }
}
