"""Generate the jungle background tile + pixel UI textures (panel, button).

Panels/buttons are authored for Phaser NineSlice: small corner size, hard
2px outline, light top-left bevel, dark bottom-right bevel, flat fill.
The button is intentionally neutral so it can be tinted per state in code.
"""
import os, random
from PIL import Image
from pixelkit import Canvas, RAMPS, OUTLINE

SPR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites')
BG = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'background')

PANEL_FILL = (26, 30, 54)
PANEL_FILL2 = (20, 24, 44)
PANEL_LIGHT = (74, 96, 150)
PANEL_DARK = (14, 16, 32)


def jungle_tile(size=64):
    """Seamless dark jungle-floor tile, dithered pixel style."""
    rng = random.Random(7)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    base = (24, 40, 28)
    dk = (18, 30, 22)
    lt = (34, 54, 36)
    px = img.load()
    # base + ordered-ish dither
    for y in range(size):
        for x in range(size):
            r = rng.random()
            c = base
            if (x + y) % 7 == 0 and r < 0.5:
                c = dk
            elif r < 0.12:
                c = lt
            elif r < 0.20:
                c = dk
            px[x, y] = c + (255,)

    def leaf(cx, cy, col, col2):
        # simple pointed leaf, wraps around edges
        for dy in range(-5, 6):
            half = 4 - abs(dy) // 2
            for dx in range(-half, half + 1):
                xx = (cx + dx) % size
                yy = (cy + dy) % size
                px[xx, yy] = (col if dx <= 0 else col2) + (255,)
            # midrib
            px[cx % size, (cy + dy) % size] = col2 + (255,)

    leafcols = [((30, 64, 34), (40, 80, 44)), ((26, 52, 30), (34, 66, 40)),
                ((44, 74, 36), (56, 92, 46))]
    for _ in range(10):
        lc = rng.choice(leafcols)
        leaf(rng.randint(0, size - 1), rng.randint(0, size - 1), lc[0], lc[1])
    # a few pebbles
    for _ in range(8):
        cx, cy = rng.randint(0, size - 1), rng.randint(0, size - 1)
        col = (60, 60, 66)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            px[(cx + dx) % size, (cy + dy) % size] = col + (255,)
        px[cx, cy] = (84, 84, 92, 255)
    # darken overall slightly for contrast with sprites
    for y in range(size):
        for x in range(size):
            r, g, b, a = px[x, y]
            px[x, y] = (int(r * 0.85), int(g * 0.85), int(b * 0.85), 255)
    return img.resize((size * 2, size * 2), Image.NEAREST)


def panel(corner=8, fill=PANEL_FILL, fill2=PANEL_FILL2):
    """NineSlice-ready panel; total size corner*3 so middle slice = corner."""
    s = corner * 3
    c = Canvas(s, s)
    # fill (two-tone vertical for subtle depth)
    for y in range(s):
        for x in range(s):
            c.put(x, y, (fill if y < s // 2 else fill2) + (255,))
    # outline (2px)
    for t in range(2):
        for x in range(t, s - t):
            c.put(x, t, OUTLINE); c.put(x, s - 1 - t, OUTLINE)
        for y in range(t, s - t):
            c.put(t, y, OUTLINE); c.put(s - 1 - t, y, OUTLINE)
    # inner bevel: light top/left, dark bottom/right
    for x in range(2, s - 2):
        c.put(x, 2, PANEL_LIGHT + (255,))
        c.put(x, s - 3, PANEL_DARK + (255,))
    for y in range(2, s - 2):
        c.put(2, y, PANEL_LIGHT + (255,))
        c.put(s - 3, y, PANEL_DARK + (255,))
    return c.to_image(2)


def button(corner=6, fill=(150, 156, 172)):
    """Neutral light button for NineSlice; tinted per state at runtime."""
    s = corner * 3
    c = Canvas(s, s)
    for y in range(s):
        shade = fill if y < s - 3 else tuple(int(v * 0.7) for v in fill)
        top = tuple(min(255, int(v * 1.18)) for v in fill)
        for x in range(s):
            c.put(x, y, (top if y < 3 else shade) + (255,))
    for t in range(2):
        for x in range(t, s - t):
            c.put(x, t, OUTLINE); c.put(x, s - 1 - t, OUTLINE)
        for y in range(t, s - t):
            c.put(t, y, OUTLINE); c.put(s - 1 - t, y, OUTLINE)
    return c.to_image(2)


def main():
    os.makedirs(BG, exist_ok=True)
    jungle_tile(64).save(os.path.join(BG, 'jungle.png'))
    panel().save(os.path.join(SPR, 'ui_panel.png'))
    panel(corner=6, fill=(16, 20, 38), fill2=(12, 15, 30)).save(os.path.join(SPR, 'ui_panel_dark.png'))
    button().save(os.path.join(SPR, 'ui_button.png'))
    print('generated background + ui_panel + ui_panel_dark + ui_button')


if __name__ == '__main__':
    main()
