const commentHelper = require('../../helpers/comment.helper');

class WatchNormalPuppeteerService {

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Watch regular YouTube video with human-like behavior
   */
  async watchVideo(page, videoUrl, duration = 30, options = {}) {
    const {
      humanBehavior = true,
      randomDuration = false,
      autoLike = false,
      autoSubscribe = false,
      autoComment = false
    } = options;

    let actualDuration = duration;

    try {
      console.log(`\n🎬 [VIDEO] Navigating to: ${videoUrl}`);

      if (humanBehavior) {
        await this.sleep(this.randomDelay(2000, 5000));
      }

      await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for video player
      try {
        await page.waitForSelector('video', { timeout: 30000 });
        await this.sleep(this.randomDelay(1000, 2000));
        console.log('✅ Video player ready');
      } catch (e) {
        console.warn('⚠️  Video player not ready, continuing...');
      }

      // Compute watch time (45% rule, max 200s)
      try {
        const videoDuration = await page.evaluate(() => {
          const v = document.querySelector('video');
          return (v && v.duration && isFinite(v.duration) && v.duration > 0) ? v.duration : null;
        });
        if (videoDuration) {
          const minWatch = Math.ceil(videoDuration * 0.45);
          if (minWatch > actualDuration) {
            actualDuration = minWatch;
          }
        }
      } catch (e) {}

      // Hard cap at 200s
      if (actualDuration > 200) {
        actualDuration = 200;
      }
      console.log(`📊 [VIDEO] Watch time: ${actualDuration}s`);

      // Focus video and ensure playback
      try {
        const video = await page.$('video');
        if (video) {
          const box = await video.boundingBox();
          const x = box ? box.x + box.width / 2 : 640;
          const y = box ? box.y + box.height / 2 : 360;
          await page.mouse.move(x, y, { steps: 8 });
          await this.sleep(this.randomDelay(300, 800));
        }

        const isPlaying = await page.evaluate(() => {
          const v = document.querySelector('video');
          return v && !v.paused;
        });

        if (!isPlaying) {
          await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v && v.paused) { try { v.play(); } catch (e) {} }
          });
          console.log('▶️  Requested play');
          await this.sleep(this.randomDelay(500, 1200));
        }
      } catch (e) {
        console.log('ℹ️  Could not focus video');
      }

      // Dismiss popups
      try {
        const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Agree"]');
        if (consentBtn) { await consentBtn.click(); await this.sleep(500); }
        const skipBtn = await page.$('tp-yt-paper-dialog button.yt-button-renderer');
        if (skipBtn) { await skipBtn.click(); await this.sleep(500); }
        await page.keyboard.press('Escape');
        await this.sleep(300);
      } catch (e) {}

      // Auto subscribe + like early (before main watch loop)
      if (autoSubscribe) {
        await this.subscribeChannel(page, humanBehavior);
      }
      if (autoLike) {
        await this.likeVideo(page, humanBehavior);
      }

      // Use random duration if enabled (still capped at 200s)
      if (randomDuration) {
        actualDuration = Math.min(this.randomDelay(30, 180), 200);
        console.log(`🎲 Random duration: ${actualDuration}s`);
      }

      // Watch video
      console.log(`👀 Watching for ${actualDuration}s...`);
      if (humanBehavior) {
        await this.simulateVideoWatching(page, actualDuration);
      } else {
        await this.sleep(actualDuration * 1000);
      }

      // Auto comment after watching
      if (autoComment) {
        await this.commentOnVideo(page, humanBehavior);
      }

      console.log('✅ [VIDEO] Finished watching\n');

      return { success: true, type: 'video', duration: actualDuration };

    } catch (error) {
      console.error('❌ [VIDEO] Error:', error.message);
      throw error;
    }
  }

  /**
   * Simulate human behavior while watching
   */
  async simulateVideoWatching(page, durationInSeconds) {
    console.log('🎭 [VIDEO] Simulating human behavior...');

    const startTime = Date.now();
    const actions = [];
    let volumeAdjusted = false;

    while (Date.now() - startTime < durationInSeconds * 1000) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remainingTime = durationInSeconds - elapsedSeconds;

      if (remainingTime <= 0) break;

      try {
        // Adjust volume once between 40-45s
        if (!volumeAdjusted && elapsedSeconds >= 40 && elapsedSeconds <= 45) {
          const key = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          await page.keyboard.press(key);
          actions.push('volume');
          volumeAdjusted = true;
          await this.sleep(1000);
          continue;
        }

        if (Math.random() < 0.4) {
          // Scroll (40%)
          const scrollAmount = this.randomDelay(100, 300);
          await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
          }, scrollAmount);
          actions.push('scroll');
          await this.sleep(this.randomDelay(2000, 3000));
        } else {
          // Watch (60%)
          const watchTime = Math.min(this.randomDelay(2, 4), remainingTime);
          await this.sleep(watchTime * 1000);
          actions.push('watch');
        }

      } catch (e) {}
    }

    console.log(`✅ [VIDEO] Actions: ${actions.join(', ')}`);
  }

  /**
   * Subscribe to channel
   */
  async subscribeChannel(page, humanBehavior = true) {
    try {
      console.log('📺 [VIDEO] Subscribing...');

      if (humanBehavior) await this.sleep(this.randomDelay(1000, 2000));

      const selectors = [
        '#subscribe-button-shape button[aria-label*="Subscribe"]',
        'ytd-subscribe-button-renderer #subscribe-button button'
      ];

      for (const selector of selectors) {
        const btn = await page.$(selector);
        if (!btn) continue;

        const text = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (text === 'subscribe') {
          await btn.click();
          console.log('✅ [VIDEO] Subscribed!');
          if (humanBehavior) await this.sleep(this.randomDelay(500, 1000));
          return;
        } else {
          console.log('ℹ️  [VIDEO] Already subscribed');
          return;
        }
      }

      console.log('⚠️  [VIDEO] Subscribe button not found');
    } catch (error) {
      console.log('⚠️  [VIDEO] Subscribe failed:', error.message);
    }
  }

  /**
   * Like video
   */
  async likeVideo(page, humanBehavior = true) {
    try {
      console.log('👍 [VIDEO] Liking...');

      if (humanBehavior) await this.sleep(this.randomDelay(1000, 2000));

      await page.evaluate(() => {
        const btn = document.querySelector('like-button-view-model button');
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await this.sleep(500);

      const selectors = [
        'like-button-view-model button[aria-label*="like"]',
        'ytd-menu-renderer like-button-view-model button',
        '#top-level-buttons-computed like-button-view-model button'
      ];

      for (const selector of selectors) {
        const btn = await page.$(selector);
        if (!btn) continue;

        const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', btn);
        if (!ariaLabel.toLowerCase().includes('dislike')) {
          await btn.click();
          console.log('✅ [VIDEO] Liked!');
          if (humanBehavior) await this.sleep(this.randomDelay(500, 1000));
          return;
        } else {
          console.log('ℹ️  [VIDEO] Already liked');
          return;
        }
      }

      console.log('⚠️  [VIDEO] Like button not found');
    } catch (error) {
      console.log('⚠️  [VIDEO] Like failed:', error.message);
    }
  }

  /**
   * Comment on video
   */
  async commentOnVideo(page, humanBehavior = true) {
    try {
      console.log('💬 [VIDEO] Commenting...');

      if (humanBehavior) await this.sleep(this.randomDelay(2000, 4000));

      // Scroll to comments section
      await page.evaluate(() => {
        const comments = document.querySelector('ytd-comments#comments');
        if (comments) comments.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 800, behavior: 'smooth' });
      });
      await this.sleep(this.randomDelay(2000, 3000));

      // Click comment placeholder
      const placeholderSelectors = [
        '#placeholder-area',
        'ytd-comments#comments #simplebox-placeholder'
      ];

      let clicked = false;
      for (const selector of placeholderSelectors) {
        const el = await page.$(selector);
        if (el) {
          await el.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        console.log('⚠️  [VIDEO] Comment box not found');
        return;
      }

      await this.sleep(this.randomDelay(1000, 1500));

      const commentInput = await page.$('#contenteditable-root');
      if (!commentInput) {
        console.log('⚠️  [VIDEO] Comment input not found');
        return;
      }

      const commentText = commentHelper.getSmartComment();
      console.log(`📝 Typing: "${commentText}"`);

      await commentInput.click();
      await page.keyboard.type(commentText, {
        delay: humanBehavior ? this.randomDelay(50, 120) : 0
      });

      if (humanBehavior) await this.sleep(this.randomDelay(1500, 2500));

      const submitBtn = await page.$('#submit-button button');
      if (submitBtn) {
        const isDisabled = await page.evaluate(el => el.disabled, submitBtn);
        if (!isDisabled) {
          await submitBtn.click();
          console.log('✅ [VIDEO] Comment posted!');
          if (humanBehavior) await this.sleep(this.randomDelay(1000, 2000));
        }
      }

    } catch (error) {
      console.log('⚠️  [VIDEO] Comment failed:', error.message);
    }
  }
}

module.exports = new WatchNormalPuppeteerService();
