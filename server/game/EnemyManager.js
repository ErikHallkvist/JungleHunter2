import { getEnemyType } from '../../shared/enemies.js';

const ZIGZAG_AMP  = 55;   // ±55 px vertical swing
const ZIGZAG_FREQ = 2.5;  // radians per second
const SPRINT_ZONE = 400;  // x < 400 → sprint multiplier ramps up
const HEAL_INTERVAL = 3000; // ms between healer pulses
const HEAL_AMOUNT    = 25;
const HEAL_RADIUS    = 150;
const SPLIT_HP_RATIO = 0.4; // child gets 40% of parent maxHp
const SPLIT_SPEED_MULT = 1.3;
const Y_MIN = 80;
const Y_MAX = 620;

export class EnemyManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.enemies = new Map();
    this.LEAK_X = -40;
    this.leaked = 0;
    this.onEnemyLeaked = null;
  }

  spawnEnemy(typeId, hp) {
    const type = getEnemyType(typeId);
    const id = Math.random().toString(36).substr(2, 9);
    const x = 1240;
    const y = Math.floor(Math.random() * (Y_MAX - Y_MIN + 1)) + Y_MIN;
    const speed = type.speed;
    const ability = type.ability || null;

    const enemy = {
      id, x, y, hp, maxHp: hp, typeId, speed, ability,
      baseY: y,
      zigzagPhase: 0,
      healTimer: 0,
      splitDone: false,
    };

    this.enemies.set(id, enemy);
    this.io.emit('enemySpawned', { id, x, y, hp, maxHp: hp, typeId, ability });
    return enemy;
  }

  // Called by split — spawns a child enemy without emitting to WaveManager count.
  spawnSplitChild(parent, offset) {
    const id = Math.random().toString(36).substr(2, 9);
    const y = Math.max(Y_MIN, Math.min(Y_MAX, parent.y + (offset === 0 ? -22 : 22)));
    const hp = Math.max(1, Math.floor(parent.maxHp * SPLIT_HP_RATIO));
    const speed = parent.speed * SPLIT_SPEED_MULT;

    const child = {
      id,
      x: parent.x,
      y,
      hp,
      maxHp: hp,
      typeId: parent.typeId,
      speed,
      ability: null,   // children don't chain-split
      baseY: y,
      zigzagPhase: 0,
      healTimer: 0,
      splitDone: true,
    };

    this.enemies.set(id, child);
    this.io.emit('enemySpawned', { id, x: child.x, y: child.y, hp, maxHp: hp, typeId: child.typeId, ability: null });
    return child;
  }

  update(deltaMs) {
    for (const enemy of this.enemies.values()) {
      // ── Zigzag: sine-wave vertical oscillation ──────────────────────────────
      if (enemy.ability === 'zigzag') {
        enemy.zigzagPhase += deltaMs / 1000;
        enemy.y = enemy.baseY + Math.sin(enemy.zigzagPhase * ZIGZAG_FREQ) * ZIGZAG_AMP;
        enemy.y = Math.max(Y_MIN, Math.min(Y_MAX, enemy.y));
      }

      // ── Sprint: ramp up speed the closer to the left wall ──────────────────
      let speedMult = 1;
      if (enemy.ability === 'sprint' && enemy.x < SPRINT_ZONE) {
        speedMult = 1 + ((SPRINT_ZONE - enemy.x) / SPRINT_ZONE) * 2;
      }
      enemy.x -= enemy.speed * speedMult * (deltaMs / 1000);

      // ── Healer: pulse-heal nearby allies every HEAL_INTERVAL ms ────────────
      if (enemy.ability === 'healer') {
        enemy.healTimer += deltaMs;
        if (enemy.healTimer >= HEAL_INTERVAL) {
          enemy.healTimer = 0;
          for (const [id, other] of this.enemies) {
            if (id === enemy.id) continue;
            const dist = Math.hypot(other.x - enemy.x, other.y - enemy.y);
            if (dist <= HEAL_RADIUS) {
              other.hp = Math.min(other.hp + HEAL_AMOUNT, other.maxHp);
              this.io.emit('enemyHealed', { id, hp: other.hp });
            }
          }
        }
      }

      // ── Leak check ──────────────────────────────────────────────────────────
      if (enemy.x <= this.LEAK_X) {
        this.enemies.delete(enemy.id);
        this.leaked += 1;
        this.io.emit('enemyLeaked', { id: enemy.id });
        if (this.onEnemyLeaked) this.onEnemyLeaked(this.leaked);
      }
    }

    const moved = Array.from(this.enemies.values()).map(e => ({ id: e.id, x: e.x, y: e.y }));
    this.io.emit('enemiesMoved', moved);
  }

  damageEnemy(enemyId, damage, killedBySocketId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;

    enemy.hp -= damage;

    if (enemy.hp <= 0) {
      // ── Split: spawn two child enemies before removing the parent ──────────
      if (enemy.ability === 'split' && !enemy.splitDone) {
        enemy.splitDone = true;
        this.spawnSplitChild(enemy, 0);
        this.spawnSplitChild(enemy, 1);
      }

      this.enemies.delete(enemyId);
      this.io.emit('enemyDied', { id: enemyId, killedBy: killedBySocketId });
      return true;
    }

    this.io.emit('enemyDamaged', { id: enemyId, hp: enemy.hp, typeId: enemy.typeId });
    return false;
  }

  getAllEnemies() { return Array.from(this.enemies.values()); }
  getAliveCount() { return this.enemies.size; }
  clear()         { this.enemies.clear(); }
}
