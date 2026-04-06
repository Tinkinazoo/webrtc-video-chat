const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Раздача статических файлов
app.use(express.static(__dirname));

// Все неизвестные маршруты отдаем index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple.html'));
});

// Хранилище комнат
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Клиент подключен:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    room.add(userId);
    
    socket.to(roomId).emit('user-connected', userId);
    
    console.log(`Пользователь ${userId} подключился к комнате ${roomId}`);
    
    const otherUsers = Array.from(room).filter(id => id !== userId);
    socket.emit('room-users', otherUsers);
    
    socket.on('disconnect', () => {
      room.delete(userId);
      socket.to(roomId).emit('user-disconnected', userId);
      console.log(`Пользователь ${userId} отключился`);
      
      if (room.size === 0) {
        rooms.delete(roomId);
      }
    });
  });
  
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
