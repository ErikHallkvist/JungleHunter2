import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager.js';
import { COLORS, BTN, preloadTheme, panel, heading, label, button } from '../ui/theme.js';

const W = 1280;
const H = 720;

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.playerItems = [];
  }

  init(data) {
    // When returning from a finished game we reuse the existing connection.
    this.reusedSocket = data?.socket || null;
    this.reusedName = data?.myName || '';
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

    this.lobbyMusic = this.sound.add('music_lobby', { loop: true, volume: 0.3 });
    this.lobbyMusic.play();

    this.buildUI();

    // Show our name straight away when reusing (assignedName won't fire again).
    if (this.myName) {
      this.nameText.setText(`Playing as: ${this.myName}`);
      this.nameText.setColor(COLORS.gold);
    }

    this.registerSocketEvents();
  }

  buildUI() {
    // Tiled jungle background + dark scrim for readability.
    this.add.tileSprite(W / 2, H / 2, W, H, 'jungle');
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0e1a, 0.55);

    // Title with a little hunter sprite either side.
    heading(this, W / 2, 84, 'JUNGLE HUNTER 2', { size: 40, color: COLORS.gold });
    this.add.image(W / 2 - 320, 84, 'player').setScale(1.1);
    this.add.image(W / 2 + 320, 84, 'player').setScale(1.1).setFlipX(true);

    const panelX = W / 2;
    const panelY = H / 2 + 30;
    const panelW = 520;
    const panelH = 410;
    panel(this, panelX, panelY, panelW, panelH);

    heading(this, panelX, panelY - panelH / 2 + 34, 'LOBBY', { size: 18, color: COLORS.dim });
    this.add.rectangle(panelX, panelY - panelH / 2 + 58, panelW - 60, 2, 0x33406a);

    this.nameText = label(this, panelX, panelY - panelH / 2 + 88, 'Connecting...', {
      size: 22, color: COLORS.dim,
    });

    this.listStartY = panelY - panelH / 2 + 124;
    this.listX = panelX;
    this.panelW = panelW;

    const btnY = panelY + panelH / 2 - 48;
    this.startBtn = button(this, panelX, btnY, 320, 56, 'START GAME', {
      tint: BTN.green, fontSize: 18,
      onClick: () => { if (!this.gameInProgress) this.socket.emitStartGame(); },
    });
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
}
