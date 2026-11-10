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
// api64 trả lời qua cả IPv4 lẫn IPv6 → kiểm tra được proxy chỉ đi ra bằng IPv6.
// api.ipify.org (chỉ IPv4) giữ làm dự phòng khi api64 gặp sự cố.
const IP_CHECK_URLS = [
  'https://api64.ipify.org?format=json',
  'https://api.ipify.org?format=json'
];

/** Host là địa chỉ IPv6 dạng literal (vd 2001:db8::1)? */
function isIPv6Host(host) {
  return typeof host === 'string' && host.includes(':');
}

/** Bọc IPv6 trong [] khi ghép vào URL / host:port */
function formatHost(host) {
  return isIPv6Host(host) ? `[${host}]` : host;
}

/** 4 | 6 | null — phiên bản IP ra ngoài của proxy */
function ipVersionOf(ip) {
  if (!ip) return null;
  return ip.includes(':') ? 6 : 4;
}

/**
 * Parse 1 dòng proxy. Hỗ trợ:
 *   http://user:pass@host:port   socks5://host:port
 *   user:pass@host:port          host:port
 *   host:port:user:pass          (định dạng phổ biến của shop proxy VN)
 *   [2001:db8::1]:port:user:pass, user:pass@[2001:db8::1]:port   (host IPv6 phải nằm trong [])
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

  // Host IPv6 literal: bắt buộc nằm trong [] vì bản thân địa chỉ chứa dấu ":"
  const lb = rest.indexOf('[');
  const rb = rest.indexOf(']');
  if (lb >= 0 || rb >= 0) {
    if (lb < 0 || rb < lb) throw new Error(`Thiếu dấu [ ] quanh địa chỉ IPv6: ${raw}`);
    const before = rest.slice(0, lb);   // '' hoặc 'user:pass@'
    host = rest.slice(lb + 1, rb);
    const after = rest.slice(rb + 1);   // ':port' hoặc ':port:user:pass'
    if (!after.startsWith(':')) throw new Error(`Thiếu port sau địa chỉ IPv6: ${raw}`);
    const afterParts = after.slice(1).split(':');
    port = afterParts[0];
    if (before) {
      if (!before.endsWith('@')) throw new Error(`Không nhận ra định dạng: ${raw}`);
      const auth = before.slice(0, -1);
      const colon = auth.indexOf(':');
      username = colon >= 0 ? auth.slice(0, colon) : auth;
      password = colon >= 0 ? auth.slice(colon + 1) : null;
    } else if (afterParts.length >= 3) {
      username = afterParts[1];
      password = afterParts.slice(2).join(':');
    } else if (afterParts.length !== 1) {
      throw new Error(`Không nhận ra định dạng: ${raw}`);
    }
    if (!/^[0-9a-f:.]+$/i.test(host) || !host.includes(':')) {
      throw new Error(`Địa chỉ IPv6 không hợp lệ: ${host}`);
    }
    return finalize();
  }

  const parts = rest.split(':');
  // Nhiều dấu ":" mà không có [] và phần thứ 2 không phải port → nhiều khả năng là IPv6 thiếu []
  if (parts.length > 4 && !/^\d+$/.test(parts[1]) && !rest.includes('@')) {
    throw new Error(`Có vẻ là địa chỉ IPv6 — hãy ghi dạng [địa_chỉ]:port:user:pass. Dòng: ${raw}`);
  }
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

  return finalize();

  function finalize() {
    const portNum = /^\d+$/.test(String(port || '').trim()) ? parseInt(port, 10) : NaN;
    if (!host || !portNum || portNum < 1 || portNum > 65535) {
      throw new Error(`Host/port không hợp lệ: ${raw}`);
    }
    return {
      protocol,
      host: host.trim().replace(/^\[|\]$/g, ''),
      port: portNum,
      username: username ? decodeURIComponent(username) : null,
      password: password ? decodeURIComponent(password) : null
    };
  }
}

/** URL đầy đủ (có mật khẩu) của proxy — chỉ dùng nội bộ, không trả về client */
function toProxyUrl(proxy) {
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@`
    : '';
  return `${proxy.protocol}://${auth}${formatHost(proxy.host)}:${proxy.port}`;
}

/** Chuỗi hiển thị an toàn (không lộ mật khẩu) */
function toDisplay(proxy) {
  const auth = proxy.username ? `${proxy.username}:***@` : '';
  return `${proxy.protocol}://${auth}${formatHost(proxy.host)}:${proxy.port}`;
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
    return { serverUrl: `${proxy.protocol}://${formatHost(proxy.host)}:${proxy.port}`, close: async () => {} };
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

/** Lỗi mạng (không có HTTP status) → thông báo dễ hiểu */
function describeNetworkError(err, timeoutMs) {
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
    return `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) — proxy chậm hoặc không phản hồi`;
  }
  if (err.code === 'ECONNRESET' && /TLS|secure/i.test(err.message)) {
    return 'Proxy nhận kết nối nhưng cắt ngang khi mở trang HTTPS — proxy có thể chưa kích hoạt / đã hết hạn, ' +
      'chặn IP máy bạn (cần whitelist), hoặc không đi ra được loại IP của trang đích (ECONNRESET)';
  }
  return err.code ? `${err.code}: ${err.message}` : err.message;
}

/**
 * Kiểm tra proxy: gọi api64.ipify.org qua proxy (đi đúng đường Chrome sẽ đi).
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
    let firstError = null;
    for (const url of IP_CHECK_URLS) {
      try {
        const resp = await axios.get(url, {
          httpsAgent: new HttpsProxyAgent(bridge.url),
          proxy: false,
          timeout: timeoutMs
        });
        const ip = resp.data && resp.data.ip;
        if (!ip) throw new Error(`Không đọc được IP từ ${new URL(url).hostname}`);
        result = { ok: true, ip, ipVersion: ipVersionOf(ip), latencyMs: Date.now() - started };
        break;
      } catch (err) {
        if (!firstError) firstError = err;
        // Sai mật khẩu / proxy chết thì thử trang khác cũng vô ích
        const status = err.response && err.response.status;
        if (status === 407 || status === 597 || status === 594 || status === 593) break;
      }
    }
    if (!result) {
      const err = firstError;
      result = {
        ok: false,
        error: err.response ? describeStatus(err.response.status) : describeNetworkError(err, timeoutMs)
      };
    }
  } catch (err) {
    result = { ok: false, error: describeNetworkError(err, timeoutMs) };
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
  ipVersionOf,
  formatHost,
  toProxyUrl,
  toDisplay,
  prepareChromeProxy,
  checkProxy,
  getProxyForEmail
};
