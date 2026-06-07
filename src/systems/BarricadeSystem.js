const BARRICADE_W = 120;
const BARRICADE_H = 20;
const BARRICADE_COST = 80;

export class BarricadeSystem {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.barricades = new Map();
    this.placementMode = false;
    this.preview = null;
    this.hud = null;
    this.barricadeCount = 0; // local player's active barricades
  }

  init() {
    this.placementMode = false;

    // HUD button at bottom (between gold and shop button)
    this.hud = this.scene.add.text(20, 675, '🧱 [B] Barrikad (80g)', {
      fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#00000066', padding: { x: 6, y: 3 },
    }).setDepth(100).setInteractive({ useHandCursor: true });
    this.hud.on('pointerdown', () => this._enterPlacementMode());

    // B key
    this.bKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.bKey.on('down', () => this._enterPlacementMode());

    // Preview rectangle
    this.preview = this.scene.add.rectangle(0, 0, BARRICADE_W, BARRICADE_H, 0x00ff88, 0.5)
      .setStrokeStyle(2, 0x00ff88).setDepth(50).setVisible(false);

    // Mouse movement updates preview — store refs for clean removal
    this._onMove = (ptr) => {
      if (this.placementMode) this.preview.setPosition(ptr.x, ptr.y).setVisible(true);
    };
    this._onClick = (ptr) => {
      if (this.placementMode) this._place(ptr.x, ptr.y);
    };
    this.scene.input.on('pointermove', this._onMove);
    this.scene.input.on('pointerdown', this._onClick);

    // Server events
    this.socket.socket.on('barricadeSpawned', (data) => this._onSpawned(data));
    this.socket.socket.on('barricadeDamaged', ({ id, hp }) => this._onDamaged(id, hp));
    this.socket.socket.on('barricadeDestroyed', ({ id }) => this._onDestroyed(id));
    this.socket.socket.on('barricadeResult', ({ success, error }) => {
      if (!success) this._showMsg(error || 'Kan inte placera', '#ff4444');
    });
    this.socket.socket.on('goldUpdate', ({ playerId, gold }) => {
      if (playerId === this.socket.socket.id) this._updateHudColor(gold);
    });
  }

  _enterPlacementMode() {
    if (this.scene.shopUI?.isOpen || this.scene.passiveShopUI?.isOpen) return;
    if (this.placementMode) { this._exitPlacementMode(); return; }
    this.placementMode = true;
    this.hud.setColor('#00ff88');
    this._showMsg('Klicka för att placera barrikad (B avbryter)', '#00ff88');
  }

  _exitPlacementMode() {
    this.placementMode = false;
    this.preview.setVisible(false);
    this.hud.setColor('#aaaaaa');
  }

  _place(x, y) {
    this._exitPlacementMode();
    this.socket.socket.emit('placeBarricade', { x, y });
  }

  _onSpawned({ id, x, y, hp, maxHp }) {
    const rect = this.scene.add.rectangle(x, y, BARRICADE_W, BARRICADE_H, 0x224422)
      .setStrokeStyle(2, 0x00cc44).setDepth(9);
    const barBg = this.scene.add.rectangle(x, y - 16, BARRICADE_W - 4, 6, 0x333333).setDepth(10);
    const bar = this.scene.add.rectangle(x, y - 16, BARRICADE_W - 4, 6, 0x00cc44).setDepth(11);

    this.barricades.set(id, { rect, barBg, bar, hp, maxHp });
  }

  _onDamaged(id, hp) {
    const b = this.barricades.get(id);
    if (!b) return;
    b.hp = hp;
    const ratio = hp / b.maxHp;
    b.bar.width = (BARRICADE_W - 4) * ratio;
    b.bar.setFillStyle(ratio > 0.5 ? 0x00cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3333);
  }

  _onDestroyed(id) {
    const b = this.barricades.get(id);
    if (!b) return;
    // Brief flash before destroying
    this.scene.tweens.add({
      targets: [b.rect, b.barBg, b.bar], alpha: 0, duration: 300,
      onComplete: () => { b.rect.destroy(); b.barBg.destroy(); b.bar.destroy(); },
    });
    this.barricades.delete(id);
  }

  _updateHudColor(gold) {
    const canAfford = gold >= BARRICADE_COST;
    if (!this.placementMode) this.hud.setColor(canAfford ? '#aaaaaa' : '#555555');
  }

  _showMsg(text, color) {
    const msg = this.scene.add.text(640, 580, text, {
      fontSize: '16px', color, fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#000000aa', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(150);
    this.scene.tweens.add({ targets: msg, alpha: 0, delay: 2000, duration: 400, onComplete: () => msg.destroy() });
  }

  destroy() {
    this._exitPlacementMode();
    this.bKey?.off('down');
    this.socket.socket.off('barricadeSpawned');
    this.socket.socket.off('barricadeDamaged');
    this.socket.socket.off('barricadeDestroyed');
    this.socket.socket.off('barricadeResult');
    this.socket.socket.off('goldUpdate');
    if (this._onMove)  this.scene.input.off('pointermove', this._onMove);
    if (this._onClick) this.scene.input.off('pointerdown', this._onClick);
    for (const b of this.barricades.values()) {
      b.rect.destroy(); b.barBg.destroy(); b.bar.destroy();
    }
    this.barricades.clear();
    this.preview?.destroy();
    this.hud?.destroy();
  }
}
