const mongoose = require('mongoose');

const questionsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subject: { type: String, required: true },
  subtopic: { type: String, required: true },
  questions: { type: String, required: true },
  score: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }, // Automatically set timestamp
});

module.exports = mongoose.model('QuestionModel', questionsSchema);
