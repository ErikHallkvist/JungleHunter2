import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EnemyManager } from './game/EnemyManager.js';
import { WaveManager } from './game/WaveManager.js';
import { CombatManager } from './game/CombatManager.js';
import { ShopManager } from './game/ShopManager.js';
import { BarricadeManager } from './game/BarricadeManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(join(__dirname, '../dist')));

const PORT = 3000;

const ANIMAL_NAMES = [
  'Tiger', 'Panther', 'Jaguar', 'Leopard', 'Cheetah',
  'Wolf', 'Fox', 'Bear', 'Eagle', 'Hawk',
  'Viper', 'Cobra', 'Python', 'Gecko', 'Iguana',
  'Gorilla', 'Baboon', 'Lynx', 'Puma', 'Ocelot',
  'Hyena', 'Jackal', 'Dingo', 'Cougar', 'Wolverine',
  'Falcon', 'Condor', 'Vulture', 'Raven', 'Osprey',
];

const ROOM = { x: 32, y: 32, width: 1216, height: 656 };
const SPAWN_X_MIN = ROOM.x + 40;
const SPAWN_X_MAX = ROOM.x + 160;

const lobby = {};
const gamePlayers = {};
let gameInProgress = false;
let defeatTriggered = false;
const MAX_LEAKS = 10;

let enemyManager = null;
let waveManager = null;
let combatManager = null;
let shopManager = null;
let barricadeManager = null;

function getUniqueName() {
  const used = new Set(Object.values(lobby).map((p) => p.name));
  const available = ANIMAL_NAMES.filter((n) => !used.has(n));
  if (available.length === 0) return `Player${Math.floor(Math.random() * 9999)}`;
  return available[Math.floor(Math.random() * available.length)];
}

function broadcastLobbyUpdate() {
  io.emit('lobbyUpdate', { players: Object.values(lobby), gameInProgress });
}

function initGame() {
  shopManager = new ShopManager(io, () => gamePlayers);
  enemyManager = new EnemyManager(io, () => gamePlayers);
  barricadeManager = new BarricadeManager(io, shopManager);
  enemyManager.barricadeManager = barricadeManager;
  combatManager = new CombatManager(io, enemyManager, () => gamePlayers, shopManager);
  waveManager = new WaveManager(io, enemyManager, () => gamePlayers, barricadeManager);

  enemyManager.onEnemyLeaked = (totalLeaked) => {
    io.emit('leakUpdate', { escaped: totalLeaked, max: MAX_LEAKS });
    if (totalLeaked >= MAX_LEAKS) triggerGameOver();
  };
}

function triggerGameOver() {
  if (defeatTriggered) return; // only fire once
  defeatTriggered = true;

  io.emit('gameOver', { reason: 'leaked' });
  console.log(`GAME OVER — ${MAX_LEAKS} fiender passerade banan`);

  // Collect end-of-game stats before resetting
  const playerStats = {};
  for (const [id, player] of Object.entries(gamePlayers)) {
    const combat = combatManager?.getStats(id) ?? { kills: 0, damage: 0 };
    playerStats[id] = {
      name: player.name,
      kills: combat.kills,
      damage: Math.round(combat.damage),
      goldEarned: shopManager?.getGoldEarned(id) ?? 0,
    };
  }
  const wavesReached = waveManager?.getCurrentWave() ?? 0;

  // Give clients a few seconds to show GAME OVER, then send them to the lobby.
  setTimeout(() => {
    resetGame();
    io.emit('returnToLobby', { playerStats, wavesReached });
    broadcastLobbyUpdate();
  }, 4000);
}

function resetGame() {
  waveManager?.stopGame();
  combatManager?.reset();
  shopManager?.reset();
  enemyManager?.clear();
  barricadeManager?.clear();
  gameInProgress = false;
  defeatTriggered = false;
  Object.keys(gamePlayers).forEach((k) => delete gamePlayers[k]);
}

function isPlayerActive(socketId) {
  return gameInProgress && !gamePlayers[socketId]?.downed;
}

io.on('connection', (socket) => {
  const name = getUniqueName();
  lobby[socket.id] = { id: socket.id, name };
  console.log(`${name} ansluten (${socket.id})`);

  socket.emit('assignedName', name);
  broadcastLobbyUpdate();

  // A client returning to the lobby asks for the current state.
  socket.on('requestLobby', () => {
    socket.emit('lobbyUpdate', { players: Object.values(lobby), gameInProgress });
  });

  socket.on('startGame', () => {
    if (gameInProgress) return;
    gameInProgress = true;
    defeatTriggered = false;

    const players = Object.values(lobby);
    const count = players.length;
    players.forEach((player, i) => {
      const spawnX = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN);
      const spawnY = ROOM.y + 80 + (i / Math.max(count - 1, 1)) * (ROOM.height - 160);
      gamePlayers[player.id] = {
        id: player.id, name: player.name, x: spawnX, y: spawnY, weapon: 'pistol',
        hp: 100, maxHp: 100, downed: false, lastContactDamageAt: 0,
      };
    });

    initGame();

    players.forEach((player) => {
      shopManager.initPlayer(player.id);
    });

    io.emit('gameInit', Object.values(gamePlayers));
    io.emit('leakUpdate', { escaped: 0, max: MAX_LEAKS });
    broadcastLobbyUpdate();

    setTimeout(() => waveManager.startGame(), 1500);
    console.log(`Spelet startat med ${count} spelare`);
  });

  socket.on('playerMove', ({ x, y }) => {
    if (gamePlayers[socket.id]) {
      gamePlayers[socket.id].x = x;
      gamePlayers[socket.id].y = y;
      socket.broadcast.emit('gamePlayerMoved', { id: socket.id, x, y });
    }
  });

  socket.on('playerShoot', (data) => {
    if (isPlayerActive(socket.id) && combatManager) combatManager.handleShot(socket.id, data);
  });

  socket.on('hitEnemy', (data) => {
    if (isPlayerActive(socket.id) && combatManager) combatManager.handleHitEnemy(socket.id, data);
  });

  socket.on('purchaseWeapon', ({ weaponId }) => {
    if (gameInProgress && shopManager) {
      shopManager.handlePurchase(socket.id, weaponId);
    }
  });

  socket.on('switchWeapon', ({ weaponId }) => {
    if (gameInProgress && shopManager) {
      shopManager.handleSwitch(socket.id, weaponId);
    }
  });

  socket.on('upgradeWeapon', ({ weaponId }) => {
    if (gameInProgress && shopManager) {
      shopManager.handleUpgrade(socket.id, weaponId);
    }
  });

  socket.on('purchasePassive', ({ passiveId }) => {
    if (gameInProgress && shopManager) {
      shopManager.handlePassivePurchase(socket.id, passiveId);
    }
  });

  socket.on('placeBarricade', ({ x, y }) => {
    if (gameInProgress && barricadeManager) {
      barricadeManager.placeBarricade(socket.id, x, y);
    }
  });

  socket.on('revivePlayer', ({ targetId }) => {
    if (!gameInProgress) return;
    const target = gamePlayers[targetId];
    const reviver = gamePlayers[socket.id];
    if (!target || !reviver || !target.downed || reviver.downed) return;
    if (Math.hypot(reviver.x - target.x, reviver.y - target.y) > 80) return;
    target.downed = false;
    target.hp = 50;
    target.lastContactDamageAt = 0;
    io.emit('playerRevived', { id: targetId, hp: 50 });
  });

  socket.on('throwGrenade', (data) => {
    if (isPlayerActive(socket.id) && combatManager && shopManager?.getWeapons(socket.id).includes('grenade')) {
      combatManager.handleGrenadeThrow(socket.id, data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`${lobby[socket.id]?.name} frånkopplad`);
    delete lobby[socket.id];

    if (gamePlayers[socket.id]) {
      shopManager?.removePlayer(socket.id);
      delete gamePlayers[socket.id];
      io.emit('gamePlayerLeft', socket.id);

      if (gameInProgress && Object.keys(gamePlayers).length === 0) {
        resetGame();
        console.log('Spelet avslutat — inga spelare kvar');
      }
    }

    broadcastLobbyUpdate();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`);
});
