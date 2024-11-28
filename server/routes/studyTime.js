const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get study time data
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ studyHours: user.studyHours || [] });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Update study time
router.post('/update', auth, async (req, res) => {
  try {
    const { timeToAdd } = req.body;
    const user = await User.findById(req.user.id);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const studyHourIndex = user.studyHours.findIndex(
      sh => new Date(sh.date).getTime() === today.getTime()
    );

    if (studyHourIndex === -1) {
      // Add new entry for today
      user.studyHours.push({
        date: today,
        minutes: timeToAdd
      });
    } else {
      // Update existing entry
      user.studyHours[studyHourIndex].minutes += timeToAdd;
    }

    // Keep only last 365 days of data
    user.studyHours = user.studyHours
      .filter(sh => sh.date > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    await user.save();
    res.json({ studyHours: user.studyHours });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router; 