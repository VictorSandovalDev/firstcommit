const { google } = require('googleapis');
const { put, list } = require('@vercel/blob');

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
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get tokens
  const tokens = await getBlob('youtube-tokens.json');
  if (!tokens) {
    return res.status(400).json({ error: 'No hay tokens. Visita /api/auth primero.' });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    await saveBlob('youtube-tokens.json', credentials);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // Get latest video from channel
  const searchRes = await youtube.search.list({
    part: 'snippet',
    channelId: process.env.CHANNEL_ID,
    order: 'date',
    maxResults: 1,
    type: 'video',
  });

  const video = searchRes.data.items?.[0];
  if (!video) {
    return res.status(200).json({ message: 'No videos found' });
  }

  const videoId = video.id.videoId;
  const videoTitle = video.snippet.title;

  // Check if already commented
  const lastState = await getBlob('last-video.json');
  if (lastState && lastState.videoId === videoId) {
    return res.status(200).json({ message: 'Sin videos nuevos', last: videoTitle });
  }

  // Post comment
  await youtube.commentThreads.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: {
            textOriginal: process.env.COMMENT_TEXT,
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

  return res.status(200).json({
    message: 'Comentario publicado!',
    video: videoTitle,
    url: `https://youtube.com/watch?v=${videoId}`,
  });
};
