// LIVE end-to-end proof: a WebKit browser submits the real leaf form on the
// production site and the lead reaches the CRM (clientId returned by
// handle-intake after saveClient succeeds). Test data is clearly marked.
//
// Run explicitly (not part of the default matrix):
//   npx playwright test tests/live-intake-webkit.spec.js --config=tests/live.config.js
const { test, expect } = require('@playwright/test');

test('live leaf form submits from WebKit and lands in the CRM', async ({ page, browserName }) => {
  expect(browserName).toBe('webkit');

  await page.goto('https://staticswift.co.uk/plumber-website-design-burnley/', { waitUntil: 'domcontentloaded' });
  await page.fill('#ss-seo-form input[name="name"]', 'TEST LEAD - Phase0 WebKit E2E (ignore/delete)');
  await page.fill('#ss-seo-form input[name="delivery_email"]', 'hello@staticswift.co.uk');

  const responsePromise = page.waitForResponse(r => r.url().includes('handle-intake'), { timeout: 30000 });
  await page.click('#ss-seo-form .ss-submit');
  const res = await responsePromise;
  const body = await res.json();

  await expect(page.locator('#ss-seo-ok')).toBeVisible({ timeout: 20000 });
  expect(res.status()).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.clientId).toMatch(/^client_/);
  console.log('CRM write confirmed, clientId:', body.clientId);
});
