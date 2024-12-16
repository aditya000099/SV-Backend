const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const auth = require('../middleware/auth');

// Bot interaction routes
router.post('/question', auth, botController.getNextQuestion);
router.post('/generate-roadmap', auth, botController.generateRoadmap);

module.exports = router; 