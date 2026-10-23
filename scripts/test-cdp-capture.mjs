import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../apps/mobile/dist');
const outDir = path.resolve(__dirname, '../docs/screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    });
    res.end(content);
  });
});

async function run() {
  await new Promise((r) => server.listen(8099, r));
  console.log('Static server on port 8099');

  const tmpDir = path.join(os.tmpdir(), 'chrome-ss-' + Date.now());
  const chrome = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9223',
      '--remote-allow-origins=*',
      `--user-data-dir=${tmpDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=412,915',
      'about:blank',
    ],
  );

  let pageWsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const tabsRes = await fetch('http://127.0.0.1:9223/json/list');
      const tabs = await tabsRes.json();
      if (tabs.length > 0 && tabs[0]?.webSocketDebuggerUrl) {
        pageWsUrl = tabs[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (!pageWsUrl) throw new Error('Could not connect to Chrome CDP');
  console.log('Connected to tab WS:', pageWsUrl);

  const ws = new WebSocket(pageWsUrl);
  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) cb.reject(data.error);
      else cb.resolve(data.result);
    }
  };

  await new Promise((r) => {
    ws.onopen = r;
  });
  console.log('WS opened');

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Navigate to login page
  console.log('Navigating to http://localhost:8099/');
  await send('Page.navigate', { url: 'http://localhost:8099/' });

  // Wait 2.5s for React hydration
  await new Promise((r) => setTimeout(r, 2500));

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(outDir, '01-auth-gate-login.png');
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(
    'Captured 01-auth-gate-login.png (' + fs.statSync(outPath).size + ' bytes)',
  );

  ws.close();
  chrome.kill();
  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
