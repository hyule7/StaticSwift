// Static file server for the test matrix that also stubs the Netlify
// function endpoints. Needed because keepalive fetches (order form) bypass
// Playwright route interception, so the stub must live server-side.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8899;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/.netlify/functions/')) {
    const fn = url.pathname.split('/').pop();
    if (fn === 'track-event') { res.writeHead(204).end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clientId: 'test_stub' }));
    return;
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  let file = join(ROOT, p);
  try {
    let body;
    try { body = await readFile(file); }
    catch { body = await readFile(join(ROOT, p, 'index.html')); file = join(p, 'index.html'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`test server on http://127.0.0.1:${PORT}`));
