const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { markUploaded, isYoutubeUrl } = require('../lib/uploaded');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'uploaded-'));

test('isYoutubeUrl chỉ nhận link YouTube https', () => {
  assert.ok(isYoutubeUrl('https://youtu.be/abc123'));
  assert.ok(isYoutubeUrl('https://www.youtube.com/watch?v=abc'));
  assert.ok(!isYoutubeUrl('http://youtu.be/abc'));
  assert.ok(!isYoutubeUrl('Processing...'));
  assert.ok(!isYoutubeUrl(null));
});

test('markUploaded ghi uploadedUrl, giữ trường khác, "-" bỏ đánh dấu', () => {
  const dir = tmp();
  assert.deepStrictEqual(markUploaded(dir, 'https://youtu.be/a'), { uploadedUrl: 'https://youtu.be/a' });
  fs.writeFileSync(path.join(dir, 'review.json'), '{"imagesReviewed":true}');
  assert.deepStrictEqual(markUploaded(dir, 'https://youtu.be/b'), { imagesReviewed: true, uploadedUrl: 'https://youtu.be/b' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'review.json'), 'utf8')).uploadedUrl, 'https://youtu.be/b');
  assert.deepStrictEqual(markUploaded(dir, '-'), { imagesReviewed: true });
});

test('markUploaded từ chối link không phải YouTube và review.json hỏng', () => {
  const dir = tmp();
  assert.throws(() => markUploaded(dir, 'https://example.com/x'), /Không phải link YouTube/);
  fs.writeFileSync(path.join(dir, 'review.json'), '[1,2]');
  assert.deepStrictEqual(markUploaded(dir, 'https://youtu.be/c'), { uploadedUrl: 'https://youtu.be/c' });
});
