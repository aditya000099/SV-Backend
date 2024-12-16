const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const auth = require('../middleware/auth');

// Goal routes
router.get('/:userId', auth, goalController.getGoal);
router.post('/', auth, goalController.createGoal);
router.patch('/:userId', auth, goalController.updateGoal);
router.delete('/:userId', auth, goalController.deleteGoal);

module.exports = router; 