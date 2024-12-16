const mongoose = require('mongoose');

const roadmapSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  goal: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  basics: [{
    topic: String,
    description: String
  }],
  learningPath: [{
    phase: String,
    description: String,
    duration: String,
    tasks: [String]
  }],
  resources: {
    videos: [{
      title: String,
      url: String,
      platform: String
    }],
    courses: [{
      title: String,
      url: String,
      platform: String,
      isPaid: Boolean
    }],
    books: [{
      title: String,
      author: String,
      description: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Roadmap', roadmapSchema); 