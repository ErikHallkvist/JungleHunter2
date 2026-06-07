import { getWeapon, PROJECTILES } from '../../shared/weapons.js';

// Per-weapon sound config: { key, rate } — rate shifts pitch (1.0 = normal)
const WEAPON_SOUND = {
  pistol:        { key: 'sfx_bullet', rate: 1.1  },
  revolver:      { key: 'sfx_heavy',  rate: 0.95 },
  smg:           { key: 'sfx_bullet', rate: 1.25 },
  shotgun:       { key: 'sfx_pellet', rate: 0.9  },
  burst_rifle:   { key: 'sfx_bullet', rate: 1.15 },
  assault_rifle: { key: 'sfx_bullet', rate: 1.05 },
  double_barrel: { key: 'sfx_pellet', rate: 0.82 },
  magnum:        { key: 'sfx_heavy',  rate: 0.85 },
  tactical_smg:  { key: 'sfx_bullet', rate: 1.3  },
  grenade:       { key: 'sfx_energy', rate: 0.75 },
  combat_shotgun:{ key: 'sfx_pellet', rate: 0.95 },
  marksman:      { key: 'sfx_heavy',  rate: 1.05 },
  lmg:           { key: 'sfx_bullet', rate: 1.0  },
  sniper:        { key: 'sfx_rail',   rate: 0.9  },
  auto_shotgun:  { key: 'sfx_pellet', rate: 1.0  },
  plasma_rifle:  { key: 'sfx_plasma', rate: 0.95 },
  pulse_rifle:   { key: 'sfx_plasma', rate: 1.2  },
  railgun:       { key: 'sfx_rail',   rate: 0.75 },
  flak_cannon:   { key: 'sfx_pellet', rate: 0.78 },
  laser_minigun: { key: 'sfx_laser',  rate: 1.0  },
  devastator:    { key: 'sfx_energy', rate: 0.9  },
};

// Offset from player centre to gun muzzle (pixels forward along shot direction)
const MUZZLE_OFFSET = 22;

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

  spawnMuzzleFlash(originX, originY, angle) {
    // Place flash at gun muzzle, offset forward from player centre
    const x = originX + Math.cos(angle) * MUZZLE_OFFSET;
    const y = originY + Math.sin(angle) * MUZZLE_OFFSET;

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

  playWeaponSound(weaponType, mine) {
    const cfg = WEAPON_SOUND[weaponType] || { key: 'sfx_bullet', rate: 1.0 };
    const volume = mine ? 0.5 : 0.25;
    if (this.scene.cache?.audio.exists(cfg.key)) {
      this.scene.sound.play(cfg.key, { volume, rate: cfg.rate });
    }
  }

  onBulletFired({ id, ownerId, x, y, vx, vy, weaponType, bulletType }) {
    const type = bulletType || getWeapon(weaponType).bulletType;
    const proj = PROJECTILES[type] || PROJECTILES.bullet;

    // Small bullet sprite: a tiny elongated oval rotated along the shot direction
    const tracker = this.scene.add.graphics({ x, y }).setDepth(8);
    tracker.fillStyle(0xffffcc, 1);
    tracker.fillEllipse(0, 0, 8, 3);
    tracker.setRotation(angle);

    const angle = Math.atan2(vy, vx);
    const mine = ownerId === this.socket.socket.id;
    const isGrenade = weaponType === 'grenade';

    if (!mine) {
      const now = Date.now();
      if (now - (this.lastRemoteSound.get(ownerId) || 0) > 70) {
        this.lastRemoteSound.set(ownerId, now);
        this.playWeaponSound(weaponType, false);
        this.spawnMuzzleFlash(x, y, angle);
      }
    } else {
      const now = Date.now();
      if (now - this._lastOwnFlash > 70) {
        this._lastOwnFlash = now;
        this.spawnMuzzleFlash(x, y, angle);
      }
    }

    this.bullets.set(id, {
      sprite: tracker, vx, vy, ownerId,
      w: proj.w, h: proj.h,
      mine,
      isGrenade,
      createdAt: Date.now(),
      processed: false,
    });
  }

  onGrenadeExploded({ id, x, y, radius }) {
    const bullet = this.bullets.get(id);
    if (bullet) {
      bullet.sprite.destroy();
      this.bullets.delete(id);
    }

    // Explosion VFX
    const gfx = this.scene.add.graphics().setDepth(15);
    gfx.fillStyle(0xff6600, 0.75);
    gfx.fillCircle(x, y, radius);
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

      if (isGrenade) continue;

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
