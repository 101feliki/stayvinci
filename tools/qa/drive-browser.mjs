// Drives a headless Chromium browser over the DevTools protocol to check UI after changes:
// navigate, click, type, switch light/dark, take screenshots.
//
// Usage: node tools/qa/drive-browser.mjs steps.json
// Steps: [{ "go": url, "wait": ms }, { "click": [cssSelector, text] }, { "type": "text" },
//         { "media": "dark" | "light" }, { "scroll": px }, { "shot": "name.png", "w": 1440, "h": 1000 }]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Chromium-based browser to drive. Override with BROWSER=/path/to/chrome.
const EDGE = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// Screenshots go to .qa-output/ in the current folder (git-ignored).
const OUT = path.resolve('.qa-output');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = path.join(OUT, 'edge-profile-' + Date.now());
const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--window-size=1440,1000',
  'about:blank',
]);

let ws;
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const msg = { id: ++id, method, params };
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // browser not ready yet: retry
    }
    await sleep(200);
  }
  throw new Error('no devtools');
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  return r.result?.value;
}
async function shot(name, w = 1440, h = 1000) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(300);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
  console.log('shot', name);
}
async function go(url, wait = 2500) {
  await send('Page.navigate', { url });
  await sleep(wait);
}
const clickText = (sel, text) =>
  evaluate(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)})); if (!el) return 'missing'; el.click(); return 'ok'; })()`,
  );

const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message));
      else p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown')
      console.log('PAGE ERROR', m.params.exceptionDetails?.exception?.description?.slice(0, 600));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      console.log(
        'CONSOLE',
        JSON.stringify(m.params.args.map((a) => a.value ?? a.description)).slice(0, 600),
      );
  });
  await send('Page.enable');
  await send('Runtime.enable');
  for (const s of steps) {
    if (s.media)
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: s.media }],
      });
    if (s.scroll !== undefined) await evaluate(`window.scrollTo(0, ${s.scroll})`);
    if (s.go) await go(s.go, s.wait ?? 2500);
    if (s.click) console.log('click', s.click[1], await clickText(s.click[0], s.click[1]));
    if (s.eval) console.log('eval', await evaluate(s.eval));
    if (s.type) await send('Input.insertText', { text: s.type });
    if (s.key) {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: s.key,
        modifiers: s.mod ?? 0,
        windowsVirtualKeyCode: s.code ?? 0,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: s.key,
        modifiers: s.mod ?? 0,
        windowsVirtualKeyCode: s.code ?? 0,
      });
    }
    if (s.sleep) await sleep(s.sleep);
    if (s.shot) await shot(s.shot, s.w, s.h);
  }
} catch (e) {
  console.error('ERR', e.message);
} finally {
  edge.kill();
  ws?.close();
}
