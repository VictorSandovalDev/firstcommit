const { google } = require('googleapis');
const { put } = require('@vercel/blob');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
}

module.exports = async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN no esta configurado' });
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    await put('youtube-tokens.json', JSON.stringify(tokens), {
      access: 'private',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).json({
      message: 'Autorizacion exitosa! Los tokens se guardaron correctamente.',
      hint: 'El cron job revisara automaticamente por nuevos videos.',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error en callback',
      details: error.message,
    });
  }
};
