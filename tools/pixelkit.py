"""
Shared pixel-art toolkit for JungleHunter2 asset generation.

Everything is drawn on a small low-resolution grid with a single hard
1px outline and a tight, shared palette, then nearest-neighbour upscaled.
That single convention is what makes the whole game look like one
coherent pixel-art set instead of a pile of mismatched assets.
"""
from PIL import Image
import hashlib

# ── Shared palette ──────────────────────────────────────────────────────────
# A deliberately small, harmonious palette. Every sprite pulls from this so the
# game reads as one set. Each ramp is (dark, base, light).
OUTLINE = (26, 22, 34, 255)          # near-black warm outline used everywhere
TRANSPARENT = (0, 0, 0, 0)

RAMPS = {
    'green':   ((40, 92, 48),  (86, 170, 78),  (150, 222, 120)),
    'lime':    ((74, 110, 30), (140, 190, 60), (200, 235, 120)),
    'red':     ((120, 36, 40), (196, 64, 58),  (240, 128, 110)),
    'crimson': ((92, 20, 34),  (158, 38, 54),  (214, 80, 92)),
    'orange':  ((150, 70, 22), (232, 124, 40), (252, 192, 96)),
    'gold':    ((150, 110, 28),(226, 178, 38), (250, 224, 130)),
    'blue':    ((36, 60, 130), (66, 110, 200), (130, 180, 246)),
    'cyan':    ((30, 104, 120),(58, 178, 196), (150, 232, 240)),
    'purple':  ((70, 38, 116), (124, 74, 190), (188, 146, 240)),
    'magenta': ((118, 30, 96), (196, 60, 150), (240, 130, 206)),
    'brown':   ((78, 50, 28),  (130, 88, 50),  (186, 138, 90)),
    'tan':     ((120, 86, 46), (180, 140, 84), (226, 196, 140)),
    'gray':    ((70, 74, 88),  (120, 126, 144),(184, 190, 206)),
    'stone':   ((78, 78, 80),  (128, 128, 132),(184, 184, 190)),
    'bone':    ((150, 146, 128),(206, 202, 182),(244, 242, 228)),
    'ghost':   ((86, 110, 140),(150, 178, 208),(214, 232, 248)),
    'void':    ((30, 22, 52),  (58, 44, 96),    (108, 86, 168)),
    'teal':    ((26, 96, 90),  (44, 158, 146),  (130, 222, 210)),
    'pink':    ((158, 60, 110),(226, 104, 156), (250, 180, 210)),
    'ash':     ((54, 52, 64),  (92, 90, 108),   (150, 148, 168)),
}

EYE_WHITE = (245, 245, 255, 255)
EYE_DARK = (24, 20, 30, 255)


def rgba(c, a=255):
    if len(c) == 4:
        return c
    return (c[0], c[1], c[2], a)


class Canvas:
    """Low-res pixel grid with optional left/right mirror symmetry."""

    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.px = {}  # (x,y) -> rgba

    def put(self, x, y, color):
        x = int(round(x)); y = int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h and color is not None:
            self.px[(x, y)] = rgba(color)

    def mput(self, x, y, color):
        """Mirror put: draws at x and its horizontal mirror."""
        self.put(x, y, color)
        self.put(self.w - 1 - x, y, color)

    def get(self, x, y):
        return self.px.get((x, y))

    def rect(self, x0, y0, x1, y1, color, mirror=False):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                (self.mput if mirror else self.put)(x, y, color)

    def disc(self, cx, cy, r, color, mirror=False, squash=1.0):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                dx = (x - cx)
                dy = (y - cy) / squash
                if dx * dx + dy * dy <= r * r + r * 0.4:
                    (self.mput if mirror else self.put)(x, y, color)

    def line(self, x0, y0, x1, y1, color, mirror=False):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx = abs(x1 - x0); dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            (self.mput if mirror else self.put)(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def add_outline(self, color=OUTLINE):
        """Add a 1px outline around every opaque cluster (4-neighbour)."""
        edges = {}
        for (x, y) in list(self.px.keys()):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                           (1, 1), (1, -1), (-1, 1), (-1, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) not in self.px and 0 <= nx < self.w and 0 <= ny < self.h:
                    edges[(nx, ny)] = color
        self.px.update(edges)

    def to_image(self, scale, size=None):
        img = Image.new('RGBA', (self.w, self.h), TRANSPARENT)
        for (x, y), c in self.px.items():
            img.putpixel((x, y), c)
        img = img.resize((self.w * scale, self.h * scale), Image.NEAREST)
        if size and img.size != size:
            img = img.resize(size, Image.NEAREST)
        return img


def seed_of(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)
