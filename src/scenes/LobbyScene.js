import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager.js';
import { COLORS, BTN, preloadTheme, panel, heading, label, button } from '../ui/theme.js';

const W = 1280;
const H = 720;

function loadHighscores() {
  try { return JSON.parse(localStorage.getItem('jh2_scores') || '[]'); } catch { return []; }
}

function saveHighscore(entry) {
  const scores = loadHighscores();
  scores.push(entry);
  scores.sort((a, b) => b.waves - a.waves || b.kills - a.kills);
  scores.splice(5); // top 5
  localStorage.setItem('jh2_scores', JSON.stringify(scores));
}

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.playerItems = [];
  }

  init(data) {
    this.reusedSocket = data?.socket || null;
    this.reusedName = data?.myName || '';
    this.gameResult = data?.gameResult || null;
  }

  preload() {
    this.load.audio('music_lobby', 'assets/sounds/music_lobby.wav');
    this.load.image('jungle', 'assets/background/jungle.png');
    this.load.image('player', 'assets/sprites/player.png');
    preloadTheme(this);
  }

  create() {
    this.socket = this.reusedSocket || new SocketManager();
    this.myName = this.reusedName || '';
    this.players = [];
    this.gameInProgress = false;

    // Save score from last game
    if (this.gameResult && (this.gameResult.waves > 0 || this.gameResult.kills > 0)) {
      saveHighscore({
        name: this.gameResult.name,
        waves: this.gameResult.waves,
        kills: this.gameResult.kills,
        date: new Date().toLocaleDateString('sv-SE'),
      });
    }

    this.lobbyMusic = this.sound.add('music_lobby', { loop: true, volume: 0.3 });
    this.lobbyMusic.play();

    this.buildUI();

    // Show post-game stats overlay if we have meaningful data
    if (this.gameResult?.playerStats) {
      this._showStatsOverlay(this.gameResult);
    }

    if (this.myName) {
      this.nameText.setText(`Playing as: ${this.myName}`);
      this.nameText.setColor(COLORS.gold);
    }

    this.registerSocketEvents();
  }

  buildUI() {
    this.add.tileSprite(W / 2, H / 2, W, H, 'jungle');
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0e1a, 0.55);

    heading(this, W / 2, 68, 'JUNGLE HUNTER 2', { size: 36, color: COLORS.gold });
    this.add.image(W / 2 - 310, 68, 'player').setScale(1.0);
    this.add.image(W / 2 + 310, 68, 'player').setScale(1.0).setFlipX(true);

    // ── Controls panel (left) ────────────────────────────────────────────────
    const ctrlX = 190, ctrlY = H / 2 + 30, ctrlW = 300, ctrlH = 410;
    panel(this, ctrlX, ctrlY, ctrlW, ctrlH);
    heading(this, ctrlX, ctrlY - ctrlH / 2 + 30, 'KONTROLLER', { size: 14, color: COLORS.dim });
    this.add.rectangle(ctrlX, ctrlY - ctrlH / 2 + 52, ctrlW - 50, 2, 0x33406a);

    const controls = [
      ['WASD', 'Move'],
      ['SHIFT', 'Dash'],
      ['Q', 'Throw grenade'],
      ['LMB / SPACE', 'Shoot'],
      ['Scroll / 1-9', 'Switch weapon'],
      ['B', 'Weapon shop'],
      ['P', 'Passives'],
      ['V', 'Place barricade'],
      ['ESC', 'Close shop'],
    ];
    controls.forEach(([key, desc], i) => {
      const y = ctrlY - ctrlH / 2 + 76 + i * 36;
      label(this, ctrlX - 80, y, key, { size: 17, color: COLORS.gold, origin: [0, 0.5] });
      label(this, ctrlX + 20, y, desc, { size: 17, color: COLORS.dim, origin: [0, 0.5] });
    });

    // ── Lobby/player panel (center) ──────────────────────────────────────────
    const panelX = W / 2, panelY = H / 2 + 30, panelW = 480, panelH = 410;
    panel(this, panelX, panelY, panelW, panelH);

    heading(this, panelX, panelY - panelH / 2 + 30, 'LOBBY', { size: 16, color: COLORS.dim });
    this.add.rectangle(panelX, panelY - panelH / 2 + 52, panelW - 60, 2, 0x33406a);

    this.nameText = label(this, panelX, panelY - panelH / 2 + 80, 'Connecting...', {
      size: 20, color: COLORS.dim,
    });

    this.listStartY = panelY - panelH / 2 + 114;
    this.listX = panelX;
    this.panelW = panelW;

    const btnY = panelY + panelH / 2 - 44;
    this.startBtn = button(this, panelX, btnY, 300, 52, 'START GAME', {
      tint: BTN.green, fontSize: 16,
      onClick: () => { if (!this.gameInProgress) this.socket.emitStartGame(); },
    });

    // ── Highscore panel (right) ──────────────────────────────────────────────
    const hsX = W - 190, hsY = H / 2 + 30, hsW = 300, hsH = 410;
    panel(this, hsX, hsY, hsW, hsH);
    heading(this, hsX, hsY - hsH / 2 + 30, 'HIGHSCORE', { size: 14, color: COLORS.gold });
    this.add.rectangle(hsX, hsY - hsH / 2 + 52, hsW - 50, 2, 0x33406a);

    const scores = loadHighscores();
    if (scores.length === 0) {
      label(this, hsX, hsY - hsH / 2 + 90, 'No scores yet', { size: 16, color: COLORS.dim });
    } else {
      // Header
      label(this, hsX - 90, hsY - hsH / 2 + 70, 'Player', { size: 14, color: COLORS.dim, origin: [0, 0.5] });
      label(this, hsX + 50, hsY - hsH / 2 + 70, 'Wave', { size: 14, color: COLORS.dim, origin: [0.5, 0.5] });
      label(this, hsX + 100, hsY - hsH / 2 + 70, 'Kills', { size: 14, color: COLORS.dim, origin: [0.5, 0.5] });
      scores.forEach((s, i) => {
        const y = hsY - hsH / 2 + 96 + i * 52;
        const rowColor = i === 0 ? COLORS.gold : COLORS.white;
        label(this, hsX - 90, y - 8, `#${i + 1} ${s.name}`, { size: 16, color: rowColor, origin: [0, 0.5] });
        label(this, hsX - 90, y + 12, s.date, { size: 13, color: COLORS.dim, origin: [0, 0.5] });
        label(this, hsX + 50, y, `${s.waves}`, { size: 18, color: rowColor, origin: [0.5, 0.5] });
        label(this, hsX + 100, y, `${s.kills}`, { size: 18, color: rowColor, origin: [0.5, 0.5] });
      });
    }
  }

  registerSocketEvents() {
    this.socket.onAssignedName((name) => {
      this.myName = name;
      this.nameText.setText(`Playing as: ${name}`);
      this.nameText.setColor(COLORS.gold);
    });

    this.socket.onLobbyUpdate(({ players, gameInProgress }) => {
      this.players = players;
      this.gameInProgress = gameInProgress;
      this.refreshPlayerList();
      this.refreshButton();
    });

    this.socket.onGameStarted((playerList) => {
      this.socket.offLobby();
      this.lobbyMusic?.stop();
      this.scene.start('GameScene', { socket: this.socket, myName: this.myName, playerList });
    });

    // When reusing an existing connection (returning from a game), the initial
    // lobbyUpdate already fired before this scene existed — ask for it again.
    if (this.reusedSocket) this.socket.requestLobby();
  }

  refreshPlayerList() {
    this.playerItems.forEach((item) => item.destroy());
    this.playerItems = [];

    this.players.forEach((player, i) => {
      const y = this.listStartY + i * 38;
      const isMe = player.name === this.myName;

      const row = this.add.rectangle(this.listX, y, this.panelW - 70, 32, isMe ? 0x1c2c52 : 0x141a30, 0.85)
        .setStrokeStyle(1, isMe ? 0x3a5aa0 : 0x26304e);
      const dot = this.add.rectangle(this.listX - 110, y, 8, 8, isMe ? 0xe2b714 : 0x56aa4e);
      const name = label(this, this.listX - 92, y, `${player.name}${isMe ? '  (you)' : ''}`, {
        size: 22, color: isMe ? COLORS.gold : COLORS.white, origin: [0, 0.5],
      });

      this.playerItems.push(row, dot, name);
    });
  }

  refreshButton() {
    if (this.gameInProgress) {
      this.startBtn.setTint(BTN.gray).disable();
      this.startBtn.setText('WAITING...').setTextColor(COLORS.dim);
    } else {
      this.startBtn.setTint(BTN.green).enable();
      this.startBtn.setText('START GAME').setTextColor(COLORS.white);
    }
  }

  _showStatsOverlay(result) {
    const stats = result.playerStats;
    const playerIds = Object.keys(stats);
    const panelH = Math.min(420, 120 + playerIds.length * 80);
    const cx = W / 2, cy = H / 2;

    const elements = [];

    const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.7).setDepth(300);
    const panelRect = this.add.rectangle(cx, cy, 600, panelH, 0x0a0e1a, 0.97)
      .setStrokeStyle(2, 0x334488).setDepth(301);
    elements.push(overlay, panelRect);

    elements.push(this.add.text(cx, cy - panelH / 2 + 30, 'GAME OVER — STATS', {
      fontSize: '22px', color: COLORS.gold, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(302));

    elements.push(this.add.text(cx, cy - panelH / 2 + 58, `Waves reached: ${result.waves}`, {
      fontSize: '16px', color: COLORS.white, fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(302));

    // Header row
    const hdrY = cy - panelH / 2 + 88;
    [['Player', -200], ['Kills', 20], ['Damage', 120], ['Gold', 220]].forEach(([txt, dx]) => {
      elements.push(this.add.text(cx + dx, hdrY, txt, {
        fontSize: '13px', color: COLORS.dim, fontFamily: 'monospace',
      }).setOrigin(0, 0.5).setDepth(302));
    });

    playerIds.forEach((id, i) => {
      const s = stats[id];
      const rowY = hdrY + 30 + i * 70;
      const isMe = s.name === this.reusedName;
      const color = isMe ? COLORS.gold : COLORS.white;
      elements.push(
        this.add.text(cx - 200, rowY, s.name + (isMe ? ' (you)' : ''), {
          fontSize: '17px', color, fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setDepth(302),
        this.add.text(cx + 20,  rowY, `${s.kills}`,      { fontSize: '17px', color, fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(302),
        this.add.text(cx + 120, rowY, `${s.damage}`,     { fontSize: '17px', color, fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(302),
        this.add.text(cx + 220, rowY, `${s.goldEarned}g`, { fontSize: '17px', color, fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(302),
      );
    });

    elements.push(this.add.text(cx, cy + panelH / 2 - 22, 'Auto-closing in 8 seconds — click to dismiss', {
      fontSize: '12px', color: COLORS.dim, fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(302));

    const dismiss = () => elements.forEach(e => e?.destroy());
    overlay.setInteractive().on('pointerdown', dismiss);
    this.time.delayedCall(8000, dismiss);
  }
}
