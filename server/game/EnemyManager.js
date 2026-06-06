export class EnemyManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.enemies = new Map();
    this.LEAK_X = -40;       // once past this x the enemy has escaped the map
    this.leaked = 0;         // how many enemies have escaped
    this.onEnemyLeaked = null; // callback(totalLeaked) — set externally
  }

  spawnEnemy(hp) {
    const id = Math.random().toString(36).substr(2, 9);
    const x = 1240;
    const y = Math.floor(Math.random() * (600 - 80 + 1)) + 80;
    const enemy = { id, x, y, hp, maxHp: hp };
    this.enemies.set(id, enemy);
    this.io.emit('enemySpawned', { id, x, y, hp, maxHp: hp });
    return enemy;
  }

  update(deltaMs) {
    for (const enemy of this.enemies.values()) {
      // Enemies ONLY march straight left and never change height. They do not
      // attack players — instead they try to escape past the left wall.
      enemy.x -= 80 * (deltaMs / 1000);

      if (enemy.x <= this.LEAK_X) {
        // Escaped the map.
        this.enemies.delete(enemy.id);
        this.leaked += 1;
        this.io.emit('enemyLeaked', { id: enemy.id });
        if (this.onEnemyLeaked) this.onEnemyLeaked(this.leaked);
      }
    }

    const moved = Array.from(this.enemies.values()).map(e => ({ id: e.id, x: e.x, y: e.y }));
    this.io.emit('enemiesMoved', moved);
  }

  damageEnemy(enemyId, damage, killedBySocketId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;

    enemy.hp -= damage;

    if (enemy.hp <= 0) {
      this.enemies.delete(enemyId);
      this.io.emit('enemyDied', { id: enemyId, killedBy: killedBySocketId });
      return true;
    }

    this.io.emit('enemyDamaged', { id: enemyId, hp: enemy.hp });
    return false;
  }

  getAllEnemies() {
    return Array.from(this.enemies.values());
  }

  getAliveCount() {
    return this.enemies.size;
  }

  clear() {
    this.enemies.clear();
  }
}
