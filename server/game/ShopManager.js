import { shopWeapons, getWeapon } from '../../shared/weapons.js';

const PASSIVE_PRICES = { boots: 100, ammo_belt: 100, magnet: 120, synergy: 200 };
const PASSIVES_LIST = Object.keys(PASSIVE_PRICES);

export class ShopManager {
  constructor(io, getPlayers) {
    this.io = io;
    this.getPlayers = getPlayers;
    // socketId -> { gold, weapons: [ids], active: id, upgrades: Set, passives: Set }
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
    this.playerData.set(socketId, {
      gold: 0, weapons: ['pistol'], active: 'pistol',
      upgrades: new Set(), passives: new Set(),
    });
    this.io.to(socketId).emit('goldUpdate', { playerId: socketId, gold: 0, gained: 0 });
  }

  addGold(socketId, amount) {
    const data = this.playerData.get(socketId);
    if (!data) return;
    data.gold += amount;
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: amount });
  }

  getGold(socketId) { return this.playerData.get(socketId)?.gold ?? 0; }
  getActiveWeapon(socketId) { return this.playerData.get(socketId)?.active ?? 'pistol'; }
  getWeapons(socketId) { return this.playerData.get(socketId)?.weapons ?? ['pistol']; }
  getUpgrades(socketId) { return this.playerData.get(socketId)?.upgrades ?? new Set(); }
  getPassives(socketId) { return this.playerData.get(socketId)?.passives ?? new Set(); }

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

  handleUpgrade(socketId, weaponId) {
    const item = getWeapon(weaponId);
    if (!item || item.id === 'pistol') {
      this.io.to(socketId).emit('upgradeResult', { success: false, error: 'Cannot upgrade' });
      return;
    }
    const data = this.playerData.get(socketId);
    if (!data || !data.weapons.includes(weaponId)) {
      this.io.to(socketId).emit('upgradeResult', { success: false, error: 'Not owned' });
      return;
    }
    if (data.upgrades.has(weaponId)) {
      this.io.to(socketId).emit('upgradeResult', { success: false, error: 'Already upgraded' });
      return;
    }
    const upgradeCost = Math.floor(item.price * 0.6);
    if (data.gold < upgradeCost) {
      this.io.to(socketId).emit('upgradeResult', { success: false, error: 'Not enough gold' });
      return;
    }
    data.gold -= upgradeCost;
    data.upgrades.add(weaponId);
    this.io.to(socketId).emit('upgradeResult', {
      success: true, weaponId, newGold: data.gold, upgrades: Array.from(data.upgrades),
    });
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: 0 });
  }

  handleSwitch(socketId, weaponId) {
    const data = this.playerData.get(socketId);
    if (!data || !data.weapons.includes(weaponId)) return;
    data.active = weaponId;
    this.io.emit('weaponSwitched', { playerId: socketId, weaponId });
  }

  handlePassivePurchase(socketId, passiveId) {
    if (!PASSIVES_LIST.includes(passiveId)) {
      this.io.to(socketId).emit('passiveResult', { success: false, error: 'Unknown passive' });
      return;
    }
    const data = this.playerData.get(socketId);
    if (!data) return;
    if (data.passives.has(passiveId)) {
      this.io.to(socketId).emit('passiveResult', { success: false, error: 'Already owned' });
      return;
    }
    const price = PASSIVE_PRICES[passiveId];
    if (data.gold < price) {
      this.io.to(socketId).emit('passiveResult', { success: false, error: 'Not enough gold' });
      return;
    }
    data.gold -= price;
    data.passives.add(passiveId);
    this.io.to(socketId).emit('passiveResult', {
      success: true, passiveId, newGold: data.gold, passives: Array.from(data.passives),
    });
    this.io.emit('goldUpdate', { playerId: socketId, gold: data.gold, gained: 0 });
  }

  removePlayer(socketId) { this.playerData.delete(socketId); }
  reset() { this.playerData.clear(); }
}
