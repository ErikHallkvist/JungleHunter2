import { getWeapon } from '../../shared/weapons.js';

export class WeaponSystem {
  constructor(scene, socket, myName) {
    this.scene = scene;
    this.socket = socket;
    this.myName = myName;
    this.currentWeapon = 'pistol';
    this.ownedWeapons = ['pistol'];
    this.lastFireTime = 0;
    this.localPlayerSprite = null;
    this.hudText = null;
  }

  init() {
    this.currentWeapon = 'pistol';
    this.ownedWeapons = ['pistol'];
    this.lastFireTime = 0;

    this.scene.input.on('pointerdown', () => this.tryShoot());

    // Mouse wheel cycles through owned weapons.
    this.scene.input.on('wheel', (_p, _o, _dx, dy) => {
      this.cycle(dy > 0 ? 1 : -1);
    });

    // Number keys 1-9 = quick-select owned weapon slots.
    this.scene.input.keyboard.on('keydown', (e) => {
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= 9) this.selectIndex(n - 1);
    });

    // Keep the owned list in sync with the shop.
    this.socket.socket.on('purchaseResult', ({ success, weaponId, weapons }) => {
      if (!success) return;
      if (weapons) this.ownedWeapons = weapons.slice();
      else if (!this.ownedWeapons.includes(weaponId)) this.ownedWeapons.push(weaponId);
    });
    this.socket.socket.on('weaponEquipped', ({ playerId, weaponId }) => {
      if (playerId === this.socket.socket.id && !this.ownedWeapons.includes(weaponId)) {
        this.ownedWeapons.push(weaponId);
      }
    });

    // Current-weapon HUD (bottom centre).
    this.hudText = this.scene.add.text(640, 695, '', {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 1).setDepth(100);
    this.updateHud();
  }

  cycle(dir) {
    if (this.scene.shopUI?.isOpen) return;
    if (this.ownedWeapons.length <= 1) return;
    let idx = this.ownedWeapons.indexOf(this.currentWeapon);
    idx = (idx + dir + this.ownedWeapons.length) % this.ownedWeapons.length;
    this.switchTo(this.ownedWeapons[idx]);
  }

  selectIndex(i) {
    if (i < this.ownedWeapons.length) this.switchTo(this.ownedWeapons[i]);
  }

  switchTo(weaponId) {
    if (weaponId === this.currentWeapon) return;
    this.currentWeapon = weaponId;
    this.updateHud();
    // Tell the server (which broadcasts so other players see the new gun).
    this.socket.socket.emit('switchWeapon', { weaponId });
  }

  tryShoot() {
    if (!this.localPlayerSprite) return;
    if (this.scene.shopUI?.isOpen) return; // don't fire while shopping

    const now = Date.now();
    const cooldown = getWeapon(this.currentWeapon).fireRate;
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

  // Called when the server confirms our active weapon changed.
  equipWeapon(weaponType) {
    this.currentWeapon = weaponType;
    if (!this.ownedWeapons.includes(weaponType)) this.ownedWeapons.push(weaponType);
    this.updateHud();

    const w = getWeapon(weaponType);
    const notif = this.scene.add
      .text(640, 150, `Utrustad: ${w.name}!`, {
        fontSize: '20px',
        color: '#ffe27a',
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

  updateHud() {
    if (!this.hudText) return;
    const w = getWeapon(this.currentWeapon);
    const idx = this.ownedWeapons.indexOf(this.currentWeapon) + 1;
    this.hudText.setText(`[${idx}] ${w.name}  (hjul/siffror för att byta)`);
  }

  getCurrentWeapon() {
    return this.currentWeapon;
  }

  destroy() {
    this.scene.input.off('pointerdown');
    this.scene.input.off('wheel');
    this.socket.socket.off('purchaseResult');
    this.socket.socket.off('weaponEquipped');
    this.hudText?.destroy();
  }
}
