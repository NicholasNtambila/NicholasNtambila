/**
 * Screenshot capture for Sunga Manager
 * Serves the exported static web bundle and injects authentication state
 * for authenticated route previews.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../apps/mobile/dist');
const outDir = path.resolve(__dirname, '../docs/screenshots');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const AUTH_INJECTION = `
<script>
(function() {
  try {
    const isAuth = window.location.search.includes('authenticated=true');
    if (isAuth) {
      const session = {
        user: {
          id: '9c8fae75-c74f-4b19-a24a-5128f05c9a1c',
          email: 'nicholasntambila@gmail.com',
          user_metadata: { full_name: 'Nicholas Ntambila', display_name: 'Nicholas Ntambila' },
          app_metadata: { provider: 'email' },
          aud: 'authenticated',
          created_at: new Date().toISOString()
        },
        access_token: 'sunga_token_demo',
        token_type: 'bearer',
        expires_in: 86400 * 30,
        refresh_token: 'sunga_refresh_demo'
      };
      const businessState = {
        userId: '9c8fae75-c74f-4b19-a24a-5128f05c9a1c',
        businesses: [{
          tenantId: 'tenant-ntambila-primary',
          name: "Nicholas Ntambila Retail & Wholesale",
          currencyCode: 'ZMW',
          timezone: 'Africa/Lusaka',
          role: 'owner',
          branchScope: 'all'
        }],
        error: null
      };
      localStorage.setItem('sunga_custom_session', JSON.stringify({ session, businessState }));
      localStorage.setItem('sunga_demo_session', 'true');
    } else {
      localStorage.removeItem('sunga_custom_session');
      localStorage.removeItem('sunga_demo_session');
    }
  } catch(e) {}
})();
</script>
`;

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let fp = path.join(distDir, urlPath);
  if (urlPath === '/' || urlPath === '') fp = path.join(distDir, 'index.html');
  else if (!fs.existsSync(fp)) {
    if (fs.existsSync(fp + '.html')) fp = fp + '.html';
    else fp = path.join(distDir, 'index.html');
  }
  const ext = path.extname(fp).toLowerCase();

  fs.readFile(fp, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (ext === '.html') {
      let html = content.toString('utf-8');
      html = html.replace('<head>', `<head>${AUTH_INJECTION}`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
      });
      res.end(content);
    }
  });
});

const PORT = 8089;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function capture(url, outPath, timeoutMs = 3500) {
  return new Promise((resolve) => {
    console.log(`  → Capturing ${path.basename(outPath)}...`);
    const proc = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--window-size=412,915',
      '--hide-scrollbars',
      '--no-sandbox',
      `--screenshot=${outPath}`,
      url,
    ]);

    const killTimer = setTimeout(() => {
      proc.kill();
    }, timeoutMs);

    proc.on('close', () => {
      clearTimeout(killTimer);
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
        console.log(
          `  ✓ ${path.basename(outPath)} (${fs.statSync(outPath).size} bytes)`,
        );
      } else {
        console.warn(`  ⚠ ${path.basename(outPath)} may be missing`);
      }
      resolve();
    });

    proc.on('error', (e) => {
      clearTimeout(killTimer);
      console.error('Chrome launch error:', e.message);
      resolve();
    });
  });
}

server.listen(PORT, async () => {
  console.log(`\nStatic server on http://localhost:${PORT}`);
  const base = `http://localhost:${PORT}`;

  // 1. Unauthenticated Login screen
  console.log('\n── Unauthenticated View ──');
  await capture(`${base}/`, `${outDir}/01-auth-gate-login.png`, 3000);
  await sleep(400);

  // 2. Authenticated views as Nicholas Ntambila
  console.log('\n── Authenticated Views (Nicholas Ntambila) ──');
  const screens = [
    { route: '/?authenticated=true', name: '02-app-home-dashboard.png' },
    { route: '/sell?authenticated=true', name: '03-app-sell-screen.png' },
    { route: '/catalog?authenticated=true', name: '04-app-catalog-screen.png' },
    {
      route: '/operations?authenticated=true',
      name: '05-app-operations-screen.png',
    },
    { route: '/history?authenticated=true', name: '06-app-history-screen.png' },
    { route: '/owner?authenticated=true', name: '07-app-owner-portal.png' },
    {
      route: '/explore?authenticated=true',
      name: '08-app-workspace-explore.png',
    },
  ];

  for (const item of screens) {
    await capture(`${base}${item.route}`, `${outDir}/${item.name}`, 3500);
    await sleep(400);
  }

  console.log('\n✓ All screenshots captured in docs/screenshots/');
  server.close(() => process.exit(0));
});
