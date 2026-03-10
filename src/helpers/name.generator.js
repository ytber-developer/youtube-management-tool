const { RETRY_STRATEGIES } = require('../config/constants');

class NameGenerator {
  /**
   * Generate a modified channel name for retry
   * @param {string} baseName - Original channel name
   * @param {string} strategy - Retry strategy (timestamp, random, uuid)
   * @returns {string} - Modified channel name
   */
  generateRetryName(baseName, strategy) {
    switch (strategy) {
      case RETRY_STRATEGIES.TIMESTAMP:
        return this.withTimestamp(baseName);
      
      case RETRY_STRATEGIES.RANDOM_NUMBER:
        return this.withRandomNumber(baseName);
      
      case RETRY_STRATEGIES.UUID:
        return this.withUUID(baseName);
      
      default:
        return this.withTimestamp(baseName);
    }
  }

  /**
   * Add timestamp suffix to name
   * @param {string} name 
   * @returns {string}
   */
  withTimestamp(name) {
    const timestamp = Date.now().toString().slice(-6);
    return `${name} ${timestamp}`;
  }

  /**
   * Add random 4-digit number to name
   * @param {string} name 
   * @returns {string}
   */
  withRandomNumber(name) {
    const randomNum = Math.floor(Math.random() * 9999) + 1000;
    return `${name} ${randomNum}`;
  }

  /**
   * Add random UUID suffix to name
   * @param {string} name 
   * @returns {string}
   */
  withUUID(name) {
    const randomStr = () => Math.random().toString(36).substring(2, 8);
    const uuidSuffix = randomStr() + randomStr(); // 12 chars
    return `${name} ${uuidSuffix}`;
  }
}

module.exports = new NameGenerator();
