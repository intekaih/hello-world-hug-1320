const helmet = require('helmet');
const MongoStore = require('connect-mongo');
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
    const required = ['SESSION_SECRET', 'ENCRYPT_KEY'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
        process.exit(1);
    }
}

if (!process.env.MONGODB_URI && process.env.NODE_ENV !== 'test') {
    console.error('[FATAL] Missing MONGODB_URI environment variable. Vui lòng thêm MONGODB_URI vào file .env');
    process.exit(1);
}

const sessionStore = process.env.NODE_ENV === 'test' ? null : MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    mongoOptions: { maxPoolSize: parseInt(process.env.SESSION_POOL_SIZE, 10) || 15 }, // tăng từ 5 để xử lý nhiều concurrent sessions hơn
});

if (sessionStore) {
    const originalTouch = sessionStore.touch.bind(sessionStore);
    sessionStore.touch = function (sid, session, cb) {
        originalTouch(sid, session, (err) => {
            if (err && err.message === 'Unable to find the session to touch') return cb();
            cb(err);
        });
    };
}

const config = {
    // Session Configuration
    session: {
        name: '__sid',
        ...(sessionStore ? { store: sessionStore } : {}),
        secret: process.env.SESSION_SECRET || 'moviecc_dev_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        }
    },

    // Rate Limit Configuration (một nguồn duy nhất)
    rateLimit: {
        global: {
            windowMs: 15 * 60 * 1000, // 15 phút
            limit: parseInt(process.env.GLOBAL_RATE_LIMIT, 10) || 3000, // giảm từ 10000 để prevent abuse
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: 'Too many requests from this IP, please try again after 15 minutes',
        },
        login: {
            windowMs: 5 * 60 * 1000, // 5 phút
            limit: 5,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
        },
        admin: {
            windowMs: 15 * 60 * 1000,
            limit: 100,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Quá nhiều yêu cầu admin. Vui lòng thử lại sau.' },
        },
        suggest: {
            windowMs: 60 * 1000, // 1 phút
            limit: 30,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Quá nhiều yêu cầu tìm kiếm. Vui lòng chậm lại.' },
        },
    },

    // Helmet Security Configuration
    // Note: scriptSrc gets nonce injected per-request in server.js middleware
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://challenges.cloudflare.com"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                mediaSrc: ["'self'", "blob:", "https:"],
                connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://challenges.cloudflare.com"],
                frameSrc: ["'self'", "https:"],
                upgradeInsecureRequests: null,
                workerSrc: ["'self'", "blob:"],
            },
        },
    },

    port: process.env.PORT || 5000
};

module.exports = config;
