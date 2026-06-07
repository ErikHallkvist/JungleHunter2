import { ENEMY_TYPES } from '../../shared/enemies.js';

const WAVE_EVENTS = ['GOLD-RUSH', 'DARKNESS', 'FRENZY', 'FREEZE', 'ELITE_STORM', 'HORDE', 'REGENERATION'];
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
    if (!this.gameRunning) return;
    const now = Date.now();
    const deltaMs = this.lastTime !== null ? now - this.lastTime : 50;
    this.lastTime = now;

    try {
      this.enemyManager.update(deltaMs);
      this.barricadeManager?.tick();
    } catch (err) {
      console.error('Tick error:', err);
    }

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

  // Returns the pool of enemy types available for a given wave.
  // New types unlock every wave; pool grows up to 6 choices.
  _getEnemyPool(waveNum) {
    const maxUnlocked = Math.min(waveNum, ENEMY_TYPES.length);
    // Always include the "main" type for this wave plus up to 5 earlier types
    const poolSize = Math.min(6, maxUnlocked);
    const startIdx = Math.max(0, maxUnlocked - poolSize);
    return ENEMY_TYPES.slice(startIdx, maxUnlocked);
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

    // Respawn any downed players at wave start
    for (const player of Object.values(this.getPlayers())) {
      if (player.downed) {
        player.downed = false;
        player.hp = 50;
        player.lastContactDamageAt = 0;
        this.io.emit('playerRevived', { id: player.id, hp: 50 });
      }
    }

    // Pick wave event every 3 normal waves (not on boss waves)
    let waveEvent = null;
    if (!isBoss && this.currentWave % 3 === 0) {
      waveEvent = WAVE_EVENTS[Math.floor(Math.random() * WAVE_EVENTS.length)];
    }

    this._applyWaveEvent(waveEvent);

    const isHorde = waveEvent === 'HORDE';
    const actualEnemyCount = isHorde ? enemyCount * 3
      : waveEvent === 'FREEZE' ? enemyCount * 2
      : enemyCount;
    const hpMult = isHorde ? 0.4 : 1;

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

    const pool = isBoss ? [type] : this._getEnemyPool(nextNum);

    let spawned = 0;
    const spawnInterval = setInterval(() => {
      if (!this.gameRunning) { clearInterval(spawnInterval); return; }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const baseHp = isBoss ? pick.hp * 5 : pick.hp;
      this.enemyManager.spawnEnemy(pick.id, Math.max(1, Math.floor(baseHp * hpMult)));
      spawned++;
      if (spawned >= actualEnemyCount) {
        clearInterval(spawnInterval);
        this.allEnemiesSpawned = true;
      }
    }, 600);
  }

  _applyWaveEvent(event) {
    this.enemyManager.setSpeedMultiplier(1);
    this.enemyManager.clearEliteChanceOverride();
    this.enemyManager.clearRegen();
    switch (event) {
      case 'FRENZY':       this.enemyManager.setSpeedMultiplier(1.6); break;
      case 'FREEZE':       this.enemyManager.setSpeedMultiplier(0.5); break;
      case 'ELITE_STORM':  this.enemyManager.setEliteChanceOverride(0.5); break;
      case 'REGENERATION': this.enemyManager.setRegen(10); break;
    }
    this.activeEvent = event ?? null;
  }

  _clearWaveEvent() { this._applyWaveEvent(null); }

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
