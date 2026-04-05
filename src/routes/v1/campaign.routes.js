const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/campaign.controller');

router.post('/', (req, res) => ctrl.create(req, res));
router.get('/', (req, res) => ctrl.list(req, res));
router.get('/:id', (req, res) => ctrl.get(req, res));
router.post('/:id/hold', (req, res) => ctrl.hold(req, res));
router.post('/:id/release', (req, res) => ctrl.release(req, res));
router.post('/:id/stop', (req, res) => ctrl.stop(req, res));
router.delete('/:id', (req, res) => ctrl.deleteCampaign(req, res));

module.exports = router;
