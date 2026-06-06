const handgunDef = {
  damage: 10,
  speed: 800,
  pelletsCount: 1,
};

const shotgunDef = {
  damage: 8,
  speed: 700,
  pelletsCount: 5,
};

export class CombatManager {
  constructor(io, enemyManager, getPlayers, shopManager) {
    this.io = io;
    this.enemyManager = enemyManager;
    this.getPlayers = getPlayers;
    this.shopManager = shopManager;
    this.activeBullets = new Map(); // bulletId -> bullet object
    this.playerHp = new Map();      // socketId -> currentHp
  }

  initPlayer(socketId) {
    this.playerHp.set(socketId, 100);
  }

  handleShot(socketId, data) {
    const { weaponType, originX, originY } = data;
    const weapon = weaponType === 'shotgun' ? shotgunDef : handgunDef;

    const spreadAngles =
      weaponType === 'shotgun'
        ? [-2, -1, 0, 1, 2].map((n) => n * (15 * Math.PI / 180))
        : [0];

    for (let i = 0; i < spreadAngles.length; i++) {
      const angle = spreadAngles[i];
      const vx = Math.cos(angle) * weapon.speed;
      const vy = Math.sin(angle) * weapon.speed;
      const bulletId = Math.random().toString(36).substr(2, 9);

      const bullet = {
        id: bulletId,
        ownerId: socketId,
        x: originX,
        y: originY,
        vx,
        vy,
        weaponType,
        damage: weapon.damage,
        createdAt: Date.now(),
      };

      this.activeBullets.set(bulletId, bullet);

      this.io.emit('bulletFired', {
        id: bulletId,
        ownerId: socketId,
        x: originX,
        y: originY,
        vx,
        vy,
        weaponType,
      });

      setTimeout(() => {
        this.activeBullets.delete(bulletId);
      }, 2000);
    }
  }

  handleHitEnemy(socketId, data) {
    const { bulletId, enemyId } = data;

    const bullet = this.activeBullets.get(bulletId);
    if (!bullet) return;

    const damage = bullet.damage;
    const killed = this.enemyManager.damageEnemy(enemyId, damage, socketId);

    if (killed) {
      this.shopManager.addGold(socketId, 10);
    }

    this.io.to(socketId).emit('hitConfirmed', {
      bulletId,
      enemyId,
      damage,
      killed,
    });

    this.activeBullets.delete(bulletId);
  }

  handlePlayerDamaged(playerId, damage) {
    const players = this.getPlayers();
    let socketId = null;

    for (const [sid, player] of Object.entries(players)) {
      if (player.id === playerId) {
        socketId = sid;
        break;
      }
    }

    if (!socketId) return;

    const current = this.playerHp.get(socketId) ?? 100;
    const newHp = Math.max(0, current - damage);
    this.playerHp.set(socketId, newHp);

    this.io.emit('playerHpUpdated', {
      id: playerId,
      hp: newHp,
      maxHp: 100,
    });

    if (newHp <= 0) {
      this.io.emit('playerDied', { id: playerId });
    }
  }

  removePlayer(socketId) {
    this.playerHp.delete(socketId);
  }

  reset() {
    this.activeBullets.clear();
    this.playerHp.clear();
  }
}
