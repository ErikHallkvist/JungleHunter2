import { ENEMY_TYPES } from '../../shared/enemies.js';

export class WaveManager {
  constructor(io, enemyManager, getPlayers) {
    this.io = io;
    this.enemyManager = enemyManager;
    this.getPlayers = getPlayers;

    this.currentWave = 0;
    this.gameRunning = false;
    this.waveActive = false;
    this.allEnemiesSpawned = false;
    this.loopInterval = null;
    this.lastTime = null;
  }

  startGame() {
    this.currentWave = 0;
    this.gameRunning = true;
    this.lastTime = Date.now();
    this.loopInterval = setInterval(() => this.tick(), 50);
    this.startNextWave();
  }

  tick() {
    const now = Date.now();
    const deltaMs = this.lastTime !== null ? now - this.lastTime : 50;
    this.lastTime = now;

    this.enemyManager.update(deltaMs);

    if (
      this.waveActive &&
      this.allEnemiesSpawned &&
      this.enemyManager.getAliveCount() === 0
    ) {
      this.waveActive = false;
      this.io.emit('waveComplete', { waveNumber: this.currentWave });
      this.startCountdown(10, () => this.startNextWave());
    }
  }

  startNextWave() {
    // Each wave uses one specific enemy type; cycle back after all 40.
    const typeIndex = this.currentWave % ENEMY_TYPES.length;
    const type = ENEMY_TYPES[typeIndex];
    this.currentWave++;

    // Enemy count scales with wave number (more enemies each loop of 40)
    const loop = Math.floor((this.currentWave - 1) / ENEMY_TYPES.length);
    const enemyCount = 5 + (this.currentWave - 1) * 2 + loop * 3;

    this.io.emit('waveStart', {
      waveNumber: this.currentWave,
      enemyCount,
      enemyType: type.id,
      enemyName: type.name,
    });

    this.waveActive = true;
    this.allEnemiesSpawned = false;

    let spawned = 0;
    const spawnInterval = setInterval(() => {
      if (!this.gameRunning) { clearInterval(spawnInterval); return; }
      this.enemyManager.spawnEnemy(type.id, type.hp);
      spawned++;
      if (spawned >= enemyCount) {
        clearInterval(spawnInterval);
        this.allEnemiesSpawned = true;
      }
    }, 600);
  }

  startCountdown(seconds, onComplete) {
    let remaining = seconds;
    this.io.emit('waveCountdown', { seconds: remaining });
    const interval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        this.io.emit('waveCountdown', { seconds: remaining });
      } else {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
  }

  getCurrentWave() { return this.currentWave; }

  stopGame() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.gameRunning = false;
    this.enemyManager.clear();
  }
}
