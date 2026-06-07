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
import { ChatUI } from '../ui/ChatUI.js';
import { KillFeedUI } from '../ui/KillFeedUI.js';
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
    this.chatMessages = data.chatMessages || [];
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
    this._damageDealt = 0;
    this._goldEarned = 0;

    this.createRoom();
    this.createPlayerAnimations();

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

    // Revive downed teammate (F)
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.fKey.on('down', () => {
      if (!this.localSprite || this.gameEnded) return;
      const local = this.players[this.localId];
      if (local?.downed) return;
      for (const [id, p] of Object.entries(this.players)) {
        if (id === this.localId || !p.downed) continue;
        if (Math.hypot(p.sprite.x - this.localSprite.x, p.sprite.y - this.localSprite.y) < 80) {
          this.socket.socket.emit('revivePlayer', { targetId: id });
          break;
        }
      }
    });

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

    this.chatUI = new ChatUI(this.socket, this.myName, this.chatMessages);

    this.killFeedUI = new KillFeedUI(this);
    this.killFeedUI.init(this.socket, this.socket.socket.id);

    // Track passives for speed/cooldown effects
    this._passiveResultHandler = ({ success, passives }) => {
      if (success && passives) passives.forEach(id => this.passives.add(id));
    };
    this.socket.socket.on('passiveResult', this._passiveResultHandler);

    // Track damage dealt for end-of-game stats
    this._hitConfirmedHandler = ({ damage }) => { this._damageDealt += damage; };
    this.socket.socket.on('hitConfirmed', this._hitConfirmedHandler);

    // Track gold earned
    this._goldUpdateHandler = ({ playerId, gained }) => {
      if (playerId === this.socket.socket.id && gained > 0) this._goldEarned += gained;
    };
    this.socket.socket.on('goldUpdate', this._goldUpdateHandler);

    // "DOWNED" overlay for the local player
    this.downedText = this.add.text(640, 360, 'DOWNED\n[F] teammate can revive you\nRespawns next wave', {
      fontSize: '28px', color: '#ff4444', fontFamily: FONT_HEAD,
      stroke: '#000000', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(200).setAlpha(0);

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
          if (!p.downed) {
            if (x < p.sprite.x) p.sprite.setFlipX(true);
            else if (x > p.sprite.x) p.sprite.setFlipX(false);
            if (!p.sprite.anims.isPlaying) p.sprite.play('player_walk');
            clearTimeout(p._stopAnimTimer);
            p._stopAnimTimer = setTimeout(() => {
              if (p.sprite?.active) { p.sprite.stop(); p.sprite.setFrame(0); }
            }, 300);
          }
          p.sprite.setPosition(x, y);
          p.nameText.setPosition(x, y - PLAYER_H / 2 - 8);
          const barY = y + PLAYER_H / 2 + 6;
          p.hpBarBg.setPosition(x, barY);
          p.hpBarFg.setPosition(x - 17, barY);
          this.positionWeapon(p);
        }
      },
      gamePlayerLeft: (id) => {
        const p = this.players[id];
        if (p) {
          clearTimeout(p._stopAnimTimer);
          p.sprite.destroy();
          p.nameText.destroy();
          p.weaponSprite?.destroy();
          p.hpBarBg?.destroy();
          p.hpBarFg?.destroy();
          delete this.players[id];
        }
      },
      playerDamaged: ({ id, hp, maxHp }) => {
        const p = this.players[id];
        if (!p) return;
        p.hp = hp; p.maxHp = maxHp;
        this._updateHpBar(p);
      },
      playerDowned: ({ id }) => {
        const p = this.players[id];
        if (!p) return;
        p.downed = true;
        p.hp = 0;
        this._updateHpBar(p);
        p.sprite.setAlpha(0.35);
        if (p.sprite.anims.isPlaying) { p.sprite.stop(); p.sprite.setFrame(0); }
        if (id === this.localId) this.downedText?.setAlpha(1);
      },
      playerRevived: ({ id, hp }) => {
        const p = this.players[id];
        if (!p) return;
        p.downed = false;
        p.hp = hp;
        this._updateHpBar(p);
        p.sprite.setAlpha(1);
        if (id === this.localId) this.downedText?.setAlpha(0);
      },
      // A player (anyone) changed their active weapon — update the visible gun.
      onWeaponChange: ({ playerId, weaponId }) => this.setPlayerWeapon(playerId, weaponId),
      leakUpdate: ({ escaped, max }) => {
        this.leakMax = max;
        this.leakText?.setText(`Escaped: ${escaped} / ${max}`);
      },
      enemyLeaked: () => this.playSfx('sfx_leak', 0.5),
      gameOver: () => this.showGameOver(),
      returnToLobby: ({ playerStats, wavesReached } = {}) => {
        const chatMessages = this.chatUI?.getMessages() ?? [];
        this.scene.start('LobbyScene', {
          socket: this.socket,
          myName: this.myName,
          chatMessages,
          gameResult: {
            waves: wavesReached ?? this._maxWave,
            kills: this._kills,
            name: this.myName,
            damage: this._damageDealt,
            goldEarned: this._goldEarned,
            playerStats,
          },
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
    s.on('playerDamaged', this._handlers.playerDamaged);
    s.on('playerDowned', this._handlers.playerDowned);
    s.on('playerRevived', this._handlers.playerRevived);

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
        const chatMessages = this.chatUI?.getMessages() ?? [];
        this.scene.start('LobbyScene', {
          socket: this.socket,
          myName: this.myName,
          chatMessages,
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
      s.off('playerDamaged', this._handlers.playerDamaged);
      s.off('playerDowned', this._handlers.playerDowned);
      s.off('playerRevived', this._handlers.playerRevived);
      s.off('passiveResult', this._passiveResultHandler);
      s.off('hitConfirmed', this._hitConfirmedHandler);
      s.off('goldUpdate', this._goldUpdateHandler);
    }
    this.downedText?.destroy();
    this.gameMusic?.stop();
    this.enemySystem?.destroy();
    this.bulletSystem?.destroy();
    this.weaponSystem?.destroy();
    this.barricadeSystem?.destroy();
    this.waveUI?.destroy();
    this.shopUI?.destroy();
    this.passiveShopUI?.destroy();
    this.goldUI?.destroy();
    // ChatUI is destroyed only when we're NOT handing it off to LobbyScene.
    // The returnToLobby handler calls getMessages() then scene.start(), which
    // triggers shutdown before chatUI can be destroyed here — so guard by check.
    if (this.chatUI) { this.chatUI.destroy(); this.chatUI = null; }
    this.killFeedUI?.destroy();
  }

  createRoom() {
    const bg = this.add.graphics().setDepth(0);
    const rng = Phaser.Math.RND;

    // Overcast winter sky
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const r = Math.round(Phaser.Math.Linear(0x8a, 0xcc, t));
      const g = Math.round(Phaser.Math.Linear(0xa8, 0xde, t));
      const b = Math.round(Phaser.Math.Linear(0xcc, 0xf2, t));
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, 1280, 1);
    }

    // Distant frozen mountain silhouettes at horizon
    bg.fillStyle(0xa0bcd0, 1);
    const peaks = [
      [0, 200, 110, 115, 220, 200],
      [180, 200, 300, 90,  430, 200],
      [390, 200, 510, 120, 620, 200],
      [580, 200, 700, 82,  820, 200],
      [780, 200, 900, 100, 1020, 200],
      [980, 200, 1100, 118, 1230, 200],
      [1150, 200, 1260, 95, 1380, 200],
    ];
    for (const [x0, y0, x1, y1, x2, y2] of peaks) {
      bg.fillTriangle(x0, y0, x1, y1, x2, y2);
    }
    // Snow caps on each peak
    bg.fillStyle(0xeef5ff, 1);
    for (const [, , x1, y1] of peaks) {
      bg.fillTriangle(x1 - 14, y1 + 20, x1, y1, x1 + 14, y1 + 20);
    }

    // Ice/snow ground — pale blue-white gradient
    for (let y = 200; y < 720; y++) {
      const t = (y - 200) / 520;
      const r = Math.round(Phaser.Math.Linear(0xd0, 0xe8, t));
      const g = Math.round(Phaser.Math.Linear(0xe4, 0xf4, t));
      const b = Math.round(Phaser.Math.Linear(0xf4, 0xff, t));
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, 1280, 1);
    }

    // Ice crack network
    const cracks = this.add.graphics().setDepth(1);
    for (let i = 0; i < 40; i++) {
      cracks.lineStyle(1, 0x6a9fbe, rng.frac() * 0.3 + 0.12);
      let cx = rng.between(0, 1280);
      let cy = rng.between(210, 720);
      cracks.beginPath();
      cracks.moveTo(cx, cy);
      for (let s = 0; s < rng.between(2, 5); s++) {
        cx += rng.between(-90, 90);
        cy = Phaser.Math.Clamp(cy + rng.between(-40, 40), 210, 720);
        cracks.lineTo(cx, cy);
      }
      cracks.strokePath();
    }

    // Snow drifts
    const drifts = this.add.graphics().setDepth(1);
    for (let i = 0; i < 14; i++) {
      const dx = rng.between(40, 1240);
      const dy = rng.between(260, 700);
      const dw = rng.between(50, 190);
      const dh = rng.between(7, 24);
      drifts.fillStyle(0xffffff, 0.72);
      drifts.fillEllipse(dx, dy, dw, dh);
      drifts.fillStyle(0xffffff, 0.38);
      drifts.fillEllipse(dx - dw * 0.08, dy - dh * 0.25, dw * 0.55, dh * 0.5);
    }

    // Frozen ponds — slightly darker blue ice patches
    const ponds = this.add.graphics().setDepth(1);
    for (let i = 0; i < 5; i++) {
      const px = rng.between(80, 1200);
      const py = rng.between(280, 640);
      const pw = rng.between(70, 160);
      const ph = rng.between(25, 55);
      ponds.fillStyle(0x8ab8d8, 0.3);
      ponds.fillEllipse(px, py, pw, ph);
      ponds.lineStyle(1, 0x5a90b8, 0.45);
      ponds.strokeEllipse(px, py, pw, ph);
    }

    // Ice sparkle dots
    const sparkles = this.add.graphics().setDepth(1);
    for (let i = 0; i < 90; i++) {
      sparkles.fillStyle(0xffffff, rng.frac() * 0.55 + 0.1);
      sparkles.fillCircle(rng.between(0, 1280), rng.between(200, 720), 1);
    }
  }

  createPlayerAnimations() {
    const FW = PLAYER_W;
    const FH = PLAYER_H;
    const FRAMES = 4;

    const canvas = document.createElement('canvas');
    canvas.width = FW * FRAMES;
    canvas.height = FH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let f = 0; f < FRAMES; f++) {
      this._drawPlayerFrame(ctx, f * FW, 0, f);
    }

    this.textures.addSpriteSheet('player_walk', canvas, {
      frameWidth: FW,
      frameHeight: FH,
    });

    this.anims.create({
      key: 'player_walk',
      frames: this.anims.generateFrameNumbers('player_walk', { start: 0, end: FRAMES - 1 }),
      frameRate: 8,
      repeat: -1,
    });
  }

  // Draw one frame of the pixel-art walking character onto a 2D canvas context.
  // frame 0/2 = neutral stance; frame 1 = left foot forward; frame 3 = right foot forward.
  _drawPlayerFrame(ctx, ox, oy, frame) {
    const bodyDY    = (frame % 2 === 1) ? -1 : 0;
    const leftLegDY  = frame === 1 ? -4 : frame === 3 ?  4 : 0;
    const rightLegDY = frame === 1 ?  4 : frame === 3 ? -4 : 0;
    const leftArmDY  = frame === 1 ?  3 : frame === 3 ? -3 : 0;
    const rightArmDY = frame === 1 ? -3 : frame === 3 ?  3 : 0;
    const by = oy + bodyDY;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,20,50,0.22)';
    ctx.beginPath();
    ctx.ellipse(ox + 18, oy + 46, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#1a0e05';
    ctx.fillRect(ox + 8,  by + 38 + leftLegDY,  8, 7);
    ctx.fillRect(ox + 20, by + 38 + rightLegDY, 8, 7);
    ctx.fillStyle = '#2c1808';
    ctx.fillRect(ox + 8,  by + 38 + leftLegDY,  8, 2);
    ctx.fillRect(ox + 20, by + 38 + rightLegDY, 8, 2);

    // Pants
    ctx.fillStyle = '#263848';
    ctx.fillRect(ox + 9,  by + 26 + leftLegDY,  8, 14);
    ctx.fillRect(ox + 19, by + 26 + rightLegDY, 8, 14);
    ctx.fillStyle = '#32495e';
    ctx.fillRect(ox + 9,  by + 26 + leftLegDY,  3, 12);
    ctx.fillRect(ox + 19, by + 26 + rightLegDY, 3, 12);

    // Jacket body
    ctx.fillStyle = '#b83e14';
    ctx.fillRect(ox + 8, by + 14, 20, 14);
    ctx.fillStyle = '#8a2e0c';
    ctx.fillRect(ox + 17, by + 15, 2, 12);
    ctx.fillStyle = '#cc4c1c';
    ctx.fillRect(ox + 9,  by + 14, 7, 4);
    ctx.fillRect(ox + 20, by + 14, 7, 4);

    // Arms
    ctx.fillStyle = '#b83e14';
    ctx.fillRect(ox + 2,  by + 15 + leftArmDY,  7, 14);
    ctx.fillRect(ox + 27, by + 15 + rightArmDY, 7, 14);
    ctx.fillStyle = '#cc4c1c';
    ctx.fillRect(ox + 2,  by + 15 + leftArmDY,  2, 12);
    ctx.fillRect(ox + 27, by + 15 + rightArmDY, 2, 12);

    // Hands
    ctx.fillStyle = '#c89060';
    ctx.fillRect(ox + 2,  by + 27 + leftArmDY,  6, 4);
    ctx.fillRect(ox + 28, by + 27 + rightArmDY, 6, 4);

    // Neck
    ctx.fillStyle = '#d8a070';
    ctx.fillRect(ox + 15, by + 11, 6, 4);

    // Head — pixel-art oval built from rects + arc
    ctx.fillStyle = '#e8b878';
    ctx.beginPath();
    ctx.ellipse(ox + 18, by + 7, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ox + 11, by + 3, 14, 9);

    // Hair
    ctx.fillStyle = '#2c180a';
    ctx.fillRect(ox + 10, by + 0, 16, 6);
    ctx.fillRect(ox + 10, by + 0, 4,  10);
    ctx.fillRect(ox + 22, by + 0, 4,  10);
    ctx.fillStyle = '#3e2210';
    ctx.fillRect(ox + 13, by + 0, 10, 2);

    // Eyes
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(ox + 13, by + 6, 3, 3);
    ctx.fillRect(ox + 20, by + 6, 3, 3);
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(ox + 14, by + 7, 2, 2);
    ctx.fillRect(ox + 21, by + 7, 2, 2);

    // Nose
    ctx.fillStyle = '#b88050';
    ctx.fillRect(ox + 17, by + 9, 2, 1);

    // Mouth
    ctx.fillStyle = '#b86840';
    ctx.fillRect(ox + 15, by + 11, 5, 1);
  }

  spawnPlayer(playerData) {
    const isLocal = playerData.name === this.myName;

    let sprite;
    if (isLocal) {
      sprite = this.physics.add.sprite(playerData.x, playerData.y, 'player_walk', 0);
      sprite.setDisplaySize(PLAYER_W, PLAYER_H);
      sprite.body.setSize(PLAYER_W - 6, PLAYER_H - 6);
      sprite.body.setCollideWorldBounds(true);
      this.localSprite = sprite;
      this.localId = playerData.id;
      this.weaponSystem.setLocalPlayerSprite(sprite);
    } else {
      sprite = this.add.sprite(playerData.x, playerData.y, 'player_walk', 0);
      sprite.setDisplaySize(PLAYER_W, PLAYER_H);
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

    // HP bar (background + foreground), positioned below the sprite
    const barY = playerData.y + PLAYER_H / 2 + 6;
    const hpBarBg = this.add.rectangle(playerData.x, barY, 34, 4, 0x222222, 0.85).setDepth(11);
    const hpBarFg = this.add.rectangle(playerData.x - 17, barY, 34, 4, 0x44ff88, 1)
      .setOrigin(0, 0.5).setDepth(12);

    const entry = {
      sprite, nameText, weaponSprite, isLocal,
      hpBarBg, hpBarFg,
      hp: playerData.hp ?? 100, maxHp: playerData.maxHp ?? 100,
      downed: false,
    };
    this.players[playerData.id] = entry;
    this.positionWeapon(entry);
    this._updateHpBar(entry);
  }

  _updateHpBar(entry) {
    const ratio = entry.maxHp > 0 ? Math.max(0, entry.hp / entry.maxHp) : 0;
    const barW = 34;
    entry.hpBarFg.setSize(barW * ratio, 4);
    const color = ratio > 0.5 ? 0x44ff88 : ratio > 0.25 ? 0xffaa22 : 0xff3333;
    entry.hpBarFg.setFillStyle(color);
  }

  isLocalPlayerDowned() { return !!this.players[this.localId]?.downed; }

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

    // Suppress all game input while the chat box is focused.
    if (this.chatUI?.isFocused) {
      this.enemySystem.update();
      this.bulletSystem.update(delta);
      this.localSprite.body.setVelocity(0);
      return;
    }

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

    const local = this.players[this.localId];

    // When downed: freeze in place, disable shooting
    if (local?.downed) {
      this.enemySystem.update();
      this.bulletSystem.update(delta);
      return;
    }

    const currentSpeed = this.passives.has('boots') ? SPEED_BOOTS : SPEED;
    if (now < this.dashActiveUntil) {
      body.setVelocity(this.dashVx, this.dashVy);
    } else {
      if (this.wasd.left.isDown) body.setVelocityX(-currentSpeed);
      else if (this.wasd.right.isDown) body.setVelocityX(currentSpeed);

      if (this.wasd.up.isDown) body.setVelocityY(-currentSpeed);
      else if (this.wasd.down.isDown) body.setVelocityY(currentSpeed);
    }

    const moving = body.velocity.x !== 0 || body.velocity.y !== 0;

    if (local) {
      local.nameText.setPosition(
        this.localSprite.x,
        this.localSprite.y - PLAYER_H / 2 - 8
      );
      const barY = this.localSprite.y + PLAYER_H / 2 + 6;
      local.hpBarBg.setPosition(this.localSprite.x, barY);
      local.hpBarFg.setPosition(this.localSprite.x - 17, barY);
      this.positionWeapon(local);

      if (body.velocity.x < 0) local.sprite.setFlipX(true);
      else if (body.velocity.x > 0) local.sprite.setFlipX(false);

      if (moving && !local._moving) local.sprite.play('player_walk');
      else if (!moving && local._moving) { local.sprite.stop(); local.sprite.setFrame(0); }
      local._moving = moving;
    }
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
