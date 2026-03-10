/**
 * YouTube Regular Video Watch Service (Puppeteer + Chrome)
 * 
 * Optimized for standard horizontal YouTube videos
 * Uses real Chrome browser for better compatibility
 */

const commentHelper = require('../../helpers/comment.helper');

class WatchNormalPuppeteerService {
  
  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    try {
      console.log(`🎬 [VIDEO] Navigating to: ${videoUrl}`);
      
      // Initial delay (simulating user thinking)
      if (humanBehavior) {
        const delay = this.randomDelay(2000, 5000);
        await this.sleep(delay);
        console.log(`⏱️  Initial delay: ${delay}ms`);
      }

      await page.goto(videoUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      console.log('⏳ Waiting for video player...');
      
      // Wait for video player
      try {
        await page.waitForSelector('video', { timeout: 30000 });
        await this.sleep(this.randomDelay(1000, 2000));
        console.log('✅ Video player ready');
      } catch (e) {
        console.warn('⚠️  Video player not ready, continuing...');
      }

      // Click on video to focus and clear any blur
      try {
        console.log('🖱️  Focusing video player (no click)...');
        const video = await page.$('video');
        if (video) {
          // Move mouse to center of video to simulate focus without clicking
          const box = await video.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y, { steps: 8 });
            await this.sleep(this.randomDelay(300, 800));
          } else {
            const vp = await page.viewport();
            await page.mouse.move((vp.width || 1280) / 2, (vp.height || 720) / 2, { steps: 6 });
            await this.sleep(this.randomDelay(300, 800));
          }

          // Try to ensure playback programmatically (no click)
          try {
            const isPlaying = await page.evaluate(() => {
              const v = document.querySelector('video');
              return v && !v.paused;
            });

            if (!isPlaying) {
              await page.evaluate(() => {
                const v = document.querySelector('video');
                if (v && v.paused) {
                  try { v.play(); } catch (e) {}
                }
              });
              console.log('▶️  Programmatically requested play (no click)');
              await this.sleep(this.randomDelay(500, 1200));
            }
          } catch (err) {
            // ignore
          }
        }
      } catch (e) {
        console.log('ℹ️  Could not focus video');
      }

      // Ensure playback without clicking play button
      try {
        const isPlaying = await page.evaluate(() => {
          const vid = document.querySelector('video');
          return vid && !vid.paused;
        });
        if (!isPlaying) {
          try {
            await page.evaluate(() => {
              const vid = document.querySelector('video');
              if (vid && vid.paused) {
                try { vid.play(); } catch (e) {}
              }
            });
            console.log('▶️  Programmatically requested play (no click)');
            await this.sleep(this.randomDelay(1000, 2000));
          } catch (err) {
            console.log('ℹ️  Video may already be playing or programmatic play blocked');
          }
        }
      } catch (e) {
        console.log('ℹ️  Video already playing');
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

        // Close "Skip trial" or premium prompts
        const skipButton = await page.$('button[aria-label*="No thanks"], button[aria-label*="Skip"], tp-yt-paper-dialog button.yt-button-renderer');
        if (skipButton) {
          await skipButton.click();
          console.log('✅ Closed premium prompt');
          await this.sleep(this.randomDelay(500, 1000));
        }

        // Press Escape to close any remaining overlays
        await page.keyboard.press('Escape');
        await this.sleep(500);
        
      } catch (e) {
        console.log('ℹ️  No popups');
      }

      // Auto subscribe (25% conversion)
      if (autoSubscribe && Math.random() < 0.25) {
        await this.subscribeChannel(page, humanBehavior);
      }

      // Use random duration if enabled
      let actualDuration = duration;
      if (randomDuration) {
        actualDuration = this.randomDelay(30, 180);
        console.log(`🎲 Random duration: ${actualDuration}s`);
      }

      // Watch video
      console.log(`👀 Watching for ${actualDuration} seconds...`);
      if (humanBehavior) {
        await this.simulateVideoWatching(page, actualDuration);
      } else {
        await this.sleep(actualDuration * 1000);
      }

      // Auto like (15% conversion)
      if (autoLike && Math.random() < 0.15) {
        await this.likeVideo(page, humanBehavior);
      }

      // Auto comment (5% conversion)
      if (autoComment && Math.random() < 0.05) {
        await this.commentOnVideo(page, humanBehavior);
      }

      console.log('✅ [VIDEO] Finished watching\n');
      
      return {
        success: true,
        type: 'video',
        duration: actualDuration,
        liked: autoLike,
        subscribed: autoSubscribe,
        commented: autoComment
      };

    } catch (error) {
      console.error('❌ [VIDEO] Error:', error.message);
      throw error;
    }
  }

  /**
   * Simulate human behavior on regular video (super simplified)
   */
  async simulateVideoWatching(page, durationInSeconds) {
    console.log('🎭 [VIDEO] Simulating human behavior...');
    
    const startTime = Date.now();
    const actions = [];
    let volumeAdjusted = false;
    
    // Simple pattern: watch, scroll every 2-3s (pause/resume removed)
    while (Date.now() - startTime < durationInSeconds * 1000) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remainingTime = durationInSeconds - elapsedSeconds;
      
      if (remainingTime <= 0) break;
      
      try {
        // Adjust volume between 40-45 seconds
        if (!volumeAdjusted && elapsedSeconds >= 40 && elapsedSeconds <= 45) {
          const volumeKey = Math.random() < 0.5 ? 'ArrowUp' : 'ArrowDown';
          console.log(`🔊 [${elapsedSeconds}s] Volume ${volumeKey === 'ArrowUp' ? 'up' : 'down'}`);
          await page.keyboard.press(volumeKey);
          actions.push('volume');
          volumeAdjusted = true;
          await this.sleep(1000);
        }
        
        const action = Math.random();
        
        if (action < 0.4) {
          // Scroll (40%)
          console.log(`📜 [${elapsedSeconds}s] Scrolling`);
          const scrollAmount = this.randomDelay(100, 300);
          await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
          }, scrollAmount);
          actions.push('scroll');
          await this.sleep(this.randomDelay(2000, 3000));
          
        } else {
          // Just watch (60%)
          const watchTime = Math.min(
            this.randomDelay(2, 4),
            remainingTime
          );
          console.log(`👀 [${elapsedSeconds}s] Watching for ${watchTime}s`);
          await this.sleep(watchTime * 1000);
          actions.push('watch');
        }
        
      } catch (e) {
        // Ignore action errors
      }
    }
    
    console.log(`✅ [VIDEO] Actions: ${actions.join(', ')}`);
  }

  /**
   * Subscribe to channel
   */
  async subscribeChannel(page, humanBehavior = true) {
    try {
      console.log('📺 [VIDEO] Attempting to subscribe...');
      
      if (humanBehavior) {
        await this.sleep(this.randomDelay(2000, 4000));
      }

      const subscribeSelectors = [
        '#subscribe-button-shape button[aria-label*="Subscribe"]',
        'ytd-subscribe-button-renderer #subscribe-button button'
      ];

      for (const selector of subscribeSelectors) {
        try {
          const subscribeButton = await page.$(selector);
          
          if (subscribeButton) {
            const text = await page.evaluate(el => el.textContent, subscribeButton);
            
            if (text && text.trim().toLowerCase() === 'subscribe') {
              await subscribeButton.click();
              console.log('✅ [VIDEO] Subscribed!');
              
              if (humanBehavior) {
                await this.sleep(this.randomDelay(1000, 2000));
              }
              return;
            } else {
              console.log('ℹ️  [VIDEO] Already subscribed');
              return;
            }
          }
        } catch (e) {
          continue;
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
      console.log('👍 [VIDEO] Attempting to like...');
      
      if (humanBehavior) {
        await this.sleep(this.randomDelay(1000, 3000));
      }

      // Scroll to like button
      await page.evaluate(() => {
        const likeButton = document.querySelector('like-button-view-model button');
        if (likeButton) {
          likeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      if (humanBehavior) {
        await this.sleep(this.randomDelay(500, 1000));
      }

      const likeSelectors = [
        'like-button-view-model button[aria-label*="like"]',
        'ytd-menu-renderer like-button-view-model button',
        '#top-level-buttons-computed like-button-view-model button'
      ];

      for (const selector of likeSelectors) {
        try {
          const likeButton = await page.$(selector);
          
          if (likeButton) {
            const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), likeButton);
            
            if (ariaLabel && !ariaLabel.toLowerCase().includes('dislike')) {
              await likeButton.click();
              console.log('✅ [VIDEO] Liked!');
              
              if (humanBehavior) {
                await this.sleep(this.randomDelay(500, 1500));
              }
              return;
            } else {
              console.log('ℹ️  [VIDEO] Already liked');
              return;
            }
          }
        } catch (e) {
          continue;
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
      console.log('💬 [VIDEO] Attempting to comment...');
      
      if (humanBehavior) {
        await this.sleep(this.randomDelay(2000, 5000));
      }

      // Scroll to comments
      console.log('📜 Scrolling to comments...');
      await page.evaluate(() => {
        const commentsSection = document.querySelector('ytd-comments#comments');
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 800, behavior: 'smooth' });
        }
      });

      if (humanBehavior) {
        await this.sleep(this.randomDelay(2000, 4000));
      }

      // Click comment box
      const commentBoxSelectors = [
        '#placeholder-area',
        'ytd-comments#comments #simplebox-placeholder'
      ];

      let commentBoxClicked = false;

      for (const selector of commentBoxSelectors) {
        try {
          const commentBox = await page.$(selector);
          if (commentBox) {
            await commentBox.click();
            commentBoxClicked = true;
            console.log('✅ Comment box clicked');
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!commentBoxClicked) {
        console.log('⚠️  [VIDEO] Comment box not found');
        return;
      }

      if (humanBehavior) {
        await this.sleep(this.randomDelay(1000, 2000));
      }

      // Wait for input field
      await this.sleep(1000);

      // Type comment
      const commentInput = await page.$('#contenteditable-root');
      
      if (commentInput) {
        const commentText = commentHelper.getSmartComment();
        
        console.log(`📝 Comment: "${commentText}"`);
        
        if (humanBehavior) {
          await commentInput.click();
          await page.keyboard.type(commentText, {
            delay: this.randomDelay(50, 150)
          });
        } else {
          await commentInput.type(commentText);
        }
        
        if (humanBehavior) {
          await this.sleep(this.randomDelay(2000, 4000));
        }
        
        // Submit
        const submitButton = await page.$('#submit-button button');
        if (submitButton) {
          const isDisabled = await page.evaluate(el => el.disabled, submitButton);
          if (!isDisabled) {
            await submitButton.click();
            console.log('✅ [VIDEO] Comment posted!');
            
            if (humanBehavior) {
              await this.sleep(this.randomDelay(1000, 2000));
            }
          }
        }
      } else {
        console.log('⚠️  [VIDEO] Comment input not found');
      }

    } catch (error) {
      console.log('⚠️  [VIDEO] Comment failed:', error.message);
    }
  }

  /**
   * Helper: Random delay
   */
  randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = new WatchNormalPuppeteerService();
