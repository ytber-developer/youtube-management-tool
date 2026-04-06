const commentHelper = require('../../helpers/comment.helper');
const { sleep, randomDelay } = require('../../helpers/timing.helper');

class WatchNormalPuppeteerService {

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
        await sleep(randomDelay(2000, 5000));
      }

      await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for video player
      try {
        await page.waitForSelector('video', { timeout: 30000 });
        await sleep(randomDelay(1000, 2000));
        console.log('✅ Video player ready');
      } catch (e) {
        console.warn('⚠️  Video player not ready, continuing...');
      }

      // Compute watch time: respect user-defined duration, cap at video length
      try {
        const videoDuration = await page.evaluate(() => {
          const v = document.querySelector('video');
          return (v && v.duration && isFinite(v.duration) && v.duration > 0) ? v.duration : null;
        });
        if (videoDuration && actualDuration > videoDuration) {
          actualDuration = Math.ceil(videoDuration);
        }
      } catch (e) {}
      console.log(`📊 [VIDEO] Watch time: ${actualDuration}s`);

      // Focus video and ensure playback
      try {
        const video = await page.$('video');
        if (video) {
          const box = await video.boundingBox();
          const x = box ? box.x + box.width / 2 : 640;
          const y = box ? box.y + box.height / 2 : 360;
          await page.mouse.move(x, y, { steps: 8 });
          await sleep(randomDelay(300, 800));
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
          await sleep(randomDelay(500, 1200));
        }
      } catch (e) {
        console.log('ℹ️  Could not focus video');
      }

      // Dismiss popups
      try {
        const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Agree"]');
        if (consentBtn) { await consentBtn.click(); await sleep(500); }
        const skipBtn = await page.$('tp-yt-paper-dialog button.yt-button-renderer');
        if (skipBtn) { await skipBtn.click(); await sleep(500); }
        await page.keyboard.press('Escape');
        await sleep(300);
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
        actualDuration = Math.min(randomDelay(30, 180), 200);
        console.log(`🎲 Random duration: ${actualDuration}s`);
      }

      // Watch video
      console.log(`👀 Watching for ${actualDuration}s...`);
      if (humanBehavior) {
        await this.simulateVideoWatching(page, actualDuration);
      } else {
        await sleep(actualDuration * 1000);
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
   * Simulate human behavior while watching.
   * Tracks video.currentTime every 5s to detect pauses and recover them,
   * ensuring YouTube's heartbeat requests keep firing throughout.
   */
  async simulateVideoWatching(page, durationInSeconds) {
    console.log('🎭 [VIDEO] Simulating human behavior...');

    const startTime = Date.now();
    const actions = [];
    let volumeAdjusted = false;
    let lastCurrentTime = -1;
    let staleTicks = 0; // how many consecutive 5s ticks the video hasn't advanced

    while (Date.now() - startTime < durationInSeconds * 1000) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remainingTime = durationInSeconds - elapsedSeconds;

      if (remainingTime <= 0) break;

      try {
        // --- Heartbeat check: verify video is actually advancing ---
        const videoState = await page.evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return null;
          return { currentTime: v.currentTime, paused: v.paused, ended: v.ended };
        }).catch(() => null);

        if (videoState) {
          if (videoState.ended) {
            console.log('ℹ️  [VIDEO] Video ended early');
            break;
          }
          if (videoState.paused || videoState.currentTime === lastCurrentTime) {
            staleTicks++;
            if (staleTicks >= 2) {
              // Video stalled — try to resume
              console.log('⚠️  [VIDEO] Video stalled, attempting resume...');
              await page.evaluate(() => {
                const v = document.querySelector('video');
                if (v && v.paused) v.play().catch(() => {});
              });
              // Dismiss "Continue watching?" or similar dialogs
              await page.keyboard.press('Space');
              await sleep(800);
              staleTicks = 0;
              actions.push('resume');
            }
          } else {
            staleTicks = 0;
          }
          lastCurrentTime = videoState.currentTime;
        }

        // --- Human behavior actions ---
        // Adjust volume once between 40-45s
        if (!volumeAdjusted && elapsedSeconds >= 40 && elapsedSeconds <= 45) {
          const key = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          await page.keyboard.press(key);
          actions.push('volume');
          volumeAdjusted = true;
          await sleep(1000);
          continue;
        }

        if (Math.random() < 0.4) {
          // Scroll (40%)
          const scrollAmount = randomDelay(100, 300);
          await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
          }, scrollAmount);
          actions.push('scroll');
          await sleep(randomDelay(2000, 3000));
        } else {
          // Watch (60%) — sleep in 5s ticks so heartbeat check runs regularly
          const watchTime = Math.min(5, remainingTime);
          await sleep(watchTime * 1000);
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

      if (humanBehavior) await sleep(randomDelay(1000, 2000));

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
          if (humanBehavior) await sleep(randomDelay(500, 1000));
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

      if (humanBehavior) await sleep(randomDelay(1000, 2000));

      await page.evaluate(() => {
        const btn = document.querySelector('like-button-view-model button');
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await sleep(500);

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
          if (humanBehavior) await sleep(randomDelay(500, 1000));
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

      if (humanBehavior) await sleep(randomDelay(1500, 3000));

      // Scroll 60% trang để trigger lazy-load comments
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6, behavior: 'smooth' }));
      await sleep(2000);

      // Scroll simplebox vào giữa màn hình
      await page.evaluate(() => {
        const box = document.querySelector('ytd-comment-simplebox-renderer');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await sleep(1500);

      // Chờ #placeholder-area không bị hidden (YouTube lazy-load)
      try {
        await page.waitForSelector('#placeholder-area:not([hidden])', { timeout: 8000 });
      } catch (e) {
        // Fallback: thử click simplebox-placeholder
        const fallback = await page.$('#simplebox-placeholder');
        if (!fallback) {
          console.log('⚠️  [VIDEO] Comment placeholder not found');
          return;
        }
        await fallback.click();
        await sleep(1000);
      }

      await page.click('#placeholder-area');
      await sleep(randomDelay(800, 1200));

      // Chờ contenteditable-root sẵn sàng
      try {
        await page.waitForSelector('#contenteditable-root[contenteditable="true"]', { timeout: 5000 });
      } catch (e) {
        console.log('⚠️  [VIDEO] Comment input not ready');
        return;
      }

      const commentText = commentHelper.getSmartComment();
      console.log(`📝 Typing: "${commentText}"`);

      await page.click('#contenteditable-root');
      await sleep(300);

      await page.keyboard.type(commentText, {
        delay: humanBehavior ? randomDelay(60, 130) : 10
      });

      if (humanBehavior) await sleep(randomDelay(1000, 2000));

      // Submit — chờ button active
      try {
        await page.waitForSelector('#submit-button button[aria-disabled="false"]', { timeout: 3000 });
        await page.click('#submit-button button');
        console.log('✅ [VIDEO] Comment posted!');
        if (humanBehavior) await sleep(randomDelay(1000, 1500));
      } catch (e) {
        console.log('⚠️  [VIDEO] Submit button not ready:', e.message);
      }

    } catch (error) {
      console.log('⚠️  [VIDEO] Comment failed:', error.message);
    }
  }
}

module.exports = new WatchNormalPuppeteerService();
