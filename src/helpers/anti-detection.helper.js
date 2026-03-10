/**
 * Anti-Detection Helper for YouTube Automation
 * Provides utilities for:
 * - Proxy rotation
 * - Browser fingerprint randomization
 * - User agent generation
 * - Viewport/timezone randomization
 */

/**
 * List of realistic User Agents (Chrome, Firefox, Edge on Windows/Mac)
 */
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  
  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

/**
 * Common screen resolutions
 */
const VIEWPORTS = [
  { width: 1920, height: 1080 }, // Full HD
  { width: 1536, height: 864 },  // Laptop
  { width: 1440, height: 900 },  // MacBook
  { width: 1366, height: 768 },  // Common laptop
  { width: 2560, height: 1440 }, // 2K
  { width: 1680, height: 1050 }, // Desktop
];

/**
 * Common timezones (US, EU, Asia)
 */
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Australia/Sydney',
];

/**
 * Common locales
 */
const LOCALES = [
  'en-US',
  'en-GB',
  'en-CA',
  'en-AU',
  'fr-FR',
  'de-DE',
  'es-ES',
  'ja-JP',
  'ko-KR',
  'zh-CN',
];

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get random viewport with slight variation
 */
function getRandomViewport() {
  const base = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
  
  // Add small random variation (±50px) to make it unique
  return {
    width: base.width + Math.floor(Math.random() * 100) - 50,
    height: base.height + Math.floor(Math.random() * 100) - 50,
  };
}

/**
 * Get random timezone
 */
function getRandomTimezone() {
  return TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
}

/**
 * Get random locale
 */
function getRandomLocale() {
  return LOCALES[Math.floor(Math.random() * LOCALES.length)];
}

/**
 * Get random color scheme
 */
function getRandomColorScheme() {
  return Math.random() > 0.5 ? 'light' : 'dark';
}

/**
 * Load proxies from file or array
 * @param {string|Array} source - File path or array of proxies
 * @returns {Array} Array of proxy objects
 * 
 * File format (one per line):
 * http://username:password@proxy.com:8080
 * http://proxy.com:8080
 * socks5://proxy.com:1080
 */
function loadProxies(source) {
  const fs = require('fs');
  
  let proxies = [];
  
  if (typeof source === 'string') {
    // Load from file
    if (fs.existsSync(source)) {
      const content = fs.readFileSync(source, 'utf-8');
      proxies = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } else {
      console.warn(`⚠️  Proxy file not found: ${source}`);
    }
  } else if (Array.isArray(source)) {
    proxies = source;
  }
  
  // Parse proxies into Playwright format
  return proxies.map(proxy => {
    const url = new URL(proxy);
    
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  });
}

/**
 * Get random proxy from list
 * @param {Array} proxyList - Array of proxy objects
 * @returns {Object|null} Random proxy or null
 */
function getRandomProxy(proxyList) {
  if (!proxyList || proxyList.length === 0) {
    return null;
  }
  
  return proxyList[Math.floor(Math.random() * proxyList.length)];
}

/**
 * Generate complete browser context options with anti-detection
 * @param {Object} options - Optional overrides
 * @returns {Object} Playwright context options
 */
function generateContextOptions(options = {}) {
  const defaults = {
    viewport: getRandomViewport(),
    userAgent: getRandomUserAgent(),
    locale: getRandomLocale(),
    timezoneId: getRandomTimezone(),
    colorScheme: getRandomColorScheme(),
    // Geolocation (optional, match to proxy country)
    geolocation: options.geolocation || undefined,
    permissions: options.permissions || ['geolocation'],
    // Screen resolution
    screen: options.screen || getRandomViewport(),
    // Device scale factor (1 or 2 for retina)
    deviceScaleFactor: Math.random() > 0.7 ? 2 : 1,
    // Accept language header
    extraHTTPHeaders: {
      'Accept-Language': `${getRandomLocale()},en;q=0.9`,
    },
  };
  
  // Merge with user options
  return { ...defaults, ...options };
}

/**
 * Calculate optimal watch time (40-70% of video duration)
 * @param {number} videoDuration - Video duration in seconds
 * @param {number} minPercent - Minimum watch percentage (default: 0.4)
 * @param {number} maxPercent - Maximum watch percentage (default: 0.7)
 * @returns {number} Watch time in seconds
 */
function calculateOptimalWatchTime(videoDuration, minPercent = 0.4, maxPercent = 0.7) {
  // If video is short (<60s), watch at least 50%
  if (videoDuration < 60) {
    minPercent = 0.5;
    maxPercent = 0.9;
  }
  
  // If video is long (>10 min), can watch less
  if (videoDuration > 600) {
    minPercent = 0.3;
    maxPercent = 0.6;
  }
  
  const percentage = minPercent + Math.random() * (maxPercent - minPercent);
  return Math.floor(videoDuration * percentage);
}

/**
 * Calculate delay between batches to space views naturally
 * @param {number} totalViews - Total views to generate
 * @param {number} hours - Hours to space views over
 * @returns {number} Delay in milliseconds
 */
function calculateBatchDelay(totalViews, hours = 24) {
  const totalMs = hours * 60 * 60 * 1000;
  return Math.floor(totalMs / totalViews);
}

/**
 * Check if account is "aged" enough (basic heuristic)
 * @param {string} email - Account email
 * @param {Date} createdDate - Account creation date
 * @returns {Object} { isAged, reason }
 */
function checkAccountQuality(email, createdDate) {
  const now = new Date();
  const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
  
  // Check if account is at least 90 days old
  if (ageInDays < 90) {
    return {
      isAged: false,
      reason: `Account too new (${ageInDays} days old, need ≥90 days)`,
    };
  }
  
  // Check if email looks suspicious (generic patterns)
  const suspiciousPatterns = [
    /test\d+/i,
    /temp\d+/i,
    /fake\d+/i,
    /user\d{6,}/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(email)) {
      return {
        isAged: false,
        reason: `Email looks suspicious: ${email}`,
      };
    }
  }
  
  return {
    isAged: true,
    reason: `Account is ${ageInDays} days old - good quality`,
  };
}

/**
 * Generate natural traffic curve (peak during business hours)
 * @param {number} totalViews - Total views to distribute
 * @param {number} hours - Hours to distribute over (default: 24)
 * @returns {Array} Array of { hour, views } objects
 */
function generateTrafficCurve(totalViews, hours = 24) {
  // Traffic curve (0-23h, weight by hour)
  // Higher during business hours (9am-5pm), lower at night
  const hourlyWeights = [
    0.3, 0.2, 0.2, 0.2, 0.3, 0.5, // 0-5am
    0.8, 1.2, 1.5, 1.8, 2.0, 2.2, // 6-11am (morning peak)
    2.0, 2.2, 2.5, 2.3, 2.0, 1.8, // 12-5pm (afternoon peak)
    1.5, 1.2, 1.0, 0.8, 0.5, 0.4, // 6-11pm (evening decline)
  ];
  
  const totalWeight = hourlyWeights.reduce((sum, w) => sum + w, 0);
  
  const distribution = [];
  let remaining = totalViews;
  
  for (let hour = 0; hour < hours; hour++) {
    const weight = hourlyWeights[hour % 24];
    const views = Math.floor((weight / totalWeight) * totalViews);
    
    distribution.push({ hour, views });
    remaining -= views;
  }
  
  // Distribute remaining views randomly
  while (remaining > 0) {
    const randomHour = Math.floor(Math.random() * hours);
    distribution[randomHour].views++;
    remaining--;
  }
  
  return distribution;
}

module.exports = {
  getRandomUserAgent,
  getRandomViewport,
  getRandomTimezone,
  getRandomLocale,
  getRandomColorScheme,
  loadProxies,
  getRandomProxy,
  generateContextOptions,
  calculateOptimalWatchTime,
  calculateBatchDelay,
  checkAccountQuality,
  generateTrafficCurve,
};
