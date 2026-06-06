export class GoldUI {
  constructor(scene) {
    this.scene = scene;
    this.goldText = null;
    this.socket = null;
    this.myPlayerId = null;
    this.floatingTexts = [];
  }

  init(socket, myPlayerId) {
    this.socket = socket;
    this.myPlayerId = myPlayerId;

    // Gold display bottom-left
    this.goldText = this.scene.add.text(20, 650, 'GOLD: 0', {
      fontSize: '18px',
      color: '#e2b714',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: '#00000066',
      padding: { x: 6, y: 3 }
    });

    socket.socket.on('goldUpdate', ({ playerId, gold, gained }) => {
      if (playerId !== this.myPlayerId) return;
      this.setGold(gold);
      if (gained > 0) this.showGoldGained(gained);
    });
  }

  setGold(amount) {
    this.goldText.setText(`GOLD: ${amount}`);
  }

  showGoldGained(amount) {
    const ft = this.scene.add.text(110, 650, `+${amount}`, {
      fontSize: '16px',
      color: '#e2b714',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    });

    this.scene.tweens.add({
      targets: ft,
      y: ft.y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => ft.destroy()
    });

    this.floatingTexts.push(ft);
  }

  destroy() {
    this.socket.socket.off('goldUpdate');
    this.goldText?.destroy();
    this.floatingTexts.forEach(t => t.destroy());
  }
}
