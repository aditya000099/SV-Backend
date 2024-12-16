const configureSocket = (io) => {
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

        const newMessage = {
          sender: messageData.sender._id,
          text: messageData.text,
          timestamp: new Date()
        };

        chatroom.messages.push(newMessage);
        await chatroom.save();

        socket.to(roomId).emit('newMessage', {
          _id: newMessage._id,
          text: newMessage.text,
          timestamp: newMessage.timestamp,
          sender: {
            _id: messageData.sender._id,
            name: messageData.sender.name
          }
        });
      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    });

    // Video call handlers
    socket.on("initiateCall", ({ targetId, signalData, senderId, senderName }) => {
      io.to(targetId).emit("incomingCall", {
        signal: signalData,
        from: senderId,
        name: senderName,
      });
    });

    socket.on("answerCall", (data) => {
      io.to(data.to).emit("callAnswered", data);
    });

    socket.on("terminateCall", ({ targetId }) => {
      io.to(targetId).emit("callTerminated");
    });
  });
};

module.exports = configureSocket; 