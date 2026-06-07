import Phaser from 'phaser';
import { WEAPONS, PROJECTILES, getWeapon } from '../../shared/weapons.js';
import { ENEMY_TYPES } from '../../shared/enemies.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { BulletSystem } from '../systems/BulletSystem.js';
import { BarricadeSystem } from '../systems/BarricadeSystem.js';
import { WaveUI } from '../ui/WaveUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { PassiveShopUI } from '../ui/PassiveShopUI.js';
import { GoldUI } from '../ui/GoldUI.js';
import { FONT, FONT_HEAD, COLORS, preloadTheme } from '../ui/theme.js';

const ROOM = { x: 32, y: 32, width: 1216, height: 656 };
export const PLAYER_W = 36;
export const PLAYER_H = 48;
const SPEED = 220;
const SPEED_BOOTS = 275; // +25%

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
    preloadTheme(this);

    // All 40 enemy sprites and hit sounds
    for (const e of ENEMY_TYPES) {
      this.load.image(`e_${e.id}`, `assets/sprites/e_${e.id}.png`);
      this.load.audio(`sfx_ouch_${e.id}`, `assets/sounds/sfx_ouch_${e.id}.wav`);
    }

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
    this.passives = new Set();
    this._kills = 0;
    this._maxWave = 0;

    this.createRoom();

    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    // Inset by 3px so the 36px sprite stays fully inside the room borders
    this.physics.world.setBounds(ROOM.x + 3, ROOM.y + 3, ROOM.width - 6, ROOM.height - 6);

    // Dash (Shift)
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.dashCooldownUntil = 0;
    this.dashActiveUntil = 0;
    this.dashVx = 0;
    this.dashVy = 0;

    // Grenade throw (Q)
    this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // Escape closes all open shop/ability windows
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      if (this.shopUI?.isOpen) this.shopUI.hide();
      if (this.passiveShopUI?.isOpen) this.passiveShopUI.hide();
    });

    this.enemySystem = new EnemySystem(this);
    this.enemySystem.init(this.socket);

    this.bulletSystem = new BulletSystem(this);
    this.bulletSystem.init(this.socket, () => this.enemySystem.getEnemies());

    this.weaponSystem = new WeaponSystem(this, this.socket, this.myName);
    this.weaponSystem.init();

    // Escaped-enemy counter (top-right). Game over when it reaches the max.
    this.leakMax = 10;
    this.leakText = this.add.text(1260, 18, 'Escaped: 0 / 10', {
      fontSize: '22px',
      color: COLORS.red,
      fontFamily: FONT,
    }).setOrigin(1, 0).setDepth(100);

    this.waveUI = new WaveUI(this);
    this.waveUI.init(this.socket);

    this.shopUI = new ShopUI(this, this.socket);
    this.shopUI.init();

    this.passiveShopUI = new PassiveShopUI(this, this.socket);
    this.passiveShopUI.init();

    this.barricadeSystem = new BarricadeSystem(this, this.socket);
    this.barricadeSystem.init();

    this.goldUI = new GoldUI(this);
    this.goldUI.init(this.socket, this.socket.id);

    // Track passives for speed/cooldown effects
    this.socket.socket.on('passiveResult', ({ success, passives }) => {
      if (success && passives) passives.forEach(id => this.passives.add(id));
    });

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
        this.scene.start('LobbyScene', {
          socket: this.socket,
          myName: this.myName,
          gameResult: { waves: this._maxWave, kills: this._kills, name: this.myName },
        });
      },
      waveStart: ({ waveNumber }) => {
        if (waveNumber > this._maxWave) this._maxWave = waveNumber;
        // Clear blood decals from the previous wave.
        this.enemySystem?.clearBlood();
      },
      enemyDied: ({ killedBy }) => {
        if (killedBy === this.localId) this._kills++;
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
    s.on('waveStart', this._handlers.waveStart);
    s.on('enemyDied', this._handlers.enemyDied);

    // Tear everything down cleanly when the scene stops (return to lobby).
    this.events.once('shutdown', () => this.cleanup());
  }

  showGameOver() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    this.playSfx('sfx_gameover', 0.6);

    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setDepth(199);
    this.add.text(640, 332, 'GAME OVER', {
      fontSize: '64px',
      color: COLORS.red,
      fontFamily: FONT_HEAD,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(200);
    this.add.text(640, 412, 'Too many enemies escaped - returning to lobby...', {
      fontSize: '24px',
      color: COLORS.white,
      fontFamily: FONT,
    }).setOrigin(0.5).setDepth(200);

    // Client-side fallback: return to lobby after 5s even if server event is lost
    this.time.delayedCall(5000, () => {
      if (this.scene.isActive('GameScene')) {
        this.scene.start('LobbyScene', {
          socket: this.socket,
          myName: this.myName,
          gameResult: { waves: this._maxWave, kills: this._kills, name: this.myName },
        });
      }
    });
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
      s.off('waveStart', this._handlers.waveStart);
      s.off('enemyDied', this._handlers.enemyDied);
      s.off('passiveResult');
    }
    this.gameMusic?.stop();
    this.enemySystem?.destroy();
    this.bulletSystem?.destroy();
    this.weaponSystem?.destroy();
    this.barricadeSystem?.destroy();
    this.waveUI?.destroy();
    this.shopUI?.destroy();
    this.passiveShopUI?.destroy();
    this.goldUI?.destroy();
  }

  createRoom() {
    const bg = this.add.graphics().setDepth(0);

    // Sky gradient: light azure at top → warm horizon
    for (let y = 0; y < 260; y++) {
      const t = y / 260;
      const r = Math.round(Phaser.Math.Linear(0x87, 0xff, t));
      const g = Math.round(Phaser.Math.Linear(0xce, 0xe0, t));
      const b = Math.round(Phaser.Math.Linear(0xeb, 0xa0, t));
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, 1280, 1);
    }

    // Ocean: deep blue at horizon, lighter at shore
    for (let y = 260; y < 420; y++) {
      const t = (y - 260) / 160;
      const r = Math.round(Phaser.Math.Linear(0x00, 0x1e, t));
      const g = Math.round(Phaser.Math.Linear(0x80, 0xa0, t));
      const b = Math.round(Phaser.Math.Linear(0xc8, 0xff, t));
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, 1280, 1);
    }

    // Sandy beach
    for (let y = 420; y < 720; y++) {
      const t = (y - 420) / 300;
      const r = Math.round(Phaser.Math.Linear(0xf5, 0xc2, t));
      const g = Math.round(Phaser.Math.Linear(0xdc, 0x9a, t));
      const b = Math.round(Phaser.Math.Linear(0x9a, 0x5a, t));
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, 1280, 1);
    }

    // Gentle wave lines on the ocean
    const waves = this.add.graphics().setDepth(1);
    waves.lineStyle(2, 0xffffff, 0.35);
    for (let i = 0; i < 6; i++) {
      const wy = 290 + i * 22;
      waves.beginPath();
      for (let x = 0; x <= 1280; x += 4) {
        const sx = x / 1280;
        const waveY = wy + Math.sin(sx * Math.PI * 8 + i) * 3;
        if (x === 0) waves.moveTo(x, waveY); else waves.lineTo(x, waveY);
      }
      waves.strokePath();
    }

    // Palm trees — drawn procedurally
    this._drawPalm(bg,  80, 400, -0.25, 1.0);
    this._drawPalm(bg, 220, 420,  0.15, 0.85);
    this._drawPalm(bg, 1160, 410, 0.2, 1.0);
    this._drawPalm(bg, 1020, 430, -0.1, 0.9);
    this._drawPalm(bg,  600, 395,  0.05, 0.8);

    // Sparse sand pebbles / texture dots
    const sand = this.add.graphics().setDepth(1);
    const rng = Phaser.Math.RND;
    for (let i = 0; i < 180; i++) {
      const px = rng.between(0, 1280);
      const py = rng.between(430, 710);
      const shade = rng.between(0xb0, 0xcc);
      sand.fillStyle((shade << 16) | (shade << 8) | (shade - 30), 0.5);
      sand.fillCircle(px, py, rng.between(1, 3));
    }

    // Dark vignette on the outer border strip
    const gfx = this.add.graphics().setDepth(3);
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillRect(0, 0, 1280, ROOM.y);                         // top
    gfx.fillRect(0, ROOM.y + ROOM.height, 1280, ROOM.y);      // bottom
    gfx.fillRect(0, 0, ROOM.x, 720);                          // left
    gfx.fillRect(ROOM.x + ROOM.width, 0, ROOM.x, 720);        // right

    // Room border
    gfx.lineStyle(3, 0x4caf50, 0.7);
    gfx.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
  }

  // Draw a procedural palm tree on gfx at (cx, cy).
  // lean: trunk lean angle in radians (positive = right), scale: size multiplier.
  _drawPalm(gfx, cx, cy, lean, scale) {
    const trunkH = 110 * scale;
    const segments = 12;
    // Trunk — slightly curved brownish segments
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = cx + Math.sin(lean * t0) * trunkH * t0;
      const y0 = cy - t0 * trunkH;
      const x1 = cx + Math.sin(lean * t1) * trunkH * t1;
      const y1 = cy - t1 * trunkH;
      const shade = 0x5a3810 + i * 0x020100;
      gfx.fillStyle(shade, 1);
      gfx.fillRect(x0 - 5 * scale, y0, 10 * scale, (y0 - y1) + 1);
    }

    // Fronds — 7 leaves fanning out from the top
    const topX = cx + Math.sin(lean) * trunkH;
    const topY = cy - trunkH;
    const frondCount = 7;
    for (let f = 0; f < frondCount; f++) {
      const baseAngle = -Math.PI / 2 + lean;
      const spread = Math.PI * 1.3;
      const angle = baseAngle - spread / 2 + (f / (frondCount - 1)) * spread;
      const frondLen = (45 + Math.random() * 20) * scale;
      const ex = topX + Math.cos(angle) * frondLen;
      const ey = topY + Math.sin(angle) * frondLen;
      // Main stem
      gfx.lineStyle(Math.round(3 * scale), 0x2d6a1a, 1);
      gfx.beginPath();
      gfx.moveTo(topX, topY);
      gfx.lineTo(ex, ey);
      gfx.strokePath();
      // Leaf blades (pairs along the stem)
      for (let l = 0.3; l <= 0.9; l += 0.25) {
        const lx = topX + Math.cos(angle) * frondLen * l;
        const ly = topY + Math.sin(angle) * frondLen * l;
        const perpAngle = angle + Math.PI / 2;
        const leafLen = 14 * scale * (1 - l * 0.4);
        gfx.fillStyle(0x3a8a1e, 0.9);
        const pts = [
          { x: lx, y: ly },
          { x: lx + Math.cos(perpAngle) * leafLen, y: ly + Math.sin(perpAngle) * leafLen },
          { x: lx + Math.cos(angle) * leafLen * 0.5, y: ly + Math.sin(angle) * leafLen * 0.5 },
        ];
        gfx.fillPoints(pts, true);
        const pts2 = [
          { x: lx, y: ly },
          { x: lx - Math.cos(perpAngle) * leafLen, y: ly - Math.sin(perpAngle) * leafLen },
          { x: lx + Math.cos(angle) * leafLen * 0.5, y: ly + Math.sin(angle) * leafLen * 0.5 },
        ];
        gfx.fillPoints(pts2, true);
      }
    }

    // Coconuts
    gfx.fillStyle(0x8b4513, 1);
    gfx.fillCircle(topX - 5 * scale, topY + 4 * scale, 5 * scale);
    gfx.fillCircle(topX + 4 * scale, topY + 6 * scale, 4 * scale);
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
        fontSize: '18px',
        color: isLocal ? COLORS.green : COLORS.blue,
        fontFamily: FONT,
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
    const now = Date.now();

    // ── Q key: throw grenade toward mouse cursor (if owned) ─────────────────
    if (Phaser.Input.Keyboard.JustDown(this.qKey) && !this.gameEnded) {
      if (this.weaponSystem.ownsWeapon('grenade') && !this.shopUI?.isOpen) {
        const ptr = this.input.activePointer;
        this.socket.socket.emit('throwGrenade', {
          originX: this.localSprite.x,
          originY: this.localSprite.y,
          targetX: ptr.x,
          targetY: ptr.y,
        });
        this.playShotSound?.('energy', true);
      }
    }

    // ── Shift: dash in movement direction (1.5 s cooldown, 140 ms burst) ───
    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && now > this.dashCooldownUntil && !this.gameEnded) {
      let dx = (this.wasd.right.isDown ? 1 : 0) - (this.wasd.left.isDown ? 1 : 0);
      let dy = (this.wasd.down.isDown  ? 1 : 0) - (this.wasd.up.isDown   ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        this.dashVx = (dx / len) * 700;
        this.dashVy = (dy / len) * 700;
        this.dashActiveUntil   = now + 140;
        this.dashCooldownUntil = now + 1500;
        this.localSprite.setAlpha(0.35);
        this.tweens.add({ targets: this.localSprite, alpha: 1, duration: 220 });
      }
    }

    body.setVelocity(0);

    const currentSpeed = this.passives.has('boots') ? SPEED_BOOTS : SPEED;
    if (now < this.dashActiveUntil) {
      body.setVelocity(this.dashVx, this.dashVy);
    } else {
      if (this.wasd.left.isDown) body.setVelocityX(-currentSpeed);
      else if (this.wasd.right.isDown) body.setVelocityX(currentSpeed);

      if (this.wasd.up.isDown) body.setVelocityY(-currentSpeed);
      else if (this.wasd.down.isDown) body.setVelocityY(currentSpeed);
    }

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
    this.barricadeSystem?.update?.();
  }
}
