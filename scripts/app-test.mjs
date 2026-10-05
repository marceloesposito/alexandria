// Prova dell'app desktop vera: la avvia fuori schermo e senza focus, si collega al WebView2
// via CDP ed esegue uno script di prova. Uso: node scripts/app-test.mjs <exe> <script.mjs> [cartella dati]
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { connect } from './cdp.mjs';

const [exe, scriptPath, dataDir] = process.argv.slice(2);
const PORT = 9555;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// argomenti in piu' per l'app (es. un .recensio da aprire): ALEXANDRIA_TEST_ARGS, separati da |
const extra = process.env.ALEXANDRIA_TEST_ARGS ? process.env.ALEXANDRIA_TEST_ARGS.split('|') : [];
const proc = spawn(exe, extra, {
  env: {
    ...process.env,
    ALEXANDRIA_TEST_OFFSCREEN: '1',
    ...(dataDir ? { ALEXANDRIA_DATA_DIR: dataDir } : {}),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
  },
  stdio: 'ignore',
});

let target = null;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
if (!target) {
  console.error('WebView2 non raggiungibile');
  proc.kill();
  process.exit(1);
}
const c = await connect(target.webSocketDebuggerUrl);
const s = (m, p) => c.send(m, p);
const logs = [];
c.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
});
await s('Runtime.enable');
await s('Page.enable');
const page = {
  sleep,
  send: s,
  async eval(expr) {
    const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  },
  async waitFor(expr, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try {
        if (await page.eval(expr)) return true;
      } catch {}
      await sleep(150);
    }
    throw new Error('Timeout: ' + expr);
  },
  async shot(path) {
    const { writeFileSync } = await import('node:fs');
    const { data } = await s('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(data, 'base64'));
  },
};
try {
  const mod = await import(pathToFileURL(scriptPath).href);
  await mod.default(page);
} catch (e) {
  console.error('ERRORE', e.message);
  process.exitCode = 1;
} finally {
  if (logs.length) console.log('--- console\n' + logs.slice(-20).join('\n'));
  c.close();
  proc.kill();
}
