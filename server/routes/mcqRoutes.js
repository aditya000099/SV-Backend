const express = require('express');
const router = express.Router();
const mcqController = require('../controllers/mcqController');
const auth = require('../middleware/auth');

router.post('/', mcqController.generateQuestions);
router.post('/save', auth, mcqController.saveQuestions);
router.post('/history', auth, mcqController.getHistory);

module.exports = router; 