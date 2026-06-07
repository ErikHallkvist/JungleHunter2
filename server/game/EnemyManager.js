import { getEnemyType } from '../../shared/enemies.js';
import { getWeapon } from '../../shared/weapons.js';

const ZIGZAG_AMP  = 55;
const ZIGZAG_FREQ = 2.5;
const SPRINT_ZONE = 400;
const HEAL_INTERVAL = 3000;
const HEAL_AMOUNT    = 25;
const HEAL_RADIUS    = 150;
const SPLIT_HP_RATIO = 0.4;
const SPLIT_SPEED_MULT = 1.3;
const Y_MIN = 205;
const Y_MAX = 620;
const ELITE_CHANCE = 0.08;
const BARRICADE_DPS = 8;
const CONTACT_DAMAGE = 25;
const CONTACT_COOLDOWN_MS = 1000;
const CONTACT_RADIUS = 35;

const ARMED_CHANCE = 0.20;
const SHOOT_INTERVAL_MIN = 2500;
const SHOOT_INTERVAL_MAX = 6000;
const ENEMY_BULLET_INACCURACY_DEG = 15;
const ENEMY_BULLET_LIFETIME = 2500;
const PLAYER_HIT_RADIUS = 22;

// Weapon pool unlocks progressively as waves increase.
// Grenades are excluded since they have special throw mechanics.
function getWeaponPoolForWave(wave) {
  if (wave <= 5)  return ['pistol'];
  if (wave <= 10) return ['pistol', 'revolver'];
  if (wave <= 15) return ['revolver', 'smg'];
  if (wave <= 20) return ['smg', 'shotgun', 'burst_rifle'];
  if (wave <= 25) return ['shotgun', 'burst_rifle', 'assault_rifle'];
  if (wave <= 30) return ['burst_rifle', 'assault_rifle', 'magnum'];
  if (wave <= 35) return ['assault_rifle', 'magnum', 'combat_shotgun'];
  if (wave <= 40) return ['magnum', 'combat_shotgun', 'marksman'];
  if (wave <= 45) return ['combat_shotgun', 'marksman', 'lmg'];
  if (wave <= 50) return ['marksman', 'lmg', 'sniper'];
  return ['lmg', 'sniper', 'auto_shotgun', 'plasma_rifle'];
}

export class EnemyManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.enemies = new Map();
    this.LEAK_X = -40;
    this.leaked = 0;
    this.onEnemyLeaked = null;
    this._lastKilledPos = null;
    this.barricadeManager = null;
    this.speedMultiplier = 1;
    this.eliteChanceOverride = null;
    this.regenPerSec = 0;
    this._regenTimer = 0;
    this.currentWave = 1;
    this.activeBullets = new Map();
  }

  setCurrentWave(wave) { this.currentWave = wave; }

  _pickWeapon() {
    const pool = getWeaponPoolForWave(this.currentWave);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  spawnEnemy(typeId, hp) {
    const type = getEnemyType(typeId);
    const id = Math.random().toString(36).substr(2, 9);
    const x = 1240;
    const y = Math.floor(Math.random() * (Y_MAX - Y_MIN + 1)) + Y_MIN;

    const isElite = Math.random() < (this.eliteChanceOverride ?? ELITE_CHANCE);
    const finalHp = isElite ? hp * 3 : hp;
    const speed = isElite ? type.speed * 1.3 : type.speed;
    const ability = type.ability || null;
    const goldValue = isElite ? hp * 5 : null;

    const hasWeapon = Math.random() < ARMED_CHANCE;
    const weaponId = hasWeapon ? this._pickWeapon() : null;
    const nextShootAt = hasWeapon
      ? Date.now() + SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN)
      : null;

    const enemy = {
      id, x, y, hp: finalHp, maxHp: finalHp, typeId, speed, ability,
      baseY: y,
      zigzagPhase: 0,
      healTimer: 0,
      splitDone: false,
      isElite,
      goldValue,
      weapon: weaponId,
      nextShootAt,
    };

    this.enemies.set(id, enemy);
    this.io.emit('enemySpawned', { id, x, y, hp: finalHp, maxHp: finalHp, typeId, ability, isElite, weapon: weaponId });
    return enemy;
  }

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
      ability: null,
      baseY: y,
      zigzagPhase: 0,
      healTimer: 0,
      splitDone: true,
      isElite: false,
      goldValue: null,
      weapon: null,
      nextShootAt: null,
    };

    this.enemies.set(id, child);
    this.io.emit('enemySpawned', { id, x: child.x, y: child.y, hp, maxHp: hp, typeId: child.typeId, ability: null, isElite: false, weapon: null });
    return child;
  }

  _fireEnemyBullet(enemy, targetPlayer) {
    const weapon = getWeapon(enemy.weapon);
    const n = weapon.pellets;
    const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
    const inaccuracyRad = (ENEMY_BULLET_INACCURACY_DEG * Math.PI) / 180;

    const dx = targetPlayer.x - enemy.x;
    const dy = targetPlayer.y - enemy.y;
    const baseAngle = Math.atan2(dy, dx);

    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const weaponSpread = t * spreadRad;
      const inaccuracy = (Math.random() - 0.5) * 2 * inaccuracyRad;
      const angle = baseAngle + weaponSpread + inaccuracy;

      const vx = Math.cos(angle) * weapon.speed;
      const vy = Math.sin(angle) * weapon.speed;
      const bulletId = 'eb_' + Math.random().toString(36).substr(2, 9);

      this.activeBullets.set(bulletId, {
        id: bulletId,
        x: enemy.x,
        y: enemy.y,
        vx,
        vy,
        damage: weapon.damage,
        createdAt: Date.now(),
      });

      this.io.emit('bulletFired', {
        id: bulletId,
        ownerId: 'enemy_' + enemy.id,
        x: enemy.x,
        y: enemy.y,
        vx,
        vy,
        weaponType: weapon.id,
        bulletType: weapon.bulletType,
      });

      setTimeout(() => this.activeBullets.delete(bulletId), ENEMY_BULLET_LIFETIME);
    }
  }

  update(deltaMs) {
    const now = Date.now();

    for (const enemy of this.enemies.values()) {
      if (enemy.ability === 'zigzag') {
        enemy.zigzagPhase += deltaMs / 1000;
        enemy.y = enemy.baseY + Math.sin(enemy.zigzagPhase * ZIGZAG_FREQ) * ZIGZAG_AMP;
        enemy.y = Math.max(Y_MIN, Math.min(Y_MAX, enemy.y));
      }

      let speedMult = this.speedMultiplier;
      if (enemy.ability === 'sprint' && enemy.x < SPRINT_ZONE) {
        speedMult *= 1 + ((SPRINT_ZONE - enemy.x) / SPRINT_ZONE) * 2;
      }

      // Check barricade collision before moving
      let blockedByBarricade = false;
      if (this.barricadeManager) {
        for (const barricade of this.barricadeManager.getBarricades()) {
          const bw = barricade.w / 2;
          const bh = barricade.h / 2 + 20;
          const nextX = enemy.x - enemy.speed * speedMult * (deltaMs / 1000);
          if (nextX <= barricade.x + bw + 5 && nextX >= barricade.x - bw - 5 &&
              Math.abs(enemy.y - barricade.y) < bh + 20) {
            enemy.x = barricade.x + bw + 5;
            this.barricadeManager.damageBarricade(barricade.id, BARRICADE_DPS * (deltaMs / 1000));
            blockedByBarricade = true;
            break;
          }
        }
      }

      if (!blockedByBarricade) {
        enemy.x -= enemy.speed * speedMult * (deltaMs / 1000);
      }

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

      if (enemy.x <= this.LEAK_X) {
        this.enemies.delete(enemy.id);
        this.leaked += 1;
        this.io.emit('enemyLeaked', { id: enemy.id });
        if (this.onEnemyLeaked) this.onEnemyLeaked(this.leaked);
        continue;
      }

      // Armed enemy shooting
      if (enemy.weapon && enemy.nextShootAt && now >= enemy.nextShootAt) {
        const players = this.getPlayers();
        let nearest = null;
        let nearestDist = Infinity;
        for (const player of Object.values(players)) {
          if (player.downed || player.hp == null) continue;
          const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = player;
          }
        }
        if (nearest) this._fireEnemyBullet(enemy, nearest);
        enemy.nextShootAt = now + SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN);
      }
    }

    // Enemy regeneration (throttled to every 500 ms to limit network traffic)
    if (this.regenPerSec > 0) {
      this._regenTimer += deltaMs;
      if (this._regenTimer >= 500) {
        this._regenTimer = 0;
        for (const enemy of this.enemies.values()) {
          if (enemy.hp < enemy.maxHp) {
            enemy.hp = Math.min(enemy.hp + this.regenPerSec * 0.5, enemy.maxHp);
            this.io.emit('enemyHealed', { id: enemy.id, hp: enemy.hp });
          }
        }
      }
    }

    // Player contact damage — enemies deal damage when touching a player
    for (const player of Object.values(this.getPlayers())) {
      if (player.downed || player.hp == null) continue;
      if (now - (player.lastContactDamageAt || 0) < CONTACT_COOLDOWN_MS) continue;
      for (const enemy of this.enemies.values()) {
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < CONTACT_RADIUS) {
          player.lastContactDamageAt = now;
          player.hp = Math.max(0, player.hp - CONTACT_DAMAGE);
          this.io.emit('playerDamaged', { id: player.id, hp: player.hp, maxHp: player.maxHp });
          if (player.hp <= 0 && !player.downed) {
            player.downed = true;
            this.io.emit('playerDowned', { id: player.id });
          }
          break;
        }
      }
    }

    // Enemy bullet movement and player hit detection
    const dt = deltaMs / 1000;
    for (const [bulletId, bullet] of this.activeBullets) {
      if (now - bullet.createdAt > ENEMY_BULLET_LIFETIME) {
        this.activeBullets.delete(bulletId);
        continue;
      }

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (bullet.x < -50 || bullet.x > 1350 || bullet.y < -50 || bullet.y > 780) {
        this.activeBullets.delete(bulletId);
        continue;
      }

      for (const player of Object.values(this.getPlayers())) {
        if (player.downed || player.hp == null) continue;
        if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < PLAYER_HIT_RADIUS) {
          player.hp = Math.max(0, player.hp - bullet.damage);
          this.io.emit('playerDamaged', { id: player.id, hp: player.hp, maxHp: player.maxHp });
          if (player.hp <= 0 && !player.downed) {
            player.downed = true;
            this.io.emit('playerDowned', { id: player.id });
          }
          this.activeBullets.delete(bulletId);
          break;
        }
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
      if (enemy.ability === 'split' && !enemy.splitDone) {
        enemy.splitDone = true;
        this.spawnSplitChild(enemy, 0);
        this.spawnSplitChild(enemy, 1);
      }

      this._lastKilledPos = { x: enemy.x, y: enemy.y, goldValue: enemy.goldValue, isElite: enemy.isElite };
      const killedByName = this.getPlayers()[killedBySocketId]?.name ?? 'Unknown';
      const enemyType = getEnemyType(enemy.typeId);
      this.enemies.delete(enemyId);
      this.io.emit('enemyDied', { id: enemyId, killedBy: killedBySocketId, killedByName, enemyName: enemyType?.name ?? enemy.typeId });
      return true;
    }

    this.io.emit('enemyDamaged', { id: enemyId, hp: enemy.hp, typeId: enemy.typeId, damage });
    return false;
  }

  getLastKilledPos() { return this._lastKilledPos; }
  getAllEnemies() { return Array.from(this.enemies.values()); }
  getAliveCount() { return this.enemies.size; }
  clear()         { this.enemies.clear(); this.activeBullets.clear(); }
  setSpeedMultiplier(mult) { this.speedMultiplier = mult; }
  setEliteChanceOverride(v) { this.eliteChanceOverride = v; }
  clearEliteChanceOverride() { this.eliteChanceOverride = null; }
  setRegen(v) { this.regenPerSec = v; this._regenTimer = 0; }
  clearRegen() { this.regenPerSec = 0; }
}
