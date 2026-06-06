import { FONT, COLORS } from './theme.js';

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
    this.goldText = this.scene.add.text(20, 648, 'GOLD: 0', {
      fontSize: '26px',
      color: COLORS.gold,
      fontFamily: FONT,
      backgroundColor: '#00000066',
      padding: { x: 6, y: 2 }
    }).setDepth(100);

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
    const ft = this.scene.add.text(120, 648, `+${amount}`, {
      fontSize: '22px',
      color: COLORS.gold,
      fontFamily: FONT,
    }).setDepth(100);

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
