/**
 * Proxy Service
 *
 * - Parse proxy từ nhiều định dạng nhà cung cấp hay dùng
 * - Kiểm tra proxy (lấy IP ra ngoài + độ trễ)
 * - Chuẩn bị proxy cho Chrome: Chrome không nhận user:pass trong --proxy-server
 *   và không hỗ trợ SOCKS5 có mật khẩu, nên dùng proxy-chain tạo một proxy
 *   cục bộ 127.0.0.1:xxxx không cần mật khẩu, chuyển tiếp sang proxy thật.
 */

const axios = require('axios');
const proxyChain = require('proxy-chain');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Proxy, AccountYoutube } = require('../models');

const SUPPORTED_PROTOCOLS = ['http', 'https', 'socks5', 'socks4'];
const IP_CHECK_URL = 'https://api.ipify.org?format=json';

/**
 * Parse 1 dòng proxy. Hỗ trợ:
 *   http://user:pass@host:port   socks5://host:port
 *   user:pass@host:port          host:port
 *   host:port:user:pass          (định dạng phổ biến của shop proxy VN)
 * @param {string} line
 * @param {string} defaultProtocol - dùng khi dòng không ghi protocol
 * @returns {{protocol, host, port, username, password}}
 */
function parseProxyLine(line, defaultProtocol = 'http') {
  const raw = String(line || '').trim();
  if (!raw) throw new Error('Dòng trống');

  let protocol = defaultProtocol;
  let rest = raw;
  const protoMatch = raw.match(/^([a-z0-9]+):\/\//i);
  if (protoMatch) {
    protocol = protoMatch[1].toLowerCase();
    rest = raw.slice(protoMatch[0].length);
  }
  if (protocol === 'socks') protocol = 'socks5';
  if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
    throw new Error(`Protocol không hỗ trợ: ${protocol}`);
  }

  let host, port, username = null, password = null;
  const parts = rest.split(':');
  const looksHostPortUserPass = !protoMatch && parts.length >= 4 && /^\d+$/.test(parts[1]) && !parts[0].includes('@');

  if (looksHostPortUserPass) {
    // host:port:user:pass (mật khẩu có thể chứa ":" hoặc "@")
    host = parts[0];
    port = parts[1];
    username = parts[2];
    password = parts.slice(3).join(':');
  } else if (rest.includes('@')) {
    // user:pass@host:port
    const at = rest.lastIndexOf('@');
    const auth = rest.slice(0, at);
    const hp = rest.slice(at + 1);
    const colon = auth.indexOf(':');
    username = colon >= 0 ? auth.slice(0, colon) : auth;
    password = colon >= 0 ? auth.slice(colon + 1) : null;
    [host, port] = hp.split(':');
  } else if (parts.length === 2) {
    [host, port] = parts;
  } else {
    throw new Error(`Không nhận ra định dạng: ${raw}`);
  }

  const portNum = parseInt(port, 10);
  if (!host || !portNum || portNum < 1 || portNum > 65535) {
    throw new Error(`Host/port không hợp lệ: ${raw}`);
  }

  return {
    protocol,
    host: host.trim(),
    port: portNum,
    username: username ? decodeURIComponent(username) : null,
    password: password ? decodeURIComponent(password) : null
  };
}

/** URL đầy đủ (có mật khẩu) của proxy — chỉ dùng nội bộ, không trả về client */
function toProxyUrl(proxy) {
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@`
    : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

/** Chuỗi hiển thị an toàn (không lộ mật khẩu) */
function toDisplay(proxy) {
  const auth = proxy.username ? `${proxy.username}:***@` : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

/**
 * Dựng proxy HTTP cục bộ 127.0.0.1:<cổng ngẫu nhiên> không cần mật khẩu,
 * chuyển tiếp mọi request sang proxy thật (HTTP/HTTPS/SOCKS, có hoặc không mật khẩu).
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
async function startLocalBridge(proxy) {
  const upstreamProxyUrl = toProxyUrl(proxy);
  const server = new proxyChain.Server({
    port: 0, // để OS chọn cổng trống — tránh trùng khi nhiều browser/kiểm tra chạy song song
    host: '127.0.0.1',
    prepareRequestFunction: () => ({ requestAuthentication: false, upstreamProxyUrl })
  });
  await server.listen();
  return {
    url: `http://127.0.0.1:${server.port}`,
    close: async () => {
      try { await server.close(true); } catch (e) { /* ignore */ }
    }
  };
}

/**
 * Chuẩn bị URL cho Chrome --proxy-server.
 * - HTTP không mật khẩu → dùng thẳng
 * - Có mật khẩu hoặc SOCKS → tạo proxy cục bộ bằng proxy-chain
 * @returns {Promise<{ serverUrl: string, close: () => Promise<void> }>}
 */
async function prepareChromeProxy(proxy) {
  const needsLocalBridge = !!proxy.username || proxy.protocol.startsWith('socks');
  if (!needsLocalBridge) {
    return { serverUrl: `${proxy.protocol}://${proxy.host}:${proxy.port}`, close: async () => {} };
  }
  const bridge = await startLocalBridge(proxy);
  return { serverUrl: bridge.url, close: bridge.close };
}

/** Mã lỗi (gồm mã riêng 59x của proxy-chain) → thông báo dễ hiểu */
function describeStatus(status) {
  const map = {
    407: 'Sai username/password proxy (407)',
    502: 'Proxy không chuyển tiếp được request (502)',
    504: 'Không kết nối được tới proxy — hết thời gian chờ (504)',
    593: 'Không phân giải được host proxy (593)',
    594: 'Proxy từ chối kết nối — sai host/port hoặc proxy đã tắt (594)',
    595: 'Proxy ngắt kết nối giữa chừng (595)',
    596: 'Kết nối tới proxy bị gãy (596)',
    597: 'Sai username/password proxy (597)',
    599: 'Lỗi từ proxy (599)'
  };
  return map[status] || `Proxy trả về HTTP ${status}`;
}

/**
 * Kiểm tra proxy: gọi api.ipify.org qua proxy (đi đúng đường Chrome sẽ đi).
 * Cập nhật status/last_ip/last_latency_ms vào DB.
 * @param {Proxy} proxy - instance Sequelize
 * @returns {Promise<{ ok: boolean, ip?: string, latencyMs?: number, error?: string }>}
 */
async function checkProxy(proxy, { timeoutMs = 15000 } = {}) {
  let bridge = null;
  const started = Date.now();
  let result;
  try {
    // Luôn đi qua cầu cục bộ + tunnel CONNECT — giống hệt cách Chrome dùng proxy
    bridge = await startLocalBridge(proxy);
    const agent = new HttpsProxyAgent(bridge.url);
    const resp = await axios.get(IP_CHECK_URL, {
      httpsAgent: agent,
      proxy: false,
      timeout: timeoutMs
    });
    const ip = resp.data && resp.data.ip;
    if (!ip) throw new Error('Không đọc được IP từ api.ipify.org');
    result = { ok: true, ip, latencyMs: Date.now() - started };
  } catch (err) {
    const msg = err.response
      ? describeStatus(err.response.status)
      : (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)
        ? `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) — proxy chậm hoặc không phản hồi`
        : (err.code ? `${err.code}: ${err.message}` : err.message));
    result = { ok: false, error: msg };
  } finally {
    if (bridge) await bridge.close();
  }

  await proxy.update({
    status: result.ok ? 'active' : 'dead',
    last_ip: result.ok ? result.ip : proxy.last_ip,
    last_latency_ms: result.ok ? result.latencyMs : null,
    last_error: result.ok ? null : result.error,
    last_checked_at: new Date()
  });

  return result;
}

/** Lấy proxy đang gắn với account (theo email), null nếu không có */
async function getProxyForEmail(email) {
  if (!email) return null;
  const account = await AccountYoutube.findOne({
    where: { email },
    attributes: ['id', 'proxy_id']
  });
  if (!account || !account.proxy_id) return null;
  return Proxy.findByPk(account.proxy_id);
}

module.exports = {
  parseProxyLine,
  toProxyUrl,
  toDisplay,
  prepareChromeProxy,
  checkProxy,
  getProxyForEmail
};
