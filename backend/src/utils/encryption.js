const crypto = require('crypto');

if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPT_KEY) {
    console.error('[FATAL] Missing ENCRYPT_KEY in production. Set a strong random key in .env');
    process.exit(1);
}

const STREAM_KEY = process.env.ENCRYPT_KEY || process.env.SESSION_SECRET || 'moviecc_dev_stream_key';
const HASH_TTL = 8 * 60 * 60 * 1000;

function encryptStreamUrl(url) {
    const payload = Date.now() + '|' + url;
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(STREAM_KEY).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptStreamUrl(hash) {
    try {
        const parts = hash.split(':');
        if (parts.length !== 2) return null;
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = crypto.createHash('sha256').update(STREAM_KEY).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const pipeIdx = decrypted.indexOf('|');
        if (pipeIdx === -1) return decrypted;

        const ts = parseInt(decrypted.substring(0, pipeIdx), 10);
        const url = decrypted.substring(pipeIdx + 1);

        if (isNaN(ts) || (Date.now() - ts) > HASH_TTL) return null;

        return url;
    } catch {
        return null;
    }
}

function decryptStreamUrlNoTTL(hash) {
    try {
        const parts = hash.split(':');
        if (parts.length !== 2) return null;
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = crypto.createHash('sha256').update(STREAM_KEY).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const pipeIdx = decrypted.indexOf('|');
        if (pipeIdx === -1) return decrypted;
        return decrypted.substring(pipeIdx + 1);
    } catch {
        return null;
    }
}

module.exports = {
    encryptStreamUrl,
    decryptStreamUrl,
    decryptStreamUrlNoTTL
};
