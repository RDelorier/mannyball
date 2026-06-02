// Drive the real game headless via the Chrome DevTools Protocol to verify the
// timing-bar fix: a throw is no longer always "overthrown into the crowd".
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const HTTP_PORT = 8123;
const URL = `http://localhost:${HTTP_PORT}/index.html`;

const server = spawn('node', ['serve.js'], { env: { ...process.env, PORT: String(HTTP_PORT) } });
await new Promise((r) => setTimeout(r, 500));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--user-data-dir=/tmp/__cdp_profile', URL,
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('no devtools target');
}

const ws = new WebSocket(await getWsUrl());
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
    errors.push(msg.params.args.map((a) => a.value).join(' '));
  if (msg.method === 'Runtime.exceptionThrown')
    errors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Page.enable');
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

// Reload to ensure listeners capture startup.
await send('Page.reload');
await sleep(800);

await evalJs(`window.__err = []; window.addEventListener('error', e => window.__err.push(e.message)); window.addEventListener('unhandledrejection', e => window.__err.push('rej:' + e.reason)); true`);
// Force a deterministic, human-controlled game: 2p mode so every press is human.
await evalJs(`(() => {
  document.getElementById('mode-select').value = '2p';
  document.getElementById('difficulty-select').value = 'easy';
  document.getElementById('start-btn').click();
  return true;
})()`);
await sleep(600);
console.log('DEBUG state:', await evalJs(`JSON.stringify({
  start: document.getElementById('start-screen').className,
  game: document.getElementById('game-screen').className,
  kickoff: document.getElementById('kickoff-choice').className,
  playcall: document.getElementById('playcall').className,
  msg: document.getElementById('message') && document.getElementById('message').textContent,
  modeVal: document.getElementById('mode-select').value,
  pageErr: window.__err,
})`));

// Helper: press the offense key repeatedly with good timing to land green-ish,
// over the whole sweep, so the throw should usually complete (not overthrow).
// We run several downs and tally how many passes were "overthrown".
async function pressKeyAimed(possessionKey) {
  // Hold for a few hundred ms doing nothing (let bar arm), then press near mid-sweep.
  await sleep(360);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: possessionKey, windowsVirtualKeyCode: possessionKey.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: possessionKey, windowsVirtualKeyCode: possessionKey.toUpperCase().charCodeAt(0) });
}

let overthrown = 0, passesRun = 0, kickoffs = 0;
for (let tick = 0; tick < 60 && passesRun < 6; tick++) {
  const koVisible = await evalJs(`!document.getElementById('kickoff-choice').classList.contains('hidden')`);
  if (koVisible) {
    await evalJs(`[...document.querySelectorAll('#kickoff-choice button')].find(b=>b.dataset.kick==='regular').click()`);
    kickoffs++;
    await sleep(1200);
    continue;
  }
  const playVisible = await evalJs(`!document.getElementById('playcall').classList.contains('hidden')`);
  if (!playVisible) { await sleep(350); continue; }

  const possession = await evalJs(`document.querySelector('.team.home.has-ball') ? 'a' : 'l'`);
  await evalJs(`[...document.querySelectorAll('#playcall button')].find(b=>b.dataset.play==='pass').click()`);
  passesRun++;
  await pressKeyAimed(possession);          // evade the rush
  // Simulate the BUG trigger: a leaked/ghost press the instant the throw bar
  // opens. With the fix this is ignored (arming window); pre-fix it graded red
  // -> "overthrown into the crowd". Fire it immediately, with no arming wait.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: possession, windowsVirtualKeyCode: possession.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: possession, windowsVirtualKeyCode: possession.toUpperCase().charCodeAt(0) });
  await pressKeyAimed(possession);          // genuine throw press after arming
  await sleep(360);                          // defender catch attempt (SPACE)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', windowsVirtualKeyCode: 32 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', windowsVirtualKeyCode: 32 });
  await sleep(1500);
  const msg = await evalJs(`document.getElementById('message').textContent`);
  if (/overthrown/i.test(msg)) overthrown++;
  console.log(`pass ${passesRun}: "${msg}"`);
  await sleep(900);
}

console.log(JSON.stringify({ passesRun, overthrown, kickoffs, errors }, null, 2));
ws.close();
chrome.kill();
server.kill();
process.exit(0);
