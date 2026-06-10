// Browser/device matrix for the three core templates.
// Runs against a local static server of the built tree; the intake function
// is mocked via page.route inside the specs (the live-endpoint E2E proof is
// tests/live-intake-webkit.spec.js, run explicitly).
const { defineConfig, devices } = require('@playwright/test');

const viewports = {
  'iphone-se': { width: 375, height: 667, isMobile: true, hasTouch: true },
  'android': { width: 412, height: 915, isMobile: true, hasTouch: true },
  'desktop': { width: 1440, height: 900 },
};

const projects = [];
for (const [engine, device] of [['chromium', {}], ['firefox', {}], ['webkit', {}]]) {
  for (const [vpName, vp] of Object.entries(viewports)) {
    // Firefox does not support isMobile in Playwright.
    const { isMobile, hasTouch, ...rest } = vp;
    const use = engine === 'firefox'
      ? { viewport: { width: vp.width, height: vp.height } }
      : { viewport: { width: vp.width, height: vp.height }, isMobile, hasTouch };
    projects.push({ name: `${engine}-${vpName}`, use: { browserName: engine, ...use } });
  }
}

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: /live-.*\.spec\.js/,
  timeout: 45_000,
  retries: 1,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8899',
  },
  webServer: {
    command: 'node tests/static-server.mjs',
    url: 'http://127.0.0.1:8899/',
    reuseExistingServer: true,
    timeout: 20_000,
  },
  projects,
});
