const path = require('path');

/**
 * Service xử lý visibility settings và schedule cho video YouTube
 */
class YoutubeUploadVisibilityService {
  /**
   * Thiết lập visibility (public, unlisted, private) và schedule (nếu có)
   * @param {Page} page - Puppeteer page
   * @param {string} visibility - public, unlisted, private
   * @param {string|null} scheduleDate - ISO date string (VD: '2024-01-15T10:00:00')
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async setVisibility(page, visibility, scheduleDate = null) {
    try {
      console.log('🔄 Đang chuyển đến trang Visibility...');

      // Click NEXT để qua các bước: Details -> Video elements -> Checks -> Visibility
      await this.navigateToVisibilityStep(page);
      await new Promise(r => setTimeout(r, 2000));

      // Chọn visibility
      console.log(`🔒 Đang chọn visibility: ${visibility}...`);
      const visClicked = await this.selectVisibilityOption(page, visibility);

      if (visClicked) {
        console.log(`✅ Đã chọn visibility: ${visibility}`);
      } else {
        console.log(`⚠️ Không tìm thấy option visibility: ${visibility}`);
        // Take screenshot for debugging
        const screenshotPath = path.join(__dirname, '../../../uploads', `visibility-error-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Đã chụp screenshot: ${screenshotPath}`);
        return { success: false, error: `Không tìm thấy option visibility: ${visibility}` };
      }

      await new Promise(r => setTimeout(r, 1000));

      // Nếu có scheduleDate, click vào Schedule section và điền thông tin
      if (scheduleDate) {
        console.log(`📅 Đang thiết lập schedule: ${scheduleDate}...`);
        const scheduleSuccess = await this.setScheduleDateTime(page, scheduleDate);
        
        if (!scheduleSuccess) {
          // Take screenshot for debugging
          const screenshotPath = path.join(__dirname, '../../../uploads', `schedule-error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath });
          console.log(`📸 Đã chụp screenshot: ${screenshotPath}`);
          return { success: false, error: 'Không thể thiết lập schedule date/time' };
        }
      }
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Lỗi setVisibility: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Navigate qua 3 steps để đến Visibility page
   */
  async navigateToVisibilityStep(page) {
    // Click NEXT 3 lần: Details -> Video elements -> Checks -> Visibility
    const stepNames = ['Details -> Video elements', 'Video elements -> Checks', 'Checks -> Visibility'];

    for (let i = 0; i < 3; i++) {
      console.log(`\n   📍 Step ${i + 1}/3: ${stepNames[i]}`);
      await new Promise(r => setTimeout(r, 2000));

      // Nếu đang ở step Checks (i === 1), đợi checks hoàn tất
      if (i === 1) {
        await this.waitForChecksComplete(page);
      }

      // Tìm và click nút Next
      const nextClicked = await page.evaluate(() => {
        const nextSelectors = [
          '#next-button',
          'ytcp-button#next-button',
          '[aria-label="Next"]',
          '[aria-label="Tiếp theo"]',
          'ytcp-button[id="next-button"]'
        ];

        for (const selector of nextSelectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            // Log trạng thái button
            const isDisabled = btn.hasAttribute('disabled') || btn.disabled;
            if (!isDisabled) {
              btn.click();
              return { clicked: true, selector, wasDisabled: false };
            } else {
              return { clicked: false, selector, wasDisabled: true, reason: 'Button is disabled' };
            }
          }
        }

        // Fallback: tìm button có text "Next"
        const buttons = document.querySelectorAll('ytcp-button, button');
        for (const btn of buttons) {
          if (btn.textContent.toLowerCase().includes('next') ||
            btn.textContent.toLowerCase().includes('tiếp')) {
            btn.click();
            return { clicked: true, selector: 'text-match' };
          }
        }

        return { clicked: false, reason: 'Button not found' };
      });

      if (nextClicked.clicked) {
        console.log(`   ✅ Click Next ${i + 1}/3 (${nextClicked.selector})`);
      } else {
        console.log(`   ⚠️ Không thể click Next ${i + 1}/3 - ${nextClicked.reason || 'Unknown'}`);
        if (nextClicked.wasDisabled) {
          console.log('      Button bị disabled, có thể do lỗi hoặc checks chưa xong');
        }
      }

      await new Promise(r => setTimeout(r, 1500));
    }
  }

  /**
   * Đợi checks hoàn tất ở step Checks
   */
  async waitForChecksComplete(page) {
    console.log('   ⏳ Đang ở step Checks, đợi kiểm tra hoàn tất...');

    // Đợi tối đa 5 phút cho checks hoàn tất (video dài cần nhiều thời gian)
    const maxWaitChecks = 300000; // 5 phút
    const startChecks = Date.now();

    while (Date.now() - startChecks < maxWaitChecks) {
      const checksStatus = await page.evaluate(() => {
        // Kiểm tra trạng thái checks
        const checksSection = document.querySelector('ytcp-video-metadata-checks');
        const progressBar = document.querySelector('ytcp-video-metadata-checks tp-yt-paper-progress');
        const checksComplete = document.querySelector('.checks-complete');
        const checksRunning = document.querySelector('.checks-running');

        // Kiểm tra text hiển thị từ toàn bộ trang
        const pageText = document.body.innerText;

        // ========== KIỂM TRA CÁC LỖI CỤ THỂ ==========
        const errorMessages = [];

        // Chỉ kiểm tra lỗi thực sự
        if (pageText.includes('Processing abandoned')) {
          errorMessages.push('Processing abandoned');
        }
        if (pageText.includes('Video is too long')) {
          errorMessages.push('Video is too long');
        }
        if (pageText.includes('Includes copyrighted content') ||
          pageText.includes('Copyright claim on your video') ||
          pageText.includes('Copyright-protected content found')) {
          errorMessages.push('Copyright claim detected');
        }
        if (pageText.includes('Upload failed') || pageText.includes('Tải lên thất bại')) {
          errorMessages.push('Upload failed');
        }
        if (pageText.includes('Video has been rejected') || pageText.includes('violates our Community Guidelines')) {
          errorMessages.push('Video rejected - violates Community Guidelines');
        }
        if (pageText.includes('Invalid file format') || pageText.includes('File type not supported')) {
          errorMessages.push('Invalid file format');
        }
        if (pageText.includes('daily upload limit') || pageText.includes('reached your daily limit')) {
          errorMessages.push('Daily upload limit reached');
        }

        // Kiểm tra nút Next có disabled không
        const nextBtn = document.querySelector('#next-button');
        const nextDisabled = nextBtn ? nextBtn.hasAttribute('disabled') : true;

        return {
          hasChecksSection: !!checksSection,
          hasProgressBar: !!progressBar,
          checksComplete: !!checksComplete,
          checksRunning: !!checksRunning,
          nextDisabled: nextDisabled,
          hasError: errorMessages.length > 0,
          errorMessages
        };
      });

      console.log(`      Checks status: complete=${checksStatus.checksComplete}, running=${checksStatus.checksRunning}, nextDisabled=${checksStatus.nextDisabled}, hasError=${checksStatus.hasError}`);

      // Nếu có lỗi, throw error ngay lập tức
      if (checksStatus.hasError) {
        const errorMsg = checksStatus.errorMessages.join(', ');
        console.error(`❌ YouTube Error: ${errorMsg}`);
        throw new Error(`YouTube upload error: ${errorMsg}`);
      }

      // Nếu checks hoàn tất VÀ nút Next không bị disabled, tiếp tục
      if (checksStatus.checksComplete && !checksStatus.nextDisabled) {
        console.log('   ✅ Checks đã hoàn tất, có thể tiếp tục');
        break;
      }

      // Nếu không có progress bar VÀ nút Next không bị disabled, có thể tiếp tục
      if (!checksStatus.hasProgressBar && !checksStatus.nextDisabled) {
        console.log('   ✅ Không có progress bar, có thể tiếp tục');
        break;
      }

      await new Promise(r => setTimeout(r, 3000)); // Đợi 3 giây mỗi lần check
    }
  }

  /**
   * Chọn visibility option (public/unlisted/private)
   */
  async selectVisibilityOption(page, visibility) {
    const visibilityMap = {
      'public': 'PUBLIC',
      'unlisted': 'UNLISTED',
      'private': 'PRIVATE'
    };

    return await page.evaluate((vis) => {
      // Tìm radio button theo name
      const selectors = [
        `[name="${vis}"]`,
        `tp-yt-paper-radio-button[name="${vis}"]`,
        `#${vis.toLowerCase()}-radio-button`
      ];

      for (const selector of selectors) {
        const radio = document.querySelector(selector);
        if (radio) {
          radio.click();
          return true;
        }
      }

      // Tìm theo text
      const radios = document.querySelectorAll('tp-yt-paper-radio-button');
      for (const radio of radios) {
        const text = radio.textContent.toLowerCase();
        if ((vis === 'PUBLIC' && text.includes('public')) ||
          (vis === 'UNLISTED' && text.includes('unlisted')) ||
          (vis === 'PRIVATE' && text.includes('private'))) {
          radio.click();
          return true;
        }
      }

      return false;
    }, visibilityMap[visibility] || 'PUBLIC');
  }

  /**
   * Thiết lập ngày giờ schedule cho video
   * @param {Page} page - Puppeteer page
   * @param {string} scheduleDate - ISO date string (VD: '2024-01-15T10:00:00')
   * @returns {Promise<boolean>} - true if schedule was set successfully, false otherwise
   */
  async setScheduleDateTime(page, scheduleDate) {
    // Parse date từ ISO string
    const date = new Date(scheduleDate);

    const day = date.getDate();
    const month = date.getMonth(); // 0-indexed
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Format các thành phần để log
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month];
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const timeStr = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    console.log(`   📅 Target Date: ${monthName} ${day}, ${year}`);
    console.log(`   ⏰ Target Time: ${timeStr}`);

    // 1. Expand Schedule section
    const scheduleExpanded = await this.expandScheduleSection(page);
    if (!scheduleExpanded) {
      console.log('   ❌ Không expand được Schedule section');
      return false;
    }

    await new Promise(r => setTimeout(r, 3000));

    // 2. Open Date Picker
    const datePickerOpened = await this.openDatePicker(page);
    if (!datePickerOpened) {
      console.log('   ❌ Không mở được Date Picker');
      return false;
    }

    await new Promise(r => setTimeout(r, 2000));

    // 3. Navigate to correct month/year
    await this.navigateToMonth(page, monthName, year);
    await new Promise(r => setTimeout(r, 1000));

    // 4. Select day
    const dayClicked = await this.selectDay(page, day);
    if (!dayClicked) {
      console.log(`      ❌ Không chọn được ngày: ${day}`);
      return false;
    }

    await new Promise(r => setTimeout(r, 2000));

    // 5. Set time
    const timeSet = await this.setTime(page, timeStr);
    if (!timeSet) {
      console.log('   ❌ Thất bại thiết lập Schedule datetime');
      return false;
    }

    console.log('   ✅ Hoàn tất thiết lập Schedule datetime');
    return true;
  }

  /**
   * Expand Schedule section
   */
  async expandScheduleSection(page) {
    console.log('   🔍 Looking for Schedule expand button...');

    const scheduleExpanded = await page.evaluate(() => {
      // PHƯƠNG PHÁP 1: Click button expand của Schedule section (MỚI - ƯU TIÊN)
      const expandButton = document.querySelector('#second-container-expand-button');
      if (expandButton) {
        expandButton.click();
        return { success: true, method: 'second-container-expand-button', aria: expandButton.getAttribute('aria-label') };
      }

      // PHƯƠNG PHÁP 2: Tìm ytcp-icon-button trong #second-container
      const secondContainer = document.querySelector('#second-container');
      if (secondContainer) {
        const iconButton = secondContainer.querySelector('ytcp-icon-button');
        if (iconButton) {
          iconButton.click();
          return { success: true, method: 'second-container-icon-button' };
        }
      }

      // PHƯƠNG PHÁP 3: Tìm button với text "Schedule" hoặc "Lên lịch"
      const allButtons = document.querySelectorAll('ytcp-icon-button, button, [role="button"]');
      for (const btn of allButtons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const tooltipLabel = btn.getAttribute('tooltip-label') || '';
        
        if (ariaLabel.toLowerCase().includes('expand') || 
            tooltipLabel.toLowerCase().includes('expand') ||
            ariaLabel.toLowerCase().includes('click to expand')) {
          // Check if this button is near "Schedule" text
          const parent = btn.closest('[id*="container"]');
          if (parent) {
            const parentText = parent.textContent || '';
            if (parentText.includes('Schedule') || parentText.includes('Lên lịch')) {
              btn.click();
              return { success: true, method: 'expand-button-near-schedule', aria: ariaLabel };
            }
          }
        }
      }

      // PHƯƠNG PHÁP 4: Tìm expandable section với "Schedule" text
      const expandableSections = document.querySelectorAll('[class*="expand"], [class*="collapsible"]');
      for (const section of expandableSections) {
        const text = section.textContent.toLowerCase();
        if (text.includes('schedule') && (text.includes('select a date') || text.includes('chọn ngày'))) {
          const header = section.querySelector('[class*="header"], [class*="trigger"], [role="button"]');
          if (header) {
            header.click();
            return { success: true, method: 'expandable-header' };
          }
          section.click();
          return { success: true, method: 'section-click' };
        }
      }

      // PHƯƠNG PHÁP 5: Fallback - tìm icon chevron_down
      const chevronButtons = document.querySelectorAll('[icon*="chevron"], [icon*="expand"]');
      for (const btn of chevronButtons) {
        const parent = btn.closest('[id*="container"]');
        if (parent) {
          const parentText = parent.textContent || '';
          if (parentText.includes('Schedule') || parentText.includes('Lên lịch')) {
            btn.click();
            return { success: true, method: 'chevron-icon' };
          }
        }
      }

      return { success: false, debug: { 
        hasSecondContainer: !!document.querySelector('#second-container'),
        hasExpandButton: !!document.querySelector('#second-container-expand-button')
      }};
    });

    console.log(`   Schedule expand result:`, scheduleExpanded);
    return scheduleExpanded.success;
  }

  /**
   * Open date picker dropdown
   */
  async openDatePicker(page) {
    console.log('   📅 Looking for Date Picker...');

    // Đợi thêm để schedule section mở hoàn toàn
    await new Promise(r => setTimeout(r, 3000));

    const datePickerOpened = await page.evaluate(() => {
      // PHƯƠNG PHÁP 1: Tìm ytcp-datetime-picker trong expanded section (MỚI - ƯU TIÊN)
      const datetimePicker = document.querySelector('ytcp-datetime-picker');
      if (datetimePicker) {
        // Tìm date input hoặc trigger trong datetime picker
        const dateInput = datetimePicker.querySelector('input, ytcp-text-dropdown-trigger, [role="button"]');
        if (dateInput) {
          dateInput.click();
          return { success: true, selector: 'ytcp-datetime-picker-input', element: dateInput.tagName };
        }
      }

      // PHƯƠNG PHÁP 2: Tìm trong #publish-from-private-non-sponsor (expanded content)
      const publishFromPrivate = document.querySelector('#publish-from-private-non-sponsor');
      if (publishFromPrivate && !publishFromPrivate.hasAttribute('hidden')) {
        const trigger = publishFromPrivate.querySelector('ytcp-text-dropdown-trigger, input, [role="button"]');
        if (trigger) {
          trigger.click();
          return { success: true, selector: 'publish-from-private-trigger' };
        }
      }

      // PHƯƠNG PHÁP 3: Tìm ytcp-visibility-scheduler
      const visibilityScheduler = document.querySelector('ytcp-visibility-scheduler');
      if (visibilityScheduler && !visibilityScheduler.hasAttribute('hidden')) {
        const datetimePicker2 = visibilityScheduler.querySelector('ytcp-datetime-picker');
        if (datetimePicker2) {
          const trigger = datetimePicker2.querySelector('input, ytcp-text-dropdown-trigger, [role="button"]');
          if (trigger) {
            trigger.click();
            return { success: true, selector: 'visibility-scheduler-trigger' };
          }
        }
      }

      // PHƯƠNG PHÁP 4: Tìm date picker theo selectors chuẩn
      const dateSelectors = [
        '#datepicker-trigger',
        'ytcp-text-dropdown-trigger#datepicker-trigger',
        'ytcp-date-picker #datepicker-trigger',
        '[id="datepicker-trigger"]'
      ];

      for (const sel of dateSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { // visible
          el.click();
          return { success: true, selector: sel };
        }
      }

      // PHƯƠNG PHÁP 5: Tìm element hiển thị ngày (pattern matching)
      const allTriggers = document.querySelectorAll('ytcp-text-dropdown-trigger, input[type="text"]');
      for (const trigger of allTriggers) {
        const value = trigger.value || trigger.textContent || '';
        // Match date patterns: "Jan 15, 2024" or "1/15/2024"
        if (value.match(/[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/) || value.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          trigger.click();
          return { success: true, selector: 'date-text-match', text: value.trim() };
        }
      }

      // PHƯƠNG PHÁP 6: Debug - check expanded state
      return { 
        success: false, 
        debug: { 
          hasDatetimePicker: !!document.querySelector('ytcp-datetime-picker'),
          hasVisibilityScheduler: !!document.querySelector('ytcp-visibility-scheduler'),
          publishFromPrivateHidden: document.querySelector('#publish-from-private-non-sponsor')?.hasAttribute('hidden'),
          secondContainerExpanded: document.querySelector('#second-container-expand-button')?.getAttribute('aria-expanded')
        }
      };
    });

    console.log(`   Date picker result:`, JSON.stringify(datePickerOpened, null, 2));
    
    // Nếu không mở được, chụp screenshot để debug
    if (!datePickerOpened.success) {
      const screenshotPath = path.join(__dirname, '../../../uploads', `datepicker-debug-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`   📸 Debug screenshot: ${screenshotPath}`);
    }
    
    return datePickerOpened.success;
  }

  /**
   * Navigate calendar to correct month/year
   */
  async navigateToMonth(page, targetMonth, targetYear) {
    console.log(`   🔄 Đang navigate tới tháng ${targetMonth} ${targetYear}...`);

    const maxMonthNavigate = 12;
    for (let i = 0; i < maxMonthNavigate; i++) {
      const calendarInfo = await page.evaluate(() => {
        const popup = document.querySelector('tp-yt-iron-dropdown[aria-hidden="false"], ytcp-date-picker');
        let headerText = '';
        if (popup) {
          const header = popup.querySelector('[class*="header"], [class*="month"], iron-label, #label');
          if (header) {
            headerText = header.textContent.trim();
          }
        }
        return { headerText };
      });

      console.log(`      Calendar header: "${calendarInfo.headerText}"`);

      const isCorrectMonth = calendarInfo.headerText.includes(targetMonth) &&
        calendarInfo.headerText.includes(String(targetYear));

      if (isCorrectMonth) {
        console.log(`      ✅ Đã đến đúng tháng: ${targetMonth} ${targetYear}`);
        break;
      }

      // Click Next Month button
      const nextMonthClicked = await page.evaluate(() => {
        const nextSelectors = [
          '#next-month',
          'ytcp-date-picker #next-month',
          '[aria-label*="Next" i]',
          'tp-yt-paper-icon-button:last-of-type'
        ];

        for (const sel of nextSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return { success: true, selector: sel };
          }
        }

        return { success: false };
      });

      if (!nextMonthClicked.success) {
        console.log('      ⚠️ Không tìm thấy nút Next Month');
        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  /**
   * Select day in calendar
   */
  async selectDay(page, targetDay) {
    console.log(`   📅 Selecting day ${targetDay}...`);

    const dayClicked = await page.evaluate((day) => {
      // Find calendar popup (có thể là tp-yt-iron-dropdown hoặc trong ytcp-datetime-picker)
      const daySelectors = [
        '.day:not(.disabled):not(.not-in-month)',
        'tp-yt-paper-button.day',
        '[role="gridcell"]',
        'button[class*="day"]'
      ];

      // PHƯƠNG PHÁP 1: Tìm trong popup dropdown
      const popup = document.querySelector('tp-yt-iron-dropdown[aria-hidden="false"], ytcp-date-picker, [class*="calendar"]');
      
      if (popup) {
        for (const sel of daySelectors) {
          const days = popup.querySelectorAll(sel);
          for (const d of days) {
            const text = d.textContent.trim();
            if (text === String(day) && !d.classList.contains('not-in-month') && !d.classList.contains('disabled')) {
              d.scrollIntoView({ block: 'center' });
              d.click();
              return { success: true, selector: sel + '-popup', dayText: text };
            }
          }
        }
      }

      // PHƯƠNG PHÁP 2: Tìm trong toàn bộ page (fallback)
      for (const sel of daySelectors) {
        const days = document.querySelectorAll(sel);
        for (const d of days) {
          const text = d.textContent.trim();
          if (text === String(day) && !d.classList.contains('not-in-month') && !d.classList.contains('disabled')) {
            d.scrollIntoView({ block: 'center' });
            d.click();
            return { success: true, selector: sel, dayText: text };
          }
        }
      }

      // PHƯƠNG PHÁP 3: Tìm element có textContent = ngày (không có class)
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        // Chỉ check elements không có children (leaf nodes)
        if (el.children.length === 0 && el.textContent.trim() === String(day)) {
          // Check xem có clickable không
          const parent = el.closest('[role="button"], button, .day, [class*="day"]');
          if (parent && !parent.classList.contains('disabled') && !parent.classList.contains('not-in-month')) {
            parent.scrollIntoView({ block: 'center' });
            parent.click();
            return { success: true, selector: 'leaf-element-parent', dayText: el.textContent };
          }
          
          // Hoặc click trực tiếp vào element
          if (el.onclick || el.closest('[onclick]')) {
            el.scrollIntoView({ block: 'center' });
            el.click();
            return { success: true, selector: 'leaf-element-direct', dayText: el.textContent };
          }
        }
      }

      // PHƯƠNG PHÁP 4: Debug - list all days found
      const debugDays = [];
      for (const sel of daySelectors) {
        const days = document.querySelectorAll(sel);
        for (const d of days) {
          debugDays.push({
            text: d.textContent.trim(),
            selector: sel,
            disabled: d.classList.contains('disabled'),
            notInMonth: d.classList.contains('not-in-month')
          });
        }
      }

      return { 
        success: false, 
        debug: {
          targetDay: day,
          daysFound: debugDays.length,
          daysList: debugDays.slice(0, 10) // First 10 days for debugging
        }
      };
    }, targetDay);

    console.log(`   Day click result:`, JSON.stringify(dayClicked, null, 2));

    if (dayClicked.success) {
      console.log(`      ✅ Selected day: ${targetDay}`);
    } else {
      console.log(`      ❌ Could not select day: ${targetDay}`);
      if (dayClicked.debug) {
        console.log(`      Debug: Found ${dayClicked.debug.daysFound} day elements`);
        if (dayClicked.debug.daysList && dayClicked.debug.daysList.length > 0) {
          console.log(`      Sample days:`, dayClicked.debug.daysList.slice(0, 5));
        }
      }
    }

    return dayClicked.success;
  }

  /**
   * Set time input - Enhanced with robust detection and comprehensive input methods
   * Based on proven patterns from older working code
   */
  async setTime(page, timeStr) {
    console.log(`   ⏰ Setting time: ${timeStr}...`);

    // STEP 1: Wait for time input to appear (DOM may re-render after date selection)
    console.log(`      ⏳ Waiting for time input to appear...`);
    let timeInputFound = false;
    const maxWaitTimeInput = 10000; // 10 seconds
    const startWaitTime = Date.now();
    
    while (Date.now() - startWaitTime < maxWaitTimeInput && !timeInputFound) {
      timeInputFound = await page.evaluate(() => {
        // DON'T search in scheduleSection anymore - it may have collapsed
        // Search in entire page instead
        
        // Method 1: Find input.tp-yt-paper-input
        const paperInputs = document.querySelectorAll('input.tp-yt-paper-input[autocomplete="off"]');
        if (paperInputs.length >= 2) return true;
        
        // Method 2: Find in visibility section
        const visibilitySection = document.querySelector('ytcp-video-metadata-visibility, ytcp-video-metadata-planner');
        if (visibilitySection) {
          const inputs = visibilitySection.querySelectorAll('input[autocomplete="off"]');
          if (inputs.length >= 2) return true;
        }
        
        // Method 3: Find tp-yt-iron-input
        const ironInputs = document.querySelectorAll('tp-yt-iron-input input[autocomplete="off"]');
        if (ironInputs.length >= 2) return true;
        
        return false;
      });
      
      if (!timeInputFound) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    if (!timeInputFound) {
      console.log(`      ❌ Timeout: Time input not found after 10 seconds`);
      return false;
    }

    console.log(`      ✅ Time input appeared`);
    await new Promise(r => setTimeout(r, 1000));

    // STEP 2: Click time input to focus - with multiple fallback methods
    console.log(`      🖱️  Clicking time input...`);
    const timeInputClicked = await page.evaluate(() => {
      // DON'T search in scheduleSection anymore - search in entire page
      // Because after date selection, schedule section may have collapsed
      
      let timeInput = null;
      
      // Method 1: Find tp-yt-iron-input#input-1 (from HTML: <tp-yt-iron-input id="input-1">)
      // May have 2: one for date, one for time
      const ironInputsWithId = document.querySelectorAll('tp-yt-iron-input#input-1');
      if (ironInputsWithId.length >= 2) {
        // Second iron-input is the time input
        timeInput = ironInputsWithId[1].querySelector('input.tp-yt-paper-input[autocomplete="off"]');
        console.log('Found via method 1: tp-yt-iron-input#input-1 (index 1)');
      } else if (ironInputsWithId.length === 1) {
        // If only 1, check if it's time input (value has time pattern)
        const inp = ironInputsWithId[0].querySelector('input[autocomplete="off"]');
        const value = inp?.value || '';
        if (value.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i)) {
          timeInput = inp;
          console.log('Found via method 1b: tp-yt-iron-input#input-1 (time pattern match)');
        }
      }
      
      // Method 2: Find input.tp-yt-paper-input in tp-yt-iron-input
      if (!timeInput) {
        const paperInputs = document.querySelectorAll('input.tp-yt-paper-input[autocomplete="off"]');
        if (paperInputs.length >= 2) {
          // Second input is time input (first is date)
          timeInput = paperInputs[1];
          console.log('Found via method 2: input.tp-yt-paper-input (index 1)');
        }
      }
      
      // Method 3: Find in visibility section
      if (!timeInput) {
        const visibilitySection = document.querySelector('ytcp-video-metadata-visibility, ytcp-video-metadata-planner');
        if (visibilitySection) {
          const ironInputs = visibilitySection.querySelectorAll('tp-yt-iron-input#input-1');
          if (ironInputs.length >= 2) {
            timeInput = ironInputs[1].querySelector('input[autocomplete="off"]');
            console.log('Found via method 3: visibility section iron-input (index 1)');
          }
        }
      }
      
      // Method 4: Find in tp-yt-paper-input containers
      if (!timeInput) {
        const paperInputContainers = document.querySelectorAll('tp-yt-paper-input');
        if (paperInputContainers.length >= 2) {
          timeInput = paperInputContainers[1].querySelector('input[autocomplete="off"]');
          console.log('Found via method 4: tp-yt-paper-input container (index 1)');
        }
      }
      
      // Method 5: Find all tp-yt-iron-input (without id restriction)
      if (!timeInput) {
        const ironInputs = document.querySelectorAll('tp-yt-iron-input');
        if (ironInputs.length >= 2) {
          timeInput = ironInputs[1].querySelector('input[autocomplete="off"]');
          console.log('Found via method 5: tp-yt-iron-input (index 1)');
        }
      }
      
      // Method 6: Find all visible inputs
      if (!timeInput) {
        const allInputs = document.querySelectorAll('input[autocomplete="off"]:not([style*="display: none"])');
        if (allInputs.length >= 2) {
          // Filter hidden inputs
          const visibleInputs = Array.from(allInputs).filter(inp => {
            const rect = inp.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (visibleInputs.length >= 2) {
            timeInput = visibleInputs[1];
            console.log('Found via method 6: visible inputs (index 1)');
          }
        }
      }
      
      // Method 7: Find by placeholder/value/aria-label containing time
      if (!timeInput) {
        const allInputs = document.querySelectorAll('input[autocomplete="off"]');
        for (const input of allInputs) {
          const placeholder = input.placeholder || '';
          const value = input.value || '';
          const ariaLabel = input.getAttribute('aria-label') || '';
          
          // Check time format: "5:54 PM", "17:54", etc.
          if (placeholder.toLowerCase().includes('time') ||
              ariaLabel.toLowerCase().includes('time') ||
              value.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i)) {
            timeInput = input;
            console.log('Found via method 7: time pattern/placeholder match');
            break;
          }
        }
      }
      
      if (timeInput) {
        // Log info for debugging
        console.log('Found time input:', {
          className: timeInput.className,
          id: timeInput.id,
          tagName: timeInput.tagName,
          parentTagName: timeInput.parentElement?.tagName,
          value: timeInput.value,
          placeholder: timeInput.placeholder
        });
        
        // Scroll into view first
        timeInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
        
        // Focus and click
        timeInput.focus();
        timeInput.click();
        
        return { 
          success: true, 
          value: timeInput.value,
          placeholder: timeInput.placeholder,
          id: timeInput.id,
          className: timeInput.className
        };
      }

      // Debug info if not found
      const paperInputCount = document.querySelectorAll('input.tp-yt-paper-input').length;
      const allInputCount = document.querySelectorAll('input[autocomplete="off"]').length;
      const visibleInputCount = Array.from(document.querySelectorAll('input[autocomplete="off"]')).filter(inp => {
        const rect = inp.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      
      return { 
        success: false, 
        error: 'Time input not found', 
        paperInputCount,
        allInputCount,
        visibleInputCount
      };
    });

    console.log(`      Click result:`, timeInputClicked);

    if (!timeInputClicked.success) {
      console.log(`      ⚠️ Could not click time input: ${timeInputClicked.error}`);
      if (timeInputClicked.paperInputCount !== undefined) {
        console.log(`      ℹ️  Debug: paperInputs=${timeInputClicked.paperInputCount}, allInputs=${timeInputClicked.allInputCount}, visible=${timeInputClicked.visibleInputCount}`);
      }
      return false;
    }

    console.log(`      ℹ️  Input ID: "${timeInputClicked.id || 'unknown'}"`);
    console.log(`      ℹ️  Current value: "${timeInputClicked.value}"`);
    console.log(`      ℹ️  Placeholder: "${timeInputClicked.placeholder || 'none'}"`);
    console.log(`      ℹ️  Class: "${timeInputClicked.className}"`);
    await new Promise(r => setTimeout(r, 500));

    // STEP 3: Clear default value - Multiple robust clearing methods
    console.log(`      ⌨️  Clearing default value...`);
    
    // Triple-click to select all (most natural for text input)
    await page.keyboard.press('Home'); // Move to start
    await new Promise(r => setTimeout(r, 200));
    
    const isMac = process.platform === 'darwin';
    
    // Select all with Ctrl/Cmd + A
    await page.keyboard.down(isMac ? 'Meta' : 'Control');
    await page.keyboard.press('a');
    await page.keyboard.up(isMac ? 'Meta' : 'Control');
    await new Promise(r => setTimeout(r, 300));
    
    // Delete selected text
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 300));
    
    // Verify if cleared
    const afterDelete = await page.evaluate(() => {
      // Find time input again to check value
      const ironInputsWithId = document.querySelectorAll('tp-yt-iron-input#input-1');
      if (ironInputsWithId.length >= 2) {
        const inp = ironInputsWithId[1].querySelector('input[autocomplete="off"]');
        return inp ? inp.value : null;
      }
      
      const paperInputs = document.querySelectorAll('input.tp-yt-paper-input[autocomplete="off"]');
      if (paperInputs.length >= 2) {
        return paperInputs[1].value;
      }
      
      return null;
    });
    
    console.log(`      ℹ️  Value after delete: "${afterDelete}"`);
    
    // If still has text, clear via JavaScript
    if (afterDelete && afterDelete.length > 0) {
      console.log(`      ⚠️  Still has text, clearing via JavaScript...`);
      await page.evaluate(() => {
        const ironInputsWithId = document.querySelectorAll('tp-yt-iron-input#input-1');
        if (ironInputsWithId.length >= 2) {
          const inp = ironInputsWithId[1].querySelector('input[autocomplete="off"]');
          if (inp) {
            inp.value = '';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          const paperInputs = document.querySelectorAll('input.tp-yt-paper-input[autocomplete="off"]');
          if (paperInputs.length >= 2) {
            paperInputs[1].value = '';
            paperInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            paperInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`      ✅ Default value cleared`);

    // STEP 4: Type new time
    console.log(`      ⌨️  Typing new time: ${timeStr}...`);
    await page.keyboard.type(timeStr, { delay: 100 });
    console.log(`      ✅ Typed time: ${timeStr}`);

    await new Promise(r => setTimeout(r, 500));

    // STEP 5: Press Enter to confirm
    console.log(`      ⏎ Pressing Enter...`);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));

    // STEP 6: Press Tab to trigger validation and move focus
    console.log(`      ⇥ Pressing Tab...`);
    await page.keyboard.press('Tab');

    console.log(`      ✅ Time input completed (Clear → Type → Enter → Tab)`);
    console.log(`      ⏱️  Waiting 2 seconds for YouTube to validate...`);
    await new Promise(r => setTimeout(r, 2000));

    return true;
  }
}

module.exports = new YoutubeUploadVisibilityService();
