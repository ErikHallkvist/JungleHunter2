import { FONT, COLORS } from './theme.js';

export class GoldUI {
  constructor(scene) {
    this.scene = scene;
    this.goldText = null;
    this.comboText = null;
    this.socket = null;
    this.myPlayerId = null;
    this.floatingTexts = [];
    this._comboHideTimer = null;
  }

  init(socket, myPlayerId) {
    this.socket = socket;
    this.myPlayerId = myPlayerId;

    this.goldText = this.scene.add.text(20, 648, 'GOLD: 0', {
      fontSize: '26px',
      color: COLORS.gold,
      fontFamily: FONT,
      backgroundColor: '#00000066',
      padding: { x: 6, y: 2 }
    }).setDepth(100);

    // Combo text above gold indicator
    this.comboText = this.scene.add.text(20, 614, '', {
      fontSize: '26px',
      color: '#ff8833',
      fontFamily: FONT,
      fontStyle: 'bold',
      backgroundColor: '#00000066',
      padding: { x: 6, y: 2 },
    }).setDepth(100).setAlpha(0);

    socket.socket.on('goldUpdate', ({ playerId, gold, gained }) => {
      if (playerId !== this.myPlayerId) return;
      this.setGold(gold);
      if (gained > 0) this.showGoldGained(gained);
    });

    socket.socket.on('comboUpdate', ({ combo }) => {
      if (combo < 2) {
        this.comboText.setAlpha(0);
        return;
      }
      let mult = 1;
      if (combo >= 10) mult = 4;
      else if (combo >= 5) mult = 3;
      else if (combo >= 2) mult = 2;
      this.comboText.setText(`KOMBO x${combo}  (x${mult} GULD)`).setAlpha(1);
      if (this._comboHideTimer) clearTimeout(this._comboHideTimer);
      this._comboHideTimer = setTimeout(() => {
        this.comboText?.setAlpha(0);
      }, 3000);
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
    this.socket.socket.off('comboUpdate');
    if (this._comboHideTimer) clearTimeout(this._comboHideTimer);
    this.goldText?.destroy();
    this.comboText?.destroy();
    this.floatingTexts.forEach(t => t.destroy());
  }
}
