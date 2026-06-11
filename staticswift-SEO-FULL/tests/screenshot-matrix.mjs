// Captures the three core templates in all three engines at mobile + desktop
// into docs/audit/browser-matrix/. Run: node tests/screenshot-matrix.mjs
// (expects tests/static-server.mjs already running on :8899)
import { chromium, firefox, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../docs/audit/browser-matrix/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const templates = [
  ['homepage', '/'],
  ['town-hub', '/website-design-manchester/'],
  ['leaf', '/plumber-website-design-burnley/'],
];
const viewports = [['mobile-375', 375, 667], ['desktop-1440', 1440, 900]];

for (const [engineName, engine] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const browser = await engine.launch();
  for (const [vpName, width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    for (const [tplName, path] of templates) {
      await page.goto('http://127.0.0.1:8899' + path, { waitUntil: 'load' }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}${tplName}--${engineName}--${vpName}.png`, timeout: 15000 })
        .catch(e => console.log(`SKIP ${tplName} ${engineName} ${vpName}: ${e.message.split('\n')[0]}`));
      console.log(`${tplName} ${engineName} ${vpName}`);
    }
    await page.close();
  }
  await browser.close();
}
console.log('done');
