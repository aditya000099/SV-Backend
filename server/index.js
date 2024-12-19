const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chatroom = require('./models/Chatroom');
const Roadmap = require('./models/Roadmap');
  // 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
const Groq = require("groq-sdk");
const QuestionsModel = require("./models/QuestionsModel");
const Goal = require("./models/Goal");
const router = express.Router();
const { connectDB } = require('./config/database');
const { getGroqChatCompletion, getGroqChatCompletionGoal, generateRoadmap } = require('./services/groqService');
const auth = require('./middleware/auth');
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

app.post("/api/mcqs", async (req, res) => {
  try {
    const { subject, subtopic } = req.body;

    // Validate request input
    if (!subject || !subtopic) {
      return res.status(400).send("Both subject and subtopic are required.");
    }

    // Fetch MCQs using LLM
    const chatCompletion = await getGroqChatCompletion({ subject, subtopic });

    // Extract MCQs from the response
    const mcqs = parseMCQs(chatCompletion.choices[0]?.message?.content || "");

    // Respond with the MCQs
    res.json(mcqs);
  } catch (error) {
    console.error("Error generating MCQs:", error);
    res.status(500).send("An error occurred while generating MCQs.");
  }
});

// Helper function to parse MCQs from the LLM response
function parseMCQs(rawText) {
  const mcqs = [];
  const questions = rawText.split("Question: ").slice(1);

  questions.forEach((q) => {
    const [question, optionsAndAnswer] = q.split("Options:");
    const [optionsText, correctAnswerLine] = optionsAndAnswer.split("Correct Answer:");
    const correctAnswer = correctAnswerLine.trim();
    const options = {};

    optionsText
      .trim()
      .split("\n")
      .forEach((line) => {
        const [key, value] = line.split(". ");
        options[key.trim()] = value.trim();
      });

    mcqs.push({
      question: question.trim(),
      options,
      correctAnswer,
    });
  });

  return mcqs;
}
app.use('/api/study-time', require('./routes/studyTime')); 
// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.create({ name, email, password });
    const token = jwt.sign({ userId: user._id },
      JWT_SECRET,
      { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        bio: user.bio || ''
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Endpoint to save MCQs
app.post('/api/mcqs/save', async (req, res) => {
  try {
    const { userId, subject, subtopic, questions, score } = req.body;

    // Check for missing required fields and return detailed error messages
    if (!userId || !subject || !subtopic || !questions || score === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields.',
        missingFields: { userId, subject, subtopic, questions, score } // Log which fields are missing
      });
    }

    // Create and save the new entry
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
    console.error('Error saving questions:', error.message);
    console.error(error); // Log the full error for debugging
    res.status(500).json({ message: 'Internal Server Error.', error: error.message });
  }
});

// app.get('/api/mcqs/history', async (req, res) => {
//   const { userId } = req.query;

//   // Validate the query parameters
//   if (!userId) {
//     return res.status(400).json({ message: "User IDis required." });
//   }

//   try {
//     // Query the database to find questions based on subject and subtopic
//     const questions = await QuestionsModel.find({ userId });

//     if (questions.length === 0) {
//       return res.status(404).json({ message: "No questions found for the given subject and subtopic." });
//     }

//     // Return the questions if found
//     res.status(200).json(questions);
//   } catch (error) {
//     console.error("Error fetching MCQs:", error);
//     res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// });

app.post('/api/mcqs/history', async (req, res) => {
  const { userId } = req.body; // Get userId from the request body

  // Validate the body to ensure userId is provided
  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    // Query the database to find questions based on userId
    const questions = await QuestionsModel.find({ userId });

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for the given user." });
    }

    // Return the questions if found
    res.status(200).json(questions);
  } catch (error) {
    console.error("Error fetching MCQs:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// app.post('/api/bot/question', async (req, res) => {
//   try {
//     // Example of a static first question
//     const firstQuestion = "What is your primary goal or area of interest?";

//     // Send the question as a response
//     res.status(200).json({ question: firstQuestion });
//   } catch (error) {
//     console.error("Error fetching the first question:", error);
//     res.status(500).json({ error: "Failed to get the first question." });
//   }
// });

// app.post('/api/bot/question', async (req, res) => {
//   try {
//     const { previousResponses } = req.body;

//     // Get AI-generated question
//     const { question, complete } = await getGroqChatCompletionGoal({ previousResponses });

//     res.json({ question, complete });
//   } catch (error) {
//     console.error("Error in /api/bot/question route:", error);
//     res.status(500).json({ error: "Failed to generate AI-driven question." });
//   }
// });


//new code   

const generateNextQuestion = (responses) => {
  // Example logic: Adjust based on collected responses
  if (responses.length === 0) {
    return "What is your primary learning goal?";
  } else if (responses.length === 1) {
    return "How much time can you dedicate daily?";
  } else if (responses.length === 2) {
    return "What resources do you have access to (books, internet, mentors)?";
  }
  return null; // End of questioning
};

app.post('/api/bot/question', (req, res) => {
  const { previousResponses } = req.body;

  // Generate next question
  const nextQuestion = generateNextQuestion(previousResponses);

  if (nextQuestion) {
    return res.json({ question: nextQuestion, complete: false });
  }

  // If no more questions, mark as complete
  return res.json({ complete: true });
});

app.post('/api/bot/generate-roadmap', (req, res) => {
  const { responses, userId } = req.body;

  // Use responses to create a roadmap
  const roadmap = {
    mainGoal: responses[0]?.answer || "Undefined Goal",
    timeline: "3 months",
    minimumTime: responses[1]?.answer || "30 minutes daily",
    milestones: [
      "Complete foundational concepts",
      "Build a small project",
      "Master advanced topics",
    ],
    resources: [
      { title: "FreeCodeCamp", url: "https://freecodecamp.org" },
      { title: "Khan Academy", url: "https://khanacademy.org" },
    ],
  };

  // Save roadmap logic here (e.g., database save)

  res.json(roadmap);
});
//till here

app.get('/api/goals/:userId', async (req, res) => {
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
});

// Route to create a new goal
app.post('/api/goals', async (req, res) => {
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
});

// Route to update progress or mark goal as complete
app.patch('/api/goals/:userId', async (req, res) => {
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
});

// Route to delete a user's goal (optional)
app.delete('/api/goals/:userId', async (req, res) => {
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
});


// Add these routes after your existing routes

// Get all chatrooms
app.get('/api/chatrooms', async (req, res) => {
  try {
    const chatrooms = await Chatroom.find()
      .populate('creator', 'name')
      .populate('participants', 'name');
    res.json(chatrooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create chatroom
app.post('/api/chatrooms', async (req, res) => {
  try {
    const { name } = req.body;
    const { image } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const chatroom = new Chatroom({
      name,
      image,
      creator: decoded.userId,
      participants: [decoded.userId]
    });
    
    await chatroom.save();
    await chatroom.populate('creator', 'name');
    res.status(201).json(chatroom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/users/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Update user profile
app.put('/api/users/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, bio } = req.body;
    user.name = name || user.name;
    user.email = email || user.email;
    user.bio = bio;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add this route for getting messages
app.get('/api/chatrooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const chatroom = await Chatroom.findById(roomId)
      .populate('messages.sender', 'name')
      .select('messages');
    
    if (!chatroom) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }
    
    // Transform messages to include sender information consistently
    const messages = chatroom.messages.map(msg => ({
      _id: msg._id,
      text: msg.text,
      timestamp: msg.timestamp,
      sender: {
        _id: msg.sender._id,
        name: msg.sender.name
      }
    }));
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this route for saving messages
app.post('/api/chatrooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { text } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const chatroom = await Chatroom.findById(roomId);
    if (!chatroom) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }

    const newMessage = {
      sender: decoded.userId,
      text,
      timestamp: new Date()
    };

    chatroom.messages.push(newMessage);
    // await chatroom.save();

    // Populate sender info before sending response
    const populatedMessage = await Chatroom.populate(newMessage, {
      path: 'sender',
      select: 'name'
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Socket.IO Connection
io.on("connection", (socket) => {
  socket.emit("socketId", socket.id);

  // Join chatroom
  socket.on('joinRoom', async ({ roomId, userId }) => {
    try {
      socket.join(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $addToSet: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  // Leave chatroom
  socket.on('leaveRoom', async ({ roomId, userId }) => {
    try {
      socket.leave(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $pull: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Chat message
  socket.on('chatMessage', async ({ roomId, messageData }) => {
    try {
      const chatroom = await Chatroom.findById(roomId);
      if (!chatroom) {
        console.error('Chatroom not found:', roomId);
        return;
      }

      // Create new message
      const newMessage = {
        sender: messageData.sender._id,
        text: messageData.text,
        timestamp: new Date()
      };

      // Save to database
      chatroom.messages.push(newMessage);
      await chatroom.save();

      // Get the saved message
      const savedMessage = chatroom.messages[chatroom.messages.length - 1];

      // Format message for emission
      const formattedMessage = {
        _id: savedMessage._id,
        text: savedMessage.text,
        timestamp: savedMessage.timestamp,
        sender: {
          _id: messageData.sender._id,
          name: messageData.sender.name
        }
      };

      // Broadcast to room
      socket.to(roomId).emit('newMessage', formattedMessage);
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  // Existing video call handlers
  socket.on("initiateCall", ({ targetId, signalData, senderId, senderName }) => {
    io.to(targetId).emit("incomingCall", {
      signal: signalData,
      from: senderId,
      name: senderName,
    });
  });

  socket.on("changeMediaStatus", ({ mediaType, isActive }) => {
    socket.broadcast.emit("mediaStatusChanged", {
      mediaType,
      isActive,
    });
  });

  socket.on("sendMessage", ({ targetId, message, senderName }) => {
    io.to(targetId).emit("receiveMessage", { message, senderName });
  });

  socket.on("answerCall", (data) => {
    socket.broadcast.emit("mediaStatusChanged", {
      mediaType: data.mediaType,
      isActive: data.mediaStatus,
    });
    io.to(data.to).emit("callAnswered", data);
  });

  socket.on("terminateCall", ({ targetId }) => {
    io.to(targetId).emit("callTerminated");
  });

  // Add participant update handler
  socket.on('joinRoom', async ({ roomId, userId }) => {
    try {
      socket.join(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $addToSet: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  socket.on('leaveRoom', async ({ roomId, userId }) => {
    try {
      socket.leave(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $pull: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Add route to get participants
  socket.on('joinRoom', async ({ roomId, userId }) => {
    try {
      socket.join(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $addToSet: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  socket.on('leaveRoom', async ({ roomId, userId }) => {
    try {
      socket.leave(roomId);
      const chatroom = await Chatroom.findByIdAndUpdate(
        roomId,
        { $pull: { participants: userId } },
        { new: true }
      ).populate('participants', 'name email bio');
      
      io.to(roomId).emit('participantUpdate', chatroom.participants);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });
});

// Generate and save roadmap
app.post('/api/roadmap/generate', async (req, res) => {
  try {
    const { userId, goal, duration } = req.body;

      if (!userId || !goal || !duration) {
      return res.status(400).json({ 
        message: 'User ID, goal, and duration are required.' 
      });
    }

    // Generate roadmap using Groq
    const roadmapData = await generateRoadmap(goal, duration);

    // Create new roadmap document
    const roadmap = new Roadmap({
      userId,
      goal,
      duration,
      basics: roadmapData.basics,
      learningPath: roadmapData.learningPath,
      resources: roadmapData.resources
    });

    await roadmap.save();
    res.status(201).json(roadmap);
  } catch (error) {
    console.error('Error generating roadmap:', error);
    res.status(500).json({ 
      message: 'Error generating roadmap', 
      error: error.message 
    });
  }
});

// Get user's roadmaps
app.get('/api/roadmap/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const roadmaps = await Roadmap.find({ userId });
    res.json(roadmaps);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching roadmaps', 
      error: error.message 
    });
  }
});

// Get specific roadmap
app.get('/api/roadmap/detail/:roadmapId', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const roadmap = await Roadmap.findById(roadmapId);
    
    if (!roadmap) {
      return res.status(404).json({ message: 'Roadmap not found' });
    }
    
    res.json(roadmap);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching roadmap', 
      error: error.message 
    });
  }
});

// Update roadmap
app.put('/api/roadmap/:roadmapId', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const updates = req.body;
    
    const roadmap = await Roadmap.findByIdAndUpdate(
      roadmapId,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!roadmap) {
      return res.status(404).json({ message: 'Roadmap not found' });
    }
    
    res.json(roadmap);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating roadmap', 
      error: error.message 
    });
  }
});

// Delete roadmap
app.delete('/api/roadmap/:roadmapId', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const roadmap = await Roadmap.findByIdAndDelete(roadmapId);
    
    if (!roadmap) {
      return res.status(404).json({ message: 'Roadmap not found' });
    }
    
    res.json({ message: 'Roadmap deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error deleting roadmap', 
      error: error.message 
    });
  }
});
app.get('/api/users/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/users/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name email loginDates'); // Only select needed fields
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Add this endpoint after your other routes
app.post('/api/track-login', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has already logged in today
    const hasLoggedInToday = user.loginDates.some(date => {
      const loginDate = new Date(date);
      loginDate.setHours(0, 0, 0, 0);
      return loginDate.getTime() === today.getTime();
    });

    // If user hasn't logged in today, add today's date
    if (!hasLoggedInToday) {
      user.loginDates.push(today);
      await user.save();
    }

    res.json({ success: true, loginDates: user.loginDates });
  } catch (error) {
    console.error('Error tracking login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
