import { ENEMY_TYPES } from '../../shared/enemies.js';

const WAVE_EVENTS = ['GULD-RUSH', 'MÖRKER', 'HETS', 'FRYSNING'];
const BOSS_INTERVAL = 10; // boss wave every 10 waves

export class WaveManager {
  constructor(io, enemyManager, getPlayers, barricadeManager) {
    this.io = io;
    this.enemyManager = enemyManager;
    this.getPlayers = getPlayers;
    this.barricadeManager = barricadeManager || null;

    this.currentWave = 0;
    this.gameRunning = false;
    this.waveActive = false;
    this.allEnemiesSpawned = false;
    this.loopInterval = null;
    this.lastTime = null;
    this.activeEvent = null;
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
    this.barricadeManager?.tick();

    if (
      this.waveActive &&
      this.allEnemiesSpawned &&
      this.enemyManager.getAliveCount() === 0
    ) {
      this.waveActive = false;
      this._clearWaveEvent();
      this.io.emit('waveComplete', { waveNumber: this.currentWave });
      this.startCountdown(10, () => this.startNextWave());
    }
  }

  _getNextWaveInfo(waveNum) {
    const typeIndex = (waveNum - 1) % ENEMY_TYPES.length;
    const type = ENEMY_TYPES[typeIndex];
    const loop = Math.floor((waveNum - 1) / ENEMY_TYPES.length);
    const enemyCount = 5 + (waveNum - 1) * 2 + loop * 3;
    const isBoss = waveNum % BOSS_INTERVAL === 0;
    // estimate gold: 10g per kill × count
    const estimatedGold = enemyCount * 10;
    return { type, enemyCount, isBoss, estimatedGold };
  }

  startNextWave() {
    const nextNum = this.currentWave + 1;
    const { type, enemyCount, isBoss, estimatedGold } = this._getNextWaveInfo(nextNum);
    this.currentWave = nextNum;

    // Pick wave event every 3 normal waves (not on boss waves)
    let waveEvent = null;
    if (!isBoss && this.currentWave % 3 === 0) {
      waveEvent = WAVE_EVENTS[Math.floor(Math.random() * WAVE_EVENTS.length)];
    }

    // Apply event effects
    this._applyWaveEvent(waveEvent, enemyCount);

    const goldMult = waveEvent === 'GULD-RUSH' ? 3 : 1;
    const actualEnemyCount = waveEvent === 'FRYSNING' ? enemyCount * 2 : enemyCount;

    this.io.emit('waveStart', {
      waveNumber: this.currentWave,
      enemyCount: actualEnemyCount,
      enemyType: type.id,
      enemyName: type.name,
      isBoss,
      waveEvent,
    });

    this.waveActive = true;
    this.allEnemiesSpawned = false;
    this.activeEvent = waveEvent;

    let spawned = 0;
    const spawnInterval = setInterval(() => {
      if (!this.gameRunning) { clearInterval(spawnInterval); return; }
      this.enemyManager.spawnEnemy(type.id, isBoss ? type.hp * 5 : type.hp);
      spawned++;
      if (spawned >= actualEnemyCount) {
        clearInterval(spawnInterval);
        this.allEnemiesSpawned = true;
      }
    }, 600);
  }

  _applyWaveEvent(event, baseCount) {
    switch (event) {
      case 'HETS':
        this.enemyManager.setSpeedMultiplier(1.6);
        break;
      case 'FRYSNING':
        this.enemyManager.setSpeedMultiplier(0.5);
        break;
      default:
        this.enemyManager.setSpeedMultiplier(1);
    }
  }

  _clearWaveEvent() {
    this.enemyManager.setSpeedMultiplier(1);
    this.activeEvent = null;
  }

  startCountdown(seconds, onComplete) {
    // Send preview of next wave during countdown
    const nextNum = this.currentWave + 1;
    const preview = this._getNextWaveInfo(nextNum);
    this.io.emit('wavePreview', {
      nextWave: nextNum,
      enemyType: preview.type.id,
      enemyName: preview.type.name,
      enemyCount: preview.enemyCount,
      estimatedGold: preview.estimatedGold,
      isBoss: preview.isBoss,
    });

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
    this._clearWaveEvent();
    this.enemyManager.clear();
  }
}
