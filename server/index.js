import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = 3000;

const ANIMAL_NAMES = [
  'Tiger', 'Panther', 'Jaguar', 'Leopard', 'Cheetah',
  'Wolf', 'Fox', 'Bear', 'Eagle', 'Hawk',
  'Viper', 'Cobra', 'Python', 'Gecko', 'Iguana',
  'Gorilla', 'Baboon', 'Lynx', 'Puma', 'Ocelot',
  'Hyena', 'Jackal', 'Dingo', 'Cougar', 'Wolverine',
  'Falcon', 'Condor', 'Vulture', 'Raven', 'Osprey',
];

// Room bounds matching client constants
const ROOM = { x: 32, y: 32, width: 1216, height: 656 };
const SPAWN_X_MIN = ROOM.x + 40;
const SPAWN_X_MAX = ROOM.x + 160;

const lobby = {};
const gamePlayers = {};
let gameInProgress = false;

function getUniqueName() {
  const used = new Set(Object.values(lobby).map((p) => p.name));
  const available = ANIMAL_NAMES.filter((n) => !used.has(n));
  if (available.length === 0) return `Player${Math.floor(Math.random() * 9999)}`;
  return available[Math.floor(Math.random() * available.length)];
}

function broadcastLobbyUpdate() {
  io.emit('lobbyUpdate', { players: Object.values(lobby), gameInProgress });
}

io.on('connection', (socket) => {
  const name = getUniqueName();
  lobby[socket.id] = { id: socket.id, name };
  console.log(`${name} ansluten (${socket.id})`);

  socket.emit('assignedName', name);
  broadcastLobbyUpdate();

  socket.on('startGame', () => {
    if (gameInProgress) return;
    gameInProgress = true;

    const players = Object.values(lobby);
    const count = players.length;

    players.forEach((player, i) => {
      const spawnX = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN);
      const spawnY = ROOM.y + 80 + (i / Math.max(count - 1, 1)) * (ROOM.height - 160);
      gamePlayers[player.id] = { id: player.id, name: player.name, x: spawnX, y: spawnY };
    });

    io.emit('gameInit', Object.values(gamePlayers));
    broadcastLobbyUpdate();
    console.log(`Spelet startat med ${count} spelare`);
  });

  socket.on('playerMove', ({ x, y }) => {
    if (gamePlayers[socket.id]) {
      gamePlayers[socket.id].x = x;
      gamePlayers[socket.id].y = y;
      socket.broadcast.emit('gamePlayerMoved', { id: socket.id, x, y });
    }
  });

  socket.on('disconnect', () => {
    console.log(`${lobby[socket.id]?.name} frånkopplad`);
    delete lobby[socket.id];
    delete gamePlayers[socket.id];

    if (gameInProgress && Object.keys(gamePlayers).length === 0) {
      gameInProgress = false;
      console.log('Spelet avslutat — inga spelare kvar');
    }

    io.emit('gamePlayerLeft', socket.id);
    broadcastLobbyUpdate();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`);
});
