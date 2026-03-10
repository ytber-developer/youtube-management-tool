/**
 * YouTube Service Module Exports
 * 
 * This file exports all YouTube-related services for easy importing
 */

const channelService = require('./channel.service');
const avatarService = require('./avatar.service');
const retryService = require('./retry.service');

// Upload helper services (modular structure)
// Note: Main upload service is at ../youtube.upload.service.js (not in this folder)
const uploadUiService = require('./youtube.upload.ui.service');
const uploadFormService = require('./youtube.upload.form.service');
const uploadVisibilityService = require('./youtube.upload.visibility.service');
const uploadPublishService = require('./youtube.upload.publish.service');

module.exports = {
  channelService,
  avatarService,
  retryService,
  
  // Upload helper services (not main upload service)
  uploadUiService,
  uploadFormService,
  uploadVisibilityService,
  uploadPublishService
};

