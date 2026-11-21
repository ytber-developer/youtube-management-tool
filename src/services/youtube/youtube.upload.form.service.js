const { cleanTitle, cleanDescription } = require('../../helpers/video.metadata.helper');
const { pause, humanClick, pasteText } = require('../../helpers/human.helper');

/**
 * Service xử lý form nhập thông tin video (title, description, audience)
 */
class YoutubeUploadFormService {
  /**
   * Nhập thông tin video (title, description, tags)
   */
  async fillVideoDetails(page, { title, description, tags, thumbnailPath }) {
    console.log('📝 Bắt đầu nhập thông tin video...');
    await pause(2000, 3500);

    // ========== BƯỚC 1: NHẬP TITLE ==========
    await this.fillTitle(page, title);
    await pause(700, 1600);

    // ========== BƯỚC 2: NHẬP DESCRIPTION ==========
    await this.fillDescription(page, description);
    await pause(700, 1600);

    // ========== BƯỚC 2b: THUMBNAIL (tuỳ chọn, không làm hỏng upload nếu thất bại) ==========
    if (thumbnailPath) {
      await this.uploadThumbnail(page, thumbnailPath).catch(e => console.log(`⚠️ Bỏ qua thumbnail: ${e.message}`));
      await pause(800, 1500);
    }

    // ========== BƯỚC 3: SCROLL XUỐNG VÀ CHỌN "NOT MADE FOR KIDS" ==========
    await this.selectAudience(page);
    await pause(1200, 2200);

    // ========== BƯỚC 4: TAGS (trong "Show more", tuỳ chọn) ==========
    if (Array.isArray(tags) && tags.length) {
      await this.fillTags(page, tags).catch(e => console.log(`⚠️ Bỏ qua tags: ${e.message}`));
      await pause(800, 1500);
    }

    console.log('✅ Hoàn tất nhập thông tin video');
  }

  /**
   * Tải thumbnail tuỳ chỉnh ở bước Details. Kênh chưa xác minh số điện thoại không được phép → chỉ cảnh báo.
   */
  async uploadThumbnail(page, thumbnailPath) {
    const fs = require('fs');
    if (!fs.existsSync(thumbnailPath)) throw new Error(`Không thấy file ${thumbnailPath}`);
    console.log('🖼️  Đang tải thumbnail...');

    await page.evaluate(() => {
      const el = document.querySelector('ytcp-thumbnails-compact-editor, ytcp-thumbnail-uploader, #thumbnails-container');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 1000));

    // Studio hay đổi DOM → thử nhiều selector, input ảnh (accept image) đứng cuối
    const selectors = [
      'ytcp-thumbnails-compact-editor input[type="file"]',
      'ytcp-thumbnail-uploader input[type="file"]',
      'input#file-loader[type="file"]',
      'ytcp-video-metadata-editor input[type="file"][accept*="image"]',
    ];
    let input = null;
    for (const sel of selectors) {
      input = await page.$(sel);
      if (input) { console.log(`   input thumbnail: ${sel}`); break; }
    }
    if (!input) {
      const blocked = await page.evaluate(() => /verify|xác minh/i.test((document.querySelector('ytcp-thumbnails-compact-editor, #thumbnails-container') || {}).innerText || ''));
      throw new Error(blocked ? 'kênh cần xác minh số điện thoại mới được dùng thumbnail tuỳ chỉnh' : 'không tìm thấy ô tải thumbnail');
    }
    await input.uploadFile(thumbnailPath);
    await new Promise(r => setTimeout(r, 4000));

    const state = await page.evaluate(() => {
      const box = document.querySelector('ytcp-thumbnails-compact-editor, #thumbnails-container');
      const txt = (box && box.innerText) || '';
      return { hasImg: !!(box && box.querySelector('img[src^="blob:"], img[src^="data:"], img[src*="ytimg"]')), verify: /verify your account|xác minh/i.test(txt) };
    });
    if (state.verify) throw new Error('kênh cần xác minh số điện thoại mới được dùng thumbnail tuỳ chỉnh');
    console.log(state.hasImg ? '✅ Đã tải thumbnail' : '⚠️ Đã gửi thumbnail nhưng chưa thấy ảnh hiện (Studio có thể còn xử lý)');
  }

  /**
   * Nhập tags: bấm "Show more" rồi gõ vào ô Tags, phân cách bằng dấu phẩy (YouTube giới hạn 500 ký tự)
   */
  async fillTags(page, tags) {
    const clean = [];
    let len = 0;
    for (const t of tags.map(x => String(x).replace(/[<>,]/g, ' ').trim()).filter(Boolean)) {
      if (len + t.length + 1 > 500) break;
      clean.push(t); len += t.length + 1;
    }
    if (!clean.length) return;
    console.log(`🏷️  Đang nhập ${clean.length} tags...`);

    // "Show more" mở phần nâng cao (tags nằm trong đó); nếu đã mở thì ô tags có sẵn
    const hasInput = () => page.$('#tags-container input, ytcp-chip-bar input#text-input, ytcp-form-input-container#tags-container #text-input');
    if (!(await hasInput())) {
      const opened = await page.evaluate(() => {
        const btn = document.querySelector('ytcp-video-metadata-editor #toggle-button, #toggle-button')
          || [...document.querySelectorAll('ytcp-button, button')].find(b => /show more|hiển thị thêm/i.test(b.textContent || ''));
        if (!btn) return false;
        btn.scrollIntoView({ block: 'center' }); btn.click(); return true;
      });
      if (!opened) throw new Error('không tìm thấy nút "Show more"');
      await new Promise(r => setTimeout(r, 2000));
    }
    const input = await hasInput();
    if (!input) throw new Error('không tìm thấy ô Tags');
    if (!(await humanClick(page, input))) await input.click();
    await pause(300, 600);
    await pasteText(page, clean.join(',') + ',');
    await pause(800, 1400);
    const countChips = () => page.evaluate(() => document.querySelectorAll('#tags-container ytcp-chip, ytcp-chip-bar ytcp-chip').length);
    let chips = await countChips();
    if (!chips) { // ô tags không tách chip khi dán → gõ nhanh
      await page.keyboard.type(clean.join(',') + ',', { delay: 15 });
      await pause(600, 1000);
      chips = await countChips();
    }
    console.log(chips ? `✅ Đã nhập tags (${chips} chip)` : '⚠️ Đã nhập tags nhưng không thấy chip nào');
  }

  /**
   * Nhập title (YouTube giới hạn 100 ký tự)
   */
  async fillTitle(page, title) {
    // Use helper to clean title
    const finalTitle = cleanTitle(title, 100);
    
    console.log('📝 Đang nhập title...');
    console.log(`   Title: "${finalTitle}"`);


    // Tìm title textbox bằng Puppeteer
    let titleTextbox = await page.$('#title-textarea #textbox');
    if (!titleTextbox) {
      titleTextbox = await page.$('ytcp-social-suggestions-textbox #textbox');
    }
    if (!titleTextbox) {
      const textboxes = await page.$$('div#textbox[contenteditable="true"]');
      if (textboxes.length > 0) {
        titleTextbox = textboxes[0];
      }
    }

    if (titleTextbox) {
      // Bấm vào ô (chuột người thật) → chọn hết chữ cũ → dán tiêu đề một lần, như Ctrl+V
      if (!(await humanClick(page, titleTextbox))) await titleTextbox.click();
      await pause(300, 700);
      await pasteText(page, finalTitle, { replace: true });
      await pause(300, 700);

      // Kiểm tra lại; nếu Studio không nhận sự kiện dán thì gõ nhanh
      const got = await page.evaluate(el => (el.textContent || '').trim(), titleTextbox);
      if (got !== finalTitle.trim()) {
        console.log('   ⚠️ Dán tiêu đề không khớp, gõ lại...');
        await titleTextbox.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.keyboard.type(finalTitle, { delay: 15 });
      }
      console.log(`✅ Đã nhập title: "${finalTitle}"`);
    } else {
      console.log('⚠️ Không tìm thấy title textbox');
    }
  }

  /**
   * Nhập description
   * YouTube hỗ trợ xuống dòng trong description, nên giữ nguyên format
   */
  async fillDescription(page, description) {
    if (!description) return;

    // Use helper to clean description
    const finalDescription = cleanDescription(description, 5000);

    console.log('📝 Đang nhập description...');
    console.log(`   Description preview: "${finalDescription.substring(0, 100)}${finalDescription.length > 100 ? '...' : ''}"`);

    // Bấm vào ô mô tả rồi dán nguyên khối (giữ xuống dòng), không gõ từng ký tự
    let descTextbox = await page.$('#description-textarea #textbox');
    if (!descTextbox) {
      descTextbox = await page.$('ytcp-video-description #textbox, #description-container #textbox');
    }
    if (!descTextbox) {
      console.log('⚠️ Không tìm thấy description textbox');
      return;
    }
    if (!(await humanClick(page, descTextbox))) await descTextbox.click();
    await pause(300, 700);
    await pasteText(page, finalDescription, { replace: true });
    await pause(400, 900);
    const got = await page.evaluate(el => (el.textContent || '').trim().length, descTextbox);
    if (got < Math.min(20, finalDescription.trim().length)) {
      console.log('   ⚠️ Dán mô tả không vào, gõ nhanh...');
      await page.keyboard.type(finalDescription, { delay: 5 });
    }
    console.log(`✅ Đã nhập description (${finalDescription.length} ký tự)`);
  }

  /**
   * Chọn "Not made for kids" trong Audience section
   */
  async selectAudience(page) {
    console.log('🔍 Đang tìm phần Audience...');

    // Tìm container scrollable trong dialog và scroll xuống
    await page.evaluate(() => {
      // Tìm các container có thể scroll trong upload dialog
      const scrollContainers = [
        document.querySelector('ytcp-uploads-dialog #scrollable-content'),
        document.querySelector('ytcp-uploads-dialog .scrollable-content'),
        document.querySelector('#details ytcp-mention-textbox'),
        document.querySelector('ytcp-video-metadata-editor-basics'),
        document.querySelector('#scrollable-content')
      ];

      for (const container of scrollContainers) {
        if (container && container.scrollHeight > container.clientHeight) {
          container.scrollTop = container.scrollHeight;
          console.log('Scrolled container:', container.tagName, container.id || container.className);
          return;
        }
      }

      // Fallback: scroll bằng cách tìm Audience section và scrollIntoView
      const audienceEl = document.querySelector('ytcp-video-metadata-audience');
      if (audienceEl) {
        audienceEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Đợi và tìm Audience section
    let audienceFound = false;
    try {
      await page.waitForSelector('ytcp-video-metadata-audience', { timeout: 10000 });
      audienceFound = true;
      console.log('   ✅ Tìm thấy Audience section');
    } catch (e) {
      console.log('   ⚠️ Không tìm thấy Audience section selector');
    }

    // Scroll thêm để hiện radio buttons
    await page.evaluate(() => {
      const audienceSection = document.querySelector('ytcp-video-metadata-audience');
      if (audienceSection) {
        // Scroll Audience section vào view
        audienceSection.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Tìm và click "No, it's not made for kids"
    let notForKidsClicked = false;

    // Phương pháp 1: Tìm radio button bằng attribute name
    console.log('   Phương pháp 1: Tìm bằng name attribute...');
    const audienceRadio = await page.$('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]');
    if (audienceRadio) {
      await audienceRadio.scrollIntoViewIfNeeded();
      await pause(400, 900);
      if (!(await humanClick(page, audienceRadio))) await audienceRadio.click();
      notForKidsClicked = true;
      console.log('   ✅ Clicked NOT_MADE_FOR_KIDS radio (method 1)');
    }

    // Phương pháp 2: Click radio thứ 2 trong Audience section
    if (!notForKidsClicked) {
      console.log('   Phương pháp 2: Click radio thứ 2...');
      notForKidsClicked = await page.evaluate(() => {
        const audienceSection = document.querySelector('ytcp-video-metadata-audience');
        if (audienceSection) {
          const radios = audienceSection.querySelectorAll('tp-yt-paper-radio-button');
          console.log('Found', radios.length, 'radios');
          if (radios.length >= 2) {
            radios[1].scrollIntoView({ block: 'center' });
            radios[1].click();
            return true;
          }
        }
        return false;
      });
      if (notForKidsClicked) {
        console.log('   ✅ Clicked radio thứ 2 (method 2)');
      }
    }

    // Phương pháp 3: Tìm bằng text content
    if (!notForKidsClicked) {
      console.log('   Phương pháp 3: Tìm bằng text...');
      notForKidsClicked = await page.evaluate(() => {
        const allRadios = document.querySelectorAll('tp-yt-paper-radio-button');
        for (const radio of allRadios) {
          const text = radio.textContent.toLowerCase();
          if (text.includes('no, it') || text.includes('not made for kids') || text.includes('không phải')) {
            radio.scrollIntoView({ block: 'center' });
            radio.click();
            return true;
          }
        }
        return false;
      });
      if (notForKidsClicked) {
        console.log('   ✅ Clicked bằng text match (method 3)');
      }
    }

    // Phương pháp 4: Click bằng tọa độ
    if (!notForKidsClicked) {
      console.log('   Phương pháp 4: Click bằng mouse coordinate...');
      const radioGroup = await page.$('ytcp-video-metadata-audience tp-yt-paper-radio-group');
      if (radioGroup) {
        const box = await radioGroup.boundingBox();
        if (box) {
          // Radio thứ 2 thường nằm ở dưới, cách radio 1 khoảng 40-50px
          await page.mouse.click(box.x + 20, box.y + 50);
          await new Promise(r => setTimeout(r, 500));
          notForKidsClicked = true;
          console.log('   ✅ Clicked bằng mouse (method 4)');
        }
      }
    }

    if (notForKidsClicked) {
      console.log('✅ Đã chọn "Not made for kids"');
    } else {
      console.log('⚠️ Không tìm thấy option "Not made for kids"');
    }
  }
}

module.exports = new YoutubeUploadFormService();
