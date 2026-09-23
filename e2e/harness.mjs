// Harness e2e: prawdziwy klient www arkadia.rpg.pl serwowany lokalnie
// z katalogu e2e/client/, rozszerzenie ladowane jako unpacked w Chromium,
// websocket do gry zastapiony atrapa wstrzykiwana do strony (window.WebSocket).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIR = path.join(__dirname, 'client');
export const EXT_DIR = path.join(__dirname, '..', 'src', 'arkadia_treningi');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Atrapa websocketu: klient laczy sie z wss://arkadia.rpg.pl/wss, my podmieniamy
// konstruktor WebSocket, wiec polaczenie nigdy nie opuszcza strony. Test moze
// pchac komunikaty "z serwera" przez window.__mudPush(tekst) i czytac, co klient
// wyslal, przez window.__mudSockets[i].sent.
const FAKE_WS_INIT = `
(function () {
  var sockets = [];
  function FakeWebSocket(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.binaryType = 'blob';
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    sockets.push(this);
    var s = this;
    setTimeout(function () {
      if (s.readyState !== 0) return;
      s.readyState = 1;
      if (s.onopen) s.onopen({ type: 'open' });
    }, 0);
  }
  FakeWebSocket.CONNECTING = 0;
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSING = 2;
  FakeWebSocket.CLOSED = 3;
  FakeWebSocket.prototype.send = function (d) {
    this.sent.push(typeof d === 'string' ? d : '[binary]');
  };
  FakeWebSocket.prototype.close = function () {
    this.readyState = 3;
    if (this.onclose) this.onclose({ type: 'close' });
  };
  FakeWebSocket.prototype.addEventListener = function (type, fn) {
    this['on' + type] = fn;
  };
  FakeWebSocket.prototype.removeEventListener = function (type) {
    this['on' + type] = null;
  };
  Object.defineProperty(window, '__mudSockets', { value: sockets });
  window.__mudPush = function (data) {
    var s = sockets[sockets.length - 1];
    if (s && s.onmessage) s.onmessage({ type: 'message', data: data });
  };
  window.WebSocket = FakeWebSocket;
})();
`;

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Serwuje pliki klienta z dysku pod adresem https://arkadia.rpg.pl/*.
export async function routeKlient(context) {
  await context.route('https://arkadia.rpg.pl/**', async (route) => {
    const url = new URL(route.request().url());
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const filePath = path.normalize(path.join(CLIENT_DIR, rel));
    if (!filePath.startsWith(CLIENT_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return route.fulfill({ status: 404, body: 'brak zasobu' });
    }
    return route.fulfill({
      status: 200,
      contentType: contentType(filePath),
      body: fs.readFileSync(filePath)
    });
  });
}

// Deterministyczna odpowiedz update-check (bez sieci).
export async function routeUpdateCheck(context, version = '1.0.0') {
  await context.route('https://isithunzi000.github.io/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version,
        zip: 'arkadia_treningi_' + version.replace(/\./g, '_') + '.zip'
      })
    });
  });
}

// Uruchamia Chromium z zaladowanym rozszerzeniem (MV3, world: MAIN).
// CHROMIUM_PATH pozwala wskazac systemowe chromium; bez niej playwright
// uzyje wlasnej przegladarki (npx playwright install chromium).
export async function uruchomKlienta() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trng-e2e-prof-'));
  const launchOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-extensions-except=' + EXT_DIR,
      '--load-extension=' + EXT_DIR
    ]
  };
  if (process.env.CHROMIUM_PATH) {
    launchOpts.executablePath = process.env.CHROMIUM_PATH;
  } else {
    // playwright domyslnie uzywa chromium-headless-shell, ktory nie obsluguje
    // rozszerzen — kanal "chromium" to pelna przegladarka z nowym headless
    launchOpts.channel = 'chromium';
  }
  const context = await chromium.launchPersistentContext(userDataDir, launchOpts);
  await context.addInitScript(FAKE_WS_INIT);
  await routeKlient(context);
  await routeUpdateCheck(context);
  const page = await context.newPage();
  await page.goto('https://arkadia.rpg.pl/', { waitUntil: 'load' });
  return { context, page, userDataDir };
}

export async function zamknijKlienta(env) {
  try { await env.context.close(); } catch {}
  try { fs.rmSync(env.userDataDir, { recursive: true, force: true }); } catch {}
}
