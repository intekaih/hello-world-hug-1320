const mongoose = require('mongoose');

function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] MONGODB_URI chua duoc dat trong .env');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB bi ngat ket noi');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB da ket noi lai');
  });

  // Query timeout: query nao >8s thi tu fail
  mongoose.set('maxTimeMS', 8000);

  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    maxPoolSize: 3,   // 8 may x 3 = 24 connections, an toan cho Atlas M0
    minPoolSize: 1,
  }).then(() => {
    console.log('[DB] Ket noi MongoDB thanh cong');
  });
}

async function disconnect() {
  await mongoose.connection.close();
  console.log('[DB] Da dong ket noi MongoDB');
}

async function ping() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
  await mongoose.connection.db.admin().command({ ping: 1 });
  return { ok: true };
}

module.exports = { connect, disconnect, ping };
