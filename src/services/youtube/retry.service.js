const { CHANNEL_CREATION, YOUTUBE_SELECTORS, RETRY_STRATEGIES } = require('../../config/constants');
const nameGenerator = require('../../helpers/name.generator');

class RetryService {
  /**
   * Find name input field using multiple strategies
   * @param {Page} page - Puppeteer page
   * @returns {Promise<ElementHandle|null>}
   */
  async findNameInput(page) {
    // Method 1: Find by label="Name"
    try {
      const nameInput = await page.evaluateHandle(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const nameLabel = labels.find(l => l.textContent.trim() === 'Name');
        if (nameLabel) {
          const labelFor = nameLabel.getAttribute('for');
          if (labelFor) {
            const ironInput = document.getElementById(labelFor)?.closest('tp-yt-iron-input');
            return ironInput?.querySelector('input');
          }
        }
        return null;
      });

      if (nameInput && nameInput.asElement()) {
        console.log('   ✅ Found Name input by label');
        return nameInput.asElement();
      }
    } catch (e) {
      console.log('   ⚠️  Label="Name" method failed');
    }

    // Method 2: Find by title-input id
    try {
      const nameInput = await page.$(YOUTUBE_SELECTORS.TITLE_INPUT);
      if (nameInput) {
        console.log('   ✅ Found Name input with #title-input selector');
        return nameInput;
      }
    } catch (e) {
      console.log('   ⚠️  #title-input not found');
    }

    // Method 3: Find first input in all paper inputs
    try {
      const allInputs = await page.$$('tp-yt-paper-input tp-yt-iron-input input');
      if (allInputs && allInputs.length > 0) {
        console.log('   ✅ Found Name input (first input)');
        return allInputs[0];
      }
    } catch (e) {
      console.log('   ⚠️  First input method failed');
    }

    return null;
  }

  /**
   * Clear input field thoroughly
   * @param {Page} page 
   * @param {ElementHandle} input 
   */
  async clearInput(page, input) {
    await input.click();
    await new Promise(r => setTimeout(r, 300));

    // Clear using evaluate
    await page.evaluate(el => {
      el.value = '';
      el.focus();
    }, input);

    // Keyboard clear as backup
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 500));
  }

  /**
   * Type new name into input
   * @param {ElementHandle} input 
   * @param {string} name 
   */
  async typeNewName(input, name) {
    await input.type(name, { delay: CHANNEL_CREATION.INPUT_DELAY });
    console.log(`✅ Đã nhập tên mới: "${name}"`);
    await new Promise(r => setTimeout(r, CHANNEL_CREATION.WAIT_AFTER_INPUT));
  }

  /**
   * Click "Create channel" button
   * @param {Page} page 
   * @returns {Promise<boolean>}
   */
  async clickCreateButton(page) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('create channel');
      });
      if (createBtn) {
        createBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await new Promise(r => setTimeout(r, CHANNEL_CREATION.WAIT_AFTER_CLICK));
    }

    return clicked;
  }

  /**
   * Check for error message
   * @param {Page} page 
   * @returns {Promise<string|null>}
   */
  async checkForError(page) {
    return await page.evaluate(() => {
      const errorContainer = document.querySelector('.error-container.style-scope.ytd-channel-creation-dialog-renderer');
      if (errorContainer) {
        const errorText = errorContainer.querySelector('yt-formatted-string.error');
        if (errorText) {
          return errorText.textContent?.trim();
        }
      }

      const errorElements = Array.from(document.querySelectorAll('yt-formatted-string.error, div.error'));
      for (const el of errorElements) {
        const text = el.textContent?.trim() || '';
        if (text.includes("This name can't be used")) {
          return text;
        }
      }
      return null;
    });
  }

  /**
   * Attempt to retry channel creation with new name
   * @param {Page} page 
   * @param {string} baseName - Original channel name
   * @param {string} strategy - Retry strategy
   * @returns {Promise<{success: boolean, name: string}>}
   */
  async retryWithStrategy(page, baseName, strategy) {
    console.log(`   🔍 Tìm Name input field...`);

    const nameInput = await this.findNameInput(page);
    if (!nameInput) {
      console.log('   ⚠️  Không tìm thấy Name input');
      return { success: false, name: baseName };
    }

    // Generate new name
    const newName = nameGenerator.generateRetryName(baseName, strategy);
    console.log(`   📝 New name (${strategy}): "${newName}"`);

    // Clear and type new name
    console.log('   📝 Đang cập nhật Name field...');
    await this.clearInput(page, nameInput);
    await this.typeNewName(nameInput, newName);

    // Click create button
    const clicked = await this.clickCreateButton(page);
    if (clicked) {
      console.log(`✅ Đã click "Create channel"`);
    }

    return { success: clicked, name: newName };
  }
}

module.exports = new RetryService();
