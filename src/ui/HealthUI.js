export class HealthUI {
  constructor(scene) {
    this.scene = scene;
    this.playerBars = new Map(); // playerId -> {bg, fill, sprite}
    this.playerHps = new Map();  // playerId -> {hp, maxHp}
    this.localHpText = null;
    this.localPlayerId = null;
    this.myName = null;
    this.socket = null;
  }

  init(socket, myName) {
    this.myName = myName;
    this.socket = socket;

    this.localHpText = this.scene.add.text(20, 680, 'HP: 100/100', {
      fontSize: '16px',
      color: '#00ff00',
      fontFamily: 'monospace',
    }).setDepth(100);

    socket.socket.on('gameInit', (players) => {
      players.forEach((p) => {
        this.playerHps.set(p.id, { hp: 100, maxHp: 100 });
      });
    });

    socket.socket.on('playerHpUpdated', ({ id, hp, maxHp }) => {
      this.playerHps.set(id, { hp, maxHp });

      const bar = this.playerBars.get(id);
      if (bar) {
        const ratio = hp / maxHp;
        const fillWidth = 36 * ratio;
        bar.fill.width = fillWidth;
        bar.fill.setPosition(
          bar.sprite.x - 18 + fillWidth / 2,
          bar.sprite.y - 34
        );
        bar.fill.setFillStyle(
          ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffaa00 : 0xff0000
        );
      }

      if (this.isLocalPlayer(id)) {
        this.localHpText.setText(`HP: ${hp}/${maxHp}`);
        this.localHpText.setColor(
          hp > 50 ? '#00ff00' : hp > 25 ? '#ffaa00' : '#ff0000'
        );
      }
    });

    socket.socket.on('playerDied', ({ id }) => {
      if (this.isLocalPlayer(id)) {
        this.localHpText.setText('HP: DEAD').setColor('#ff0000');

        const deadText = this.scene.add
          .text(640, 360, 'YOU DIED', {
            fontSize: '72px',
            color: '#ff0000',
            fontFamily: 'monospace',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setAlpha(0)
          .setDepth(50);

        this.scene.tweens.add({
          targets: deadText,
          alpha: 1,
          duration: 500,
        });
      }
    });
  }

  isLocalPlayer(id) {
    return id === this.localPlayerId;
  }

  registerPlayerSprite(playerId, sprite, isLocal) {
    const bg = this.scene.add.rectangle(
      sprite.x,
      sprite.y - 34,
      36,
      6,
      0x333333
    ).setDepth(50);

    const fill = this.scene.add.rectangle(
      sprite.x,
      sprite.y - 34,
      36,
      6,
      0x00ff00
    ).setDepth(51);

    this.playerBars.set(playerId, { bg, fill, sprite });

    if (isLocal) {
      this.localPlayerId = playerId;
    }
  }

  updateBarPositions() {
    for (const [playerId, bar] of this.playerBars) {
      const hpData = this.playerHps.get(playerId);
      const hp = hpData ? hpData.hp : 100;
      const maxHp = hpData ? hpData.maxHp : 100;
      const ratio = hp / maxHp;
      const fillWidth = 36 * ratio;

      bar.bg.setPosition(bar.sprite.x, bar.sprite.y - 34);
      bar.fill.setPosition(
        bar.sprite.x - 18 + fillWidth / 2,
        bar.sprite.y - 34
      );
      bar.fill.width = fillWidth;
    }
  }

  destroy() {
    if (this.socket) {
      this.socket.socket.off('gameInit');
      this.socket.socket.off('playerHpUpdated');
      this.socket.socket.off('playerDied');
    }

    for (const [id, bar] of this.playerBars) {
      bar.bg.destroy();
      bar.fill.destroy();
    }

    this.playerBars.clear();
    this.playerHps.clear();

    if (this.localHpText) {
      this.localHpText.destroy();
      this.localHpText = null;
    }
  }
}
