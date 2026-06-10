const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: /live-.*\.spec\.js/,
  timeout: 60_000,
  projects: [{ name: 'webkit-live', use: { browserName: 'webkit', viewport: { width: 375, height: 667 } } }],
});
