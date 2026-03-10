const path = require('path');
const fs = require('fs');

/**
 * Session Service - Manage browser profiles per email
 * Uses userDataDir to persist full browser state (cookies, localStorage, cache)
 */
class SessionService {

  constructor() {
    this.profilesDir = path.join(__dirname, '../../browser-profiles');
    this.ensureProfilesDir();
  }

  /**
   * Ensure profiles directory exists
   */
  ensureProfilesDir() {
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
      console.log(`✅ Created browser profiles directory: ${this.profilesDir}`);
    }
  }

  /**
   * Get profile directory path for an email
   * @param {string} email - Account email
   * @returns {string} - Path to profile directory
   */
  getProfilePath(email) {
    const sanitized = email.replace(/[@.+]/g, '_');
    return path.join(this.profilesDir, sanitized);
  }

  /**
   * Check if profile exists for email
   * @param {string} email - Account email
   * @returns {boolean}
   */
  hasProfile(email) {
    const profilePath = this.getProfilePath(email);
    return fs.existsSync(profilePath);
  }

  /**
   * Get launch options with profile for email
   * @param {string} email - Account email
   * @param {object} baseOptions - Base puppeteer launch options
   * @returns {object} - Launch options with userDataDir
   */
  getLaunchOptions(email, baseOptions = {}) {
    const userDataDir = this.getProfilePath(email);
    
    return {
      ...baseOptions,
      userDataDir,
      args: [
        ...(baseOptions.args || []),
        '--no-first-run',
        '--no-default-browser-check'
      ]
    };
  }

  /**
   * Delete profile for email (clean up)
   * @param {string} email - Account email
   */
  deleteProfile(email) {
    const profilePath = this.getProfilePath(email);
    if (fs.existsSync(profilePath)) {
      fs.rmSync(profilePath, { recursive: true, force: true });
      console.log(`🗑️  Deleted profile for: ${email}`);
    }
  }

  /**
   * List all profiles
   * @returns {Array<string>} - List of profile directory names
   */
  listProfiles() {
    if (!fs.existsSync(this.profilesDir)) return [];
    return fs.readdirSync(this.profilesDir);
  }

  /**
   * Get profile size in MB
   * @param {string} email - Account email
   * @returns {number} - Size in MB
   */
  getProfileSize(email) {
    const profilePath = this.getProfilePath(email);
    if (!fs.existsSync(profilePath)) return 0;

    let totalSize = 0;
    const calculateSize = (dirPath) => {
      try {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              calculateSize(filePath);
            } else {
              totalSize += stats.size;
            }
          } catch (err) {
            // Skip files that can't be accessed (locked, symlinks, etc)
            // console.warn(`Skipping ${filePath}: ${err.message}`);
          }
        });
      } catch (err) {
        // Skip directories that can't be read
        // console.warn(`Skipping directory ${dirPath}: ${err.message}`);
      }
    };

    calculateSize(profilePath);
    return (totalSize / (1024 * 1024)).toFixed(2); // MB
  }
}

module.exports = new SessionService();
