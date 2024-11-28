const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chatroom = require('./models/Chatroom');
  // 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
const Groq = require("groq-sdk");
const QuestionsModel = require("./models/QuestionsModel");
const router = express.Router();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://aditya:aditya123@cluster0.u9tkv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));




const groq = new Groq({ apiKey:"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"});

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

// Helper function to call LLM for MCQ generation
async function getGroqChatCompletion({ subject, subtopic }) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `
        Generate 10 multiple-choice questions (MCQs) for the subject "${subject}" and subtopic "${subtopic}". 
        Format them as:
        Question: [question text]
        Options:
        a. [option 1]
        b. [option 2]
        c. [option 3]
        d. [option 4]
        Correct Answer: [correct option]
        Respond only in this format without any extra text or greetings.
        `,
      },
    ],
    model: "llama3-8b-8192",
  });
}

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

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
