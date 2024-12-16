const Chatroom = require('../models/Chatroom');
const jwt = require('jsonwebtoken');

const getAllChatrooms = async (req, res) => {
  try {
    const chatrooms = await Chatroom.find()
      .populate('creator', 'name')
      .populate('participants', 'name');
    res.json(chatrooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createChatroom = async (req, res) => {
  try {
    const { name, image } = req.body;
    const userId = req.user.userId; // From auth middleware
    
    const chatroom = new Chatroom({
      name,
      image,
      creator: userId,
      participants: [userId]
    });
    
    await chatroom.save();
    await chatroom.populate('creator', 'name');
    res.status(201).json(chatroom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getChatroomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const chatroom = await Chatroom.findById(roomId)
      .populate('messages.sender', 'name')
      .select('messages');
    
    if (!chatroom) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }
    
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
};

const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { text } = req.body;
    const userId = req.user.userId;

    const chatroom = await Chatroom.findById(roomId);
    if (!chatroom) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }

    const newMessage = {
      sender: userId,
      text,
      timestamp: new Date()
    };

    chatroom.messages.push(newMessage);
    await chatroom.save();

    const populatedMessage = await Chatroom.populate(newMessage, {
      path: 'sender',
      select: 'name'
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getAllChatrooms,
  createChatroom,
  getChatroomMessages,
  sendMessage
}; 