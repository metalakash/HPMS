/**
 * E2E Test Configuration
 * Initialize test environment and global setup for Detox
 */

const detox = require('detox');
const config = require('../package.json').detox;
const adapter = require('detox/runners/jest/adapter');

jest.setTimeout(120000);
jasmine.getEnv().addReporter(adapter);

beforeAll(async () => {
  await detox.init(config, { launchApp: true });
});

beforeEach(async () => {
  await adapter.beforeEach();
});

afterAll(async () => {
  await detox.cleanup();
});
