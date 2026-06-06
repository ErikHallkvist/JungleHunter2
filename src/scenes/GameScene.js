import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Ladda resurser här (bilder, ljud, etc.)
  }

  create() {
    this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'JungleHunter2',
      { fontSize: '48px', color: '#ffffff' }
    ).setOrigin(0.5);
  }

  update() {
    // Spellogik uppdateras här varje frame
  }
}
