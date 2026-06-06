const ENEMY_W = 40;
const ENEMY_H = 52;

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = new Map();
    this.socket = null;
  }

  init(socket) {
    this.socket = socket;
    socket.socket.on('enemySpawned',  (data) => this.onEnemySpawned(data));
    socket.socket.on('enemiesMoved',  (list) => this.onEnemiesMoved(list));
    socket.socket.on('enemyDied',     (data) => this.onEnemyDied(data));
    socket.socket.on('enemyDamaged',  (data) => this.onEnemyDamaged(data));
    socket.socket.on('enemyLeaked',   (data) => this.onEnemyLeaked(data));
  }

  onEnemyLeaked({ id }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    enemy.hpBarBg.destroy();
    enemy.hpBar.destroy();
    enemy.sprite.destroy();
    this.enemies.delete(id);
  }

  onEnemySpawned({ id, x, y, hp, maxHp, typeId }) {
    const key = `e_${typeId}`;
    const spriteKey = this.scene.textures.exists(key) ? key : 'e_slime';
    const sprite = this.scene.add.image(x, y, spriteKey);
    sprite.setDisplaySize(ENEMY_W, ENEMY_H);
    sprite.setDepth(10);

    const barW = 36;
    const barY = y - ENEMY_H / 2 - 6;
    const hpBarBg = this.scene.add.rectangle(x, barY, barW, 5, 0x333333).setDepth(11);
    const hpBar   = this.scene.add.rectangle(x, barY, barW, 5, 0x00ff00).setDepth(12);

    this.enemies.set(id, { sprite, hpBarBg, hpBar, hp, maxHp, typeId, targetX: x, targetY: y });
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
    const { sprite, hpBarBg, hpBar } = enemy;
    hpBarBg.destroy();
    hpBar.destroy();
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
    const barW = 36;
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
  }

  update() {
    for (const enemy of this.enemies.values()) {
      const { sprite, hpBarBg, hpBar, targetX, targetY } = enemy;
      sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.3);
      sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.3);
      const barY = sprite.y - ENEMY_H / 2 - 6;
      hpBarBg.setPosition(sprite.x, barY);
      hpBar.setPosition(sprite.x - (36 - hpBar.width) / 2, barY);
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
    }
    for (const { sprite, hpBarBg, hpBar } of this.enemies.values()) {
      sprite.destroy();
      hpBarBg.destroy();
      hpBar.destroy();
    }
    this.enemies.clear();
  }
}
