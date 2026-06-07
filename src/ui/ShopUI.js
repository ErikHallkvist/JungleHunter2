import Phaser from 'phaser';
import { shopWeapons, getWeapon } from '../../shared/weapons.js';
import { COLORS, BTN, panel, heading, label, button } from './theme.js';

const INITIAL_VISIBLE = 4;

export class ShopUI {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.isOpen = false;
    this.currentGold = 0;
    this.ownedWeapons = ['pistol'];
    this.activeWeapon = 'pistol';
    this.upgradedWeapons = new Set();
    this.visibleCount = INITIAL_VISIBLE;
    this.elements = [];
    this.rows = [];
    this.feedbackText = null;
    this.shopBtn = null;
    this.goldText = null;
    this.eKey = null;
  }

  init() {
    this.isOpen = false;
    this.currentGold = 0;
    this.ownedWeapons = ['pistol'];
    this.activeWeapon = 'pistol';
    this.visibleCount = INITIAL_VISIBLE;
    this.elements = [];
    this.rows = [];

    // Shop toggle button (always visible, bottom-right)
    this.shopBtn = button(this.scene, 1206, 686, 124, 40, '[B] SHOP', {
      tint: BTN.gold, fontSize: 12, color: '#10182e', depth: 120,
      onClick: () => this.toggle(),
    });

    // ── Panel ──────────────────────────────────────────────────────────────
    const pnl = panel(this.scene, 640, 362, 1180, 600, { depth: 101 });

    const title = heading(this.scene, 640, 96, 'WEAPON SHOP', { size: 26, color: COLORS.gold }).setDepth(103);

    this.goldText = label(this.scene, 640, 134, 'GOLD: 0', { size: 24, color: COLORS.gold }).setDepth(103);

    const divider = this.scene.add.rectangle(640, 156, 1140, 2, 0x33406a, 1).setDepth(103);

    this.elements.push(pnl, title, this.goldText, divider);

    // ── Weapon rows (two columns) ────────────────────────────────────────────
    const items = shopWeapons();
    const COL_X = [60, 645];
    const ROW_H = 45;
    const TOP = 182;
    const PER_COL = Math.ceil(items.length / 2);

    items.forEach((w, i) => {
      const col = i < PER_COL ? 0 : 1;
      const r = i % PER_COL;
      const x0 = COL_X[col];
      const y = TOP + r * ROW_H;
      this.buildRow(w, x0, y, i);
    });

    // Feedback + close hint
    this.feedbackText = label(this.scene, 640, 632, '', { size: 22, color: COLORS.white }).setDepth(103).setAlpha(0);

    const closeHint = label(this.scene, 640, 656, 'Press B or Esc to close   -   wheel / number keys switch weapon', {
      size: 18, color: COLORS.dim,
    }).setDepth(103);

    this.elements.push(this.feedbackText, closeHint);

    // Hide everything initially
    this.elements.forEach((e) => e.setVisible(false));
    this.rows.forEach((row) => row.parts.forEach((e) => e.setVisible(false)));

    // Keyboard toggle
    this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.eKey.on('down', () => this.toggle());

    // ── Socket listeners ─────────────────────────────────────────────────────
    this.socket.socket.on('goldUpdate', ({ playerId, gold }) => {
      if (playerId === this.socket.id) {
        this.currentGold = gold;
        this.goldText?.setText(`GOLD: ${gold}`);
        this.refreshItemStates();
      }
    });

    this.socket.socket.on('purchaseResult', ({ success, weaponId, newGold, weapons, error }) => {
      if (success) {
        this.ownedWeapons = weapons ? weapons.slice() : [...this.ownedWeapons, weaponId];
        this.activeWeapon = weaponId;
        this.currentGold = newGold;
        this.goldText?.setText(`GOLD: ${newGold}`);
        this.showFeedback(`Bought ${getWeapon(weaponId).name}!`, COLORS.green);
        this.scene.playSfx?.('sfx_cash', 0.55);
        // Expand visible weapons: show all up to 4 beyond the purchased weapon
        const idx = this.rows.findIndex(r => r.weapon.id === weaponId);
        if (idx >= 0) this.visibleCount = Math.max(this.visibleCount, idx + 1 + 4);
        this.refreshDiscovery();
        this.refreshItemStates();
      } else {
        this.showFeedback(error === 'Not enough gold' ? 'Not enough gold!' : (error || 'Purchase failed'), COLORS.red);
      }
    });

    this.socket.socket.on('upgradeResult', ({ success, weaponId, newGold, upgrades, error }) => {
      if (success) {
        if (upgrades) upgrades.forEach(id => this.upgradedWeapons.add(id));
        else this.upgradedWeapons.add(weaponId);
        this.currentGold = newGold;
        this.goldText?.setText(`GOLD: ${newGold}`);
        this.showFeedback(`${getWeapon(weaponId).name} upgraded!`, '#ffdd00');
        this.scene.playSfx?.('sfx_cash', 0.55);
        this.refreshItemStates();
      } else {
        this.showFeedback(error || 'Upgrade failed', COLORS.red);
      }
    });

    const onActive = ({ playerId, weaponId }) => {
      if (playerId === this.socket.id) {
        this.activeWeapon = weaponId;
        if (!this.ownedWeapons.includes(weaponId)) this.ownedWeapons.push(weaponId);
        this.refreshItemStates();
      }
    };
    this.socket.socket.on('weaponEquipped', onActive);
    this.socket.socket.on('weaponSwitched', onActive);
  }

  buildRow(w, x0, y, idx) {
    // Undiscovered placeholder: grey "?" instead of weapon icon
    const qmark = label(this.scene, x0 + 30, y, '?', {
      size: 28, color: '#555577', origin: [0.5, 0.5],
    }).setDepth(103);

    const icon = this.scene.add.image(x0 + 30, y, w.icon)
      .setDisplaySize(56, 25).setDepth(103);

    const name = label(this.scene, x0 + 64, y - 9, w.name, {
      size: 21, color: COLORS.white, origin: [0, 0.5],
    }).setDepth(103);

    const undiscName = label(this.scene, x0 + 64, y - 9, 'Undiscovered', {
      size: 21, color: '#555577', origin: [0, 0.5],
    }).setDepth(103);

    const stats = label(
      this.scene, x0 + 64, y + 11,
      `DMG ${w.damage}  ${w.fireRate}ms${w.pellets > 1 ? `  x${w.pellets}` : ''}`,
      { size: 16, color: COLORS.dim, origin: [0, 0.5] }
    ).setDepth(103);

    const price = label(this.scene, x0 + 360, y, `${w.price}g`, {
      size: 21, color: COLORS.gold, origin: [1, 0.5],
    }).setDepth(103);

    const btn = button(this.scene, x0 + 435, y, 86, 32, 'BUY', {
      tint: BTN.green, fontSize: 11, depth: 103,
      onClick: () => this.onRowClick(w.id),
    });

    // Upgrade button (★)
    let upgradeBtn = null;
    if (w.id !== 'pistol') {
      const upgradeCost = Math.floor(w.price * 0.6);
      upgradeBtn = button(this.scene, x0 + 536, y, 80, 32, `★ ${upgradeCost}g`, {
        tint: BTN.gray, fontSize: 10, depth: 103,
        onClick: () => this.socket.socket.emit('upgradeWeapon', { weaponId: w.id }),
      });
    }

    // parts = everything shown when the row is visible (discovered or not)
    const parts = [icon, name, stats, price, btn.bg, btn.txt, qmark, undiscName];
    if (upgradeBtn) parts.push(upgradeBtn.bg, upgradeBtn.txt);
    const row = { weapon: w, idx, btn, upgradeBtn, price, parts, icon, name, stats, qmark, undiscName, discovered: false };
    this.rows.push(row);

    // Apply initial discovery state
    this._applyDiscovery(row, idx < INITIAL_VISIBLE);
  }

  _applyDiscovery(row, discovered) {
    row.discovered = discovered;
    row.icon.setVisible(discovered);
    row.name.setVisible(discovered);
    row.stats.setVisible(discovered);
    row.price.setVisible(discovered);
    row.qmark.setVisible(!discovered);
    row.undiscName.setVisible(!discovered);
    if (row.btn) {
      if (!discovered) {
        row.btn.setTint(BTN.gray).disable();
        row.btn.setText('?').setTextColor(COLORS.dim);
      }
    }
    if (row.upgradeBtn) {
      row.upgradeBtn.bg.setVisible(discovered);
      row.upgradeBtn.txt.setVisible(discovered);
    }
  }

  refreshDiscovery() {
    this.rows.forEach((row, i) => {
      const shouldDiscover = i < this.visibleCount;
      if (shouldDiscover && !row.discovered) {
        this._applyDiscovery(row, true);
      }
    });
  }

  onRowClick(weaponId) {
    const row = this.rows.find(r => r.weapon.id === weaponId);
    if (!row?.discovered) return;
    const owned = this.ownedWeapons.includes(weaponId);
    if (!owned) {
      this.socket.socket.emit('purchaseWeapon', { weaponId });
    } else if (this.activeWeapon !== weaponId) {
      this.socket.socket.emit('switchWeapon', { weaponId });
      this.activeWeapon = weaponId;
      this.refreshItemStates();
    }
  }

  show() {
    this.isOpen = true;
    this.elements.forEach((e) => e.setVisible(true));
    this.rows.forEach((row) => row.parts.forEach((e) => e.setVisible(true)));
    // Re-apply discovery so undiscovered parts stay hidden
    this.rows.forEach((row, i) => this._applyDiscovery(row, i < this.visibleCount));
    this.refreshItemStates();
  }

  hide() {
    this.isOpen = false;
    this.elements.forEach((e) => e.setVisible(false));
    this.rows.forEach((row) => row.parts.forEach((e) => e.setVisible(false)));
  }

  toggle() {
    this.isOpen ? this.hide() : this.show();
  }

  refreshItemStates() {
    for (const row of this.rows) {
      if (!row.discovered) continue;
      const id = row.weapon.id;
      const owned = this.ownedWeapons.includes(id);
      const active = this.activeWeapon === id;
      const affordable = this.currentGold >= row.weapon.price;

      if (active) {
        row.btn.setTint(BTN.gold).disable();
        row.btn.setText('ACTIVE').setTextColor('#10182e');
      } else if (owned) {
        row.btn.setTint(BTN.blue).enable();
        row.btn.setText('EQUIP').setTextColor(COLORS.white);
      } else if (affordable) {
        row.btn.setTint(BTN.green).enable();
        row.btn.setText('BUY').setTextColor(COLORS.white);
      } else {
        row.btn.setTint(BTN.gray).disable();
        row.btn.setText('BUY').setTextColor(COLORS.dim);
      }

      if (row.upgradeBtn) {
        const upgraded = this.upgradedWeapons.has(id);
        const upgradeCost = Math.floor(row.weapon.price * 0.6);
        const canAffordUpgrade = this.currentGold >= upgradeCost;
        if (upgraded) {
          row.upgradeBtn.setTint(BTN.gold).disable();
          row.upgradeBtn.setText('★ DONE').setTextColor('#10182e');
        } else if (owned && canAffordUpgrade) {
          row.upgradeBtn.setTint(0xbb8800).enable();
          row.upgradeBtn.setText(`★ ${upgradeCost}g`).setTextColor(COLORS.white);
        } else {
          row.upgradeBtn.setTint(BTN.gray).disable();
          row.upgradeBtn.setText(`★ ${upgradeCost}g`).setTextColor(COLORS.dim);
        }
      }
    }
  }

  showFeedback(msg, color) {
    this.feedbackText.setText(msg).setColor(color).setAlpha(1);
    this.scene.tweens.add({
      targets: this.feedbackText, alpha: 0, duration: 1500, delay: 600,
    });
  }

  destroy() {
    this.eKey.off('down');
    this.socket.socket.off('goldUpdate');
    this.socket.socket.off('purchaseResult');
    this.socket.socket.off('upgradeResult');
    this.socket.socket.off('weaponEquipped');
    this.socket.socket.off('weaponSwitched');
    this.elements.forEach((e) => e.destroy());
    this.rows.forEach((row) => row.parts.forEach((e) => e.destroy()));
    this.shopBtn.destroy();
  }
}
