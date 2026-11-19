// Kiểm tra script.json theo quy tắc sản xuất (xem .claude/skills/write-video-script).
const CHANNELS = require('./channels');

const words = (s = '') => s.split(/\s+/).filter(Boolean).length;
const stripTags = (s = '') => s.replace(/<[^>]+>/g, ' ');

function validateScript(script) {
  const errors = [], warnings = [];
  const ch = CHANNELS[script.channel];
  if (!ch) errors.push(`unknown channel "${script.channel}"`);
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];
  if (!scenes.length) errors.push('no scenes');

  const total = scenes.reduce((a, s) => a + words(s.narration), 0);
  const target = Math.round((script.target_minutes || 0) * CHANNELS.WPM);
  if (target && Math.abs(total - target) / target > 0.07) errors.push(`narration has ${total} words, target ${target} (±7%)`);

  scenes.forEach((s, i) => {
    const n = i + 1, w = words(s.narration), last = i === scenes.length - 1;
    if (last) {
      if (ch && s.narration !== ch.outro) errors.push(`scene ${n}: last scene must be the outro "${ch.outro}"`);
      if (s.visual?.type !== 'outro') errors.push(`scene ${n}: outro visual must be {"type":"outro"}`);
      return;
    }
    if (script.style === 'anim') { // hoạt hình: không cần ảnh/tiêu đề slide, cần anim hợp lệ
      if (!s.anim) errors.push(`scene ${n}: missing anim`);
      else for (const e of require('./animspec').validateAnim(s.anim)) errors.push(`scene ${n}: ${e}`);
    } else if (!s.visual || !s.visual.type) errors.push(`scene ${n}: missing visual`);
    if (i === 0 && w > 25) errors.push(`scene 1: hook has ${w} words (max 25)`);
    if (i > 0 && (w < 20 || w > 60)) errors.push(`scene ${n}: ${w} words (must be 20–60)`);
    else if (i > 0 && w < 25) warnings.push(`scene ${n}: only ${w} words (aim for 25–60)`);
    const digits = (s.narration.match(/\b\d+\b/g) || []).filter(d => !/^(1[5-9]|20)\d\d$/.test(d));
    if (digits.length) warnings.push(`scene ${n}: digits in narration (${digits.join(', ')}) — write them out for TTS`);
    if (script.style === 'anim') return;
    const hw = words(stripTags(s.headline));
    if (hw > 6) errors.push(`scene ${n}: headline has ${hw} words (max 6)`);
    const ems = (s.headline || '').match(/<em>/g) || [];
    if (ems.length !== 1) errors.push(`scene ${n}: headline needs exactly one <em> (has ${ems.length})`);
    if (words(s.sub) > 8) errors.push(`scene ${n}: sub has ${words(s.sub)} words (max 8)`);
  });

  if ((script.title || '').length > 70) errors.push(`title is ${script.title.length} chars (max 70)`);
  if (words(script.thumbnail_text) > 4) errors.push('thumbnail_text has more than 4 words');
  if (!Array.isArray(script.sources) || script.sources.length < 2) errors.push('needs at least 2 sources');
  if (ch?.disclaimer && !(script.description || '').trim().endsWith(ch.disclaimer)) {
    errors.push('description must end with the medical disclaimer');
  }
  return { ok: errors.length === 0, errors, warnings, words: total, target };
}

module.exports = { validateScript, words };
