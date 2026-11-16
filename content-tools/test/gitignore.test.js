const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

// Mọi file media sinh ra (kể cả file tạm khi render lỗi giữa chừng) không được lọt vào git
test('generated media and render leftovers under content/ are gitignored', () => {
  const v = 'content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole';
  const files = ['final.mp4', 'preview.mp4', 'voice.mp3', 'captions.srt', 'thumbnail.png', 'images/scene01.jpg', 'slides/scene01.png',
    'caps/c0001.png', 'final.mp4.part.mp4', 'preview.mp4.part.mp4', 'voice.part.mp3'].map(f => `${v}/${f}`);
  const out = execFileSync('git', ['check-ignore', '--no-index', ...files], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' });
  assert.deepStrictEqual(out.trim().split('\n').sort(), files.sort());
});
