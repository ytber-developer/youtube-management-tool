/**
 * Thao tác giống người thật cho luồng Puppeteer: nghỉ ngẫu nhiên, đưa chuột tới phần tử rồi mới bấm,
 * dán văn bản một lần (như Ctrl+V) thay vì gõ từng ký tự.
 */
const { sleep, randomDelay } = require('./timing.helper');

/** Nghỉ ngẫu nhiên trong [min, max] ms */
const pause = (min = 400, max = 1200) => sleep(randomDelay(min, max));

/** Số ngẫu nhiên trong [a, b) */
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Đưa chuột tới phần tử theo đường cong nhẹ (nhiều bước), dừng một nhịp rồi bấm.
 * @param {import('puppeteer').Page} page
 * @param {import('puppeteer').ElementHandle|string} target  handle hoặc selector
 * @returns {Promise<boolean>} false nếu không tìm thấy / không có kích thước
 */
async function humanClick(page, target, { scroll = true } = {}) {
  const el = typeof target === 'string' ? await page.$(target) : target;
  if (!el) return false;
  if (scroll) {
    try { await el.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); } catch { /* bỏ qua */ }
    await pause(150, 400);
  }
  const box = await el.boundingBox();
  if (!box) return false;
  // điểm bấm lệch khỏi tâm một chút, như tay người
  const x = box.x + box.width * rand(0.3, 0.7);
  const y = box.y + box.height * rand(0.3, 0.7);
  await page.mouse.move(x + rand(-80, 80), y + rand(-40, 40), { steps: Math.round(rand(6, 12)) });
  await page.mouse.move(x, y, { steps: Math.round(rand(8, 18)) });
  await pause(80, 220);
  await page.mouse.down();
  await pause(40, 120);
  await page.mouse.up();
  return true;
}

/**
 * Chọn toàn bộ nội dung ô đang focus. Chọn bằng Range/select() vì Cmd+A giả lập qua CDP trên macOS
 * không được trình duyệt xử lý như phím tắt thật; phím tắt chỉ là dự phòng.
 */
async function selectAll(page) {
  const done = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    if (typeof el.select === 'function' && 'value' in el) { el.select(); return true; }
    if (el.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
    return false;
  });
  if (done) return;
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(mod);
  await page.keyboard.press('a');
  await page.keyboard.up(mod);
}

/**
 * Dán văn bản vào ô đang focus trong một lần (sự kiện input giống Ctrl+V), không gõ từng ký tự.
 * @param {boolean} replace  true: chọn tất cả rồi thay thế nội dung cũ
 */
async function pasteText(page, text, { replace = false } = {}) {
  if (replace) {
    await selectAll(page);
    await pause(80, 200);
    await page.keyboard.press('Backspace');
    await pause(80, 200);
  }
  // sendCharacter gửi cả chuỗi qua CDP Input.insertText → một sự kiện input duy nhất, đúng như dán
  await page.keyboard.sendCharacter(text);
}

/** Lăn chuột một đoạn như người đang đọc trang */
async function humanScroll(page, dy = 300) {
  const steps = Math.max(2, Math.round(Math.abs(dy) / 120));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({ deltaY: dy / steps });
    await sleep(randomDelay(40, 120));
  }
}

module.exports = { pause, rand, humanClick, pasteText, selectAll, humanScroll };
