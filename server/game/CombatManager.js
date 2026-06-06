import { getWeapon } from '../../shared/weapons.js';

const GOLD_PER_KILL = 10;

export class CombatManager {
  constructor(io, enemyManager, getPlayers, shopManager) {
    this.io = io;
    this.enemyManager = enemyManager;
    this.getPlayers = getPlayers;
    this.shopManager = shopManager;
    this.activeBullets = new Map(); // bulletId -> bullet object
  }

  handleShot(socketId, data) {
    const { originX, originY } = data;

    // Server is authoritative about which weapon the player actually holds.
    const weaponId = this.shopManager.getActiveWeapon(socketId);
    const weapon = getWeapon(weaponId);

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

  reset() {
    this.activeBullets.clear();
  }
}
