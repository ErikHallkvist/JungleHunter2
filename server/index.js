import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const PORT = 3000;

const ANIMAL_NAMES = [
  'Tiger', 'Panther', 'Jaguar', 'Leopard', 'Cheetah',
  'Wolf', 'Fox', 'Bear', 'Eagle', 'Hawk',
  'Viper', 'Cobra', 'Python', 'Gecko', 'Iguana',
  'Gorilla', 'Baboon', 'Lynx', 'Puma', 'Ocelot',
  'Hyena', 'Jackal', 'Dingo', 'Cougar', 'Wolverine',
  'Falcon', 'Condor', 'Vulture', 'Raven', 'Osprey',
];

const lobby = {};
let gameInProgress = false;

function getUniqueName() {
  const usedNames = new Set(Object.values(lobby).map((p) => p.name));
  const available = ANIMAL_NAMES.filter((n) => !usedNames.has(n));
  if (available.length === 0) return `Player${Math.floor(Math.random() * 9999)}`;
  return available[Math.floor(Math.random() * available.length)];
}

function broadcastLobbyUpdate() {
  io.emit('lobbyUpdate', {
    players: Object.values(lobby),
    gameInProgress,
  });
}

io.on('connection', (socket) => {
  const name = getUniqueName();
  lobby[socket.id] = { id: socket.id, name };
  console.log(`${name} ansluten (${socket.id})`);

  socket.emit('assignedName', name);
  broadcastLobbyUpdate();

  socket.on('startGame', () => {
    if (!gameInProgress) {
      gameInProgress = true;
      io.emit('gameStarted');
      broadcastLobbyUpdate();
      console.log('Spelet har startat');
    }
  });

  socket.on('disconnect', () => {
    console.log(`${lobby[socket.id]?.name} frånkopplad`);
    delete lobby[socket.id];
    broadcastLobbyUpdate();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`);
});
