// Sinh narration.txt (dán vào ElevenLabs) và metadata.md (copy khi upload YouTube).
const fs = require('fs');
const path = require('path');
const CHANNELS = require('./channels');
const { words } = require('./check');

const narrationText = (script) => script.scenes.map(s => s.narration.trim()).join('\n\n');

function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Ghi nguồn ảnh, mỗi credit một dòng (gộp trùng) */
function creditLines(credits) {
  const seen = new Map();
  for (const c of credits) {
    if (!c || c.missing || !c.credit) continue;
    if (!seen.has(c.credit)) seen.set(c.credit, c.url || '');
  }
  return [...seen].map(([credit, url]) => `- ${credit}${url ? ` (${url})` : ''}`);
}

/** Credit ảnh cho mô tả YouTube. Video hoạt hình không dùng ảnh trong images/ → chỉ ghi animation + icon */
function imageCredits(script, credits) {
  if (script.style === 'anim') {
    return creditLines([{ credit: `Original animation by ${(CHANNELS[script.channel] || {}).name || 'the channel'}` },
      { credit: 'Icons: Fluent Emoji by Microsoft (MIT License)', url: 'https://github.com/microsoft/fluentui-emoji' }]);
  }
  return creditLines(credits);
}

/** Mô tả đăng YouTube nguyên khối: description + credit ảnh */
function youtubeDescription(script, credits) {
  const lines = imageCredits(script, credits);
  return String(script.description || '').trim() + (lines.length ? `\n\nImages:\n${lines.join('\n')}` : '');
}

/** Giờ đăng 12:00 PM ET (mùa đông = 00:00 giờ VN hôm sau) */
const postTime = (date) => ({ et: `${date} 12:00 PM ET`, vn: `00:00 ngày ${nextDay(date)} (giờ VN)` });

function metadataMarkdown(script, credits, { date }) {
  const ch = CHANNELS[script.channel] || {};
  const lines = imageCredits(script, credits);
  const description = youtubeDescription(script, credits);
  const chars = narrationText(script).length;
  const minutes = (script.scenes.reduce((a, s) => a + words(s.narration), 0) / CHANNELS.WPM).toFixed(1);
  return `# ${script.title}

- **Kênh:** ${ch.name || script.channel} · **Video #${script.number}** · **Ngày đăng:** ${date}
- **Giờ đăng gợi ý:** 12:00 PM ET (00:00 giờ VN ngày ${nextDay(date)})
- **Giọng đọc:** ${ch.voiceHint || '—'} · **Lời đọc:** ${chars} ký tự · khoảng ${minutes} phút
- **Thumbnail text:** ${script.thumbnail_text || ''}

## Title
${script.title}

## Description (copy nguyên khối)
\`\`\`
${description}
\`\`\`

## Tags
${(script.tags || []).join(', ')}

## Image credits
${lines.join('\n') || '- (chưa có ảnh)'}

## Sources
${(script.sources || []).map(s => `- ${s.title}: ${s.url}`).join('\n')}
`;
}

function writeAll(dir) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const credFile = path.join(dir, 'credits.json');
  const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : [];
  const date = path.basename(path.dirname(dir));
  fs.writeFileSync(path.join(dir, 'narration.txt'), narrationText(script) + '\n');
  fs.writeFileSync(path.join(dir, 'metadata.md'), metadataMarkdown(script, credits, { date }));
}

module.exports = { narrationText, metadataMarkdown, writeAll, creditLines, youtubeDescription, postTime };
