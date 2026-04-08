const { google } = require('googleapis');
const { put, list } = require('@vercel/blob');
const { parseStringPromise } = require('xml2js');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
}

async function getBlob(pathname) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const { blobs } = await list({ prefix: pathname, token: blobToken });
  if (blobs.length === 0) return null;
  const response = await fetch(blobs[0].downloadUrl);
  return response.json();
}

async function saveBlob(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

module.exports = async function handler(req, res) {
  // GET = YouTube verification challenge
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    if (challenge) {
      console.log('WebSub verification received');
      return res.status(200).send(challenge);
    }
    return res.status(200).json({
      status: 'Webhook activo y esperando notificaciones de YouTube',
      channel: process.env.CHANNEL_ID,
    });
  }

  // POST = New video notification from YouTube
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });

    await new Promise((resolve) => req.on('end', resolve));

    const parsed = await parseStringPromise(body);
    const entry = parsed?.feed?.entry?.[0];

    if (!entry) {
      return res.status(200).send('No entry found');
    }

    const videoId = entry['yt:videoId']?.[0];
    const videoTitle = entry['title']?.[0];

    if (!videoId) {
      return res.status(200).send('No video ID');
    }

    // Check if we already commented on this video
    const lastState = await getBlob('last-video.json');
    if (lastState && lastState.videoId === videoId) {
      return res.status(200).json({ message: 'Ya se comento este video', videoId });
    }

    // Get tokens
    const tokens = await getBlob('youtube-tokens.json');
    if (!tokens) {
      console.error('No tokens found. Visit /api/auth first.');
      return res.status(200).send('No auth tokens');
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      await saveBlob('youtube-tokens.json', credentials);
    }

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Post comment
    const commentText = process.env.COMMENT_TEXT;
    await youtube.commentThreads.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: {
              textOriginal: commentText,
            },
          },
        },
      },
    });

    await saveBlob('last-video.json', {
      videoId,
      title: videoTitle,
      commentedAt: new Date().toISOString(),
    });

    console.log(`Comentario publicado en: ${videoTitle} (${videoId})`);
    return res.status(200).json({ message: 'Comentario publicado', videoId, videoTitle });
  }

  return res.status(405).send('Method not allowed');
};
