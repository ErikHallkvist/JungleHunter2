import { getWeapon, PROJECTILES } from '../../shared/weapons.js';

export class BulletSystem {
  constructor(scene) {
    this.scene = scene;
    this.bullets = new Map();
    this.socket = null;
    this.getEnemies = null;
    this.hitBullets = new Set();
    this.lastRemoteSound = new Map(); // ownerId -> timestamp (dedup multi-pellet shots)
    this._lastOwnFlash = 0;
  }

  init(socket, getEnemies) {
    this.socket = socket;
    this.getEnemies = getEnemies;
    socket.socket.on('bulletFired',      (data) => this.onBulletFired(data));
    socket.socket.on('grenadeExploded',  (data) => this.onGrenadeExploded(data));
  }

  spawnMuzzleFlash(x, y, angle) {
    // Draw relative to the graphics object's own origin so scale tween
    // expands from the correct centre point instead of drifting to (0,0).
    const gfx = this.scene.add.graphics({ x, y }).setDepth(20);

    // Outer flare
    gfx.fillStyle(0xff9900, 0.7);
    gfx.fillCircle(0, 0, 10);

    // Bright core
    gfx.fillStyle(0xffffaa, 1.0);
    gfx.fillCircle(0, 0, 6);

    // Elongated streak in firing direction
    gfx.fillStyle(0xffffcc, 0.85);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const streakLen = 16;
    const streakW = 4;
    const pts = [
      { x:  cos * streakLen - sin * streakW, y:  sin * streakLen + cos * streakW },
      { x:  cos * streakLen + sin * streakW, y:  sin * streakLen - cos * streakW },
      { x: -sin * streakW,                   y:  cos * streakW },
      { x:  sin * streakW,                   y: -cos * streakW },
    ];
    gfx.fillPoints(pts, true);

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 80,
      ease: 'Quad.easeOut',
      onComplete: () => gfx.destroy(),
    });
  }

  onBulletFired({ id, ownerId, x, y, vx, vy, weaponType, bulletType }) {
    // Resolve the projectile visual (fall back via the weapon def).
    const type = bulletType || getWeapon(weaponType).bulletType;
    const proj = PROJECTILES[type] || PROJECTILES.bullet;

    const sprite = this.scene.add.image(x, y, proj.sprite);
    sprite.setDisplaySize(proj.w, proj.h);
    const angle = Math.atan2(vy, vx);
    sprite.setRotation(angle);
    sprite.setDepth(8);

    const mine = ownerId === this.socket.socket.id;
    const isGrenade = weaponType === 'grenade';

    // Play other players' shot sounds (own sound is played by WeaponSystem).
    // Dedup per owner so a multi-pellet shotgun blast only sounds once.
    if (!mine) {
      const now = Date.now();
      if (now - (this.lastRemoteSound.get(ownerId) || 0) > 70) {
        this.lastRemoteSound.set(ownerId, now);
        this.scene.playShotSound?.(type, false);
        this.spawnMuzzleFlash(x, y, angle);
      }
    } else {
      // Own bullets: only flash on first pellet of a burst (dedup by 70ms window)
      const now = Date.now();
      if (now - this._lastOwnFlash > 70) {
        this._lastOwnFlash = now;
        this.spawnMuzzleFlash(x, y, angle);
      }
    }

    this.bullets.set(id, {
      sprite, vx, vy, ownerId,
      w: proj.w, h: proj.h,
      mine,
      isGrenade,
      createdAt: Date.now(),
      processed: false,
    });
  }

  onGrenadeExploded({ id, x, y, radius }) {
    // Remove grenade sprite.
    const bullet = this.bullets.get(id);
    if (bullet) {
      bullet.sprite.destroy();
      this.bullets.delete(id);
    }

    // Explosion VFX: orange circle that expands and fades.
    const gfx = this.scene.add.graphics().setDepth(15);
    gfx.fillStyle(0xff6600, 0.75);
    gfx.fillCircle(x, y, radius);
    // Inner bright core.
    gfx.fillStyle(0xffdd44, 0.9);
    gfx.fillCircle(x, y, radius * 0.35);

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => gfx.destroy(),
    });
  }

  update(delta) {
    const now = Date.now();

    for (const [id, bullet] of this.bullets) {
      const { sprite, vx, vy, createdAt, isGrenade } = bullet;

      sprite.x += vx * (delta / 1000);
      sprite.y += vy * (delta / 1000);

      // Grenades expire after fuse time (server sends grenadeExploded before then,
      // but clean up locally if somehow the sprite is still alive).
      const maxAge = isGrenade ? 1600 : 2500;

      if (
        sprite.x < 0 || sprite.x > 1280 ||
        sprite.y < 0 || sprite.y > 720 ||
        now - createdAt > maxAge
      ) {
        sprite.destroy();
        this.bullets.delete(id);
        continue;
      }

      // Grenades use server-side area detection — clients never report hits for them.
      if (isGrenade) continue;

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
    this.socket.socket.off('grenadeExploded');
    for (const bullet of this.bullets.values()) {
      bullet.sprite.destroy();
    }
    this.bullets.clear();
    this.hitBullets.clear();
  }
}
