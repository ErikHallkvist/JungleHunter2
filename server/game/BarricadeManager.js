const BARRICADE_W = 20;
const BARRICADE_H = 120;
const BARRICADE_HP = 200;
const BARRICADE_COST = 80;
const MAX_PER_PLAYER = 3;

export class BarricadeManager {
  constructor(io, shopManager) {
    this.io = io;
    this.shopManager = shopManager;
    this.barricades = new Map();
  }

  countForPlayer(socketId) {
    let count = 0;
    for (const b of this.barricades.values()) {
      if (b.ownerId === socketId) count++;
    }
    return count;
  }

  placeBarricade(socketId, x, y) {
    if (this.countForPlayer(socketId) >= MAX_PER_PLAYER) {
      this.io.to(socketId).emit('barricadeResult', { success: false, error: 'Max barricades reached' });
      return;
    }
    const gold = this.shopManager.getGold(socketId);
    if (gold < BARRICADE_COST) {
      this.io.to(socketId).emit('barricadeResult', { success: false, error: 'Not enough gold' });
      return;
    }

    // Deduct gold via addGold with negative amount
    const data = this.shopManager['playerData'].get(socketId);
    if (data) {
      data.gold -= BARRICADE_COST;
      this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: 0 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    const barricade = { id, x, y, w: BARRICADE_W, h: BARRICADE_H, hp: BARRICADE_HP, maxHp: BARRICADE_HP, ownerId: socketId };
    this.barricades.set(id, barricade);
    this.io.emit('barricadeSpawned', { id, x, y, w: BARRICADE_W, h: BARRICADE_H, hp: BARRICADE_HP, maxHp: BARRICADE_HP });
    this.io.to(socketId).emit('barricadeResult', { success: true, newGold: data?.gold ?? 0 });
  }

  damageBarricade(id, amount) {
    const b = this.barricades.get(id);
    if (!b || b.destroyed) return;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.hp = 0;
      b.destroyed = true;
      this.io.emit('barricadeDestroyed', { id });
    } else {
      this.io.emit('barricadeDamaged', { id, hp: b.hp, maxHp: b.maxHp });
    }
  }

  // Called each tick from WaveManager — removes destroyed barricades.
  tick() {
    for (const [id, b] of this.barricades.entries()) {
      if (b.destroyed) this.barricades.delete(id);
    }
  }

  getBarricades() { return Array.from(this.barricades.values()); }
  clear()         { this.barricades.clear(); }
}
