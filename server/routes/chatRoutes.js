const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// Chatroom routes
router.get('/chatrooms', auth, chatController.getAllChatrooms);
router.post('/chatrooms', auth, chatController.createChatroom);
router.get('/chatrooms/:roomId/messages', auth, chatController.getChatroomMessages);
router.post('/chatrooms/:roomId/messages', auth, chatController.sendMessage);

module.exports = router; 