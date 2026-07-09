/**
 * Test App Factory
 *
 * Tao Express app toi thieu cho integration tests.
 * Import routes rieng le thay vi full server de tran side effects.
 */

const express = require('express');
const session = require('express-session');

function createTestApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(session({
    secret: 'test-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }));

  if (mountPath && router) {
    app.use(mountPath, router);
  } else if (router) {
    app.use(router);
  }

  return app;
}

module.exports = { createTestApp };
