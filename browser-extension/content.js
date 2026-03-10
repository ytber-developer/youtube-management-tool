// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeReels') {
    scrapeReelsFromPage(request.maxReels)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }
});

/**
 * Main scraper function
 */
async function scrapeReelsFromPage(maxReels = 50) {
  console.log(`[FB REEL SCRAPER] Bắt đầu scrape (tối đa ${maxReels} reels)`);
  
  // Check if on reels page
  if (!window.location.href.includes('/reels')) {
    throw new Error('Bạn phải vào tab Reels của Facebook Page! VD: facebook.com/pagename/reels');
  }
  
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  // Close login popup if exists
  await closeLoginPopup();
  
  // Scroll to load more reels
  await scrollToLoadReels();
  
  // Get all reel links
  const reelLinks = extractReelLinks(maxReels);
  
  // Generate CSV and download
  downloadCSV(reelLinks);
  
  return {
    totalFound: reelLinks.length,
    saved: reelLinks.length,
    links: reelLinks
  };
}

/**
 * Close login popup if it appears
 */
async function closeLoginPopup() {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  await sleep(2000);
  
  try {
    const closeBtn = document.querySelector('div[aria-label="Close"]') || 
                     document.querySelector('div[aria-label="Đóng"]');
    if (closeBtn) {
      closeBtn.click();
      console.log('[FB REEL SCRAPER] Đã đóng popup login.');
      await sleep(1000);
    }
  } catch (e) {
    console.log('[FB REEL SCRAPER] Không thấy popup login.');
  }
}

/**
 * Scroll page to load more reels
 */
async function scrollToLoadReels() {
  console.log('[FB REEL SCRAPER] Đang scroll để load thêm reels...');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  let prevScrollHeight = 0;
  let noChangeCount = 0;
  const maxNoChange = 3;
  
  for (let i = 0; i < 50; i++) {
    // Scroll down in small steps
    for (let j = 0; j < 5; j++) {
      window.scrollBy(0, 800);
      await sleep(300);
    }
    
    await sleep(3000); // Wait for content to load
    
    const currentScrollHeight = document.documentElement.scrollHeight;
    
    if (currentScrollHeight === prevScrollHeight) {
      noChangeCount++;
      console.log(`[FB REEL SCRAPER] Không có thay đổi (${noChangeCount}/${maxNoChange})`);
      
      if (noChangeCount >= maxNoChange) {
        console.log('[FB REEL SCRAPER] Đã scroll đến cuối trang.');
        break;
      }
    } else {
      noChangeCount = 0;
    }
    
    prevScrollHeight = currentScrollHeight;
    
    // Check if we've scrolled to the bottom
    const scrolledToBottom = (window.innerHeight + window.pageYOffset) >= document.body.scrollHeight - 100;
    if (scrolledToBottom) {
      console.log('[FB REEL SCRAPER] Đã đến cuối trang.');
      break;
    }
  }
}

/**
 * Extract reel links from the page
 */
function extractReelLinks(maxReels) {
  console.log('[FB REEL SCRAPER] Đang lấy link reels...');
  
  const links = Array.from(document.querySelectorAll('a[href*="/reel/"]'))
    .map(a => {
      let href = a.getAttribute('href');
      if (!href) return null;
      
      // Normalize to full URL
      if (!href.startsWith('http')) {
        href = 'https://facebook.com' + href;
      }
      
      // Remove query string
      href = href.split('/?s=')[0];
      href = href.split('?')[0];
      
      return href;
    })
    .filter(Boolean);
  
  // Remove duplicates
  const uniqueLinks = Array.from(new Set(links)).slice(0, maxReels);
  console.log(`[FB REEL SCRAPER] Tìm thấy ${uniqueLinks.length} reels`);
  
  return uniqueLinks;
}

/**
 * Generate CSV and trigger download
 */
function downloadCSV(reelLinks) {
  // Create CSV content
  const csvRows = [
    ['STT', 'Reel URL', 'Reel ID'],
    ...reelLinks.map((link, index) => {
      const reelId = link.match(/\/reel\/(\d+)/)?.[1] || '';
      return [index + 1, link, reelId];
    })
  ];
  
  const csvContent = csvRows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  // Add BOM for UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const pageName = extractPageName();
  const filename = `facebook_reels_${pageName}_${timestamp}.csv`;
  
  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log(`[FB REEL SCRAPER] Đã tải xuống file: ${filename}`);
}

/**
 * Extract page name from URL
 */
function extractPageName() {
  const url = window.location.href;
  const match = url.match(/facebook\.com\/([^\/\?]+)/);
  return match ? match[1] : 'page';
}

console.log('[FB REEL SCRAPER] Content script loaded.');
