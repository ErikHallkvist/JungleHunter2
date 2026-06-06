import Phaser from 'phaser';
import { WEAPONS, PROJECTILES, getWeapon } from '../../shared/weapons.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { BulletSystem } from '../systems/BulletSystem.js';
import { WaveUI } from '../ui/WaveUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { GoldUI } from '../ui/GoldUI.js';

const ROOM = { x: 32, y: 32, width: 1216, height: 656 };
export const PLAYER_W = 36;
export const PLAYER_H = 48;
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

  preload() {
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('enemy',  'assets/sprites/enemy.png');
    this.load.image('jungle', 'assets/background/jungle.png');

    // All projectile sprites
    for (const proj of Object.values(PROJECTILES)) {
      this.load.image(proj.sprite, `assets/sprites/${proj.sprite}.png`);
    }
    // All weapon icons
    for (const w of WEAPONS) {
      this.load.image(w.icon, `assets/sprites/${w.icon}.png`);
    }
    // Weapon firing sounds (one per projectile type)
    for (const type of Object.keys(PROJECTILES)) {
      this.load.audio(`sfx_${type}`, `assets/sounds/sfx_${type}.wav`);
    }
    // Gameplay sounds
    for (const s of ['move', 'hit', 'leak', 'gameover', 'cash']) {
      this.load.audio(`sfx_${s}`, `assets/sounds/sfx_${s}.wav`);
    }
    this.load.audio('music_game', 'assets/sounds/music_game.wav');
  }

  // Generic sound helper — silently no-ops if the clip isn't loaded.
  playSfx(key, volume = 0.4) {
    if (!this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume });
  }

  // Play a weapon's firing sound. volume lowered for other players' guns.
  playShotSound(bulletType, mine = true) {
    this.playSfx(`sfx_${bulletType}`, mine ? 0.45 : 0.22);
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

    this.enemySystem = new EnemySystem(this);
    this.enemySystem.init(this.socket);

    this.bulletSystem = new BulletSystem(this);
    this.bulletSystem.init(this.socket, () => this.enemySystem.getEnemies());

    this.weaponSystem = new WeaponSystem(this, this.socket, this.myName);
    this.weaponSystem.init();

    // Escaped-enemy counter (top-right). Game over when it reaches the max.
    this.leakMax = 10;
    this.leakText = this.add.text(1260, 20, 'Escaped: 0 / 10', {
      fontSize: '18px',
      color: '#ff5555',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(100);

    this.waveUI = new WaveUI(this);
    this.waveUI.init(this.socket);

    this.shopUI = new ShopUI(this, this.socket);
    this.shopUI.init();

    this.goldUI = new GoldUI(this);
    this.goldUI.init(this.socket, this.socket.id);

    this.gameEnded = false;

    // Start looping background music
    this.gameMusic = this.sound.add('music_game', { loop: true, volume: 0.35 });
    this.gameMusic.play();

    this.initialPlayerList.forEach((player) => this.spawnPlayer(player));

    // Keep references so we can detach exactly these on shutdown.
    this._handlers = {
      gamePlayerMoved: ({ id, x, y }) => {
        const p = this.players[id];
        if (p && id !== this.localId) {
          p.sprite.setPosition(x, y);
          p.nameText.setPosition(x, y - PLAYER_H / 2 - 8);
          this.positionWeapon(p);
        }
      },
      gamePlayerLeft: (id) => {
        const p = this.players[id];
        if (p) {
          p.sprite.destroy();
          p.nameText.destroy();
          p.weaponSprite?.destroy();
          delete this.players[id];
        }
      },
      // A player (anyone) changed their active weapon — update the visible gun.
      onWeaponChange: ({ playerId, weaponId }) => this.setPlayerWeapon(playerId, weaponId),
      leakUpdate: ({ escaped, max }) => {
        this.leakMax = max;
        this.leakText?.setText(`Escaped: ${escaped} / ${max}`);
      },
      enemyLeaked: () => this.playSfx('sfx_leak', 0.5),
      gameOver: () => this.showGameOver(),
      returnToLobby: () => {
        this.scene.start('LobbyScene', { socket: this.socket, myName: this.myName });
      },
    };

    const s = this.socket.socket;
    s.on('gamePlayerMoved', this._handlers.gamePlayerMoved);
    s.on('gamePlayerLeft', this._handlers.gamePlayerLeft);
    s.on('weaponEquipped', this._handlers.onWeaponChange);
    s.on('weaponSwitched', this._handlers.onWeaponChange);
    s.on('leakUpdate', this._handlers.leakUpdate);
    s.on('enemyLeaked', this._handlers.enemyLeaked);
    s.on('gameOver', this._handlers.gameOver);
    s.on('returnToLobby', this._handlers.returnToLobby);

    // Tear everything down cleanly when the scene stops (return to lobby).
    this.events.once('shutdown', () => this.cleanup());
  }

  showGameOver() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    this.playSfx('sfx_gameover', 0.6);

    // Dark overlay + big red GAME OVER text.
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55).setDepth(199);
    this.add.text(640, 340, 'GAME OVER', {
      fontSize: '100px',
      color: '#ff2222',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(200);
    this.add.text(640, 430, 'Too many enemies escaped — returning to lobby...', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(200);
  }

  cleanup() {
    const s = this.socket?.socket;
    if (s && this._handlers) {
      s.off('gamePlayerMoved', this._handlers.gamePlayerMoved);
      s.off('gamePlayerLeft', this._handlers.gamePlayerLeft);
      s.off('weaponEquipped', this._handlers.onWeaponChange);
      s.off('weaponSwitched', this._handlers.onWeaponChange);
      s.off('leakUpdate', this._handlers.leakUpdate);
      s.off('enemyLeaked', this._handlers.enemyLeaked);
      s.off('gameOver', this._handlers.gameOver);
      s.off('returnToLobby', this._handlers.returnToLobby);
    }
    this.gameMusic?.stop();
    this.enemySystem?.destroy();
    this.bulletSystem?.destroy();
    this.weaponSystem?.destroy();
    this.waveUI?.destroy();
    this.shopUI?.destroy();
    this.goldUI?.destroy();
  }

  createRoom() {
    // Tiled jungle background
    this.add.tileSprite(640, 360, 1280, 720, 'jungle');

    // Dark vignette on the outer border strip
    const gfx = this.add.graphics();
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillRect(0, 0, 1280, ROOM.y);                         // top
    gfx.fillRect(0, ROOM.y + ROOM.height, 1280, ROOM.y);      // bottom
    gfx.fillRect(0, 0, ROOM.x, 720);                          // left
    gfx.fillRect(ROOM.x + ROOM.width, 0, ROOM.x, 720);        // right

    // Room border
    gfx.lineStyle(3, 0x4caf50, 0.7);
    gfx.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
  }

  spawnPlayer(playerData) {
    const isLocal = playerData.name === this.myName;

    let sprite;
    if (isLocal) {
      sprite = this.physics.add.image(playerData.x, playerData.y, 'player');
      sprite.setDisplaySize(PLAYER_W, PLAYER_H);
      sprite.body.setSize(PLAYER_W - 6, PLAYER_H - 6);
      sprite.body.setCollideWorldBounds(true);
      this.localSprite = sprite;
      this.localId = playerData.id;
      this.weaponSystem.setLocalPlayerSprite(sprite);
    } else {
      sprite = this.add.image(playerData.x, playerData.y, 'player');
      sprite.setDisplaySize(PLAYER_W, PLAYER_H);
      // Blue tint for other players
      sprite.setTint(0xaaddff);
    }

    sprite.setDepth(10);

    const nameText = this.add.text(
      playerData.x,
      playerData.y - PLAYER_H / 2 - 8,
      playerData.name,
      {
        fontSize: '13px',
        color: isLocal ? '#00ff88' : '#aaddff',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(11);

    // Visible weapon held by this player (everyone sees it).
    const weaponId = playerData.weapon || 'pistol';
    const weaponSprite = this.add.image(0, 0, getWeapon(weaponId).icon)
      .setOrigin(0.1, 0.5)
      .setDisplaySize(30, 13)
      .setDepth(9);

    const entry = { sprite, nameText, weaponSprite, isLocal };
    this.players[playerData.id] = entry;
    this.positionWeapon(entry);
  }

  // Place the weapon sprite at the player's right hand (always faces right).
  positionWeapon(entry) {
    if (!entry.weaponSprite) return;
    entry.weaponSprite.setPosition(entry.sprite.x + 8, entry.sprite.y + 6);
  }

  setPlayerWeapon(playerId, weaponId) {
    const p = this.players[playerId];
    if (!p || !p.weaponSprite) return;
    p.weaponSprite.setTexture(getWeapon(weaponId).icon);
    p.weaponSprite.setDisplaySize(30, 13);
    if (playerId === this.localId) {
      this.weaponSystem.equipWeapon(weaponId);
    }
  }

  update(time, delta) {
    if (!this.localSprite) return;

    if (this.gameEnded) {
      this.enemySystem.update();
      this.bulletSystem.update(delta);
      this.localSprite.body.setVelocity(0);
      return;
    }

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
        this.localSprite.y - PLAYER_H / 2 - 8
      );
      this.positionWeapon(local);
    }

    const moving = body.velocity.x !== 0 || body.velocity.y !== 0;
    if (moving) {
      this.socket.emitPlayerMove(this.localSprite.x, this.localSprite.y);
      // Footstep ticks while moving (throttled).
      if (time - (this._lastStep || 0) > 260) {
        this._lastStep = time;
        this.playSfx('sfx_move', 0.18);
      }
    }

    this.enemySystem.update();
    this.bulletSystem.update(delta);
    this.weaponSystem.update();
  }
}
