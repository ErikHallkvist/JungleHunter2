import { shopWeapons, getWeapon } from '../../shared/weapons.js';

export class ShopUI {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.isOpen = false;
    this.currentGold = 0;
    this.ownedWeapons = ['pistol'];
    this.activeWeapon = 'pistol';
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
    this.elements = [];
    this.rows = [];

    // Shop toggle button (always visible, bottom-right)
    this.shopBtn = this.scene.add.text(1264, 690, '[E] SHOP', {
      fontSize: '16px',
      color: '#e2b714',
      fontFamily: 'monospace',
      backgroundColor: '#16213e',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 1).setDepth(120).setInteractive({ useHandCursor: true });
    this.shopBtn.on('pointerdown', () => this.toggle());

    // ── Panel ──────────────────────────────────────────────────────────────
    const panel = this.scene.add.rectangle(640, 362, 1180, 600, 0x10182e, 0.97)
      .setStrokeStyle(2, 0x0f3460).setDepth(60);

    const title = this.scene.add.text(640, 95, 'WEAPON SHOP', {
      fontSize: '30px', color: '#e2b714', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(62);

    this.goldText = this.scene.add.text(640, 130, 'Gold: 0', {
      fontSize: '18px', color: '#e2b714', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(62);

    const divider = this.scene.add.rectangle(640, 152, 1140, 2, 0x0f3460, 1).setDepth(62);

    this.elements.push(panel, title, this.goldText, divider);

    // ── Weapon rows (two columns) ────────────────────────────────────────────
    const items = shopWeapons();
    const COL_X = [60, 645];
    const ROW_H = 45;
    const TOP = 178;
    const PER_COL = Math.ceil(items.length / 2);

    items.forEach((w, i) => {
      const col = i < PER_COL ? 0 : 1;
      const r = i % PER_COL;
      const x0 = COL_X[col];
      const y = TOP + r * ROW_H;
      this.buildRow(w, x0, y);
    });

    // Feedback + close hint
    this.feedbackText = this.scene.add.text(640, 632, '', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(62).setAlpha(0);

    const closeHint = this.scene.add.text(640, 652, 'Press E to close · wheel / number keys switch weapon', {
      fontSize: '13px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(62);

    this.elements.push(this.feedbackText, closeHint);

    // Hide everything initially
    this.elements.forEach((e) => e.setVisible(false));
    this.rows.forEach((row) => row.parts.forEach((e) => e.setVisible(false)));

    // Keyboard toggle
    this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => this.toggle());

    // ── Socket listeners ─────────────────────────────────────────────────────
    this.socket.socket.on('goldUpdate', ({ playerId, gold }) => {
      if (playerId === this.socket.id) {
        this.currentGold = gold;
        this.goldText?.setText(`Gold: ${gold}`);
        this.refreshItemStates();
      }
    });

    this.socket.socket.on('purchaseResult', ({ success, weaponId, newGold, weapons, error }) => {
      if (success) {
        this.ownedWeapons = weapons ? weapons.slice() : [...this.ownedWeapons, weaponId];
        this.activeWeapon = weaponId;
        this.currentGold = newGold;
        this.goldText?.setText(`Gold: ${newGold}`);
        this.showFeedback(`Bought ${getWeapon(weaponId).name}!`, '#00ff88');
        this.scene.playSfx?.('sfx_cash', 0.55);
        this.refreshItemStates();
      } else {
        this.showFeedback(error === 'Not enough gold' ? 'Not enough gold!' : (error || 'Purchase failed'), '#ff4444');
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

  buildRow(w, x0, y) {
    const icon = this.scene.add.image(x0 + 28, y, w.icon)
      .setDisplaySize(44, 20).setDepth(62);

    const name = this.scene.add.text(x0 + 58, y - 9, w.name, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(62);

    const stats = this.scene.add.text(
      x0 + 58, y + 9,
      `DMG ${w.damage} · ${w.fireRate}ms${w.pellets > 1 ? ` · x${w.pellets}` : ''}`,
      { fontSize: '11px', color: '#8aa', fontFamily: 'monospace' }
    ).setOrigin(0, 0.5).setDepth(62);

    const price = this.scene.add.text(x0 + 380, y, `${w.price}g`, {
      fontSize: '15px', color: '#e2b714', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(62);

    const btn = this.scene.add.rectangle(x0 + 470, y, 86, 30, 0x4caf50)
      .setDepth(62).setInteractive({ useHandCursor: true });
    const btnText = this.scene.add.text(x0 + 470, y, 'BUY', {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(63);

    btn.on('pointerdown', () => this.onRowClick(w.id));

    const row = { weapon: w, btn, btnText, price, parts: [icon, name, stats, price, btn, btnText] };
    this.rows.push(row);
  }

  onRowClick(weaponId) {
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
      const id = row.weapon.id;
      const owned = this.ownedWeapons.includes(id);
      const active = this.activeWeapon === id;
      const affordable = this.currentGold >= row.weapon.price;

      if (active) {
        row.btn.setFillStyle(0xe2b714).disableInteractive();
        row.btnText.setText('ACTIVE').setColor('#10182e');
      } else if (owned) {
        row.btn.setFillStyle(0x2e6fb0).setInteractive({ useHandCursor: true });
        row.btnText.setText('EQUIP').setColor('#ffffff');
      } else if (affordable) {
        row.btn.setFillStyle(0x4caf50).setInteractive({ useHandCursor: true });
        row.btnText.setText('BUY').setColor('#ffffff');
      } else {
        row.btn.setFillStyle(0x444444).disableInteractive();
        row.btnText.setText('BUY').setColor('#888888');
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
    this.socket.socket.off('weaponEquipped');
    this.socket.socket.off('weaponSwitched');
    this.elements.forEach((e) => e.destroy());
    this.rows.forEach((row) => row.parts.forEach((e) => e.destroy()));
    this.shopBtn.destroy();
  }
}
