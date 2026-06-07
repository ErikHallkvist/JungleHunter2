import { getWeapon } from '../../shared/weapons.js';

const GOLD_PER_KILL = 10;
const GRENADE_FUSE_MS = 1400;
const ROOM_MIN_X = 32;
const ROOM_MAX_X = 1248;
const ROOM_MIN_Y = 32;
const ROOM_MAX_Y = 688;
export class CombatManager {
  constructor(io, enemyManager, getPlayers, shopManager) {
    this.io = io;
    this.enemyManager = enemyManager;
    this.getPlayers = getPlayers;
    this.shopManager = shopManager;
    this.activeBullets = new Map();
    this.grenadeCooldowns = new Map();
    // per-player stats for end-of-game screen
    this.playerStats = new Map(); // socketId -> { kills: 0, damage: 0 }
  }

  _getWeaponDamage(socketId, baseWeapon) {
    const upgrades = this.shopManager.getUpgrades(socketId);
    if (upgrades.has(baseWeapon.id)) {
      return Math.floor(baseWeapon.damage * 1.2);
    }
    return baseWeapon.damage;
  }

  _getWeaponFireRate(socketId, baseWeapon) {
    const upgrades = this.shopManager.getUpgrades(socketId);
    if (upgrades.has(baseWeapon.id)) {
      return Math.floor(baseWeapon.fireRate * 0.9);
    }
    return baseWeapon.fireRate;
  }

  handleShot(socketId, data) {
    const { originX, originY } = data;

    const weaponId = this.shopManager.getActiveWeapon(socketId);
    const weapon = getWeapon(weaponId);

    if (weapon.id === 'grenade') return;

    const n = weapon.pellets;
    const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
    const angles = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      angles.push(t * spreadRad);
    }

    const damage = this._getWeaponDamage(socketId, weapon);

    for (const angle of angles) {
      const vx = Math.cos(angle) * weapon.speed;
      const vy = Math.sin(angle) * weapon.speed;
      const bulletId = Math.random().toString(36).substr(2, 9);

      this.activeBullets.set(bulletId, {
        id: bulletId,
        ownerId: socketId,
        x: originX,
        y: originY,
        vx,
        vy,
        weaponType: weapon.id,
        damage,
        createdAt: Date.now(),
      });

      this.io.emit('bulletFired', {
        id: bulletId,
        ownerId: socketId,
        x: originX,
        y: originY,
        vx,
        vy,
        weaponType: weapon.id,
        bulletType: weapon.bulletType,
      });

      setTimeout(() => this.activeBullets.delete(bulletId), 2500);
    }
  }

  handleHitEnemy(socketId, data) {
    const { bulletId, enemyId } = data;

    const bullet = this.activeBullets.get(bulletId);
    if (!bullet) return;

    if (bullet.ownerId !== socketId) return;

    // Critical hit: 15% chance for 2× damage (requires 'crit' passive)
    const passives = this.shopManager.getPassives(socketId);
    let damage = bullet.damage;
    let isCrit = false;
    if (passives.has('crit') && Math.random() < 0.15) {
      damage *= 2;
      isCrit = true;
    }

    const killed = this.enemyManager.damageEnemy(enemyId, damage, socketId);

    // Track damage stat
    const stats = this._getStats(socketId);
    stats.damage += damage;

    if (killed) {
      stats.kills++;
      const killedPos = this.enemyManager.getLastKilledPos();
      let baseGold = killedPos?.goldValue ?? GOLD_PER_KILL;
      // Bounty Hunter: 2× gold from elites
      if (passives.has('bounty_hunter') && killedPos?.isElite) baseGold *= 2;
      this.shopManager.addGold(socketId, baseGold);

      // Synergy passive: AoE explosion on kill
      if (passives.has('synergy') && killedPos) {
        this._synergyExplosion(socketId, killedPos.x, killedPos.y, 100, bullet.damage * 0.5);
      }
    }

    // Lifesteal: 8% of damage dealt heals the shooter
    if (passives.has('lifesteal')) {
      const healAmt = Math.floor(damage * 0.08);
      if (healAmt > 0) {
        const player = this.getPlayers()[socketId];
        if (player && !player.downed && player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + healAmt);
          this.io.emit('playerDamaged', { id: socketId, hp: player.hp, maxHp: player.maxHp });
        }
      }
    }

    this.io.to(socketId).emit('hitConfirmed', { bulletId, enemyId, damage, killed, isCrit });
    this.activeBullets.delete(bulletId);
  }

  _getStats(socketId) {
    if (!this.playerStats.has(socketId)) {
      this.playerStats.set(socketId, { kills: 0, damage: 0 });
    }
    return this.playerStats.get(socketId);
  }

  getStats(socketId) { return this.playerStats.get(socketId) ?? { kills: 0, damage: 0 }; }
  getAllStats() { return Object.fromEntries(this.playerStats); }

  _synergyExplosion(socketId, cx, cy, radius, damage) {
    for (const enemy of this.enemyManager.getAllEnemies()) {
      if (Math.hypot(enemy.x - cx, enemy.y - cy) <= radius) {
        this.enemyManager.damageEnemy(enemy.id, damage, socketId);
      }
    }
    this.io.emit('grenadeExploded', { id: 'syn_' + Math.random().toString(36).substr(2,5), x: cx, y: cy, radius });
  }

  handleGrenadeThrow(socketId, { originX, originY, targetX, targetY }) {
    const now = Date.now();
    const weapon = getWeapon('grenade');
    const lastThrow = this.grenadeCooldowns.get(socketId) || 0;
    if (now - lastThrow < weapon.fireRate) return;
    this.grenadeCooldowns.set(socketId, now);

    this._throwGrenade(socketId, originX, originY, targetX, targetY);
  }

  _throwGrenade(socketId, originX, originY, targetX, targetY) {
    const weapon = getWeapon('grenade');
    const dx = targetX - originX;
    const dy = targetY - originY;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * weapon.speed;
    const vy = (dy / len) * weapon.speed;
    const grenadeId = Math.random().toString(36).substr(2, 9);

    this.io.emit('bulletFired', {
      id: grenadeId,
      ownerId: socketId,
      x: originX,
      y: originY,
      vx,
      vy,
      weaponType: 'grenade',
      bulletType: weapon.bulletType,
    });

    setTimeout(() => {
      const explX = Math.min(Math.max(originX + vx * (GRENADE_FUSE_MS / 1000), ROOM_MIN_X), ROOM_MAX_X);
      const explY = Math.min(Math.max(originY + vy * (GRENADE_FUSE_MS / 1000), ROOM_MIN_Y), ROOM_MAX_Y);
      this._explodeGrenade(grenadeId, socketId, explX, explY, weapon.explodeRadius, weapon.damage);
    }, GRENADE_FUSE_MS);
  }

  _explodeGrenade(grenadeId, socketId, cx, cy, radius, damage) {
    const stats = this._getStats(socketId);
    let kills = 0;
    for (const enemy of this.enemyManager.getAllEnemies()) {
      if (Math.hypot(enemy.x - cx, enemy.y - cy) <= radius) {
        stats.damage += damage;
        const killed = this.enemyManager.damageEnemy(enemy.id, damage, socketId);
        if (killed) {
          stats.kills++;
          kills++;
        }
      }
    }

    if (kills > 0) {
      this.shopManager.addGold(socketId, GOLD_PER_KILL * kills);
    }

    this.io.emit('grenadeExploded', { id: grenadeId, x: cx, y: cy, radius });
  }

  reset() {
    this.activeBullets.clear();
    this.grenadeCooldowns.clear();
    this.playerStats.clear();
  }
}
