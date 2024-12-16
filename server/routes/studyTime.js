const express = require('express');
const router = express.Router();
const studyTimeController = require('../controllers/studyTimeController');
const auth = require('../middleware/auth');

// Study time tracking routes
router.post('/', auth, studyTimeController.logStudyTime);
router.get('/:userId', auth, studyTimeController.getStudyTime);
router.get('/stats/:userId', auth, studyTimeController.getStudyStats);

module.exports = router; 