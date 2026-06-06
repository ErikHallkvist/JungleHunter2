import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [GameScene],
  parent: document.body,
};

new Phaser.Game(config);
