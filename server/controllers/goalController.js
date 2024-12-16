const Goal = require('../models/Goal');

const getGoal = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const goal = await Goal.findOne({ userId });
    if (!goal) {
      return res.status(404).json({ message: 'No goal found for the user.' });
    }
    res.status(200).json(goal);
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

const createGoal = async (req, res) => {
  const { userId, goal, isCompleted, progress } = req.body;

  if (!userId || !goal) {
    return res.status(400).json({ message: 'User ID and goal are required.' });
  }

  try {
    const newGoal = new Goal({
      userId,
      goal,
      isCompleted: isCompleted || false,
      progress: progress || 0,
    });

    await newGoal.save();
    res.status(201).json({ message: 'Goal created successfully.', goal: newGoal });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

const updateGoal = async (req, res) => {
  const { userId } = req.params;
  const { progress, isCompleted, updatedAt } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const updatedGoal = await Goal.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(progress !== undefined && { progress }),
          ...(isCompleted !== undefined && { isCompleted }),
          updatedAt: updatedAt || new Date(),
        },
      },
      { new: true }
    );

    if (!updatedGoal) {
      return res.status(404).json({ message: 'Goal not found for the user.' });
    }

    res.status(200).json({ message: 'Goal updated successfully.', goal: updatedGoal });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

const deleteGoal = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const deletedGoal = await Goal.findOneAndDelete({ userId });

    if (!deletedGoal) {
      return res.status(404).json({ message: 'No goal found to delete.' });
    }

    res.status(200).json({ message: 'Goal deleted successfully.' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = {
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal
}; 