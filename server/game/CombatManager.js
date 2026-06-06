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
    this.activeBullets = new Map(); // bulletId -> bullet object
    this.grenadeCooldowns = new Map(); // socketId -> timestamp (for Q-throw)
  }

  handleShot(socketId, data) {
    const { originX, originY } = data;

    // Server is authoritative about which weapon the player actually holds.
    const weaponId = this.shopManager.getActiveWeapon(socketId);
    const weapon = getWeapon(weaponId);

    // Grenades are thrown with the Q key (throwGrenade event), not regular fire.
    if (weapon.id === 'grenade') return;

    // Build spread angles centred on 0 (straight right).
    const n = weapon.pellets;
    const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
    const angles = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
      angles.push(t * spreadRad);
    }

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
        damage: weapon.damage,
        createdAt: Date.now(),
      });

      // Broadcast to EVERY client so all players see each other's shots.
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

    // Only the bullet's owner can register its hits.
    if (bullet.ownerId !== socketId) return;

    const damage = bullet.damage;
    const killed = this.enemyManager.damageEnemy(enemyId, damage, socketId);

    if (killed) {
      this.shopManager.addGold(socketId, GOLD_PER_KILL);
    }

    this.io.to(socketId).emit('hitConfirmed', { bulletId, enemyId, damage, killed });
    this.activeBullets.delete(bulletId);
  }

  // Called when Q key is pressed — throw a grenade toward target position.
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

    // Broadcast the grenade as a projectile so all clients can render it.
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

    // Server-side fuse: explode at predicted position after GRENADE_FUSE_MS.
    setTimeout(() => {
      const explX = Math.min(Math.max(originX + vx * (GRENADE_FUSE_MS / 1000), ROOM_MIN_X), ROOM_MAX_X);
      const explY = Math.min(Math.max(originY + vy * (GRENADE_FUSE_MS / 1000), ROOM_MIN_Y), ROOM_MAX_Y);
      this._explodeGrenade(grenadeId, socketId, explX, explY, weapon.explodeRadius, weapon.damage);
    }, GRENADE_FUSE_MS);
  }

  _explodeGrenade(grenadeId, socketId, cx, cy, radius, damage) {
    let kills = 0;
    for (const enemy of this.enemyManager.getAllEnemies()) {
      if (Math.hypot(enemy.x - cx, enemy.y - cy) <= radius) {
        const killed = this.enemyManager.damageEnemy(enemy.id, damage, socketId);
        if (killed) kills++;
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
  }
}
