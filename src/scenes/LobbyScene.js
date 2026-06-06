import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager.js';

const W = 1280;
const H = 720;
const BG = 0x1a1a2e;
const PANEL_BG = 0x16213e;
const ACCENT = 0x0f3460;
const GREEN = 0x4caf50;
const GRAY = 0x555555;
const WHITE = '#ffffff';
const GRAY_TEXT = '#888888';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.playerItems = [];
  }

  create() {
    this.socket = new SocketManager();
    this.myName = '';
    this.players = [];
    this.gameInProgress = false;

    this.buildUI();
    this.registerSocketEvents();
  }

  buildUI() {
    this.add.rectangle(W / 2, H / 2, W, H, BG);

    this.add.text(W / 2, 80, 'JUNGLE HUNTER 2', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#e2b714',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const panelX = W / 2;
    const panelY = H / 2 + 20;
    const panelW = 500;
    const panelH = 400;
    this.add.rectangle(panelX, panelY, panelW, panelH, PANEL_BG, 0.95).setStrokeStyle(2, ACCENT);

    this.add.text(panelX, panelY - panelH / 2 + 30, 'LOBBY', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.rectangle(panelX, panelY - panelH / 2 + 55, panelW - 40, 1, 0x333355);

    this.nameText = this.add.text(panelX, panelY - panelH / 2 + 85, 'Ansluter...', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.listStartY = panelY - panelH / 2 + 120;
    this.listX = panelX;
    this.panelW = panelW;

    const btnY = panelY + panelH / 2 - 45;
    this.btnBg = this.add.rectangle(panelX, btnY, 300, 52, GREEN).setInteractive({ useHandCursor: true });
    this.btnText = this.add.text(panelX, btnY, 'START GAME', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: WHITE,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.btnBg.on('pointerdown', () => {
      if (!this.gameInProgress) this.socket.emitStartGame();
    });
    this.btnBg.on('pointerover', () => {
      if (!this.gameInProgress) this.btnBg.setFillStyle(0x66bb6a);
    });
    this.btnBg.on('pointerout', () => this.refreshButton());
  }

  registerSocketEvents() {
    this.socket.onAssignedName((name) => {
      this.myName = name;
      this.nameText.setText(`Du spelar som: ${name}`);
      this.nameText.setColor('#e2b714');
    });

    this.socket.onLobbyUpdate(({ players, gameInProgress }) => {
      this.players = players;
      this.gameInProgress = gameInProgress;
      this.refreshPlayerList();
      this.refreshButton();
    });

    this.socket.onGameStarted((playerList) => {
      this.socket.offLobby();
      this.scene.start('GameScene', { socket: this.socket, myName: this.myName, playerList });
    });
  }

  refreshPlayerList() {
    this.playerItems.forEach((item) => item.destroy());
    this.playerItems = [];

    this.players.forEach((player, i) => {
      const y = this.listStartY + i * 36;
      const isMe = player.name === this.myName;

      const row = this.add.rectangle(this.listX, y, this.panelW - 60, 30, isMe ? 0x0f3460 : 0x1e1e3f, 0.8);
      const dot = this.add.circle(this.listX - 100, y, 5, isMe ? 0xe2b714 : 0x4caf50);
      const label = this.add.text(this.listX - 85, y, `${player.name}${isMe ? '  (dig)' : ''}`, {
        fontSize: '16px',
        color: isMe ? '#e2b714' : WHITE,
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      this.playerItems.push(row, dot, label);
    });
  }

  refreshButton() {
    if (this.gameInProgress) {
      this.btnBg.setFillStyle(GRAY).disableInteractive();
      this.btnText.setText('WAITING FOR GAME TO FINISH');
      this.btnText.setFontSize(13);
      this.btnText.setColor(GRAY_TEXT);
    } else {
      this.btnBg.setFillStyle(GREEN).setInteractive({ useHandCursor: true });
      this.btnText.setText('START GAME');
      this.btnText.setFontSize(20);
      this.btnText.setColor(WHITE);
    }
  }
}
