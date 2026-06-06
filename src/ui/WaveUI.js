export class WaveUI {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.aliveEnemies = 0;

    this.waveText = null;
    this.enemyCountText = null;
    this.countdownText = null;
    this.flashText = null;
  }

  init(socket) {
    this.socket = socket;

    this.waveText = this.scene.add
      .text(640, 20, 'WAVE 0', {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.enemyCountText = this.scene.add.text(20, 20, 'Enemies: 0', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'monospace',
    });

    this.countdownText = this.scene.add
      .text(640, 360, '', {
        fontSize: '48px',
        color: '#e2b714',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.flashText = this.scene.add
      .text(640, 200, '', {
        fontSize: '36px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    socket.socket.on('waveStart', ({ waveNumber, enemyCount, enemyName }) => {
      this.aliveEnemies = 0;
      this.waveText.setText(`WAVE ${waveNumber}${enemyName ? ` — ${enemyName}` : ''}`);
      this.enemyCountText.setText(`Enemies: ${enemyCount}`);
      this.countdownText.setAlpha(0);
      this.flashText.setText(`WAVE ${waveNumber}!`).setAlpha(1);
      this.scene.tweens.add({
        targets: this.flashText,
        alpha: 0,
        duration: 2000,
        delay: 500,
      });
    });

    socket.socket.on('waveCountdown', ({ seconds }) => {
      this.countdownText.setText(`Next wave in: ${seconds}`).setAlpha(1);
    });

    socket.socket.on('waveComplete', ({ waveNumber }) => {
      this.flashText.setText('WAVE COMPLETE!').setAlpha(1);
      this.scene.tweens.add({
        targets: this.flashText,
        alpha: 0,
        duration: 1500,
        delay: 500,
      });
    });

    const decrement = () => {
      this.aliveEnemies = Math.max(0, (this.aliveEnemies || 0) - 1);
      this.enemyCountText.setText(`Enemies: ${this.aliveEnemies}`);
    };
    socket.socket.on('enemyDied', decrement);
    socket.socket.on('enemyLeaked', decrement); // escaped enemies also leave the field

    socket.socket.on('enemySpawned', () => {
      this.aliveEnemies = (this.aliveEnemies || 0) + 1;
      this.enemyCountText.setText(`Enemies: ${this.aliveEnemies}`);
    });
  }

  destroy() {
    if (this.socket) {
      this.socket.socket.off('waveStart');
      this.socket.socket.off('waveCountdown');
      this.socket.socket.off('waveComplete');
      this.socket.socket.off('enemyDied');
      this.socket.socket.off('enemyLeaked');
      this.socket.socket.off('enemySpawned');
    }

    if (this.waveText) this.waveText.destroy();
    if (this.enemyCountText) this.enemyCountText.destroy();
    if (this.countdownText) this.countdownText.destroy();
    if (this.flashText) this.flashText.destroy();
  }
}
