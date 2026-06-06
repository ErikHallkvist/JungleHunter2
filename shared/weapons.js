// ─────────────────────────────────────────────────────────────────────────────
//  JungleHunter2 — Shared weapon definitions
//  Single source of truth, imported by both the Node.js server and the client.
//
//  Balance principle: cheaper weapons are weak, every step up costs more gold
//  but gives more power (damage, fire rate, projectiles, projectile speed).
//  Some high-tier weapons are single-target specialists (huge per-shot damage
//  + very fast projectiles) instead of raw DPS.
//
//  fireRate = cooldown in milliseconds between shots (lower = faster)
//  speed    = projectile speed in px/s
//  pellets  = number of projectiles fired per shot
//  spreadDeg= total spread angle in degrees across the pellets (0 = perfectly straight)
// ─────────────────────────────────────────────────────────────────────────────

export const WEAPONS = [
  // ── Starter ────────────────────────────────────────────────────────────────
  {
    id: 'pistol', name: 'Pistol', price: 0, tier: 'Starter',
    damage: 12, fireRate: 350, speed: 800, pellets: 1, spreadDeg: 0,
    bulletType: 'bullet', icon: 'w_pistol',
    desc: 'Standardpistol. Pålitlig men svag.',
  },

  // ── Cheap ────────────────────────────────────────────────────────────────────
  {
    id: 'revolver', name: 'Revolver', price: 70, tier: 'Sidearm',
    damage: 26, fireRate: 520, speed: 880, pellets: 1, spreadDeg: 0,
    bulletType: 'heavy', icon: 'w_revolver',
    desc: 'Tung kaliber, hård träff men långsam.',
  },
  {
    id: 'smg', name: 'SMG', price: 130, tier: 'Automatic',
    damage: 9, fireRate: 120, speed: 820, pellets: 1, spreadDeg: 0,
    bulletType: 'bullet', icon: 'w_smg',
    desc: 'Spruta. Låg skada men eldar snabbt.',
  },
  {
    id: 'shotgun', name: 'Shotgun', price: 190, tier: 'Shotgun',
    damage: 10, fireRate: 720, speed: 720, pellets: 6, spreadDeg: 55,
    bulletType: 'pellet', icon: 'w_shotgun',
    desc: '6 hagel i en bred kon. Bäst på nära håll.',
  },

  // ── Mid ──────────────────────────────────────────────────────────────────────
  {
    id: 'burst_rifle', name: 'Burst Rifle', price: 260, tier: 'Rifle',
    damage: 18, fireRate: 200, speed: 920, pellets: 1, spreadDeg: 0,
    bulletType: 'bullet', icon: 'w_burst_rifle',
    desc: 'Snabb, träffsäker karbin.',
  },
  {
    id: 'assault_rifle', name: 'Assault Rifle', price: 350, tier: 'Rifle',
    damage: 16, fireRate: 140, speed: 920, pellets: 1, spreadDeg: 3,
    bulletType: 'bullet', icon: 'w_assault_rifle',
    desc: 'Helautomatiskt gevär. Allroundare.',
  },
  {
    id: 'double_barrel', name: 'Double Barrel', price: 460, tier: 'Shotgun',
    damage: 11, fireRate: 800, speed: 740, pellets: 8, spreadDeg: 50,
    bulletType: 'pellet', icon: 'w_double_barrel',
    desc: 'Dubbelpipig hagelbrakare. 8 hagel.',
  },
  {
    id: 'magnum', name: 'Magnum', price: 560, tier: 'Sidearm',
    damage: 65, fireRate: 500, speed: 980, pellets: 1, spreadDeg: 0,
    bulletType: 'heavy', icon: 'w_magnum',
    desc: 'Handkanon. Enorm skada per skott.',
  },

  // ── High ─────────────────────────────────────────────────────────────────────
  {
    id: 'tactical_smg', name: 'Tactical SMG', price: 680, tier: 'Automatic',
    damage: 13, fireRate: 100, speed: 880, pellets: 1, spreadDeg: 2,
    bulletType: 'bullet', icon: 'w_tactical_smg',
    desc: 'Förfinad spruta. Hög eldhastighet.',
  },
  {
    id: 'combat_shotgun', name: 'Combat Shotgun', price: 820, tier: 'Shotgun',
    damage: 12, fireRate: 550, speed: 760, pellets: 7, spreadDeg: 45,
    bulletType: 'pellet', icon: 'w_combat_shotgun',
    desc: 'Stridshagelgevär. Snabbare än vanliga.',
  },
  {
    id: 'marksman', name: 'Marksman Rifle', price: 980, tier: 'Rifle',
    damage: 70, fireRate: 450, speed: 1100, pellets: 1, spreadDeg: 0,
    bulletType: 'heavy', icon: 'w_marksman',
    desc: 'Prickskyttegevär. Snabba, hårda skott.',
  },
  {
    id: 'lmg', name: 'Light Machine Gun', price: 1150, tier: 'Automatic',
    damage: 20, fireRate: 90, speed: 920, pellets: 1, spreadDeg: 4,
    bulletType: 'bullet', icon: 'w_lmg',
    desc: 'Kulspruta. Brutal, uthållig eldkraft.',
  },

  // ── Elite ────────────────────────────────────────────────────────────────────
  {
    id: 'sniper', name: 'Sniper Rifle', price: 1350, tier: 'Rifle',
    damage: 140, fireRate: 850, speed: 1400, pellets: 1, spreadDeg: 0,
    bulletType: 'rail', icon: 'w_sniper',
    desc: 'Krossar nästan allt med ett skott.',
  },
  {
    id: 'auto_shotgun', name: 'Auto Shotgun', price: 1600, tier: 'Shotgun',
    damage: 14, fireRate: 320, speed: 800, pellets: 8, spreadDeg: 48,
    bulletType: 'pellet', icon: 'w_auto_shotgun',
    desc: 'Helautomatiskt hagelgevär. Förödande.',
  },
  {
    id: 'plasma_rifle', name: 'Plasma Rifle', price: 1900, tier: 'Energy',
    damage: 40, fireRate: 130, speed: 760, pellets: 1, spreadDeg: 0,
    bulletType: 'plasma', icon: 'w_plasma_rifle',
    desc: 'Skjuter glödande plasmaklot.',
  },
  {
    id: 'pulse_rifle', name: 'Pulse Rifle', price: 2300, tier: 'Energy',
    damage: 34, fireRate: 90, speed: 880, pellets: 1, spreadDeg: 0,
    bulletType: 'plasma', icon: 'w_pulse_rifle',
    desc: 'Snabbpulserande energigevär.',
  },

  // ── Legendary ────────────────────────────────────────────────────────────────
  {
    id: 'railgun', name: 'Railgun', price: 2800, tier: 'Energy',
    damage: 220, fireRate: 900, speed: 1800, pellets: 1, spreadDeg: 0,
    bulletType: 'rail', icon: 'w_railgun',
    desc: 'Hyperaccelererad slug. Genomborrar allt.',
  },
  {
    id: 'flak_cannon', name: 'Flak Cannon', price: 3400, tier: 'Shotgun',
    damage: 24, fireRate: 480, speed: 820, pellets: 10, spreadDeg: 55,
    bulletType: 'pellet', icon: 'w_flak_cannon',
    desc: '10 splitter i en vägg av metall.',
  },
  {
    id: 'laser_minigun', name: 'Laser Minigun', price: 4200, tier: 'Energy',
    damage: 24, fireRate: 50, speed: 1200, pellets: 1, spreadDeg: 3,
    bulletType: 'laser', icon: 'w_laser_minigun',
    desc: 'Roterande laser. Oavbruten dödsstråle.',
  },
  {
    id: 'devastator', name: 'Devastator', price: 6000, tier: 'Legendary',
    damage: 160, fireRate: 350, speed: 900, pellets: 3, spreadDeg: 18,
    bulletType: 'energy', icon: 'w_devastator',
    desc: 'Det ultimata vapnet. 3 förintelseklot.',
  },
];

// Projectile visuals + hitbox sizes (client rendering & collision).
export const PROJECTILES = {
  bullet: { sprite: 'p_bullet', w: 20, h: 7 },
  pellet: { sprite: 'p_pellet', w: 11, h: 11 },
  heavy:  { sprite: 'p_heavy',  w: 24, h: 10 },
  plasma: { sprite: 'p_plasma', w: 18, h: 18 },
  rail:   { sprite: 'p_rail',   w: 36, h: 8 },
  laser:  { sprite: 'p_laser',  w: 28, h: 6 },
  energy: { sprite: 'p_energy', w: 28, h: 28 },
};

const WEAPON_MAP = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function getWeapon(id) {
  return WEAPON_MAP[id] || WEAPON_MAP['pistol'];
}

// Everything except the free starter is purchasable in the shop.
export function shopWeapons() {
  return WEAPONS.filter((w) => w.price > 0);
}
