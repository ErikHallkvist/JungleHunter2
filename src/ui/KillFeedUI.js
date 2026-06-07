const FEED_X = 1260;
const FEED_Y_START = 50;
const FEED_ROW_H = 20;
const FEED_MAX = 5;
const FEED_DURATION = 4000;
const FEED_FADE = 500;

export class KillFeedUI {
  constructor(scene) {
    this.scene = scene;
    this.entries = [];
    this.socket = null;
    this.localId = null;
    this._handler = null;
  }

  init(socket, localId) {
    this.socket = socket;
    this.localId = localId;

    this._handler = ({ killedBy, killedByName, enemyName }) => {
      if (!killedByName || !enemyName) return;
      const isLocal = killedBy === this.localId;
      this._addEntry(`${killedByName} » ${enemyName}`, isLocal);
    };
    socket.socket.on('enemyDied', this._handler);
  }

  _addEntry(text, isLocal) {
    // Remove oldest if at cap
    if (this.entries.length >= FEED_MAX) {
      const oldest = this.entries.shift();
      oldest.obj.destroy();
    }

    // Re-flow existing entries upward
    this._reflow();

    const y = FEED_Y_START + this.entries.length * FEED_ROW_H;
    const obj = this.scene.add.text(FEED_X, y, text, {
      fontSize: '13px',
      color: isLocal ? '#44ff88' : '#aaaaaa',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(100);

    const entry = { obj };
    this.entries.push(entry);

    this.scene.time.delayedCall(FEED_DURATION - FEED_FADE, () => {
      if (!obj.active) return;
      this.scene.tweens.add({
        targets: obj, alpha: 0, duration: FEED_FADE,
        onComplete: () => {
          obj.destroy();
          this.entries = this.entries.filter(e => e !== entry);
          this._reflow();
        },
      });
    });
  }

  _reflow() {
    for (let i = 0; i < this.entries.length; i++) {
      this.entries[i].obj.setY(FEED_Y_START + i * FEED_ROW_H);
    }
  }

  destroy() {
    if (this.socket && this._handler) {
      this.socket.socket.off('enemyDied', this._handler);
    }
    for (const e of this.entries) e.obj.destroy();
    this.entries = [];
  }
}
