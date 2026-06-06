export class BulletSystem {
  constructor(scene) {
    this.scene = scene;
    this.bullets = new Map();   // bulletId -> {sprite, vx, vy, weaponType, createdAt, processed}
    this.socket = null;
    this.getEnemies = null;
    this.hitBullets = new Set(); // track already-hit bullet IDs to prevent double-send
  }

  init(socket, getEnemies) {
    this.socket = socket;
    this.getEnemies = getEnemies;

    socket.socket.on('bulletFired', (data) => this.onBulletFired(data));
  }

  onBulletFired({ id, ownerId, x, y, vx, vy, weaponType }) {
    let sprite;

    if (weaponType === 'shotgun') {
      sprite = this.scene.add.rectangle(x, y, 6, 3, 0xff8800); // orange pellet
    } else {
      sprite = this.scene.add.rectangle(x, y, 8, 4, 0xffff00); // yellow bullet
    }

    this.bullets.set(id, {
      sprite,
      vx,
      vy,
      weaponType,
      createdAt: Date.now(),
      processed: false,
    });
  }

  update(delta) {
    const now = Date.now();

    for (const [id, bullet] of this.bullets) {
      const { sprite, vx, vy, createdAt } = bullet;

      // Move bullet
      sprite.x += vx * (delta / 1000);
      sprite.y += vy * (delta / 1000);

      // Remove if off-screen
      if (sprite.x < 0 || sprite.x > 1280 || sprite.y < 0 || sprite.y > 720) {
        sprite.destroy();
        this.bullets.delete(id);
        continue;
      }

      // Remove if older than 2000ms
      if (now - createdAt > 2000) {
        sprite.destroy();
        this.bullets.delete(id);
        continue;
      }

      // Collision detection with enemies
      if (!bullet.processed) {
        const enemies = this.getEnemies();
        const bulletRect = new Phaser.Geom.Rectangle(sprite.x - 4, sprite.y - 2, 8, 4);

        for (const enemy of enemies) {
          const enemyRect = new Phaser.Geom.Rectangle(enemy.x - 14, enemy.y - 20, 28, 40);

          if (
            Phaser.Geom.Rectangle.Overlaps(bulletRect, enemyRect) &&
            !this.hitBullets.has(id)
          ) {
            this.hitBullets.add(id);
            bullet.processed = true;

            this.socket.socket.emit('hitEnemy', {
              bulletId: id,
              enemyId: enemy.id,
            });

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

    for (const [id, bullet] of this.bullets) {
      bullet.sprite.destroy();
    }

    this.bullets.clear();
    this.hitBullets.clear();
  }
}
