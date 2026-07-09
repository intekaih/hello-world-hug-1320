const crypto = require('crypto');

function extractApiKey(req) {
  const headerKey = req.headers['x-business-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function secureEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireBusinessApiKey(req, res, next) {
  const expectedKey = process.env.BUSINESS_API_KEY || process.env.ACCOUNT_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      message: 'Business API chua duoc cau hinh BUSINESS_API_KEY',
    });
  }

  const providedKey = extractApiKey(req);
  if (!providedKey || !secureEquals(providedKey, expectedKey)) {
    return res.status(401).json({
      success: false,
      message: 'API key khong hop le',
    });
  }

  req.businessApiClient = (req.headers['x-business-client'] || 'business-api').toString().substring(0, 80);
  next();
}

module.exports = { requireBusinessApiKey };
