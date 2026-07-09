/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/database.js',
    '!src/controllers/**/*.js',
    '!src/routes/**/*.js',
    '!src/middleware/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
};
