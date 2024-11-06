// src/routes/pinterest.routes.js
const express = require('express');
const router = express.Router();
const pinterestController = require('../controllers/pinterestController');

// Routes d'authentification
router.post('/auth/initialize', pinterestController.initialize);
router.get('/auth/check', pinterestController.checkConnection);
router.post('/auth/disconnect', pinterestController.disconnect);

// Routes des comptes publicitaires
router.get('/ad-accounts', pinterestController.getAdAccounts);

// Routes des campagnes
router.get('/campaigns', pinterestController.getCampaigns);
router.post('/campaigns', pinterestController.createCampaign);
router.patch('/campaigns/:campaignId', pinterestController.updateCampaign);

// Routes des analytics
router.get('/analytics', pinterestController.getAnalytics);

module.exports = router;