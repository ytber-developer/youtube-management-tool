// Lịch đăng: video số NN của mỗi kênh đăng vào START + (NN-1) ngày; 2 kênh cùng ngày.
const START = '2026-11-23';

function dateFor(number, start = START) {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (number - 1));
  return d.toISOString().slice(0, 10);
}

const folderName = (v) => `${v.channel}__${String(v.number).padStart(2, '0')}-${v.slug}`;

function build(videos, start = START) {
  const byDate = new Map();
  for (const v of videos) {
    const date = dateFor(v.number, start);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ id: `${date}/${folderName(v)}`, channel: v.channel, number: v.number, title: v.title });
  }
  return [...byDate.keys()].sort().map(date => ({
    date,
    videos: byDate.get(date).sort((a, b) => a.channel.localeCompare(b.channel)),
  }));
}

module.exports = { START, dateFor, folderName, build };
