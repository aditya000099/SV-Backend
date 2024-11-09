const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number }, // in minutes
  topic: { type: String }, // additional field
  notes: { type: String }, // additional field
  goals: [String] // additional field
});

module.exports = mongoose.model('StudySession', studySessionSchema); 