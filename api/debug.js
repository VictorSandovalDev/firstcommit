module.exports = function handler(req, res) {
  res.status(200).json({
    REDIRECT_URI: process.env.REDIRECT_URI || 'NOT SET',
    BASE_URL: process.env.BASE_URL || 'NOT SET',
    CLIENT_ID: process.env.CLIENT_ID ? process.env.CLIENT_ID.substring(0, 10) + '...' : 'NOT SET',
  });
};
