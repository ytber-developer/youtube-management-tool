/**
 * Utility functions for cleaning and validating video metadata
 */

/**
 * Clean video title
 * - Remove newlines
 * - Remove duplicate hashtags
 * - Trim and limit length
 */
function cleanTitle(title, maxLength = 100) {
  if (!title) return 'Untitled';

  let cleaned = title
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with space
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .trim();                    // Trim start/end
  
  // Remove duplicate hashtags (case insensitive)
  const hashtagPattern = /#[\w\u00C0-\u024F\u1E00-\u1EFF]+/gi;
  const hashtags = cleaned.match(hashtagPattern) || [];
  const uniqueHashtags = [];
  const seenHashtags = new Set();
  
  for (const tag of hashtags) {
    const lowerTag = tag.toLowerCase();
    if (!seenHashtags.has(lowerTag)) {
      seenHashtags.add(lowerTag);
      uniqueHashtags.push(tag);
    }
  }
  
  // Remove all hashtags from title
  const titleWithoutHashtags = cleaned
    .replace(hashtagPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Rebuild: title text + unique hashtags
  if (uniqueHashtags.length > 0) {
    cleaned = `${titleWithoutHashtags} ${uniqueHashtags.join(' ')}`.trim();
  } else {
    cleaned = titleWithoutHashtags;
  }
  
  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...';
  }
  
  return cleaned;
}

/**
 * Clean video description
 * - Trim whitespace
 * - Keep newlines (YouTube supports multiline descriptions)
 * - Limit length
 */
function cleanDescription(description, maxLength = 5000) {
  if (!description) return '';

  // Trim only, keep newlines (YouTube supports multiline)
  let cleaned = description.trim();
  
  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...';
  }
  
  return cleaned;
}

module.exports = {
  cleanTitle,
  cleanDescription
};
