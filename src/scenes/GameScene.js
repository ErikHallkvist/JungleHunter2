import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.otherPlayers = {};
  }

  preload() {}

  create() {
    this.socket = new SocketManager();

    this.localPlayer = this.add.rectangle(400, 300, 32, 32, 0x00ff00);
    this.physics.add.existing(this.localPlayer);
    this.cursors = this.input.keyboard.createCursorKeys();

    this.socket.onCurrentPlayers((players) => {
      Object.values(players).forEach((player) => {
        if (player.id !== this.socket.id) {
          this.addOtherPlayer(player);
        } else {
          this.localPlayer.x = player.x;
          this.localPlayer.y = player.y;
        }
      });
    });

    this.socket.onPlayerJoined((player) => {
      this.addOtherPlayer(player);
    });

    this.socket.onPlayerMoved(({ id, x, y }) => {
      if (this.otherPlayers[id]) {
        this.otherPlayers[id].x = x;
        this.otherPlayers[id].y = y;
      }
    });

    this.socket.onPlayerLeft((id) => {
      if (this.otherPlayers[id]) {
        this.otherPlayers[id].destroy();
        delete this.otherPlayers[id];
      }
    });
  }

  addOtherPlayer(player) {
    this.otherPlayers[player.id] = this.add.rectangle(player.x, player.y, 32, 32, 0xff0000);
  }

  update() {
    const body = this.localPlayer.body;
    const speed = 200;

    body.setVelocity(0);

    if (this.cursors.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown) body.setVelocityX(speed);

    if (this.cursors.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown) body.setVelocityY(speed);

    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.socket.emitMove(this.localPlayer.x, this.localPlayer.y);
    }
  }
}
