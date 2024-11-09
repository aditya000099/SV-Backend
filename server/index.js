const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chatroom = require('./models/Chatroom');

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

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.create({ name, email, password });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
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
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const chatroom = new Chatroom({
      name,
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
