import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sh = (p) => readFileSync(ROOT + p, 'utf8');
/* THADD OS deep test: sweep every terminal command + JARVIS tool-calling (mocked Groq). */
const html = sh('/desktop/index.html').replace('<script type="module" src="js/kernel.js"></script>', '');
const bundle = sh('/tools/tests/bundle.js');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = e.detail?.message || e.message; if (!/navigation to another Document/.test(m)) errors.push('jsdomError: ' + m); });
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://thadd.test/', virtualConsole: vc });
const { window } = dom;
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
window.HTMLCanvasElement.prototype.getContext = function () { const noop = () => {}; return new Proxy({}, { get: (t, k) => /^(createLinearGradient|createRadialGradient)$/.test(k) ? () => ({ addColorStop: noop }) : noop }); };
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
window.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {} };
window.SpeechSynthesisUtterance = class {};
window.localStorage.setItem('thadd.onboarded', 'true');

/* ---- mock Groq: first response asks for two tool calls, second answers ---- */
let call = 0;
const seen = [];
window.fetch = async (url, opts) => {
  seen.push({ url, body: JSON.parse(opts.body || '{}') });
  call++;
  const enc = new TextEncoder();
  let chunks;
  if (call === 1) {
    chunks = [
      { choices: [{ delta: { content: 'On it — creating the script and scanning.' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'write_file', arguments: '{"path":"~/thadd-os/recon.sh","content":"#!/usr/bin/env bash\\nnmap -sV $1\\n"}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: 'c2', function: { name: 'run_command', arguments: '{"command":"nmap -sV 10.10.10.5"}' } }] } }] },
    ];
  } else {
    chunks = [{ choices: [{ delta: { content: 'Done: recon.sh written and nmap found 22/80/443 open on 10.10.10.5.' } }] }];
  }
  const sse = chunks.map((c) => 'data: ' + JSON.stringify(c) + '\n\n').join('') + 'data: [DONE]\n\n';
  return { ok: true, status: 200, body: { getReader: () => { let done = false; return { read: async () => done ? { done: true } : (done = true, { done: false, value: enc.encode(sse) }) }; } } };
};

const s = window.document.createElement('script'); s.textContent = bundle; window.document.body.append(s);
await new Promise((r) => setTimeout(r, 5000));
const T = window.THADD;
window.localStorage.setItem('thadd.ai.groqKey', '"gsk_test"');

const report = [];
const check = (n, c, x = '') => report.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);

/* ---------- 1. sweep every terminal command ---------- */
const CMDS = [
 'help','ls -la','ls','pwd','cd ~ && pwd','cd / && cd -','cat ~/thadd-os/README.md','head -5 ~/thadd-os/Makefile','tail -3 /var/log/syslog','wc ~/thadd-os/README.md',
 'touch /tmp/a.txt','mkdir -p /tmp/deep/nest','echo hello world','rm -v /tmp/a.txt','cp ~/thadd-os/Makefile /tmp/mk','mv /tmp/mk /tmp/mk2','tree ~/thadd-os','find /home -name README',
 'grep -n THADD ~/thadd-os/README.md','sed s/THADD/NEBULA/ ~/thadd-os/README.md','stat ~/thadd-os/README.md','file ~/thadd-os/README.md','du -sh ~','df -h','chmod 755 x','which git','whereis nmap',
 'whoami','id','uname -a','hostname','date','cal','uptime','free -h','ps aux','top','lscpu','lsblk','lspci','lsusb','lsof','systemctl status thadd-shield','journalctl -n 5','dmesg','rev hello','base64 hello',
 'md5sum ~/thadd-os/Makefile','sha256sum ~/thadd-os/Makefile','xxd ~/thadd-os/Makefile','strings ~/thadd-os/README.md','bc 2+2','expr 3 * 7','seq 1 5','sort','uniq','cut','tr','xargs','watch free','time ls',
 'history','alias','export FOO=bar','env','ifconfig','ip a','ip route','ping -c 2 1.1.1.1','traceroute github.com','dig thadd.os','nslookup google.com','whois thadd.os','curl -I https://thadd.os','wget https://thadd.os',
 'ssh thadd@10.10.14.7','netstat -tulpn','ss -tulpn','tcpdump -i eth0','arp -a','iwconfig','parrot','nmap -sV -sC 10.10.10.5','nmap -p- 10.10.10.5','msfconsole','sqlmap -u http://10.10.10.5/item.php?id=1 --batch','hydra -l admin -P rockyou.txt ssh://10.10.10.5',
 'john hashes.txt','hashcat -m 1000 ntlm.txt rockyou.txt','gobuster dir -u http://10.10.10.5 -w w.txt','ffuf -u http://x/FUZZ -w w.txt','searchsploit apache','aircrack-ng cap.cap','wireshark','responder -I eth0','wpscan --url http://10.10.10.5','nikto -h http://10.10.10.5',
 'python3 --version','pip list','node -v','npm -v','npm run dev','cargo build','gcc -o x x.c','make','git status','git log','git branch','git diff','git push','docker ps','docker images','kubectl get pods','code ~/thadd-os/README.md','jupyter lab','sqlite3',
 'dir','powershell Get-Process','Get-Process','Get-Service','Get-ChildItem','tasklist','winget install firefox','where python','brew install wget','brew list','defaults write com.thadd os x','open https://thadd.os','say hello','pbcopy hi','sw_vers',
 'thadd','thadd doctor','thadd scan --full','thadd iso build','thadd iso test','thadd shield strict','thadd shield status','thadd ai what is THADD OS','thadd vpn up','thadd theme Nebula-Prime-Dark','thadd packages','thadd bench','thadd version','thadd update','thadd help',
 'apt update','apt install nmap','apt list','apt upgrade','snap list','ufw status verbose','iptables -L','fail2ban-client status','lynis audit system','rkhunter --check','clamav','aide --check','openssl rand -hex 16','gpg --list-keys','cowsay hi','figlet THADD','fortune','cmatrix','lolcat hi','hollywood',
 'screenshot','record','flash','nmcli','xrandr','wall','theme Parrot-Green','window list','passwd','mount','crontab -l','nano ~/x.md','tldr nmap','thadd-iso build','thadd-shield status','groq hello','date-iso','uptime-info','neofetch','fastfetch',
 'ls ~/thadd-os | grep README','cat /etc/os-release','cat ~/thadd-os/tools/build-iso.sh','df -h | grep sda',
];
const term = T.launch('terminal', { forceNew: true });
await new Promise((r) => setTimeout(r, 300));
let cmdFail = [], empty = 0;
for (const c of CMDS) {
  try { const out = await T.runInTerminal(c); if (!out || out === '(no output)') empty++; }
  catch (e) { cmdFail.push(c + ' → ' + e.message); }
}
check('terminal command sweep', cmdFail.length === 0, cmdFail.length ? cmdFail.slice(0, 5).join(' | ') : `${CMDS.length} commands ran, ${empty} silent`);

/* ---------- 2. JARVIS agent with mocked Groq ---------- */
const jw = T.launch('jarvis', { forceNew: true });
await new Promise((r) => setTimeout(r, 400));
/* the window this test opened — terminal commands in the sweep above also open
   JARVIS surfaces, so assertions must look at OUR transcript, not all of them. */
const jarvisWins = [...T.windows.values()].filter((w) => w._app === 'jarvis');
const myWin = jarvisWins[jarvisWins.length - 1];
const myBody = () => (myWin?.el || window.document).querySelector('#aiBody')?.textContent || '';
const ta = window.document.querySelector('#aiInput');
const sendBtn = window.document.querySelector('#aiSend');
window.localStorage.setItem('thadd.ai.groqKey', JSON.stringify('gsk_test'));
ta.value = 'Write a recon script and scan 10.10.10.5';
sendBtn.click();
await new Promise((r) => setTimeout(r, 3000));
const wrote = T.vfs.read('/home/thadd/thadd-os/recon.sh');
check('JARVIS tool: write_file', !!wrote && wrote.includes('nmap'), wrote ? JSON.stringify(wrote.slice(0, 40)) : 'file missing');
check('JARVIS tool: run_command', seen.length >= 2, seen.length + ' Groq calls');
let streamed = '';
for (let i = 0; i < 24; i++) { streamed = myBody(); if (/recon\.sh written/.test(streamed)) break; await new Promise((r) => setTimeout(r, 250)); }
check('JARVIS streamed answer', /recon\.sh written/.test(streamed) && /22\/80\/443/.test(streamed),
  /recon\.sh written/.test(streamed) ? 'answer rendered in the transcript this test opened' : JSON.stringify(streamed.slice(-160)));

/* ---------- 3. shell interactions ---------- */
T.launch('settings', { forceNew: true, pane: 'shield' });
await new Promise((r) => setTimeout(r, 300));
check('settings shield pane', [...window.document.querySelectorAll('.st-main .st-h')].some((h) => /THADD Shield/.test(h.textContent)));
const before = window.document.querySelectorAll('.win').length;
window.document.querySelectorAll('.light.c')[0]?.click();
await new Promise((r) => setTimeout(r, 300));
check('traffic-light close works', window.document.querySelectorAll('.win').length < before);

console.log(report.join('\n'));
console.log('RUNTIME ERRORS: ' + (errors.length ? '\n - ' + errors.slice(0, 10).join('\n - ') : 'none 🎉'));
process.exit(report.some((r) => r.startsWith('❌')) || errors.length ? 1 : 0);
