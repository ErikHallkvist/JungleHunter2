import { getWeapon, PROJECTILES } from '../../shared/weapons.js';

export class BulletSystem {
  constructor(scene) {
    this.scene = scene;
    this.bullets = new Map();
    this.socket = null;
    this.getEnemies = null;
    this.hitBullets = new Set();
    this.lastRemoteSound = new Map(); // ownerId -> timestamp (dedup multi-pellet shots)
  }

  init(socket, getEnemies) {
    this.socket = socket;
    this.getEnemies = getEnemies;
    socket.socket.on('bulletFired', (data) => this.onBulletFired(data));
  }

  onBulletFired({ id, ownerId, x, y, vx, vy, weaponType, bulletType }) {
    // Resolve the projectile visual (fall back via the weapon def).
    const type = bulletType || getWeapon(weaponType).bulletType;
    const proj = PROJECTILES[type] || PROJECTILES.bullet;

    const sprite = this.scene.add.image(x, y, proj.sprite);
    sprite.setDisplaySize(proj.w, proj.h);
    sprite.setRotation(Math.atan2(vy, vx));
    sprite.setDepth(8);

    const mine = ownerId === this.socket.socket.id;

    // Play other players' shot sounds (own sound is played by WeaponSystem).
    // Dedup per owner so a multi-pellet shotgun blast only sounds once.
    if (!mine) {
      const now = Date.now();
      if (now - (this.lastRemoteSound.get(ownerId) || 0) > 70) {
        this.lastRemoteSound.set(ownerId, now);
        this.scene.playShotSound?.(type, false);
      }
    }

    this.bullets.set(id, {
      sprite, vx, vy, ownerId,
      w: proj.w, h: proj.h,
      mine,
      createdAt: Date.now(),
      processed: false,
    });
  }

  update(delta) {
    const now = Date.now();

    for (const [id, bullet] of this.bullets) {
      const { sprite, vx, vy, createdAt } = bullet;

      sprite.x += vx * (delta / 1000);
      sprite.y += vy * (delta / 1000);

      if (
        sprite.x < 0 || sprite.x > 1280 ||
        sprite.y < 0 || sprite.y > 720 ||
        now - createdAt > 2500
      ) {
        sprite.destroy();
        this.bullets.delete(id);
        continue;
      }

      // Only the owner reports hits to the server (server validates ownership).
      if (!bullet.processed && bullet.mine) {
        const bulletRect = new Phaser.Geom.Rectangle(
          sprite.x - bullet.w / 2, sprite.y - bullet.h / 2, bullet.w, bullet.h
        );

        for (const enemy of this.getEnemies()) {
          const enemyRect = new Phaser.Geom.Rectangle(
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2,
            enemy.width,
            enemy.height
          );

          if (
            Phaser.Geom.Rectangle.Overlaps(bulletRect, enemyRect) &&
            !this.hitBullets.has(id)
          ) {
            this.hitBullets.add(id);
            bullet.processed = true;
            this.socket.socket.emit('hitEnemy', { bulletId: id, enemyId: enemy.id });
            sprite.destroy();
            this.bullets.delete(id);
            break;
          }
        }
      }
    }
  }

  destroy() {
    this.socket.socket.off('bulletFired');
    for (const bullet of this.bullets.values()) {
      bullet.sprite.destroy();
    }
    this.bullets.clear();
    this.hitBullets.clear();
  }
}
