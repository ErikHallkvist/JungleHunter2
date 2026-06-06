// ─────────────────────────────────────────────────────────────────────────────
//  Shared UI theme — one pixel-art look for every menu, panel and button.
//  FONT_HEAD (Press Start 2P) is used for titles & buttons; FONT (VT323) for
//  body text. Panels and buttons are pixel NineSlice textures so they scale
//  crisply with the rest of the art.
// ─────────────────────────────────────────────────────────────────────────────

export const FONT = 'VT323';            // readable pixel font for body/HUD text
export const FONT_HEAD = 'PressStart2P'; // chunky pixel font for titles/buttons

export const COLORS = {
  gold: '#f0c020',
  green: '#7ddc6a',
  white: '#f4f4f8',
  dim: '#8aa0b8',
  red: '#ff6a5a',
  blue: '#9ad0ff',
};

// Button tints (multiplied over the neutral light button texture).
export const BTN = {
  green: 0x56aa4e,
  gold: 0xe2b714,
  blue: 0x2e6fb0,
  gray: 0x44485a,
  red: 0xc4403a,
};

const PANEL_CORNER = 16;   // texture corner size in px (ui_panel)
const BTN_CORNER = 12;     // texture corner size in px (ui_button)

// Load the shared UI textures. Call from a scene's preload().
export function preloadTheme(scene) {
  scene.load.image('ui_panel', 'assets/sprites/ui_panel.png');
  scene.load.image('ui_panel_dark', 'assets/sprites/ui_panel_dark.png');
  scene.load.image('ui_button', 'assets/sprites/ui_button.png');
}

// A pixel panel (centered at x,y). Returns the NineSlice game object.
export function panel(scene, x, y, w, h, { dark = false, depth = 0 } = {}) {
  const tex = dark ? 'ui_panel_dark' : 'ui_panel';
  const ns = scene.add.nineslice(
    x, y, tex, undefined, w, h, PANEL_CORNER, PANEL_CORNER, PANEL_CORNER, PANEL_CORNER
  );
  ns.setDepth(depth);
  return ns;
}

// A pixel heading text object.
export function heading(scene, x, y, text, { size = 24, color = COLORS.gold } = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_HEAD, fontSize: `${size}px`, color,
  }).setOrigin(0.5);
}

// A pixel body text object.
export function label(scene, x, y, text, { size = 22, color = COLORS.white, origin = 0.5 } = {}) {
  const t = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color });
  if (Array.isArray(origin)) t.setOrigin(origin[0], origin[1]); else t.setOrigin(origin);
  return t;
}

// A pixel button. Returns a controller exposing the parts + state helpers.
export function button(scene, x, y, w, h, text, opts = {}) {
  const {
    tint = BTN.green, fontSize = 16, color = COLORS.white,
    onClick = null, depth = 0,
  } = opts;

  const bg = scene.add.nineslice(
    x, y, 'ui_button', undefined, w, h, BTN_CORNER, BTN_CORNER, BTN_CORNER, BTN_CORNER
  ).setDepth(depth).setTint(tint);

  const txt = scene.add.text(x, y, text, {
    fontFamily: FONT_HEAD, fontSize: `${fontSize}px`, color,
  }).setOrigin(0.5).setDepth(depth + 1);

  const ctrl = {
    bg, txt, baseTint: tint, enabled: true,
    setTint(t) { ctrl.baseTint = t; bg.setTint(t); return ctrl; },
    setText(s) { txt.setText(s); return ctrl; },
    setTextColor(c) { txt.setColor(c); return ctrl; },
    setVisible(v) { bg.setVisible(v); txt.setVisible(v); return ctrl; },
    setDepth(d) { bg.setDepth(d); txt.setDepth(d + 1); return ctrl; },
    enable() {
      ctrl.enabled = true;
      bg.setTint(ctrl.baseTint).setInteractive({ useHandCursor: true });
      return ctrl;
    },
    disable() {
      ctrl.enabled = false;
      bg.disableInteractive();
      return ctrl;
    },
    destroy() { bg.destroy(); txt.destroy(); },
  };

  const lighten = (c) => {
    const r = Math.min(255, ((c >> 16) & 0xff) + 30);
    const g = Math.min(255, ((c >> 8) & 0xff) + 30);
    const b = Math.min(255, (c & 0xff) + 30);
    return (r << 16) | (g << 8) | b;
  };

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => { if (ctrl.enabled) bg.setTint(lighten(ctrl.baseTint)); });
  bg.on('pointerout', () => { if (ctrl.enabled) bg.setTint(ctrl.baseTint); });
  if (onClick) bg.on('pointerdown', () => { if (ctrl.enabled) onClick(); });

  return ctrl;
}
