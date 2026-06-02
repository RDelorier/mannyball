// Headless screenshot harness for the game, driven over the Chrome DevTools
// Protocol. Useful for eyeballing rendering changes (field, weather, timing bar)
// without a manual browser session.
//
//   node cdp-screenshot.mjs [outPath] [condition] [difficulty]
//
//   outPath    where to write the PNG (default: ./screenshot.png)
//   condition  weather id to start with, e.g. storm/snow/clear (default: clear)
//   difficulty easy|medium|hard|extreme (default: medium)
//
// It boots serve.js on a scratch port, waits for the game module to finish
// loading (window.__game), starts a 1P game, then captures the field.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9357;          // devtools port
const HTTP_PORT = 8126;     // scratch http port for serve.js
const URL = `http://localhost:${HTTP_PORT}/index.html`;

const [, , outPath = 'screenshot.png', condition = 'clear', difficulty = 'medium'] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('node', ['serve.js'], { env: { ...process.env, PORT: String(HTTP_PORT) } });
await sleep(500);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--user-data-dir=/tmp/__cdp_shot_profile', '--window-size=900,720', URL,
]);

async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* devtools not up yet */ }
    await sleep(100);
  }
  throw new Error('no devtools target');
}

const sock = new globalThis.WebSocket(await wsUrl());
let id = 0;
const pending = new Map();
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') {
    console.error('PAGE EXCEPTION:', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
});
await new Promise((r) => sock.addEventListener('open', r));
const cmd = (method, params = {}) => new Promise((res) => {
  const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params }));
});
const evalJs = async (expression) =>
  (await cmd('Runtime.evaluate', { expression, returnByValue: true })).result?.value;

await cmd('Page.enable');
await cmd('Runtime.enable');

// Wait for the game module (and its event wiring) to finish loading.
for (let i = 0; i < 50; i++) {
  if (await evalJs('!!window.__game')) break;
  await sleep(100);
}

// Configure options, start a 1P game, and let the field settle.
await evalJs(`
  document.getElementById('difficulty-select').value = ${JSON.stringify(difficulty)};
  document.getElementById('condition-select').value = ${JSON.stringify(condition)};
  document.getElementById('start-btn').click();
`);
await sleep(900);

const state = await evalJs(`JSON.stringify({
  game: !document.getElementById('game-screen').classList.contains('hidden'),
  weather: document.getElementById('weather').className,
})`);
console.log('state:', state);

const shot = await cmd('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
console.log('saved', outPath);

chrome.kill();
server.kill();
process.exit(0);
