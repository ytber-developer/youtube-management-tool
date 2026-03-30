/**
 * Project Setup Server
 * Usage: node setup.js
 * - No npm install needed (uses only Node.js built-ins)
 * - Opens browser automatically
 * - Handles: copy .env, npm install, migrations
 */

const http = require('http');
const { spawn } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 4321;
const ROOT = __dirname;
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

// SSE clients
const sseClients = {};

function sendSSE(jobId, data) {
  (sseClients[jobId] || []).forEach(res => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

function runCommand(jobId, cmd, args) {
  return new Promise((resolve) => {
    sendSSE(jobId, { type: 'start', cmd: `${cmd} ${args.join(' ')}` });
    const proc = spawn(cmd, args, { cwd: ROOT, shell: true });
    proc.stdout.on('data', d => sendSSE(jobId, { type: 'stdout', text: d.toString() }));
    proc.stderr.on('data', d => sendSSE(jobId, { type: 'stderr', text: d.toString() }));
    proc.on('close', code => { sendSSE(jobId, { type: 'done', code }); resolve(code); });
  });
}

function runEnvCopy(jobId) {
  return new Promise((resolve) => {
    sendSSE(jobId, { type: 'start', cmd: 'copy .env.example → .env' });
    try {
      if (fs.existsSync(ENV_FILE)) {
        sendSSE(jobId, { type: 'stdout', text: '.env đã tồn tại, bỏ qua.\n' });
        sendSSE(jobId, { type: 'done', code: 0 });
        return resolve(0);
      }
      if (!fs.existsSync(ENV_EXAMPLE)) {
        sendSSE(jobId, { type: 'stderr', text: 'Không tìm thấy file .env.example!\n' });
        sendSSE(jobId, { type: 'done', code: 1 });
        return resolve(1);
      }
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      sendSSE(jobId, { type: 'stdout', text: '✔ Đã copy .env.example → .env\n' });
      sendSSE(jobId, { type: 'stdout', text: '⚠ Nhớ chỉnh sửa .env trước khi start app!\n' });
      sendSSE(jobId, { type: 'done', code: 0 });
      resolve(0);
    } catch (err) {
      sendSSE(jobId, { type: 'stderr', text: err.message + '\n' });
      sendSSE(jobId, { type: 'done', code: 1 });
      resolve(1);
    }
  });
}

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setup – YouTube Manager</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:40px;width:100%;max-width:680px}
  h1{font-size:24px;font-weight:700;color:#111;margin-bottom:6px}
  .subtitle{color:#666;font-size:14px;margin-bottom:32px}
  .steps{display:flex;flex-direction:column;gap:16px}
  .step{border:1px solid #e5e7eb;border-radius:12px;padding:20px;transition:border-color .2s}
  .step.done{border-color:#bbf7d0;background:#f0fdf4}
  .step-header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
  .badge-orange{background:#ffedd5;color:#c2410c}
  .badge-blue{background:#dbeafe;color:#1d4ed8}
  .badge-green{background:#dcfce7;color:#15803d}
  .badge-purple{background:#f3e8ff;color:#7e22ce}
  .step-title{font-weight:600;font-size:15px;color:#111;flex:1}
  .step-desc{font-size:13px;color:#6b7280;margin-bottom:14px;line-height:1.5}
  .step-desc code{background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:12px}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-orange{background:#ea580c;color:#fff}.btn-orange:hover:not(:disabled){background:#c2410c}
  .btn-blue{background:#2563eb;color:#fff}.btn-blue:hover:not(:disabled){background:#1d4ed8}
  .btn-green{background:#16a34a;color:#fff}.btn-green:hover:not(:disabled){background:#15803d}
  .btn-purple{background:#7c3aed;color:#fff}.btn-purple:hover:not(:disabled){background:#6d28d9}
  .btn-gray{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}.btn-gray:hover:not(:disabled){background:#e5e7eb}
  .terminal{background:#0f172a;border-radius:8px;padding:14px;font-family:'SF Mono','Fira Code',monospace;font-size:12px;line-height:1.7;max-height:200px;overflow-y:auto;color:#94a3b8;margin-top:12px;display:none}
  .terminal .stdout{color:#86efac} .terminal .stderr{color:#fca5a5}
  .terminal .info{color:#7dd3fc}   .terminal .done-ok{color:#4ade80;font-weight:700}
  .terminal .done-err{color:#f87171;font-weight:700}
  .status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:6px;vertical-align:middle}
  .dot-idle{background:#d1d5db} .dot-running{background:#f59e0b;animation:pulse 1s infinite}
  .dot-ok{background:#22c55e}   .dot-err{background:#ef4444}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .tag{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;margin-left:8px}
  .tag-exists{background:#dcfce7;color:#15803d}
  .tag-missing{background:#fee2e2;color:#b91c1c}
  .divider{border:none;border-top:1px solid #f3f4f6;margin:20px 0 16px}
  .footer-actions{display:flex;gap:10px;flex-wrap:wrap}
  .success-banner{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-top:16px;display:none;text-align:center;line-height:2}
  .success-banner a{color:#15803d;font-weight:600;text-decoration:none}
  .success-banner a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
  <h1>🛠️ YouTube Manager Setup</h1>
  <p class="subtitle">Khởi tạo project lần đầu — chạy từng bước hoặc bấm "Chạy tất cả"</p>

  <div class="steps">

    <!-- Step 0: .env -->
    <div class="step" id="step0">
      <div class="step-header">
        <span class="badge badge-orange">0</span>
        <span class="step-title">
          Cấu hình .env
          <span id="dot0" class="status-dot dot-idle"></span>
          <span id="envTag" class="tag" style="display:none"></span>
        </span>
      </div>
      <p class="step-desc">
        Copy <code>.env.example</code> → <code>.env</code> nếu chưa có.
        Nếu đã có thì bỏ qua. Sau đó chỉnh sửa <code>.env</code> cho phù hợp máy bạn.
      </p>
      <button class="btn btn-orange" id="btn0" onclick="runStep('env')">▶ Copy .env</button>
      <div class="terminal" id="term0"></div>
    </div>

    <!-- Step 1: npm install -->
    <div class="step" id="step1">
      <div class="step-header">
        <span class="badge badge-blue">1</span>
        <span class="step-title">Cài dependencies <span id="dot1" class="status-dot dot-idle"></span></span>
      </div>
      <p class="step-desc">Chạy <code>npm install</code> — tải tất cả packages vào <code>node_modules/</code></p>
      <button class="btn btn-blue" id="btn1" onclick="runStep('install')">▶ npm install</button>
      <div class="terminal" id="term1"></div>
    </div>

    <!-- Step 2: migrate -->
    <div class="step" id="step2">
      <div class="step-header">
        <span class="badge badge-green">2</span>
        <span class="step-title">Tạo database <span id="dot2" class="status-dot dot-idle"></span></span>
      </div>
      <p class="step-desc">Chạy migrations — tạo file <code>tool_ytb.db</code> và các bảng SQLite</p>
      <button class="btn btn-green" id="btn2" onclick="runStep('migrate')">▶ Run Migrations</button>
      <div class="terminal" id="term2"></div>
    </div>

    <!-- Step 3: start -->
    <div class="step" id="step3">
      <div class="step-header">
        <span class="badge badge-purple">3</span>
        <span class="step-title">Khởi động app <span id="dot3" class="status-dot dot-idle"></span></span>
      </div>
      <p class="step-desc">Start backend + frontend cùng lúc (port 3006 + 3000)</p>
      <button class="btn btn-purple" id="btn3" onclick="runStep('start')">▶ Start Dev Server</button>
      <div class="terminal" id="term3"></div>
    </div>

  </div>

  <div class="divider"></div>
  <div class="footer-actions">
    <button class="btn btn-gray" onclick="runAll()">⚡ Chạy tất cả (0 → 1 → 2)</button>
  </div>

  <div class="success-banner" id="successBanner">
    ✅ Setup hoàn tất!<br>
    Truy cập app tại <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>
    &nbsp;|&nbsp; Backend <a href="http://localhost:3006" target="_blank">:3006</a>
  </div>
</div>

<script>
const stepMap = { env: 0, install: 1, migrate: 2, start: 3 };

const term = n => document.getElementById('term' + n);
const dot  = n => document.getElementById('dot' + n);
const btn  = n => document.getElementById('btn' + n);

function appendLine(n, text, cls) {
  const t = term(n);
  t.style.display = 'block';
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text;
  t.appendChild(span);
  t.scrollTop = t.scrollHeight;
}

function setDot(n, state) { dot(n).className = 'status-dot dot-' + state; }

function runStep(step) {
  const n = stepMap[step];
  term(n).innerHTML = '';
  term(n).style.display = 'block';
  btn(n).disabled = true;
  setDot(n, 'running');

  const es = new EventSource('/run?step=' + step);
  let resolvePromise;
  const promise = new Promise(r => resolvePromise = r);

  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.type === 'start')  appendLine(n, '$ ' + d.cmd + '\\n', 'info');
    if (d.type === 'stdout') appendLine(n, d.text, 'stdout');
    if (d.type === 'stderr') appendLine(n, d.text, 'stderr');
    if (d.type === 'done') {
      if (d.code === 0) { appendLine(n, '\\n✔ Done\\n', 'done-ok'); setDot(n, 'ok'); }
      else              { appendLine(n, '\\n✖ Failed (exit ' + d.code + ')\\n', 'done-err'); setDot(n, 'err'); }
      btn(n).disabled = false;
      es.close();
      if (step === 'env') checkEnvStatus(); // refresh tag after copy
      resolvePromise(d.code);
    }
  };

  es.onerror = () => {
    appendLine(n, 'Connection error\\n', 'done-err');
    setDot(n, 'err');
    btn(n).disabled = false;
    es.close();
    resolvePromise(1);
  };

  return promise;
}

async function runAll() {
  const c0 = await runStep('env');
  if (c0 !== 0) return;
  const c1 = await runStep('install');
  if (c1 !== 0) return;
  const c2 = await runStep('migrate');
  if (c2 === 0) document.getElementById('successBanner').style.display = 'block';
}

// Check .env status on load
async function checkEnvStatus() {
  try {
    const r = await fetch('/check-env');
    const d = await r.json();
    const tag = document.getElementById('envTag');
    tag.style.display = 'inline-block';
    if (d.exists) {
      tag.className = 'tag tag-exists';
      tag.textContent = '✓ .env có rồi';
      setDot(0, 'ok');
    } else {
      tag.className = 'tag tag-missing';
      tag.textContent = '✗ Chưa có .env';
      setDot(0, 'idle');
    }
  } catch {}
}

checkEnvStatus();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Check if .env exists
  if (url.pathname === '/check-env') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ exists: fs.existsSync(ENV_FILE) }));
    return;
  }

  // SSE: run a setup step
  if (url.pathname === '/run') {
    const step = url.searchParams.get('step');
    const jobId = `${step}-${Date.now()}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');

    if (!sseClients[jobId]) sseClients[jobId] = [];
    sseClients[jobId].push(res);
    req.on('close', () => {
      sseClients[jobId] = (sseClients[jobId] || []).filter(r => r !== res);
    });

    const steps = {
      env:     () => runEnvCopy(jobId),
      install: () => runCommand(jobId, 'npm', ['install']),
      migrate: () => runCommand(jobId, 'node', ['src/database/migrate.js']),
      start:   () => runCommand(jobId, 'npm', ['run', 'dev:all']),
    };

    if (steps[step]) {
      steps[step]().then(() => setTimeout(() => { delete sseClients[jobId]; }, 30000));
    } else {
      sendSSE(jobId, { type: 'done', code: 1 });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🛠️  Setup server: ${url}\n`);

  const open = process.platform === 'darwin' ? 'open'
             : process.platform === 'win32'  ? 'start'
             : 'xdg-open';
  try { execSync(`${open} ${url}`); } catch { console.log(`→ Mở thủ công: ${url}`); }

  console.log('Ctrl+C để tắt sau khi setup xong.\n');
});
