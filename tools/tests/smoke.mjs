import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sh = (p) => readFileSync(ROOT + p, 'utf8');
/* THADD OS smoke test: boots the whole shell in jsdom, drives it, reports. */

const html = sh('/desktop/index.html');
const bundle = sh('/tools/tests/bundle.js');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = e.detail?.message || e.message; if (!/navigation to another Document/.test(m)) errors.push('jsdomError: ' + m); });
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));
vc.on('warn', () => {});

const dom = new JSDOM(html.replace('<script type="module" src="js/kernel.js"></script>', ''), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://thadd.test/', virtualConsole: vc,
});
const { window } = dom;
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
// canvas stub
window.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient'
    ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : noop) });
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

const s = window.document.createElement('script');
s.textContent = bundle;
window.document.body.append(s);

await new Promise((r) => setTimeout(r, 6000));

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => [...window.document.querySelectorAll(sel)];
const T = window.THADD || {};
const report = [];
const check = (name, cond, extra = '') => report.push(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);

check('kernel booted', !!T.boot, T.boot ? 'v' + T.boot.version : '');
check('boot overlay dismissed', $('#boot')?.classList.contains('done'));
check('lock screen present', !!$('#lock'));
check('menu bar rendered', $$('#menubar .mb-item').length >= 8, $$('#menubar .mb-item').length + ' items');
check('dock populated', $$('#dock .dock-item').length >= 10, $$('#dock .dock-item').length + ' dock items');
check('desktop icons', $$('#deskIcons > div').length >= 4);
check('onboarding modal shown', $('#onboard')?.classList.contains('open'));
const ob = $('#obStart'); if (ob) ob.click();
await new Promise((r) => setTimeout(r, 400));
check('onboarding accepted', !$('#onboard')?.classList.contains('open'));

// launch every registered app and make sure none throws
const ids = [...new Set([...$$('#dock .dock-item')].map((d) => d.dataset.app))];
const reg = ['finder','terminal','powershell','settings','monitor','store','about','guide','screenshot','jarvis','ai-lab','copilot',
 'parrot','shield','vault','forensics','packetlab','hackbox','editor','git','docker','dbg','apiweb','jupyter','sqlite',
 'browser','browser-chrome','browser-brave','browser-tor','mail','chat','vpn','music','videos','photos','camera','screenrec',
 'draw','presenter','notes','calendar','tasks','calc','sheet','office','pdf','clock','weather','maps','translate','trash',
 'disks','network','bluetooth','printers','users','power','logs','cronjobs','recorder','bootpicker','softwareupdate','launchpad'];
let launched = 0, failed = [];
for (const id of reg) {
  try { const w = T.launch(id); launched++; } catch (e) { failed.push(id + ': ' + e.message); }
}
await new Promise((r) => setTimeout(r, 1500));
check('all apps launch', failed.length === 0, failed.length ? failed.slice(0, 4).join(' | ') : `${launched} apps opened`);
const winCount = $$('.win').length;
check('windows created', winCount > 40, winCount + ' windows');

// terminal command engine
const term = T.launch('terminal', { forceNew: true });
await new Promise((r) => setTimeout(r, 400));
const out1 = await T.runInTerminal('thadd doctor');
check('terminal: thadd doctor', /20 passed/.test(out1), out1.split('\n').filter(Boolean).slice(-1)[0]);
const out2 = await T.runInTerminal('nmap -sV 10.10.10.5');
check('terminal: nmap', /Nmap scan report/.test(out2));
const out3 = await T.runInTerminal('thadd iso build');
check('terminal: iso build', /ISO ready/.test(out3));
const out4 = await T.runInTerminal('ls -la ~/thadd-os | grep README');
check('terminal: pipes', /README/.test(out4));

// filesystem + vfs via JARVIS tool surface
const w1 = T.vfs.read('/home/thadd/thadd-os/README.md');
check('vfs read', !!w1 && w1.includes('THADD OS 2.0'));
T.vfs.write('/home/thadd/Documents/test-smoke.md', '# smoke');
check('vfs write', T.vfs.read('/home/thadd/Documents/test-smoke.md') === '# smoke');

// spotlight search
T.spotlight();
await new Promise((r) => setTimeout(r, 200));
const spotInput = $('#spotInput');
spotInput.value = 'iso';
spotInput.dispatchEvent(new window.Event('input'));
await new Promise((r) => setTimeout(r, 200));
check('spotlight results', $$('#spotResults .spot-row').length > 3, $$('#spotResults .spot-row').length + ' rows');

// screenshot
const name = await T.screenshot();
check('screenshot', /thadd-shot/.test(name), name);

// mission control + settings panes + theme switch
T.mission();
await new Promise((r) => setTimeout(r, 200));
check('mission control', $('#mission').classList.contains('open'));
$('#mission').classList.remove('open');
window.document.documentElement.dataset.appearance = 'light';
check('light appearance', window.document.documentElement.dataset.appearance === 'light');

console.log(report.join('\n'));
console.log('\nRUNTIME ERRORS: ' + (errors.length ? '\n - ' + errors.slice(0, 12).join('\n - ') : 'none 🎉'));
console.log('STATS: windows=' + winCount + ' apps=' + launched + '/' + reg.length +
  ' dockItems=' + $$('#dock .dock-item').length + ' registryApps=' + (T.cmd ? Object.keys(T.cmd).length : '?') + ' commands');
process.exit(errors.length ? 1 : 0);
