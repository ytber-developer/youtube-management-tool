class HumanBehaviorService {
  
  /**
   * Generate random delay in milliseconds
   */
  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep for given milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get random watch duration (30-180 seconds)
   */
  getRandomWatchDuration(min = 30, max = 180) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Wait for video player to be ready
   */
  async waitForVideoReady(page, timeout = 30000) {
    try {
      await page.waitForSelector('video', { timeout });
      await this.sleep(this.randomDelay(1000, 2000));
      return true;
    } catch (error) {
      console.warn('⚠️  Video element not found');
      return false;
    }
  }

  /**
   * Random scroll on page
   */
  async randomScroll(page) {
    try {
      const scrollAmount = this.randomDelay(100, 500);
      await page.evaluate((amount) => {
        window.scrollBy({
          top: amount,
          behavior: 'smooth'
        });
      }, scrollAmount);
      
      await this.sleep(this.randomDelay(500, 1500));
      console.log(`📜 Scrolled ${scrollAmount}px`);
    } catch (error) {
      console.warn('⚠️  Scroll failed:', error.message);
    }
  }

  /**
   * Random mouse movements
   */
  async randomMouseMovements(page) {
    try {
      const movements = this.randomDelay(2, 5);
      const viewport = await page.viewport();
      
      for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        const steps = this.randomDelay(5, 20);
        
        await page.mouse.move(x, y, { steps });
        await this.sleep(this.randomDelay(300, 1000));
      }
      
      console.log(`🖱️  Made ${movements} mouse movements`);
    } catch (error) {
      console.warn('⚠️  Mouse movement failed:', error.message);
    }
  }

  /**
   * Click on video element
   */
  async clickOnVideo(page) {
    try {
      const video = await page.$('video');
      if (video) {
        const box = await video.boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height / 2
          );
          await this.sleep(this.randomDelay(500, 1000));
          console.log('🎯 Clicked on video');
        }
      }
    } catch (error) {
      console.warn('⚠️  Video click failed:', error.message);
    }
  }

  /**
   * Seek video to random position
   */
  async seekVideo(page) {
    try {
      // Get video duration and current time
      const videoInfo = await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          return {
            duration: video.duration,
            currentTime: video.currentTime
          };
        }
        return null;
      });

      if (videoInfo && videoInfo.duration > 30) {
        // Seek to random position (avoid last 20% of video)
        const maxSeek = videoInfo.duration * 0.8;
        const newTime = Math.floor(Math.random() * maxSeek);
        
        await page.evaluate((time) => {
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = time;
          }
        }, newTime);
        
        console.log(`⏩ Seeked video to ${Math.floor(newTime)}s`);
      }
    } catch (error) {
      console.warn('⚠️  Seek failed:', error.message);
    }
  }

  /**
   * Change video volume
   */
  async changeVolume(page) {
    try {
      const volume = Math.random(); // 0-1
      
      await page.evaluate((vol) => {
        const video = document.querySelector('video');
        if (video) {
          video.volume = vol;
        }
      }, volume);
      
      console.log(`🔊 Changed volume to ${Math.floor(volume * 100)}%`);
    } catch (error) {
      console.warn('⚠️  Volume change failed:', error.message);
    }
  }

  /**
   * Click pause/play button
   */
  async togglePlayPause(page) {
    try {
      // NOTE: Pause/resume behavior removed to avoid stopping playback.
      // Perform a small non-pausing interaction instead (mouse move).
      const viewport = await page.viewport();
      const x = Math.floor(Math.random() * (viewport.width || 800));
      const y = Math.floor(Math.random() * (viewport.height || 600));
      await page.mouse.move(x, y, { steps: this.randomDelay(2, 8) });
      await this.sleep(this.randomDelay(300, 800));
      console.log('ℹ️  togglePlayPause replaced with non-pausing interaction');
    } catch (error) {
      console.warn('⚠️  togglePlayPause interaction failed:', error.message);
    }
  }

  /**
   * Simulate watching video with random actions
   */
  async simulateWatching(page, durationInSeconds) {
    const endTime = Date.now() + (durationInSeconds * 1000);
    let actionCount = 0;
    
    console.log('🎭 Starting human behavior simulation...');
    
    while (Date.now() < endTime) {
      const remainingTime = endTime - Date.now();
      const actionInterval = this.randomDelay(5000, 15000);
      
      // Wait for next action or until end
      await this.sleep(Math.min(actionInterval, remainingTime));
      
      if (Date.now() >= endTime) break;
      
      // Random action with more variety
      const action = Math.random();
      actionCount++;
      
      if (action < 0.2) {
        // Scroll
        await this.randomScroll(page);
      } else if (action < 0.35) {
        // Mouse movement
        await this.randomMouseMovements(page);
      } else if (action < 0.45) {
        // Small interaction (previously pause/play) — do a non-pausing interaction instead
        await this.clickOnVideo(page);
      } else if (action < 0.55) {
        // Seek video
        await this.seekVideo(page);
      } else if (action < 0.6) {
        // Change volume
        await this.changeVolume(page);
      } else if (action < 0.7) {
        // Click on video
        await this.clickOnVideo(page);
      } else {
        // Just move mouse slightly
        const viewport = await page.viewport();
        await page.mouse.move(
          Math.floor(Math.random() * viewport.width),
          Math.floor(Math.random() * viewport.height),
          { steps: this.randomDelay(3, 10) }
        );
      }
    }
    
    console.log(`✅ Simulation complete (${actionCount} actions)`);
  }

  /**
   * Simulate typing with human-like delays
   */
  async typeWithDelay(page, selector, text) {
    try {
      await page.click(selector);
      await this.sleep(this.randomDelay(300, 800));
      
      for (const char of text) {
        await page.keyboard.type(char);
        await this.sleep(this.randomDelay(50, 200));
      }
      
      console.log(`⌨️  Typed: ${text}`);
    } catch (error) {
      console.warn('⚠️  Typing failed:', error.message);
    }
  }

  /**
   * Random viewport size (to avoid fingerprinting)
   */
  getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 }
    ];
    
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  /**
   * Random user agent
   */
  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
}

module.exports = new HumanBehaviorService();
