document.getElementById('startBtn').addEventListener('click', async () => {
  const maxReels = parseInt(document.getElementById('maxReels').value) || 50;
  const startBtn = document.getElementById('startBtn');
  const status = document.getElementById('status');
  
  // Disable button
  startBtn.disabled = true;
  startBtn.textContent = '⏳ Đang scrape...';
  
  // Show status
  status.style.display = 'block';
  status.className = 'info';
  status.innerHTML = '🔍 Đang kiểm tra trang hiện tại...';
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if on Facebook
    if (!tab.url.includes('facebook.com')) {
      throw new Error('Vui lòng mở trang Facebook Reels trước!');
    }
    
    // Inject content script if not already injected
    status.innerHTML = '💉 Đang chuẩn bị script...';
    
    try {
      // Try to inject the script (it will fail silently if already injected)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      // Script might already be injected, continue
      console.log('Script may already be injected:', e);
    }
    
    status.innerHTML = '🔍 Đang scrape reels...';
    
    // Execute scraper in content script
    const results = await chrome.tabs.sendMessage(tab.id, {
      action: 'scrapeReels',
      maxReels: maxReels
    });
    
    if (results && results.error) {
      throw new Error(results.error);
    }
    
    if (!results) {
      throw new Error('Không nhận được phản hồi từ trang. Vui lòng refresh trang và thử lại!');
    }
    
    // Show success
    status.className = 'success';
    status.innerHTML = `
      ✅ Thành công!<br>
      <div class="progress">
        • Tìm thấy: ${results.totalFound} reels<br>
        • Đã lưu: ${results.saved} reels<br>
        • File CSV đã được tải xuống!
      </div>
    `;
    
  } catch (error) {
    status.className = 'error';
    const errorMsg = error.message || 'Không xác định';
    
    if (errorMsg.includes('Receiving end does not exist')) {
      status.innerHTML = `❌ Lỗi: Vui lòng <strong>refresh trang Facebook</strong> (F5) và thử lại!<br><small>Extension cần được tải lại trên trang.</small>`;
    } else {
      status.innerHTML = `❌ Lỗi: ${errorMsg}`;
    }
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = '🚀 Bắt đầu scrape';
  }
});
