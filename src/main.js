import Phaser from 'phaser';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0c0c14',
  pixelArt: true,      // crisp nearest-neighbour scaling for the pixel-art set
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [LobbyScene, GameScene],
  parent: document.body,
};

// Wait for the bundled pixel fonts so Phaser measures glyphs correctly,
// then boot the game. Falls back after a short timeout if fonts are slow.
function start() {
  new Phaser.Game(config);
}

const fonts = [
  document.fonts.load("16px 'PressStart2P'"),
  document.fonts.load("16px 'VT323'"),
];
Promise.race([
  Promise.all(fonts).then(() => document.fonts.ready),
  new Promise((r) => setTimeout(r, 2500)),
]).then(start);
