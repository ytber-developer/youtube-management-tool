// Danh mục hợp lệ cho `anim` của từng cảnh (khớp với content-tools/anim/stage.js) + kiểm tra.
const ACTIONS = ['talk', 'wave', 'point', 'think', 'shocked', 'cheer', 'walk', 'run', 'exercise', 'float', 'fall-toward', 'stretch',
  'swallowed', 'hold-breath', 'breathe', 'tired', 'sleep', 'yawn', 'sit', 'jump', 'shiver', 'eat', 'drink', 'look-up', 'grow', 'shrink',
  'spin', 'sick', 'present', 'hidden'];
const ATS = ['right', 'left', 'center', 'top', 'far-right', 'above', 'top-left', 'bottom-right', 'hand', 'bubble'];
const SIZES = ['s', 'm', 'l', 'xl'];
const PROP_ANIMS = ['none', 'spin', 'pulse', 'bob', 'orbit', 'fall', 'grow', 'shrink', 'shake', 'approach', 'fade-in'];
const BGS = ['space', 'night', 'paper', 'room', 'park', 'lab', 'sky', 'body'];
const CAMERAS = ['drift', 'none', 'zoom-in', 'zoom-out', 'shake'];
const FACES = ['smile', 'grin', 'worry', 'shock', 'think', 'sleep', 'hold', 'sick'];

function validateAnim(a = {}) {
  const e = [];
  if (!ACTIONS.includes(a.action)) e.push(`unknown action "${a.action}"`);
  if (a.bg && !BGS.includes(a.bg)) e.push(`unknown bg "${a.bg}"`);
  if (a.camera && !CAMERAS.includes(a.camera)) e.push(`unknown camera "${a.camera}"`);
  if (a.face && !FACES.includes(a.face)) e.push(`unknown face "${a.face}"`);
  if (a.text && a.text.split(/\s+/).length > 4) e.push(`text "${a.text}" is longer than 4 words`);
  for (const p of a.props || []) {
    if (!p.icon) e.push('prop without icon');
    if (p.at && !ATS.includes(p.at)) e.push(`unknown prop position "${p.at}"`);
    if (p.size && !SIZES.includes(p.size)) e.push(`unknown prop size "${p.size}"`);
    if (p.anim && !PROP_ANIMS.includes(p.anim)) e.push(`unknown prop anim "${p.anim}"`);
  }
  if ((a.props || []).length > 4) e.push('more than 4 props');
  return e;
}

module.exports = { ACTIONS, ATS, SIZES, PROP_ANIMS, BGS, CAMERAS, FACES, validateAnim };
