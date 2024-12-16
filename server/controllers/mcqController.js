const { generateMCQs } = require('../services/groqService');
const QuestionsModel = require('../models/QuestionsModel');
const { parseMCQs } = require('../utils/mcqParser');

const generateQuestions = async (req, res) => {
  try {
    const { subject, subtopic } = req.body;

    if (!subject || !subtopic) {
      return res.status(400).send("Both subject and subtopic are required.");
    }

    const chatCompletion = await generateMCQs({ subject, subtopic });
    const mcqs = parseMCQs(chatCompletion.choices[0]?.message?.content || "");

    res.json(mcqs);
  } catch (error) {
    console.error("Error generating MCQs:", error);
    res.status(500).send("An error occurred while generating MCQs.");
  }
};

const saveQuestions = async (req, res) => {
  try {
    const { userId, subject, subtopic, questions, score } = req.body;

    if (!userId || !subject || !subtopic || !questions || score === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields.',
        missingFields: { userId, subject, subtopic, questions, score }
      });
    }

    const newEntry = new QuestionsModel({
      userId,
      subject,
      subtopic,
      questions,
      score,
    });

    await newEntry.save();
    res.status(201).json({ message: 'Questions saved successfully.' });
  } catch (error) {
    console.error('Error saving questions:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

const getHistory = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const questions = await QuestionsModel.find({ userId });

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for the given user." });
    }

    res.status(200).json(questions);
  } catch (error) {
    console.error("Error fetching MCQs:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  generateQuestions,
  saveQuestions,
  getHistory
}; 