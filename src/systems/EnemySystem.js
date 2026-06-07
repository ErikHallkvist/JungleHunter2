const ENEMY_W = 40;
const ENEMY_H = 52;

// Aura colours per ability type.
const ABILITY_COLORS = {
  zigzag:  0x8844ff,  // purple
  sprint:  0xff6600,  // orange
  healer:  0x00cc44,  // green
  split:   0xffdd00,  // yellow
};

// Blood drop colours — dark reds to simulate ground stains.
const BLOOD_COLORS = [0x8b0000, 0xaa1111, 0xcc2222, 0x990000];

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = new Map();
    this.socket = null;
    // Persistent blood graphics objects — cleared each wave start.
    this.bloodDecals = [];
  }

  init(socket) {
    this.socket = socket;
    socket.socket.on('enemySpawned',  (data) => this.onEnemySpawned(data));
    socket.socket.on('enemiesMoved',  (list) => this.onEnemiesMoved(list));
    socket.socket.on('enemyDied',     (data) => this.onEnemyDied(data));
    socket.socket.on('enemyDamaged',  (data) => this.onEnemyDamaged(data));
    socket.socket.on('enemyLeaked',   (data) => this.onEnemyLeaked(data));
    socket.socket.on('enemyHealed',   (data) => this.onEnemyHealed(data));
  }

  // Spawn blood decals at (x, y) plus flying splatter particles.
  spawnBlood(x, y, count = 4) {
    // Ground pool — draw all decals into one graphics object.
    const gfx = this.scene.add.graphics().setDepth(2);
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 70;
      const oy = (Math.random() - 0.5) * 55;
      const r  = 3 + Math.random() * 8;
      const color = BLOOD_COLORS[Math.floor(Math.random() * BLOOD_COLORS.length)];
      gfx.fillStyle(color, 0.75 + Math.random() * 0.25);
      gfx.fillEllipse(x + ox, y + oy, r * 2.2, r);
    }
    this.bloodDecals.push(gfx);

    // Flying splatter — individual particles that arc outward and splat on landing.
    const particleCount = Math.ceil(count * 0.8);
    for (let i = 0; i < particleCount; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const speed  = 80 + Math.random() * 220;
      const pr     = 2 + Math.random() * 4;
      const color  = BLOOD_COLORS[Math.floor(Math.random() * BLOOD_COLORS.length)];
      const duration = 180 + Math.random() * 320;
      const destX  = x + Math.cos(pAngle) * speed * (duration / 1000);
      const destY  = y + Math.sin(pAngle) * speed * (duration / 1000);

      const pgfx = this.scene.add.graphics({ x, y }).setDepth(15);
      pgfx.fillStyle(color, 0.9);
      pgfx.fillCircle(0, 0, pr);

      this.scene.tweens.add({
        targets: pgfx,
        x: destX,
        y: destY,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // Leave a tiny permanent splat where the particle landed.
          const splat = this.scene.add.graphics().setDepth(2);
          splat.fillStyle(color, 0.6);
          splat.fillEllipse(pgfx.x, pgfx.y, pr * 3, pr * 1.5);
          this.bloodDecals.push(splat);
          pgfx.destroy();
        },
      });
    }
  }

  // Remove all blood decals — called on wave start.
  clearBlood() {
    for (const gfx of this.bloodDecals) gfx.destroy();
    this.bloodDecals = [];
  }

  onEnemyLeaked({ id }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    enemy.hpBarBg.destroy();
    enemy.hpBar.destroy();
    enemy.aura?.destroy();
    enemy.eliteGlow?.destroy();
    enemy.eliteLabel?.destroy();
    enemy.sprite.destroy();
    this.enemies.delete(id);
  }

  onEnemySpawned({ id, x, y, hp, maxHp, typeId, ability, isElite }) {
    const key = `e_${typeId}`;
    const spriteKey = this.scene.textures.exists(key) ? key : 'e_slime';

    // Elite glow (yellow) drawn furthest back
    let eliteGlow = null;
    if (isElite) {
      eliteGlow = this.scene.add.rectangle(x, y, ENEMY_W + 18, ENEMY_H + 18, 0xffdd00, 0.45).setDepth(8);
      this.scene.tweens.add({
        targets: eliteGlow,
        alpha: { from: 0.2, to: 0.65 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    let aura = null;
    if (ability && ABILITY_COLORS[ability]) {
      aura = this.scene.add.rectangle(x, y, ENEMY_W + 10, ENEMY_H + 10, ABILITY_COLORS[ability], 0.35)
        .setDepth(9);
      if (ability === 'healer' || ability === 'split') {
        this.scene.tweens.add({
          targets: aura,
          alpha: { from: 0.15, to: 0.55 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      }
    }

    const sprite = this.scene.add.image(x, y, spriteKey);
    sprite.setDisplaySize(isElite ? ENEMY_W * 1.2 : ENEMY_W, isElite ? ENEMY_H * 1.2 : ENEMY_H);
    sprite.setDepth(10);
    if (isElite) sprite.setTint(0xffeeaa);

    const barW = isElite ? 48 : 36;
    const barY = y - ENEMY_H / 2 - 6;
    const hpBarBg = this.scene.add.rectangle(x, barY, barW, isElite ? 7 : 5, 0x333333).setDepth(11);
    const hpBar   = this.scene.add.rectangle(x, barY, barW, isElite ? 7 : 5, 0x00ff00).setDepth(12);

    // ELITE label
    let eliteLabel = null;
    if (isElite) {
      eliteLabel = this.scene.add.text(x, barY - 12, 'ELITE', {
        fontSize: '11px', color: '#ffdd00', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13);
    }

    this.enemies.set(id, { sprite, hpBarBg, hpBar, aura, eliteGlow, eliteLabel, hp, maxHp, typeId, isElite, barW, targetX: x, targetY: y });
  }

  onEnemiesMoved(list) {
    for (const { id, x, y } of list) {
      const enemy = this.enemies.get(id);
      if (enemy) { enemy.targetX = x; enemy.targetY = y; }
    }
  }

  onEnemyDied({ id }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    const { sprite, hpBarBg, hpBar, aura, eliteGlow, eliteLabel } = enemy;
    hpBarBg.destroy();
    hpBar.destroy();
    aura?.destroy();
    eliteGlow?.destroy();
    eliteLabel?.destroy();

    // Large blood pool on death
    this.spawnBlood(sprite.x, sprite.y, enemy.isElite ? 40 : 25);

    sprite.setTint(0xffffff);
    this.scene.tweens.add({
      targets: sprite, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 200,
      onComplete: () => sprite.destroy(),
    });
    this.enemies.delete(id);
  }

  onEnemyDamaged({ id, hp, typeId }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;

    enemy.hp = hp;
    const ratio = hp / enemy.maxHp;
    const barW = enemy.barW ?? 36;
    enemy.hpBar.width = barW * ratio;
    enemy.hpBar.setFillStyle(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffaa00 : 0xff3333);

    // Play type-specific ouch sound
    const ouchKey = `sfx_ouch_${typeId || enemy.typeId}`;
    this.scene.playSfx?.(ouchKey, 0.35);

    // Brief red flash
    enemy.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(80, () => {
      if (enemy.sprite?.active) enemy.sprite.clearTint();
    });

    // Blood splatter on hit
    this.spawnBlood(enemy.sprite.x, enemy.sprite.y, 15);
  }

  onEnemyHealed({ id, hp }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;

    enemy.hp = hp;
    const ratio = hp / enemy.maxHp;
    const barW = enemy.barW ?? 36;
    enemy.hpBar.width = barW * ratio;
    enemy.hpBar.setFillStyle(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffaa00 : 0xff3333);

    // Brief green flash to signal healing.
    enemy.sprite.setTint(0x44ff88);
    this.scene.time.delayedCall(120, () => {
      if (enemy.sprite?.active) enemy.sprite.clearTint();
    });
  }

  update() {
    for (const enemy of this.enemies.values()) {
      const { sprite, hpBarBg, hpBar, aura, eliteGlow, eliteLabel, targetX, targetY } = enemy;
      sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.3);
      sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.3);
      const barW = enemy.barW ?? 36;
      const barY = sprite.y - ENEMY_H / 2 - 6;
      hpBarBg.setPosition(sprite.x, barY);
      hpBar.setPosition(sprite.x - (barW - hpBar.width) / 2, barY);
      if (aura) aura.setPosition(sprite.x, sprite.y);
      if (eliteGlow) eliteGlow.setPosition(sprite.x, sprite.y);
      if (eliteLabel) eliteLabel.setPosition(sprite.x, barY - 12);
    }
  }

  getEnemies() {
    const result = [];
    for (const [id, enemy] of this.enemies.entries()) {
      result.push({ id, x: enemy.sprite.x, y: enemy.sprite.y, width: ENEMY_W, height: ENEMY_H });
    }
    return result;
  }

  destroy() {
    if (this.socket) {
      this.socket.socket.off('enemySpawned');
      this.socket.socket.off('enemiesMoved');
      this.socket.socket.off('enemyDied');
      this.socket.socket.off('enemyDamaged');
      this.socket.socket.off('enemyLeaked');
      this.socket.socket.off('enemyHealed');
    }
    for (const { sprite, hpBarBg, hpBar, aura, eliteGlow, eliteLabel } of this.enemies.values()) {
      sprite.destroy();
      hpBarBg.destroy();
      hpBar.destroy();
      aura?.destroy();
      eliteGlow?.destroy();
      eliteLabel?.destroy();
    }
    this.enemies.clear();
    this.clearBlood();
  }
}
