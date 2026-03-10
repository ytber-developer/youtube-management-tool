const express = require('express');
const router = express.Router();

// Import API versions
const v1Routes = require('./v1');

// Mount API versions
router.use('/v1', v1Routes);

// Default to v1
router.use('/', v1Routes);

module.exports = router;
