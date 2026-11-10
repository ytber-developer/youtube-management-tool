const { Op } = require('sequelize');
const { Proxy, AccountYoutube, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../helpers/response.helper');
const proxyService = require('../services/proxy.service');

/** Host nhập từ form: chấp nhận IPv6 có hoặc không có [] */
function hostForUrl(host) {
  const h = String(host || '').trim().replace(/^\[|\]$/g, '');
  return proxyService.formatHost(h);
}

/** Dạng trả về cho client — KHÔNG gửi mật khẩu */
function formatProxy(p, accounts = []) {
  return {
    id: p.id,
    label: p.label || '',
    protocol: p.protocol,
    host: p.host,
    port: p.port,
    username: p.username || '',
    hasPassword: !!p.password,
    country: p.country || '',
    status: p.status,
    lastIp: p.last_ip || '',
    ipVersion: proxyService.ipVersionOf(p.last_ip),
    hostIsIPv6: p.host.includes(':'),
    lastLatencyMs: p.last_latency_ms,
    lastError: p.last_error || '',
    lastCheckedAt: p.last_checked_at,
    display: proxyService.toDisplay(p),
    accounts: accounts.map(a => ({ id: a.id, email: a.email }))
  };
}

/**
 * GET /api/v1/proxies
 */
exports.list = async (req, res) => {
  try {
    const proxies = await Proxy.findAll({ order: [['id', 'ASC']] });
    const accounts = await AccountYoutube.findAll({
      where: { proxy_id: { [Op.ne]: null } },
      attributes: ['id', 'email', 'proxy_id']
    });
    const byProxy = new Map();
    for (const a of accounts) {
      if (!byProxy.has(a.proxy_id)) byProxy.set(a.proxy_id, []);
      byProxy.get(a.proxy_id).push(a);
    }
    return res.json(successResponse(proxies.map(p => formatProxy(p, byProxy.get(p.id) || []))));
  } catch (error) {
    console.error('Error listing proxies:', error);
    return res.status(500).json(errorResponse('Không lấy được danh sách proxy', error));
  }
};

/**
 * POST /api/v1/proxies
 * Body (thêm 1): { protocol, host, port, username, password, label, country }
 * Body (thêm nhiều): { lines: "host:port:user:pass\n...", protocol?, country? }
 */
exports.create = async (req, res) => {
  try {
    const { lines, protocol = 'http', country = null, label = null } = req.body || {};

    let items = [];
    const errors = [];

    if (typeof lines === 'string' && lines.trim()) {
      lines.split(/\r?\n/).forEach((line, idx) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        try {
          items.push({ ...proxyService.parseProxyLine(t, protocol), country, label: null });
        } catch (e) {
          errors.push({ line: idx + 1, value: t, error: e.message });
        }
      });
    } else {
      const { host, port, username, password } = req.body || {};
      try {
        const parsed = proxyService.parseProxyLine(`${protocol}://${hostForUrl(host)}:${port}`);
        items.push({
          ...parsed,
          username: username || null,
          password: password || null,
          country,
          label
        });
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có proxy hợp lệ nào', data: { errors } });
    }

    // Bỏ qua proxy trùng (cùng protocol/host/port/username)
    const existing = await Proxy.findAll({ attributes: ['protocol', 'host', 'port', 'username'] });
    const key = (p) => `${p.protocol}|${p.host}|${p.port}|${p.username || ''}`;
    const seen = new Set(existing.map(key));
    let skipped = 0;
    items = items.filter(p => {
      if (seen.has(key(p))) { skipped++; return false; }
      seen.add(key(p));
      return true;
    });

    const created = await Proxy.bulkCreate(items);
    return res.json(successResponse(
      { created: created.map(p => formatProxy(p)), skipped, errors },
      `Đã thêm ${created.length} proxy${skipped ? `, bỏ qua ${skipped} proxy trùng` : ''}${errors.length ? `, ${errors.length} dòng lỗi` : ''}`
    ));
  } catch (error) {
    console.error('Error creating proxies:', error);
    return res.status(500).json(errorResponse('Không thêm được proxy', error));
  }
};

/**
 * PUT /api/v1/proxies/:id
 * Mật khẩu để trống = giữ nguyên.
 */
exports.update = async (req, res) => {
  try {
    const proxy = await Proxy.findByPk(req.params.id);
    if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });

    const { protocol, host, port, username, password, label, country } = req.body || {};
    const parsed = proxyService.parseProxyLine(`${protocol || proxy.protocol}://${hostForUrl(host || proxy.host)}:${port || proxy.port}`);

    const changes = {
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      label: label !== undefined ? (label || null) : proxy.label,
      country: country !== undefined ? (country || null) : proxy.country
    };
    if (username !== undefined) changes.username = username || null;
    if (password) changes.password = password;
    if (username === '') changes.password = null; // bỏ user thì bỏ luôn pass

    const connectionChanged = ['protocol', 'host', 'port', 'username', 'password']
      .some(k => k in changes && changes[k] !== proxy[k]);
    if (connectionChanged) {
      Object.assign(changes, { status: 'unknown', last_ip: null, last_latency_ms: null, last_error: null, last_checked_at: null });
    }

    await proxy.update(changes);
    return res.json(successResponse(formatProxy(proxy), 'Đã cập nhật proxy'));
  } catch (error) {
    console.error('Error updating proxy:', error);
    return res.status(400).json(errorResponse(error.message || 'Không cập nhật được proxy', error));
  }
};

/**
 * DELETE /api/v1/proxies/:id — gỡ proxy khỏi các account đang dùng rồi xoá
 */
exports.remove = async (req, res) => {
  try {
    const proxy = await Proxy.findByPk(req.params.id);
    if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });

    await sequelize.transaction(async (t) => {
      await AccountYoutube.update({ proxy_id: null }, { where: { proxy_id: proxy.id }, transaction: t });
      await proxy.destroy({ transaction: t });
    });
    return res.json(successResponse({ id: proxy.id }, 'Đã xoá proxy'));
  } catch (error) {
    console.error('Error deleting proxy:', error);
    return res.status(500).json(errorResponse('Không xoá được proxy', error));
  }
};

/**
 * POST /api/v1/proxies/:id/check
 */
exports.check = async (req, res) => {
  try {
    const proxy = await Proxy.findByPk(req.params.id);
    if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });

    const result = await proxyService.checkProxy(proxy);
    return res.json(successResponse(
      formatProxy(proxy),
      result.ok ? `Proxy OK — IP ${result.ip} (${result.latencyMs}ms)` : `Proxy lỗi: ${result.error}`
    ));
  } catch (error) {
    console.error('Error checking proxy:', error);
    return res.status(500).json(errorResponse('Không kiểm tra được proxy', error));
  }
};

/**
 * POST /api/v1/proxies/check-all — kiểm tra song song, tối đa 5 proxy cùng lúc
 */
exports.checkAll = async (req, res) => {
  try {
    const proxies = await Proxy.findAll({ order: [['id', 'ASC']] });
    let ok = 0;
    const queue = [...proxies];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        const r = await proxyService.checkProxy(p);
        if (r.ok) ok++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, proxies.length) }, worker));
    return res.json(successResponse({ total: proxies.length, active: ok, dead: proxies.length - ok },
      `Đã kiểm tra ${proxies.length} proxy: ${ok} hoạt động, ${proxies.length - ok} lỗi`));
  } catch (error) {
    console.error('Error checking proxies:', error);
    return res.status(500).json(errorResponse('Không kiểm tra được proxy', error));
  }
};

/**
 * POST /api/v1/proxies/assign
 * Body: { accountIds: number[], proxyId: number | null }   (null = gỡ proxy)
 */
exports.assign = async (req, res) => {
  try {
    const { accountIds, proxyId = null } = req.body || {};
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, message: 'accountIds là bắt buộc' });
    }
    if (proxyId !== null) {
      const proxy = await Proxy.findByPk(proxyId);
      if (!proxy) return res.status(404).json({ success: false, message: 'Không tìm thấy proxy' });
    }
    const [count] = await AccountYoutube.update({ proxy_id: proxyId }, { where: { id: accountIds } });
    return res.json(successResponse({ updated: count },
      proxyId === null ? `Đã gỡ proxy khỏi ${count} account` : `Đã gán proxy cho ${count} account`));
  } catch (error) {
    console.error('Error assigning proxy:', error);
    return res.status(500).json(errorResponse('Không gán được proxy', error));
  }
};

/**
 * POST /api/v1/proxies/auto-assign
 * Body: { maxPerProxy?: number = 1, onlyActive?: boolean = true }
 * Gán các account CHƯA có proxy vào proxy đang ít account nhất.
 */
exports.autoAssign = async (req, res) => {
  try {
    const maxPerProxy = Math.max(1, parseInt(req.body?.maxPerProxy, 10) || 1);
    const onlyActive = req.body?.onlyActive !== false;

    const proxies = await Proxy.findAll({
      where: onlyActive ? { status: 'active' } : { status: { [Op.ne]: 'dead' } },
      order: [['id', 'ASC']]
    });
    if (proxies.length === 0) {
      return res.status(400).json({
        success: false,
        message: onlyActive ? 'Không có proxy nào ở trạng thái "hoạt động" — hãy bấm Kiểm tra trước' : 'Không có proxy khả dụng'
      });
    }

    const assigned = await AccountYoutube.findAll({ where: { proxy_id: { [Op.ne]: null } }, attributes: ['proxy_id'] });
    const load = new Map(proxies.map(p => [p.id, 0]));
    for (const a of assigned) if (load.has(a.proxy_id)) load.set(a.proxy_id, load.get(a.proxy_id) + 1);

    const unassigned = await AccountYoutube.findAll({ where: { proxy_id: null }, attributes: ['id'], order: [['id', 'ASC']] });

    let count = 0;
    for (const acc of unassigned) {
      let best = null;
      for (const [id, n] of load) if (n < maxPerProxy && (best === null || n < load.get(best))) best = id;
      if (best === null) break; // hết chỗ
      await AccountYoutube.update({ proxy_id: best }, { where: { id: acc.id } });
      load.set(best, load.get(best) + 1);
      count++;
    }

    const remaining = unassigned.length - count;
    return res.json(successResponse({ assigned: count, remaining },
      `Đã gán ${count} account${remaining ? `, còn ${remaining} account chưa có proxy (không đủ proxy với giới hạn ${maxPerProxy} account/proxy)` : ''}`));
  } catch (error) {
    console.error('Error auto-assigning proxies:', error);
    return res.status(500).json(errorResponse('Không tự gán được proxy', error));
  }
};
