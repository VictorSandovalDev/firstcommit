// Cron job that renews the WebSub subscription before it expires
module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const channelId = process.env.CHANNEL_ID;
  const vercelUrl = process.env.BASE_URL;

  const callbackUrl = `${vercelUrl}/api/webhook`;
  const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
  const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';

  const params = new URLSearchParams({
    'hub.callback': callbackUrl,
    'hub.topic': topicUrl,
    'hub.verify': 'async',
    'hub.mode': 'subscribe',
    'hub.lease_seconds': '864000',
  });

  const response = await fetch(hubUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const ok = response.status === 202 || response.status === 204;

  return res.status(ok ? 200 : 500).json({
    message: ok ? 'Suscripcion renovada' : 'Error al renovar',
    status: response.status,
  });
};
