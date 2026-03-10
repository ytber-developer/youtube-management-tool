/**
 * YouTube Shorts Watch Service (Puppeteer + Chrome)
 * 
 * Optimized for YouTube Shorts vertical video format
 * Uses real Chrome browser for better compatibility
 */

const commentHelper = require('../../helpers/comment.helper');

class WatchShortsPuppeteerService {
  
  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Watch YouTube Short with human-like behavior
   */
  async watchShort(page, shortUrl, duration = 30, options = {}) {
    const {
      humanBehavior = true
    } = options;

    try {
      console.log(`🎬 [SHORTS] Navigating to: ${shortUrl}`);
      
      // Initial delay (simulating user thinking)
      if (humanBehavior) {
        const delay = this.randomDelay(2000, 5000);
        await this.sleep(delay);
        console.log(`⏱️  Initial delay: ${delay}ms`);
      }

      await page.goto(shortUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      console.log('⏳ Waiting for Shorts player...');
      
      // Wait for Shorts player and video element
      try {
        await page.waitForSelector('ytd-shorts, ytd-reel-video-renderer', { timeout: 30000 });
        await page.waitForSelector('video', { timeout: 10000 });
        await this.sleep(this.randomDelay(1500, 2500));
        console.log('✅ Shorts player ready');
      } catch (e) {
        console.warn('⚠️  Shorts player not ready, continuing...');
      }

      // Click on short to focus and play
      try {
        console.log('🖱️  Clicking short to play...');
        
        // Try clicking the video container first
        const videoContainer = await page.$('.html5-video-container');
        if (videoContainer) {
          await videoContainer.click();
          await this.sleep(this.randomDelay(1000, 2000));
          console.log('▶️  Video container clicked');
        } else {
          // Fallback to video element
          const video = await page.$('video');
          if (video) {
            await video.click();
            await this.sleep(this.randomDelay(1000, 2000));
            console.log('▶️  Video element clicked');
          }
        }
        
        // Verify video is playing
        const isPlaying = await page.evaluate(() => {
          const videoEl = document.querySelector('video');
          return videoEl && !videoEl.paused;
        });
        
        if (!isPlaying) {
          console.log('⚠️  Video not playing, trying space key...');
          await page.keyboard.press('Space');
          await this.sleep(500);
        } else {
          console.log('✅ Video is playing');
        }
        
      } catch (e) {
        console.log('⚠️  Could not click video:', e.message);
      }

      // Close popups and overlays
      try {
        // Close consent dialogs
        const consentButton = await page.$('button[aria-label*="Accept"], button[aria-label*="Agree"], button[aria-label*="Chấp nhận"]');
        if (consentButton) {
          await consentButton.click();
          console.log('✅ Closed consent dialog');
          await this.sleep(this.randomDelay(500, 1000));
        }

        // Press Escape to close any remaining overlays
        await page.keyboard.press('Escape');
        await this.sleep(500);
        
      } catch (e) {
        console.log('ℹ️  No popups');
      }

      // Watch with Shorts-specific behavior
      console.log(`👀 Watching Short for ${duration} seconds...`);
      if (humanBehavior) {
        await this.simulateShortsWatching(page, duration);
      } else {
        await this.sleep(duration * 1000);
      }

      console.log('✅ [SHORTS] Finished watching\n');
      
      return {
        success: true,
        type: 'short',
        duration
      };

    } catch (error) {
      console.error('❌ [SHORTS] Error:', error.message);
      throw error;
    }
  }

  /**
   * Simulate human behavior on Shorts (simplified)
   */
  async simulateShortsWatching(page, durationInSeconds) {
    const endTime = Date.now() + (durationInSeconds * 1000);
    const actions = [];
    
    console.log('🎭 [SHORTS] Simulating human behavior...');
    
    while (Date.now() < endTime) {
      const remainingTime = Math.floor((endTime - Date.now()) / 1000);
      
      if (remainingTime <= 0) break;
      
      const action = Math.random();
      
      try {
        if (action < 0.2) {
          // Small interaction (20%) — avoid pausing: move mouse or tap area
          console.log(`🖱️  Small interaction (${remainingTime}s left)`);
          const viewport = await page.viewport();
          const x = Math.floor(Math.random() * (viewport.width || 400));
          const y = Math.floor(Math.random() * (viewport.height || 800));
          await page.mouse.move(x, y, { steps: this.randomDelay(2, 6) });
          await this.sleep(this.randomDelay(500, 1200));
          actions.push('interaction');
          
        } else if (action < 0.3) {
          // Volume control (10%)
          const volumeKey = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          console.log(`🔊 Volume ${volumeKey === 'ArrowUp' ? 'up' : 'down'} (${remainingTime}s left)`);
          await page.keyboard.press(volumeKey);
          await this.sleep(this.randomDelay(1000, 2000));
          actions.push('volume');
          
        } else {
          // Just watch (70%)
          const watchTime = Math.min(
            this.randomDelay(5, 15),
            remainingTime
          );
          console.log(`👀 Watching (${watchTime}s of ${remainingTime}s left)`);
          await this.sleep(watchTime * 1000);
          actions.push('watch');
        }
        
      } catch (e) {
        // Ignore action errors, continue watching
      }
    }
    
    console.log(`✅ [SHORTS] Actions: ${actions.join(', ')}`);
  }

  /**
   * Helper: Random delay
   */
  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = new WatchShortsPuppeteerService();
