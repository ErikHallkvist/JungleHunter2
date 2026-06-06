import { shopWeapons, getWeapon } from '../../shared/weapons.js';

export class ShopManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    // socketId -> { gold, weapons: [ids], active: id }
    this.playerData = new Map();
  }

  // All purchasable weapons (everything except the free starter).
  get SHOP_ITEMS() {
    return shopWeapons().map((w) => ({
      id: w.id, name: w.name, price: w.price, tier: w.tier,
      desc: w.desc, icon: w.icon,
    }));
  }

  initPlayer(socketId) {
    this.playerData.set(socketId, { gold: 0, weapons: ['pistol'], active: 'pistol' });
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

  getActiveWeapon(socketId) {
    return this.playerData.get(socketId)?.active ?? 'pistol';
  }

  getWeapons(socketId) {
    return this.playerData.get(socketId)?.weapons ?? ['pistol'];
  }

  handlePurchase(socketId, weaponId) {
    const item = getWeapon(weaponId);
    if (!item || item.price <= 0) {
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
    data.active = weaponId; // auto-equip newly bought weapon

    this.io.to(socketId).emit('purchaseResult', {
      success: true, weaponId, newGold: data.gold, weapons: data.weapons,
    });
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: 0 });
    // Tell EVERYONE this player is now wielding weaponId (purchase = equip).
    this.io.emit('weaponEquipped', { playerId: socketId, weaponId });
  }

  // Switching to an already-owned weapon.
  handleSwitch(socketId, weaponId) {
    const data = this.playerData.get(socketId);
    if (!data || !data.weapons.includes(weaponId)) return;
    data.active = weaponId;
    // Broadcast so every client updates this player's visible weapon.
    this.io.emit('weaponSwitched', { playerId: socketId, weaponId });
  }

  removePlayer(socketId) {
    this.playerData.delete(socketId);
  }

  reset() {
    this.playerData.clear();
  }
}
