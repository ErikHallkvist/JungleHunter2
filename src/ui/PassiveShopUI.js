import Phaser from 'phaser';

const PASSIVES = [
  { id: 'boots',          name: 'Boots',          price: 100, desc: '+25% movement speed',       color: '#44ff88' },
  { id: 'ammo_belt',      name: 'Ammo Belt',       price: 100, desc: '-20% weapon cooldown',      color: '#66aaff' },
  { id: 'magnet',         name: 'Magnet',          price: 120, desc: 'Gold pulls toward you',      color: '#e2b714' },
  { id: 'synergy',        name: 'Synergy',         price: 200, desc: 'AoE explosion on kill',      color: '#ff6622' },
  { id: 'crit',           name: 'Critical Hit',    price: 150, desc: '15% chance for 2× damage',  color: '#ff4444' },
  { id: 'bounty_hunter',  name: 'Bounty Hunter',   price: 250, desc: 'Elites drop 2× gold',       color: '#ffcc00' },
];

export class PassiveShopUI {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.isOpen = false;
    this.currentGold = 0;
    this.owned = new Set();
    this.elements = [];
    this.rows = [];
    this.pKey = null;
    this.shopBtn = null;
    this.goldText = null;
    this.feedbackText = null;
  }

  init() {
    this.isOpen = false;
    this.currentGold = 0;
    this.owned.clear();
    this.elements = [];
    this.rows = [];

    // HUD button
    this.shopBtn = this.scene.add.text(1264, 660, '[P] PASSIVES', {
      fontSize: '14px', color: '#44ff88', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 4 },
    }).setOrigin(1, 1).setDepth(120).setInteractive({ useHandCursor: true });
    this.shopBtn.on('pointerdown', () => this.toggle());

    // Panel (taller to fit 6 passives)
    const px = 640, py = 360;
    const panel = this.scene.add.rectangle(px, py, 500, 440, 0x0a0f1e, 0.97).setStrokeStyle(2, 0x1a3a2a).setDepth(101);
    const title = this.scene.add.text(px, py - 198, 'PASSIVE ABILITIES', {
      fontSize: '22px', color: '#44ff88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(103);
    this.goldText = this.scene.add.text(px, py - 168, 'Gold: 0', {
      fontSize: '16px', color: '#e2b714', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(103);
    const divider = this.scene.add.rectangle(px, py - 150, 460, 1, 0x1a3a2a).setDepth(103);
    this.elements.push(panel, title, this.goldText, divider);

    PASSIVES.forEach((p, i) => this._buildRow(p, py - 118 + i * 52));

    this.feedbackText = this.scene.add.text(px, py + 195, '', {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(103).setAlpha(0);
    const hint = this.scene.add.text(px, py + 212, '[P] close  ·  passives are permanent for the run', {
      fontSize: '12px', color: '#444444', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(103);
    this.elements.push(this.feedbackText, hint);

    this.elements.forEach(e => e.setVisible(false));
    this.rows.forEach(r => r.parts.forEach(e => e.setVisible(false)));

    this.pKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pKey.on('down', () => this.toggle());

    this.socket.socket.on('goldUpdate', ({ playerId, gold }) => {
      if (playerId === this.socket.id) { this.currentGold = gold; this.goldText?.setText(`Gold: ${gold}`); this.refreshStates(); }
    });

    this.socket.socket.on('passiveResult', ({ success, passiveId, newGold, passives, error }) => {
      if (success) {
        if (passives) passives.forEach(id => this.owned.add(id));
        else this.owned.add(passiveId);
        this.currentGold = newGold ?? this.currentGold;
        this.goldText?.setText(`Gold: ${this.currentGold}`);
        const label = PASSIVES.find(p => p.id === passiveId)?.name ?? passiveId;
        this._showFeedback(`${label} activated!`, '#44ff88');
        this.scene.playSfx?.('sfx_cash', 0.4);
        this.refreshStates();
      } else {
        this._showFeedback(error || 'Purchase failed', '#ff4444');
      }
    });
  }

  _buildRow(p, y) {
    const px = 640;
    const name = this.scene.add.text(px - 200, y - 10, p.name, {
      fontSize: '17px', color: p.color, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(103);
    const desc = this.scene.add.text(px - 200, y + 12, p.desc, {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(103);
    const priceText = this.scene.add.text(px + 60, y, `${p.price}g`, {
      fontSize: '15px', color: '#e2b714', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(103);

    // Use a single text object as the button — avoids z-order click blocking
    const btn = this.scene.add.text(px + 160, y, 'BUY', {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#226644', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(103).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.socket.socket.emit('purchasePassive', { passiveId: p.id }));

    const row = { passive: p, btn, priceText, parts: [name, desc, priceText, btn] };
    this.rows.push(row);
  }

  refreshStates() {
    for (const row of this.rows) {
      const { id, price } = row.passive;
      const owned = this.owned.has(id);
      const affordable = this.currentGold >= price;
      if (owned) {
        row.btn.setText('ACTIVE').setColor('#aaffaa').setBackgroundColor('#225533').disableInteractive();
        row.priceText.setColor('#444444');
      } else if (affordable) {
        row.btn.setText('BUY').setColor('#ffffff').setBackgroundColor('#226644').setInteractive({ useHandCursor: true });
        row.priceText.setColor('#e2b714');
      } else {
        row.btn.setText('BUY').setColor('#555555').setBackgroundColor('#333333').disableInteractive();
        row.priceText.setColor('#555555');
      }
    }
  }

  _showFeedback(msg, color) {
    if (this.feedbackText) {
      this.feedbackText.setText(msg).setColor(color).setAlpha(1);
      this.scene.tweens.add({ targets: this.feedbackText, alpha: 0, duration: 1500, delay: 600 });
    }
  }

  show() {
    this.isOpen = true;
    this.elements.forEach(e => e.setVisible(true));
    this.rows.forEach(r => r.parts.forEach(e => e.setVisible(true)));
    this.refreshStates();
  }

  hide() {
    this.isOpen = false;
    this.elements.forEach(e => e.setVisible(false));
    this.rows.forEach(r => r.parts.forEach(e => e.setVisible(false)));
  }

  toggle() { this.isOpen ? this.hide() : this.show(); }

  destroy() {
    this.pKey?.off('down');
    this.socket.socket.off('goldUpdate');
    this.socket.socket.off('passiveResult');
    this.elements.forEach(e => e.destroy());
    this.rows.forEach(r => r.parts.forEach(e => e.destroy()));
    this.shopBtn?.destroy();
  }
}
