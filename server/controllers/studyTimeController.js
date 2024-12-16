const User = require('../models/User');
const StudySession = require('../models/StudySession');

const logStudyTime = async (req, res) => {
  try {
    const { timeToAdd } = req.body;
    const userId = req.user.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let session = await StudySession.findOne({
      userId,
      date: today
    });

    if (!session) {
      session = new StudySession({
        userId,
        date: today,
        minutes: timeToAdd
      });
    } else {
      session.minutes += timeToAdd;
    }

    await session.save();
    res.json({ message: 'Study time logged successfully', session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudyTime = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await StudySession.find({ userId })
      .sort('-date')
      .limit(365); // Last year's data

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudyStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await StudySession.find({
      userId,
      date: { $gte: thirtyDaysAgo }
    });

    const totalMinutes = sessions.reduce((acc, session) => acc + session.minutes, 0);
    const averageMinutesPerDay = totalMinutes / 30;

    res.json({
      totalMinutes,
      averageMinutesPerDay,
      sessionsCount: sessions.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  logStudyTime,
  getStudyTime,
  getStudyStats
}; 