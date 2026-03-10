const { cleanTitle, cleanDescription } = require('../../helpers/video.metadata.helper');

/**
 * Service xử lý form nhập thông tin video (title, description, audience)
 */
class YoutubeUploadFormService {
  /**
   * Nhập thông tin video (title, description, tags)
   */
  async fillVideoDetails(page, { title, description, tags }) {
    console.log('📝 Bắt đầu nhập thông tin video...');
    await new Promise(r => setTimeout(r, 3000));

    // ========== BƯỚC 1: NHẬP TITLE ==========
    await this.fillTitle(page, title);
    await new Promise(r => setTimeout(r, 1000));

    // ========== BƯỚC 2: NHẬP DESCRIPTION ==========
    await this.fillDescription(page, description);
    await new Promise(r => setTimeout(r, 1000));

    // ========== BƯỚC 3: SCROLL XUỐNG VÀ CHỌN "NOT MADE FOR KIDS" ==========
    await this.selectAudience(page);
    await new Promise(r => setTimeout(r, 2000));

    console.log('✅ Hoàn tất nhập thông tin video');
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
      // PHƯƠNG PHÁP: Triple-click để select all -> Delete -> Type new text
      // Triple-click là cách tự nhiên nhất để select all text trong contenteditable

      // Bước 1: Click vào textbox để focus
      await titleTextbox.click();
      await new Promise(r => setTimeout(r, 300));

      // Bước 2: Triple-click để select all text
      await titleTextbox.click({ clickCount: 3 });
      await new Promise(r => setTimeout(r, 300));

      // Bước 3: Nhấn Delete/Backspace để xóa text đã select
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, 300));

      // Bước 4: Kiểm tra đã xóa chưa, nếu chưa thì thử Ctrl+A
      const afterDelete = await page.evaluate(el => el.textContent, titleTextbox);
      if (afterDelete && afterDelete.length > 0) {
        await titleTextbox.click();
        await new Promise(r => setTimeout(r, 200));

        // Select all bằng keyboard shortcut
        const isMac = process.platform === 'darwin';
        await page.keyboard.down(isMac ? 'Meta' : 'Control');
        await page.keyboard.press('a');
        await page.keyboard.up(isMac ? 'Meta' : 'Control');
        await new Promise(r => setTimeout(r, 200));

        await page.keyboard.press('Backspace');
        await new Promise(r => setTimeout(r, 300));
      }

      // Bước 5: Type title mới
      await page.keyboard.type(finalTitle, { delay: 30 });

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

    // Click vào description để focus
    const descTextbox = await page.$('#description-textarea #textbox');
    if (descTextbox) {
      // Click 2 lần để chắc chắn focus
      await descTextbox.click();
      await new Promise(r => setTimeout(r, 300));
      await descTextbox.click();
      await new Promise(r => setTimeout(r, 500));

      // Gõ description (giữ nguyên xuống dòng)
      await page.keyboard.type(finalDescription, { delay: 30 });
      console.log(`✅ Đã nhập description (${finalDescription.length} ký tự)`);
    } else {
      console.log('⚠️ Không tìm thấy description textbox, thử selector khác...');

      // Thử click bằng evaluate
      const clicked = await page.evaluate(() => {
        const descArea = document.querySelector('#description-textarea');
        const textbox = descArea?.querySelector('#textbox');
        if (textbox) {
          textbox.click();
          textbox.focus();
          return true;
        }
        return false;
      });

      if (clicked) {
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.type(finalDescription, { delay: 30 });
        console.log(`✅ Đã nhập description (fallback) (${finalDescription.length} ký tự)`);
      }
    }
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
      await new Promise(r => setTimeout(r, 500));
      await audienceRadio.click();
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
