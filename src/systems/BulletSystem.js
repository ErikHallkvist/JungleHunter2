export class BulletSystem {
  constructor(scene) {
    this.scene = scene;
    this.bullets = new Map();
    this.socket = null;
    this.getEnemies = null;
    this.hitBullets = new Set();
  }

  init(socket, getEnemies) {
    this.socket = socket;
    this.getEnemies = getEnemies;
    socket.socket.on('bulletFired', (data) => this.onBulletFired(data));
  }

  onBulletFired({ id, ownerId, x, y, vx, vy, weaponType }) {
    const key = weaponType === 'shotgun' ? 'pellet' : 'bullet';
    const sprite = this.scene.add.image(x, y, key);

    if (weaponType === 'shotgun') {
      sprite.setDisplaySize(10, 10);
    } else {
      sprite.setDisplaySize(20, 7);
    }

    // Rotate sprite to match travel direction
    sprite.setRotation(Math.atan2(vy, vx));
    sprite.setDepth(8);

    this.bullets.set(id, {
      sprite, vx, vy, weaponType,
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
        now - createdAt > 2000
      ) {
        sprite.destroy();
        this.bullets.delete(id);
        continue;
      }

      if (!bullet.processed) {
        const bW = bullet.weaponType === 'shotgun' ? 10 : 20;
        const bH = bullet.weaponType === 'shotgun' ? 10 : 7;
        const bulletRect = new Phaser.Geom.Rectangle(
          sprite.x - bW / 2, sprite.y - bH / 2, bW, bH
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
