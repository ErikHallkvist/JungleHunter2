export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = new Map(); // id -> {sprite, hpBarBg, hpBar, hp, maxHp, targetX, targetY}
    this.socket = null;
  }

  init(socket) {
    this.socket = socket;
    socket.socket.on('enemySpawned', (data) => this.onEnemySpawned(data));
    socket.socket.on('enemiesMoved', (list) => this.onEnemiesMoved(list));
    socket.socket.on('enemyDied', (data) => this.onEnemyDied(data));
    socket.socket.on('enemyDamaged', (data) => this.onEnemyDamaged(data));
  }

  onEnemySpawned({ id, x, y, hp, maxHp }) {
    const sprite = this.scene.add.rectangle(x, y, 28, 40, 0xff4444);
    const hpBarBg = this.scene.add.rectangle(x, y - 28, 30, 5, 0x333333);
    const hpBar = this.scene.add.rectangle(x, y - 28, 30, 5, 0x00ff00);
    this.enemies.set(id, { sprite, hpBarBg, hpBar, hp, maxHp, targetX: x, targetY: y });
  }

  onEnemiesMoved(list) {
    for (const { id, x, y } of list) {
      const enemy = this.enemies.get(id);
      if (enemy) {
        enemy.targetX = x;
        enemy.targetY = y;
      }
    }
  }

  onEnemyDied({ id, killedBy }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;

    const { sprite, hpBarBg, hpBar } = enemy;

    // Brief white flash then destroy
    sprite.setFillStyle(0xffffff);
    hpBarBg.destroy();
    hpBar.destroy();

    this.scene.time.delayedCall(150, () => {
      sprite.destroy();
    });

    this.enemies.delete(id);
  }

  onEnemyDamaged({ id, hp }) {
    const enemy = this.enemies.get(id);
    if (!enemy) return;

    enemy.hp = hp;
    const ratio = hp / enemy.maxHp;
    enemy.hpBar.width = 30 * ratio;
  }

  update() {
    for (const enemy of this.enemies.values()) {
      const { sprite, hpBarBg, hpBar, targetX, targetY } = enemy;

      sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.3);
      sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.3);

      hpBarBg.setPosition(sprite.x, sprite.y - 28);
      hpBar.setPosition(sprite.x - (30 - hpBar.width) / 2, sprite.y - 28);
    }
  }

  getEnemies() {
    return Array.from(this.enemies.values()).map(({ sprite }) => ({
      id: [...this.enemies.entries()].find(([, e]) => e.sprite === sprite)?.[0],
      x: sprite.x,
      y: sprite.y,
      width: 28,
      height: 40,
    }));
  }

  destroy() {
    if (this.socket) {
      this.socket.socket.off('enemySpawned');
      this.socket.socket.off('enemiesMoved');
      this.socket.socket.off('enemyDied');
      this.socket.socket.off('enemyDamaged');
    }

    for (const { sprite, hpBarBg, hpBar } of this.enemies.values()) {
      sprite.destroy();
      hpBarBg.destroy();
      hpBar.destroy();
    }

    this.enemies.clear();
  }
}
