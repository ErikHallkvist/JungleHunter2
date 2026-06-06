export class ShopManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    this.playerData = new Map(); // socketId -> {gold: 0, weapons: ['handgun']}
  }

  SHOP_ITEMS = [
    { id: 'shotgun', name: 'Shotgun', price: 100, description: '5 pellets, high damage' }
  ];

  initPlayer(socketId) {
    this.playerData.set(socketId, { gold: 0, weapons: ['handgun'] });
    this.io.to(socketId).emit('goldUpdate', { playerId: socketId, gold: 0, gained: 0 });
  }

  addGold(socketId, amount) {
    const data = this.playerData.get(socketId);
    if (!data) return;
    data.gold += amount;
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: amount });
  }

  getGold(socketId) {
    return this.playerData.get(socketId)?.gold ?? 0;
  }

  handlePurchase(socketId, weaponId) {
    const item = this.SHOP_ITEMS.find(i => i.id === weaponId);
    if (!item) {
      this.io.to(socketId).emit('purchaseResult', { success: false, error: 'Item not found' });
      return;
    }

    const data = this.playerData.get(socketId);
    if (!data) return;

    if (data.weapons.includes(weaponId)) {
      this.io.to(socketId).emit('purchaseResult', { success: false, error: 'Already owned' });
      return;
    }

    if (data.gold < item.price) {
      this.io.to(socketId).emit('purchaseResult', { success: false, error: 'Not enough gold' });
      return;
    }

    data.gold -= item.price;
    data.weapons.push(weaponId);

    this.io.to(socketId).emit('purchaseResult', { success: true, weaponId, newGold: data.gold });
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: 0 });
    this.io.emit('weaponEquipped', { playerId: socketId, weaponId });
  }

  removePlayer(socketId) {
    this.playerData.delete(socketId);
  }

  reset() {
    this.playerData.clear();
  }
}
