// Ảnh ứng viên (chỉ giấy phép được phép) từ Openverse / Commons / NASA — dùng cho lệnh search và cho CLIP.
// Mỗi ứng viên có pin {key, value}: dán vào visual của script.json để ghim, hoặc để CLIP tải bản đầy đủ.
const { allowedLicense } = require('./images');

const UA = 'ytb-content-tool/0.1 (personal educational video project)';
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const get = async (url) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`); return r.json(); };

async function openverse(q) {
  const d = await get(`https://api.openverse.org/v1/images/?page_size=20&mature=false&license=cc0,pdm,by&q=${encodeURIComponent(q)}`);
  return (d.results || []).map(r => {
    const lic = r.license === 'pdm' ? 'Public Domain Mark' : r.license === 'cc0' ? 'CC0' : `CC BY ${r.license_version || ''}`.trim();
    return { source: 'openverse', w: r.width, h: r.height, lic, title: r.title || '', creator: r.creator || '', thumb: r.thumbnail || r.url, pin: { key: 'openverse_id', value: r.id } };
  }).filter(c => allowedLicense(c.lic));
}

async function commons(q) {
  const d = await get('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20'
    + `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=400`);
  return Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index).map(p => {
    const ii = p.imageinfo?.[0] || {}; const md = ii.extmetadata || {};
    return { source: 'commons', w: ii.width, h: ii.height, lic: strip(md.LicenseShortName?.value), title: p.title.replace(/^File:/, ''), creator: strip(md.Artist?.value).slice(0, 40), thumb: ii.thumburl, pin: { key: 'commons', value: p.title } };
  }).filter(c => allowedLicense(c.lic));
}

async function nasa(q) {
  const d = await get(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(q)}`);
  return (d.collection.items || []).slice(0, 20).map(it => {
    const m = it.data[0];
    return { source: 'nasa', w: 0, h: 0, lic: 'NASA', title: m.title, creator: m.center || '', thumb: (it.links || [])[0]?.href, pin: { key: 'nasa_id', value: m.nasa_id } };
  });
}

const pinLine = (c) => `"${c.pin.key}": ${JSON.stringify(c.pin.value)}`;

module.exports = { openverse, commons, nasa, pinLine, UA };
