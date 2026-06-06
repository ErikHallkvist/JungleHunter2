import Phaser from 'phaser';
import { EnemySystem } from '../systems/EnemySystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { BulletSystem } from '../systems/BulletSystem.js';
import { HealthUI } from '../ui/HealthUI.js';
import { WaveUI } from '../ui/WaveUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { GoldUI } from '../ui/GoldUI.js';

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
    this.initialPlayerList = data.playerList || [];
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
    this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

    // Systems
    this.enemySystem = new EnemySystem(this);
    this.enemySystem.init(this.socket);

    this.bulletSystem = new BulletSystem(this);
    this.bulletSystem.init(this.socket, () => this.enemySystem.getEnemies());

    this.weaponSystem = new WeaponSystem(this, this.socket, this.myName);
    this.weaponSystem.init();

    this.healthUI = new HealthUI(this);
    this.healthUI.init(this.socket, this.myName);

    this.waveUI = new WaveUI(this);
    this.waveUI.init(this.socket);

    this.shopUI = new ShopUI(this, this.socket);
    this.shopUI.init();

    this.goldUI = new GoldUI(this);
    this.goldUI.init(this.socket, this.socket.id);

    // Spawn all players from data passed from lobby scene
    this.initialPlayerList.forEach((player) => this.spawnPlayer(player));

    // Other players joining/leaving/moving
    this.socket.socket.on('gamePlayerMoved', ({ id, x, y }) => {
      const p = this.players[id];
      if (p && id !== this.localId) {
        p.sprite.setPosition(x, y);
        p.nameText.setPosition(x, y - PLAYER_H / 2 - 10);
      }
    });

    this.socket.socket.on('gamePlayerLeft', (id) => {
      const p = this.players[id];
      if (p) {
        p.sprite.destroy();
        p.nameText.destroy();
        delete this.players[id];
      }
    });
  }

  createRoom() {
    this.add.rectangle(640, 360, 1280, 720, 0x0d2b1a);
    this.add.rectangle(640, 360, ROOM.width, ROOM.height, 0x1b4332);

    const g = this.add.graphics();
    g.lineStyle(4, 0x2d6a4f, 1);
    g.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
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
      this.weaponSystem.setLocalPlayerSprite(sprite);
    }

    const nameText = this.add.text(
      playerData.x, playerData.y - PLAYER_H / 2 - 10,
      playerData.name,
      { fontSize: '13px', color: isLocal ? '#00e676' : '#ffffff', fontFamily: 'monospace' }
    ).setOrigin(0.5);

    this.players[playerData.id] = { sprite, nameText, isLocal };
    this.healthUI.registerPlayerSprite(playerData.id, sprite, isLocal);
  }

  update(time, delta) {
    if (!this.localSprite) return;

    const body = this.localSprite.body;
    body.setVelocity(0);

    if (this.wasd.left.isDown) body.setVelocityX(-SPEED);
    else if (this.wasd.right.isDown) body.setVelocityX(SPEED);

    if (this.wasd.up.isDown) body.setVelocityY(-SPEED);
    else if (this.wasd.down.isDown) body.setVelocityY(SPEED);

    const local = this.players[this.localId];
    if (local) {
      local.nameText.setPosition(
        this.localSprite.x,
        this.localSprite.y - PLAYER_H / 2 - 10
      );
    }

    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.socket.emitPlayerMove(this.localSprite.x, this.localSprite.y);
    }

    this.enemySystem.update();
    this.bulletSystem.update(delta);
    this.healthUI.updateBarPositions();
  }
}
