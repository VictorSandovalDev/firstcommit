module.exports = function handler(req, res) {
  res.status(200).json({
    REDIRECT_URI: process.env.REDIRECT_URI || 'NOT SET',
    BASE_URL: process.env.BASE_URL || 'NOT SET',
    CLIENT_ID: process.env.CLIENT_ID ? process.env.CLIENT_ID.substring(0, 10) + '...' : 'NOT SET',
    BLOB_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? '***set***' : 'NOT SET',
    CHANNEL_ID: process.env.CHANNEL_ID || 'NOT SET',
    COMMENT_TEXT: process.env.COMMENT_TEXT || 'NOT SET',
    CRON_SECRET: process.env.CRON_SECRET ? '***set***' : 'NOT SET',
  });
};
