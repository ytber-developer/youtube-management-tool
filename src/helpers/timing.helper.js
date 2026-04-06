/**
 * Shared timing utilities used across watch and automation services.
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { sleep, randomDelay };
