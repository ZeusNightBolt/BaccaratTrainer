// Headless browser smoke test — boots the real app and drives the core loop to
// catch wiring/rendering regressions a unit test can't. Serves the static files
// itself and loads Playwright's chromium (bundled dep in CI, global fallback for
// local runs). Exits non-zero on the first failed check.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8199;
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

async function loadChromium() {
  try {
    const m = await import('playwright');
    return m.chromium;
  } catch {
    const m = await import('/opt/node22/lib/node_modules/playwright/index.js');
    return (m.default || m).chromium;
  }
}

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  await new Promise((r) => server.listen(PORT, r));
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // ignore network noise (e.g. a font weight that fails to fetch in a sandbox)
    if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  check('app shell renders', await page.$('#app') !== null);
  check('seven chips in the rail', (await page.$$('#chip-rail .chip')).length === 7,
    `${(await page.$$('#chip-rail .chip')).length} chips`);

  // roads collapsed by default, table centered
  const roadsClosed = await page.evaluate(() => !document.getElementById('app').classList.contains('roads-open'));
  check('roads collapsed by default', roadsClosed);

  // toggle roads open then closed
  await page.click('#road-toggle');
  await page.waitForTimeout(300);
  check('road toggle opens the board', await page.evaluate(() => document.getElementById('app').classList.contains('roads-open')));
  await page.click('#road-toggle');
  await page.waitForTimeout(300);

  // place a bet and deal a full hand
  await page.click('#chip-rail .chip[data-value="100"]');
  await page.click('[data-spot="player"]');
  check('bet registers on the felt', (await page.textContent('#total-bet')) !== '$0');
  await page.click('#btn-deal');
  await page.waitForTimeout(4500);
  const dealt = await page.evaluate(() => ({
    hands: document.getElementById('stat-shoe').textContent,
    cells: document.querySelectorAll('#road-main .road-cell').length,
    pills: document.querySelectorAll('#ticker-track .ticker-pill').length,
  }));
  check('a hand deals and reaches the board', dealt.cells >= 1 && dealt.pills >= 1, JSON.stringify(dealt));
  check('shoe hand counter advances', /·\s*1h/.test(dealt.hands), dealt.hands);

  // genie opens
  await page.click('#genie-orb');
  await page.waitForTimeout(300);
  check('genie panel opens with a call', await page.evaluate(() => {
    const p = document.getElementById('genie-panel');
    return p && !p.hidden && !!document.querySelector('.genie-rec-spot');
  }));

  check('no uncaught page/console errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.error(`\nSMOKE FAILED: ${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nSMOKE PASSED: ${checks.length} checks`);
}

run().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
