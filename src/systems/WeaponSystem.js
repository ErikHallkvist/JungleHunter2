export class WeaponSystem {
  constructor(scene, socket, myName) {
    this.scene = scene;
    this.socket = socket;
    this.myName = myName;
    this.currentWeapon = null;
    this.lastFireTime = 0;
    this.fireRates = null;
    this.localPlayerSprite = null;
  }

  init() {
    this.currentWeapon = 'handgun';
    this.lastFireTime = 0;
    this.fireRates = { handgun: 333, shotgun: 1000 };

    this.scene.input.on('pointerdown', () => this.tryShoot());

    this.socket.socket.on('weaponEquipped', ({ playerId, weaponId }) => {
      if (playerId === this.socket.socket.id) {
        this.equipWeapon(weaponId);
      }
    });
  }

  tryShoot() {
    if (!this.localPlayerSprite) return;

    const now = Date.now();
    const cooldown = this.fireRates[this.currentWeapon];
    if (now - this.lastFireTime < cooldown) return;

    this.lastFireTime = now;

    this.socket.socket.emit('playerShoot', {
      weaponType: this.currentWeapon,
      originX: this.localPlayerSprite.x,
      originY: this.localPlayerSprite.y,
    });
  }

  setLocalPlayerSprite(sprite) {
    this.localPlayerSprite = sprite;
  }

  equipWeapon(weaponType) {
    this.currentWeapon = weaponType;

    const notif = this.scene.add
      .text(640, 150, `Equipped: ${weaponType}!`, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.scene.tweens.add({
      targets: notif,
      alpha: 0,
      delay: 1500,
      duration: 400,
      onComplete: () => notif.destroy(),
    });
  }

  getCurrentWeapon() {
    return this.currentWeapon;
  }

  destroy() {
    this.scene.input.off('pointerdown');
    this.socket.socket.off('weaponEquipped');
  }
}
