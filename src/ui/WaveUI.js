import { FONT, FONT_HEAD, COLORS } from './theme.js';

const EVENT_COLORS = {
  'GOLD-RUSH': '#f0c020',
  'DARKNESS': '#3355cc',
  'FRENZY':   '#ff4400',
  'FREEZE':   '#44ccff',
};

export class WaveUI {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.aliveEnemies = 0;
    this.waveText = null;
    this.enemyCountText = null;
    this.countdownText = null;
    this.flashText = null;
    this.eventBanner = null;
    this.previewPanel = null;
    this._darknessOverlay = null;
  }

  init(socket) {
    this.socket = socket;

    this.waveText = this.scene.add
      .text(640, 22, 'WAVE 0', { fontSize: '16px', color: COLORS.white, fontFamily: FONT_HEAD })
      .setOrigin(0.5).setDepth(100);

    this.enemyCountText = this.scene.add.text(20, 18, 'Enemies: 0', {
      fontSize: '22px', color: COLORS.red, fontFamily: FONT,
    }).setDepth(100);

    this.countdownText = this.scene.add
      .text(640, 55, '', { fontSize: '22px', color: COLORS.gold, fontFamily: FONT_HEAD })
      .setOrigin(0.5).setAlpha(0).setDepth(100);

    this.flashText = this.scene.add
      .text(640, 200, '', { fontSize: '28px', color: COLORS.white, fontFamily: FONT_HEAD })
      .setOrigin(0.5).setAlpha(0).setDepth(100);

    // Pre-created preview panel (hidden by default)
    this._buildPreviewPanel();

    socket.socket.on('waveStart', ({ waveNumber, enemyCount, enemyName, isBoss, waveEvent }) => {
      this.aliveEnemies = 0;
      this.waveText.setText(`WAVE ${waveNumber}${enemyName ? ` - ${enemyName}` : ''}`);
      this.enemyCountText.setText(`Enemies: ${enemyCount}`);
      this.countdownText.setAlpha(0);
      this._hidePreview();

      if (isBoss) {
        this._showBanner('⚠ BOSS WAVE', '#ff2200', 3000);
      } else {
        this.flashText.setText(`WAVE ${waveNumber}!`).setAlpha(1);
        this.scene.tweens.add({ targets: this.flashText, alpha: 0, duration: 2000, delay: 500 });
      }

      if (waveEvent) this._showEventBanner(waveEvent);
      this._applyEventVisual(waveEvent);
    });

    socket.socket.on('waveCountdown', ({ seconds }) => {
      this.countdownText.setText(`Next wave in: ${seconds}`).setAlpha(1);
    });

    socket.socket.on('waveComplete', ({ waveNumber }) => {
      this._clearEventVisual();
      this.flashText.setText('WAVE COMPLETE!').setAlpha(1);
      this.scene.tweens.add({ targets: this.flashText, alpha: 0, duration: 1500, delay: 500 });
    });

    socket.socket.on('wavePreview', (data) => {
      this._showPreview(data.nextWave, data.enemyName, data.enemyCount, data.estimatedGold, data.isBoss);
    });

    const decrement = () => {
      this.aliveEnemies = Math.max(0, (this.aliveEnemies || 0) - 1);
      this.enemyCountText.setText(`Enemies: ${this.aliveEnemies}`);
    };
    socket.socket.on('enemyDied', decrement);
    socket.socket.on('enemyLeaked', decrement);

    socket.socket.on('enemySpawned', () => {
      this.aliveEnemies = (this.aliveEnemies || 0) + 1;
      this.enemyCountText.setText(`Enemies: ${this.aliveEnemies}`);
    });
  }

  _buildPreviewPanel() {
    const px = 640, py = 90;
    this._previewBg = this.scene.add.rectangle(px, py, 400, 110, 0x0a0e1a, 0.92)
      .setStrokeStyle(2, 0x334488).setDepth(95).setAlpha(0);
    this._previewTitle = this.scene.add.text(px, py - 38, '', {
      fontSize: '13px', color: COLORS.gold, fontFamily: FONT_HEAD,
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    this._previewLine1 = this.scene.add.text(px, py - 12, '', {
      fontSize: '16px', color: COLORS.white, fontFamily: FONT,
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    this._previewLine2 = this.scene.add.text(px, py + 10, '', {
      fontSize: '15px', color: COLORS.gold, fontFamily: FONT,
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    this._previewLine3 = this.scene.add.text(px, py + 32, '', {
      fontSize: '15px', color: COLORS.dim, fontFamily: FONT,
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
  }

  _showPreview(nextWave, enemyName, enemyCount, estimatedGold, isBoss) {
    const titleText = isBoss ? '⚠ BOSS WAVE' : `WAVE ${nextWave} PREVIEW`;
    const titleColor = isBoss ? '#ff2200' : COLORS.gold;
    this._previewTitle.setText(titleText).setColor(titleColor);
    this._previewLine1.setText(enemyName ? `Enemy: ${enemyName}` : '');
    this._previewLine2.setText(`Count: ${isBoss ? enemyCount + ' (BOSS!)' : enemyCount}`);
    this._previewLine3.setText(`Est. gold: ~${estimatedGold}g`);
    [this._previewBg, this._previewTitle, this._previewLine1, this._previewLine2, this._previewLine3]
      .forEach(o => o.setAlpha(1));
  }

  _hidePreview() {
    [this._previewBg, this._previewTitle, this._previewLine1, this._previewLine2, this._previewLine3]
      .forEach(o => o?.setAlpha(0));
  }

  _showBanner(text, color, duration = 2500) {
    if (this.eventBanner) this.eventBanner.destroy();
    this.eventBanner = this.scene.add.text(640, 180, text, {
      fontSize: '38px', color, fontFamily: FONT_HEAD,
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(150).setAlpha(1);
    this.scene.tweens.add({
      targets: this.eventBanner, alpha: 0, duration: 800, delay: duration - 800,
      onComplete: () => { this.eventBanner?.destroy(); this.eventBanner = null; },
    });
  }

  _showEventBanner(event) {
    const color = EVENT_COLORS[event] ?? COLORS.white;
    this._showBanner(`EVENT: ${event}`, color, 3000);
  }

  _applyEventVisual(event) {
    this._clearEventVisual();
    if (event === 'DARKNESS') {
      this._darknessOverlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000022, 0.72).setDepth(20);
    }
  }

  _clearEventVisual() {
    if (this._darknessOverlay) {
      this._darknessOverlay.destroy();
      this._darknessOverlay = null;
    }
  }

  destroy() {
    if (this.socket) {
      this.socket.socket.off('waveStart');
      this.socket.socket.off('waveCountdown');
      this.socket.socket.off('waveComplete');
      this.socket.socket.off('wavePreview');
      this.socket.socket.off('enemyDied');
      this.socket.socket.off('enemyLeaked');
      this.socket.socket.off('enemySpawned');
    }
    this._clearEventVisual();
    this.waveText?.destroy();
    this.enemyCountText?.destroy();
    this.countdownText?.destroy();
    this.flashText?.destroy();
    this.eventBanner?.destroy();
    this._previewBg?.destroy();
    this._previewTitle?.destroy();
    this._previewLine1?.destroy();
    this._previewLine2?.destroy();
    this._previewLine3?.destroy();
  }
}
