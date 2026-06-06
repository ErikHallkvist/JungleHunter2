import Phaser from 'phaser';

const ROOM = { x: 32, y: 32, width: 1216, height: 656 };
const PLAYER_W = 28;
const PLAYER_H = 40;
const SPEED = 220;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.socket = data.socket;
    this.myName = data.myName;
  }

  create() {
    this.players = {};
    this.localSprite = null;
    this.localId = null;

    this.createRoom();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // World bounds act as invisible walls
    this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

    this.registerSocketEvents();
  }

  createRoom() {
    // Jungle background
    this.add.rectangle(640, 360, 1280, 720, 0x0d2b1a);

    // Floor
    this.add.rectangle(640, 360, ROOM.width, ROOM.height, 0x1b4332);

    // Room border
    const g = this.add.graphics();
    g.lineStyle(4, 0x2d6a4f, 1);
    g.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

    // Spawn zone indicator (left side)
    const spawnG = this.add.graphics();
    spawnG.lineStyle(1, 0x4caf50, 0.3);
    spawnG.strokeRect(ROOM.x, ROOM.y, 200, ROOM.height);
    this.add.text(ROOM.x + 100, ROOM.y + 20, 'SPAWN', {
      fontSize: '11px',
      color: '#4caf50',
      fontFamily: 'monospace',
      alpha: 0.5,
    }).setOrigin(0.5).setAlpha(0.4);
  }

  registerSocketEvents() {
    this.socket.onGameInit((playerList) => {
      playerList.forEach((player) => this.spawnPlayer(player));
    });

    this.socket.onGamePlayerMoved(({ id, x, y }) => {
      const p = this.players[id];
      if (p && id !== this.localId) {
        p.sprite.setPosition(x, y);
        p.nameText.setPosition(x, y - PLAYER_H / 2 - 10);
      }
    });

    this.socket.onGamePlayerLeft((id) => {
      const p = this.players[id];
      if (p) {
        p.sprite.destroy();
        p.nameText.destroy();
        delete this.players[id];
      }
    });
  }

  spawnPlayer(playerData) {
    const isLocal = playerData.name === this.myName;
    const color = isLocal ? 0x00e676 : 0x448aff;

    const sprite = this.add.rectangle(playerData.x, playerData.y, PLAYER_W, PLAYER_H, color);

    if (isLocal) {
      this.physics.add.existing(sprite);
      sprite.body.setCollideWorldBounds(true);
      this.localSprite = sprite;
      this.localId = playerData.id;
    }

    const nameText = this.add.text(playerData.x, playerData.y - PLAYER_H / 2 - 10, playerData.name, {
      fontSize: '13px',
      color: isLocal ? '#00e676' : '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.players[playerData.id] = { sprite, nameText, isLocal };
  }

  update() {
    if (!this.localSprite) return;

    const body = this.localSprite.body;
    body.setVelocity(0);

    if (this.wasd.left.isDown) body.setVelocityX(-SPEED);
    else if (this.wasd.right.isDown) body.setVelocityX(SPEED);

    if (this.wasd.up.isDown) body.setVelocityY(-SPEED);
    else if (this.wasd.down.isDown) body.setVelocityY(SPEED);

    // Keep name text above local player
    const local = this.players[this.localId];
    if (local) {
      local.nameText.setPosition(this.localSprite.x, this.localSprite.y - PLAYER_H / 2 - 10);
    }

    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.socket.emitPlayerMove(this.localSprite.x, this.localSprite.y);
    }
  }
}
