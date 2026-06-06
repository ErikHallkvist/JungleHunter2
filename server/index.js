import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const PORT = 3000;

const players = {};

io.on('connection', (socket) => {
  console.log(`Spelare ansluten: ${socket.id}`);

  players[socket.id] = { id: socket.id, x: 400, y: 300 };

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('playerJoined', players[socket.id]);

  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Spelare frånkopplad: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`);
});
