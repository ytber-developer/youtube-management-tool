const commentHelper = require('../../helpers/comment.helper');

class WatchShortsPuppeteerService {

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Watch YouTube Short with human-like behavior
   */
  async watchShort(page, shortUrl, duration = 30, options = {}) {
    const {
      humanBehavior = true,
      randomDuration = false,
      autoLike = false,
      autoSubscribe = false,
      autoComment = false
    } = options;

    let actualDuration = duration;

    try {
      console.log(`\n📱 [SHORTS] Navigating to: ${shortUrl}`);

      if (humanBehavior) {
        await this.sleep(this.randomDelay(2000, 5000));
      }

      await page.goto(shortUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for Shorts player
      try {
        await page.waitForSelector('ytd-shorts, ytd-reel-video-renderer', { timeout: 30000 });
        await page.waitForSelector('video', { timeout: 10000 });
        await this.sleep(this.randomDelay(1500, 2500));
        console.log('✅ Shorts player ready');
      } catch (e) {
        console.warn('⚠️  Shorts player not ready, continuing...');
      }

      // Ensure playback
      try {
        const videoContainer = await page.$('.html5-video-container');
        if (videoContainer) {
          await videoContainer.click();
        } else {
          const video = await page.$('video');
          if (video) await video.click();
        }
        await this.sleep(this.randomDelay(800, 1500));

        const isPlaying = await page.evaluate(() => {
          const v = document.querySelector('video');
          return v && !v.paused;
        });

        if (!isPlaying) {
          await page.keyboard.press('Space');
          await this.sleep(500);
          console.log('▶️  Pressed Space to play');
        } else {
          console.log('✅ Video is playing');
        }
      } catch (e) {
        console.log('⚠️  Could not start playback:', e.message);
      }

      // Dismiss popups
      try {
        const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Agree"]');
        if (consentBtn) { await consentBtn.click(); await this.sleep(500); }
        await page.keyboard.press('Escape');
        await this.sleep(300);
      } catch (e) {}

      // Compute watch time (80% rule for Shorts, max 200s)
      try {
        const shortDuration = await page.evaluate(() => {
          const v = document.querySelector('video');
          return (v && v.duration && isFinite(v.duration) && v.duration > 0) ? v.duration : null;
        });
        if (shortDuration) {
          const minWatch = Math.ceil(shortDuration * 0.80);
          if (minWatch > actualDuration) actualDuration = minWatch;
        }
      } catch (e) {}

      if (actualDuration > 200) actualDuration = 200;

      if (randomDuration) {
        actualDuration = Math.min(this.randomDelay(15, 60), 200);
        console.log(`🎲 Random duration: ${actualDuration}s`);
      }

      console.log(`📊 [SHORTS] Watch time: ${actualDuration}s`);

      // Auto subscribe + like early (before main watch loop)
      if (autoSubscribe) {
        await this.subscribeChannel(page, humanBehavior);
      }
      if (autoLike) {
        await this.likeShort(page, humanBehavior);
      }

      // Watch short
      console.log(`👀 Watching Short for ${actualDuration}s...`);
      if (humanBehavior) {
        await this.simulateShortsWatching(page, actualDuration);
      } else {
        await this.sleep(actualDuration * 1000);
      }

      // Auto comment after watching
      if (autoComment) {
        await this.commentOnShort(page, humanBehavior);
      }

      console.log('✅ [SHORTS] Finished watching\n');

      return { success: true, type: 'short', duration: actualDuration };

    } catch (error) {
      console.error('❌ [SHORTS] Error:', error.message);
      throw error;
    }
  }

  /**
   * Simulate human behavior on Shorts
   */
  async simulateShortsWatching(page, durationInSeconds) {
    const endTime = Date.now() + (durationInSeconds * 1000);
    const actions = [];

    console.log('🎭 [SHORTS] Simulating human behavior...');

    while (Date.now() < endTime) {
      const remainingTime = Math.floor((endTime - Date.now()) / 1000);
      if (remainingTime <= 0) break;

      try {
        const action = Math.random();

        if (action < 0.2) {
          // Mouse move (20%)
          const viewport = await page.viewport();
          const x = Math.floor(Math.random() * (viewport?.width || 400));
          const y = Math.floor(Math.random() * (viewport?.height || 800));
          await page.mouse.move(x, y, { steps: this.randomDelay(2, 6) });
          await this.sleep(this.randomDelay(500, 1200));
          actions.push('move');
        } else if (action < 0.3) {
          // Volume (10%)
          const key = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          await page.keyboard.press(key);
          await this.sleep(this.randomDelay(1000, 2000));
          actions.push('volume');
        } else {
          // Watch (70%)
          const watchTime = Math.min(this.randomDelay(5, 15), remainingTime);
          await this.sleep(watchTime * 1000);
          actions.push('watch');
        }
      } catch (e) {}
    }

    console.log(`✅ [SHORTS] Actions: ${actions.join(', ')}`);
  }

  /**
   * Subscribe via Shorts sidebar
   */
  async subscribeChannel(page, humanBehavior = true) {
    try {
      console.log('📺 [SHORTS] Subscribing...');

      if (humanBehavior) await this.sleep(this.randomDelay(1000, 2000));

      const selectors = [
        'ytd-reel-player-header-renderer ytd-subscribe-button-renderer button',
        '#subscribe-button button',
        'ytd-subscribe-button-renderer button'
      ];

      for (const selector of selectors) {
        const btn = await page.$(selector);
        if (!btn) continue;

        const text = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (text === 'subscribe') {
          await btn.click();
          console.log('✅ [SHORTS] Subscribed!');
          if (humanBehavior) await this.sleep(this.randomDelay(500, 1000));
          return;
        } else {
          console.log('ℹ️  [SHORTS] Already subscribed');
          return;
        }
      }

      console.log('⚠️  [SHORTS] Subscribe button not found');
    } catch (error) {
      console.log('⚠️  [SHORTS] Subscribe failed:', error.message);
    }
  }

  /**
   * Like Short via sidebar like button
   */
  async likeShort(page, humanBehavior = true) {
    try {
      console.log('👍 [SHORTS] Liking...');

      if (humanBehavior) await this.sleep(this.randomDelay(800, 1500));

      const selectors = [
        'ytd-reel-video-renderer like-button-view-model button',
        '#like-button button',
        'like-button-view-model button'
      ];

      for (const selector of selectors) {
        const btn = await page.$(selector);
        if (!btn) continue;

        const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', btn);
        if (!ariaLabel.toLowerCase().includes('dislike')) {
          await btn.click();
          console.log('✅ [SHORTS] Liked!');
          if (humanBehavior) await this.sleep(this.randomDelay(500, 1000));
          return;
        } else {
          console.log('ℹ️  [SHORTS] Already liked');
          return;
        }
      }

      console.log('⚠️  [SHORTS] Like button not found');
    } catch (error) {
      console.log('⚠️  [SHORTS] Like failed:', error.message);
    }
  }

  /**
   * Comment on Short — opens comment drawer then types
   */
  async commentOnShort(page, humanBehavior = true) {
    try {
      console.log('💬 [SHORTS] Commenting...');

      if (humanBehavior) await this.sleep(this.randomDelay(1500, 3000));

      // Click the comments button in Shorts sidebar to open drawer
      const commentBtnSelectors = [
        'ytd-reel-video-renderer #comments-button button',
        'ytd-button-renderer#comments-button button',
        'button[aria-label*="comment" i]'
      ];

      let drawerOpened = false;
      for (const selector of commentBtnSelectors) {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          drawerOpened = true;
          console.log('✅ Comments drawer opened');
          break;
        }
      }

      if (!drawerOpened) {
        console.log('⚠️  [SHORTS] Comments button not found');
        return;
      }

      await this.sleep(this.randomDelay(1500, 2500));

      // Click comment placeholder inside drawer
      const placeholderSelectors = ['#placeholder-area', '#simplebox-placeholder'];
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
        console.log('⚠️  [SHORTS] Comment box not found');
        return;
      }

      await this.sleep(this.randomDelay(800, 1200));

      const commentInput = await page.$('#contenteditable-root');
      if (!commentInput) {
        console.log('⚠️  [SHORTS] Comment input not found');
        return;
      }

      const commentText = commentHelper.getSmartComment();
      console.log(`📝 Typing: "${commentText}"`);

      await commentInput.click();
      await page.keyboard.type(commentText, {
        delay: humanBehavior ? this.randomDelay(50, 120) : 0
      });

      if (humanBehavior) await this.sleep(this.randomDelay(1000, 2000));

      const submitBtn = await page.$('#submit-button button');
      if (submitBtn) {
        const isDisabled = await page.evaluate(el => el.disabled, submitBtn);
        if (!isDisabled) {
          await submitBtn.click();
          console.log('✅ [SHORTS] Comment posted!');
          if (humanBehavior) await this.sleep(this.randomDelay(800, 1500));
        }
      }

    } catch (error) {
      console.log('⚠️  [SHORTS] Comment failed:', error.message);
    }
  }
}

module.exports = new WatchShortsPuppeteerService();
