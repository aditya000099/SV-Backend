const mongoose = require('mongoose');

const collaborationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  canvasData: [{
    type: { type: String },
    points: [Number],
    color: String,
    width: Number,
    timestamp: Date
  }],
  videoSessionId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Collaboration', collaborationSchema); 