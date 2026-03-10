// YouTube Channel Creation Constants
const CHANNEL_CREATION = {
  MAX_RETRY_ATTEMPTS: 4,
  WAIT_AFTER_CLICK: 5000,
  WAIT_AFTER_INPUT: 2000,
  WAIT_AFTER_ERROR: 2000,
  INPUT_DELAY: 100
};

// Selectors for YouTube UI
const YOUTUBE_SELECTORS = {
  // Channel switcher
  ADVANCED_FEATURES_DIALOG: 'yt-feature-enablement-soft-entry-renderer',
  CREATE_CHANNEL_BUTTON: 'a, button, yt-button-shape a',
  
  // Input fields
  NAME_INPUT: [
    'tp-yt-paper-input-container tp-yt-iron-input input',
    'tp-yt-iron-input.input-element input.style-scope',
    'tp-yt-iron-input input',
    'tp-yt-paper-input input.style-scope',
    'input[required][autocomplete="off"]'
  ],
  
  NAME_INPUT_BY_LABEL: 'label', // Find by label text
  TITLE_INPUT: 'tp-yt-paper-input#title-input tp-yt-iron-input input',
  
  // Error messages
  ERROR_CONTAINER: '.error-container.style-scope.ytd-channel-creation-dialog-renderer',
  ERROR_TEXT: 'yt-formatted-string.error',
  
  // Buttons
  CREATE_BUTTON: 'button',
  CANCEL_BUTTON: 'button',
  
  // Avatar upload
  PROFILE_SECTION: 'ytcp-profile-image-upload',
  UPLOAD_BUTTON: 'ytcp-button#upload-button',
  FILE_INPUT: 'ytcp-profile-image-upload input#file-selector[type="file"]',
  DONE_BUTTON: 'button, ytcp-button',
  PUBLISH_BUTTON: 'button, ytcp-button',
  
  // Studio
  CONTINUE_BUTTON: 'ytcp-button button, button'
};

// Error messages
const ERROR_MESSAGES = {
  NAME_NOT_ALLOWED: [
    "This name can't be used",
    "can't be used for your YouTube channel",
    "Try again with a different name"
  ],
  CHANNEL_EXISTS: [
    'Get advanced features',
    'advanced features'
  ]
};

// Avatar upload settings
const AVATAR_SETTINGS = {
  FOLDER: 'avatars',
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  WAIT_AFTER_UPLOAD: 3000,
  WAIT_AFTER_DONE: 3000,
  WAIT_AFTER_PUBLISH: 8000,
  WAIT_FOR_DIALOG: 2000
};

// Natural channel names for retry
const CHANNEL_NAME_PARTS = {
  ADJECTIVES: [
    'Creative', 'Daily', 'Amazing', 'Modern', 'Digital', 
    'Smart', 'Tech', 'Best', 'Pro', 'Epic', 
    'Global', 'Prime', 'Elite', 'Fresh', 'Bright'
  ],
  NOUNS: [
    'Content', 'Media', 'Studio', 'Hub', 'Space', 
    'Zone', 'World', 'Network', 'Lab', 'Works', 
    'Vision', 'Stream', 'Vlog', 'Videos', 'Corner'
  ]
};

// Retry strategies
const RETRY_STRATEGIES = {
  TIMESTAMP: 'timestamp',      // Original name + timestamp
  RANDOM_NUMBER: 'random',     // Original name + random number
  UUID: 'uuid'                 // Original name + UUID
};

module.exports = {
  CHANNEL_CREATION,
  YOUTUBE_SELECTORS,
  ERROR_MESSAGES,
  AVATAR_SETTINGS,
  CHANNEL_NAME_PARTS,
  RETRY_STRATEGIES
};
