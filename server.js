const https = require('https');
const fs = require('fs');
const express = require('express');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
// Раздача статических файлов
app.use(express.static(__dirname));

// Пути к сертификатам (созданным через mkcert)
const options = {
    key: fs.readFileSync('192.168.1.249-key.pem'),
    cert: fs.readFileSync('192.168.1.249.pem')
};

const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Все неизвестные маршруты отдаем index.html (для SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT}`);
});