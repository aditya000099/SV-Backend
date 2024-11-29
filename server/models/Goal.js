const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    goal: { type: String, required: true }, // Stringified goal object
    isCompleted: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Goal", goalSchema);
