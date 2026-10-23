import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../apps/mobile/dist');
const outDir = path.resolve(__dirname, '../docs/screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const MIME_TYPES = {
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

// Create static file server with clean URL support (mapping /sell -> /sell.html)
const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(distDir, urlPath);

  // If path is root or directory
  if (urlPath === '/' || urlPath === '') {
    filePath = path.join(distDir, 'index.html');
  } else if (!fs.existsSync(filePath)) {
    // Try adding .html extension
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else {
      filePath = path.join(distDir, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const PORT = 8089;
const CHROME_PATH =
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function capturePage(url, outPath, windowSize = '412,915') {
  return new Promise((resolve, reject) => {
    console.log(`Capturing ${url} -> ${path.basename(outPath)}...`);
    const proc = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${windowSize}`,
      '--hide-scrollbars',
      '--virtual-time-budget=4000',
      `--screenshot=${outPath}`,
      url,
    ]);

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        console.log(
          `✓ Saved ${path.basename(outPath)} (${fs.statSync(outPath).size} bytes)`,
        );
        resolve();
      } else {
        console.warn(`! Process exited with code ${code} for ${url}`);
        resolve(); // resolve anyway to proceed
      }
    });

    proc.on('error', (err) => {
      console.error(`Failed to launch Chrome:`, err);
      reject(err);
    });
  });
}

server.listen(PORT, async () => {
  console.log(`Static server listening on http://localhost:${PORT}`);

  const routes = [
    { route: '/', name: '01-auth-gate-login.png' },
    { route: '/sell', name: '02-cashier-sell-screen.png' },
    { route: '/catalog', name: '03-product-catalog.png' },
    { route: '/operations', name: '04-inventory-operations.png' },
    { route: '/history', name: '05-sales-history.png' },
    { route: '/owner', name: '06-owner-portal.png' },
    { route: '/explore', name: '07-workspace-explore.png' },
  ];

  try {
    for (const item of routes) {
      const targetUrl = `http://localhost:${PORT}${item.route}`;
      const dest = path.join(outDir, item.name);
      await capturePage(targetUrl, dest);
    }
    console.log('All screenshots captured successfully!');
  } catch (e) {
    console.error('Error during capture:', e);
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
});
