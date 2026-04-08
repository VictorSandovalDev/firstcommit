module.exports = function handler(req, res) {
  const clientId = process.env.CLIENT_ID || 'NOT SET';
  const clientSecret = process.env.CLIENT_SECRET || 'NOT SET';
  const redirectUri = process.env.REDIRECT_URI || 'NOT SET';

  res.status(200).json({
    CLIENT_ID: clientId ? clientId.substring(0, 10) + '...' : 'NOT SET',
    CLIENT_SECRET: clientSecret ? '***set***' : 'NOT SET',
    REDIRECT_URI: redirectUri,
    CLIENT_ID_LENGTH: clientId.length,
  });
};
