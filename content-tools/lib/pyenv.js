// Đường dẫn Python trong venv của repo, đúng cho cả macOS/Linux (bin/python) và Windows (Scripts\python.exe)
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function venvPython(venv, platform = process.platform) {
  return platform === 'win32'
    ? path.join(ROOT, venv, 'Scripts', 'python.exe')
    : path.join(ROOT, venv, 'bin', 'python');
}

module.exports = { ROOT, venvPython };
