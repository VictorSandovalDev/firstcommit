const { google } = require('googleapis');
const { put, list, head } = require('@vercel/blob');

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

async function getLatestVideo(youtube, channelId) {
  const res = await youtube.search.list({
    part: 'snippet',
    channelId,
    order: 'date',
    maxResults: 1,
    type: 'video',
  });

  if (res.data.items && res.data.items.length > 0) {
    const video = res.data.items[0];
    return {
      id: video.id.videoId,
      title: video.snippet.title,
      publishedAt: video.snippet.publishedAt,
    };
  }
  return null;
}

async function postComment(youtube, videoId, text) {
  return youtube.commentThreads.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: {
            textOriginal: text,
          },
        },
      },
    },
  });
}

module.exports = async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const channelId = process.env.CHANNEL_ID;
  const commentText = process.env.COMMENT_TEXT;

  if (!channelId || !commentText) {
    return res.status(400).json({ error: 'CHANNEL_ID y COMMENT_TEXT son requeridos' });
  }

  // Get stored tokens
  const tokens = await getBlob('youtube-tokens.json');
  if (!tokens) {
    return res.status(400).json({ error: 'No hay tokens. Visita /api/auth para autorizarte primero.' });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Refresh token if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    await saveBlob('youtube-tokens.json', credentials);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const latestVideo = await getLatestVideo(youtube, channelId);
  if (!latestVideo) {
    return res.status(200).json({ message: 'No se encontraron videos.' });
  }

  // Check last commented video
  const lastState = await getBlob('last-video.json');
  if (lastState && lastState.videoId === latestVideo.id) {
    return res.status(200).json({
      message: 'Sin videos nuevos.',
      lastVideo: latestVideo.title,
    });
  }

  // Post comment on new video
  await postComment(youtube, latestVideo.id, commentText);
  await saveBlob('last-video.json', {
    videoId: latestVideo.id,
    title: latestVideo.title,
    commentedAt: new Date().toISOString(),
  });

  return res.status(200).json({
    message: 'Comentario publicado!',
    video: latestVideo.title,
    url: `https://youtube.com/watch?v=${latestVideo.id}`,
  });
};
