import { getEnemyType } from '../../shared/enemies.js';

export class EnemyManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.enemies = new Map();
    this.LEAK_X = -40;
    this.leaked = 0;
    this.onEnemyLeaked = null;
  }

  spawnEnemy(typeId, hp) {
    const type = getEnemyType(typeId);
    const id = Math.random().toString(36).substr(2, 9);
    const x = 1240;
    const y = Math.floor(Math.random() * (600 - 80 + 1)) + 80;
    const speed = type.speed;
    const enemy = { id, x, y, hp, maxHp: hp, typeId, speed };
    this.enemies.set(id, enemy);
    this.io.emit('enemySpawned', { id, x, y, hp, maxHp: hp, typeId });
    return enemy;
  }

  update(deltaMs) {
    for (const enemy of this.enemies.values()) {
      enemy.x -= enemy.speed * (deltaMs / 1000);

      if (enemy.x <= this.LEAK_X) {
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

    this.io.emit('enemyDamaged', { id: enemyId, hp: enemy.hp, typeId: enemy.typeId });
    return false;
  }

  getAllEnemies() { return Array.from(this.enemies.values()); }
  getAliveCount() { return this.enemies.size; }
  clear()         { this.enemies.clear(); }
}
