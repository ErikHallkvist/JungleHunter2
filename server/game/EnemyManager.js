export class EnemyManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.enemies = new Map();
    this.LEFT_WALL = 50; // enemies stop at the left wall
  }

  spawnEnemy(hp) {
    const id = Math.random().toString(36).substr(2, 9);
    const x = 1240;
    const y = Math.floor(Math.random() * (600 - 80 + 1)) + 80;
    const enemy = { id, x, y, hp, maxHp: hp, lastMeleeTime: 0 };
    this.enemies.set(id, enemy);
    this.io.emit('enemySpawned', { id, x, y, hp, maxHp: hp });
    return enemy;
  }

  update(deltaMs) {
    const players = this.getPlayers();
    const playerList = Object.values(players);

    for (const enemy of this.enemies.values()) {
      // Enemies ONLY march straight left — never adjust their height.
      // Players must run up/down to line up shots and dodge.
      enemy.x -= 80 * (deltaMs / 1000);
      if (enemy.x < this.LEFT_WALL) enemy.x = this.LEFT_WALL;

      if (playerList.length === 0) continue;

      // Melee the nearest player that is actually within reach (same lane).
      let closestPlayer = null;
      let closestDist = Infinity;
      for (const player of playerList) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestPlayer = player;
        }
      }

      if (closestPlayer && closestDist <= 45 && Date.now() - enemy.lastMeleeTime >= 1500) {
        enemy.lastMeleeTime = Date.now();
        if (this.onMeleeDamage) {
          this.onMeleeDamage(closestPlayer.id, 15);
        }
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
