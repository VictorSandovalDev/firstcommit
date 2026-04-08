module.exports = async function handler(req, res) {
  const channelId = process.env.CHANNEL_ID;
  const vercelUrl = process.env.BASE_URL.replace(/\/+$/, '');

  const callbackUrl = `${vercelUrl}/api/webhook`;

  const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
  const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';

  const params = new URLSearchParams({
    'hub.callback': callbackUrl,
    'hub.topic': topicUrl,
    'hub.verify': 'async',
    'hub.mode': 'subscribe',
    'hub.lease_seconds': '864000', // 10 days
  });

  const response = await fetch(hubUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (response.status === 202 || response.status === 204) {
    return res.status(200).json({
      message: 'Suscripcion enviada exitosamente!',
      callback: callbackUrl,
      channel: channelId,
      leaseDays: 10,
      hint: 'La suscripcion expira en 10 dias. Usa el cron para renovarla automaticamente.',
    });
  }

  return res.status(500).json({
    error: 'Error al suscribirse',
    status: response.status,
    body: await response.text(),
  });
};
