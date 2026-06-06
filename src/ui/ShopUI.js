export class ShopUI {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.isOpen = false;
    this.currentGold = 0;
    this.ownedWeapons = ['handgun'];
    this.elements = [];
    this.feedbackText = null;
    this.shopBtn = null;
    this.goldText = null;
    this.shotgunBuyBtn = null;
    this.shotgunStatusText = null;
    this.eKey = null;
  }

  init() {
    this.isOpen = false;
    this.currentGold = 0;
    this.ownedWeapons = ['handgun'];
    this.elements = [];
    this.feedbackText = null;

    // Shop toggle button (always visible, bottom-right)
    this.shopBtn = this.scene.add.text(1200, 688, '[E] SHOP', {
      fontSize: '16px',
      color: '#e2b714',
      fontFamily: 'monospace',
      backgroundColor: '#16213e',
      padding: { x: 8, y: 4 }
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.shopBtn.on('pointerdown', () => this.toggle());

    // Panel background
    const panel = this.scene.add.rectangle(640, 360, 520, 320, 0x16213e, 0.95)
      .setStrokeStyle(2, 0x0f3460);

    // Title
    const title = this.scene.add.text(640, 230, 'SHOP', {
      fontSize: '28px',
      color: '#e2b714',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.scene.add.text(640, 270, 'Gold: 0', {
      fontSize: '18px',
      color: '#e2b714',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Divider line
    const divider = this.scene.add.rectangle(640, 295, 480, 2, 0x0f3460, 1);

    // Shotgun item row (y=320)
    const shotgunName = this.scene.add.text(400, 320, 'Shotgun', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    const shotgunDesc = this.scene.add.text(400, 342, '5 pellets, high damage', {
      fontSize: '13px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    const shotgunPrice = this.scene.add.text(750, 320, '100 gold', {
      fontSize: '16px',
      color: '#e2b714',
      fontFamily: 'monospace'
    }).setOrigin(1, 0.5);

    // BUY button
    this.shotgunBuyBtn = this.scene.add.rectangle(840, 320, 70, 32, 0x4caf50)
      .setInteractive({ useHandCursor: true });
    this.shotgunStatusText = this.scene.add.text(840, 320, 'BUY', {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.shotgunBuyBtn.on('pointerdown', () => {
      this.socket.socket.emit('purchaseWeapon', { weaponId: 'shotgun' });
    });

    // Feedback text
    this.feedbackText = this.scene.add.text(640, 420, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    // Close hint
    const closeHint = this.scene.add.text(640, 460, 'Press E to close', {
      fontSize: '13px',
      color: '#666666',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Collect all panel elements
    this.elements = [
      panel,
      title,
      this.goldText,
      divider,
      shotgunName,
      shotgunDesc,
      shotgunPrice,
      this.shotgunBuyBtn,
      this.shotgunStatusText,
      this.feedbackText,
      closeHint
    ];

    // Hide all panel elements initially
    this.elements.forEach(e => e.setVisible(false));

    // Keyboard toggle
    this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => this.toggle());

    // Socket listeners
    this.socket.socket.on('goldUpdate', ({ playerId, gold, gained }) => {
      if (playerId === this.socket.id) {
        this.currentGold = gold;
        this.goldText?.setText(`Gold: ${gold}`);
      }
    });

    this.socket.socket.on('purchaseResult', ({ success, weaponId, newGold, error }) => {
      if (success) {
        this.ownedWeapons.push(weaponId);
        this.currentGold = newGold;
        this.goldText?.setText(`Gold: ${newGold}`);
        this.showFeedback('Purchased!', '#00ff00');
        this.refreshItemStates();
      } else {
        this.showFeedback(error || 'Purchase failed', '#ff4444');
      }
    });

    this.socket.socket.on('weaponEquipped', ({ playerId, weaponId }) => {
      if (playerId === this.socket.id) {
        if (!this.ownedWeapons.includes(weaponId)) this.ownedWeapons.push(weaponId);
        this.refreshItemStates();
      }
    });
  }

  show() {
    this.isOpen = true;
    this.elements.forEach(e => e.setVisible(true));
    this.refreshItemStates();
  }

  hide() {
    this.isOpen = false;
    this.elements.forEach(e => e.setVisible(false));
  }

  toggle() {
    this.isOpen ? this.hide() : this.show();
  }

  refreshItemStates() {
    if (this.ownedWeapons.includes('shotgun')) {
      this.shotgunBuyBtn.setFillStyle(0x555555).disableInteractive();
      this.shotgunStatusText.setText('OWNED').setColor('#888888');
    } else {
      this.shotgunBuyBtn.setFillStyle(0x4caf50).setInteractive({ useHandCursor: true });
      this.shotgunStatusText.setText('BUY').setColor('#ffffff');
    }
  }

  showFeedback(msg, color) {
    this.feedbackText.setText(msg).setColor(color).setAlpha(1);
    this.scene.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 1500,
      delay: 500
    });
  }

  destroy() {
    this.eKey.off('down');
    this.socket.socket.off('goldUpdate');
    this.socket.socket.off('purchaseResult');
    this.socket.socket.off('weaponEquipped');
    this.elements.forEach(e => e.destroy());
    this.shopBtn.destroy();
  }
}
