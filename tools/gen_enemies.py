"""Generate all 40 enemy sprites + player + generic fallback in one pixel style.

Grid is 20x26, upscaled x2 -> 40x52 (matches EnemySystem display size).
Symmetry is about the vertical centre so creatures stay clean and readable.
"""
import os, random
from pixelkit import Canvas, RAMPS, OUTLINE, EYE_WHITE, EYE_DARK, seed_of

W, H = 20, 26
SCALE = 2
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites')

# id -> (archetype, ramp, feature flags)
ENEMIES = {
    'slime':      ('blob',     'green',   {'eyes': 2, 'drip': True}),
    'rat':        ('critter',  'gray',    {'ears': 'round', 'tail': True, 'snout': True}),
    'bat':        ('flyer',    'purple',  {'wings': 'bat', 'small': True, 'ears': 'bat'}),
    'frog':       ('blob',     'lime',    {'eyes': 2, 'wide': True, 'legs': 'frog'}),
    'snake':      ('serpent',  'green',   {}),
    'spider':     ('insect',   'crimson', {'legs': 8, 'round': True}),
    'beetle':     ('insect',   'teal',    {'legs': 6, 'shell': True, 'horn': True}),
    'wolf':       ('beast',    'gray',    {'ears': 'point', 'tail': True}),
    'boar':       ('beast',    'brown',   {'tusks': True, 'snout': True}),
    'lizard':     ('beast',    'lime',    {'low': True, 'tail': True, 'crest': True}),
    'imp':        ('humanoid', 'red',     {'horns': True, 'small': True, 'wings': 'bat'}),
    'mushroom':   ('blob',     'magenta', {'cap': True, 'eyes': 2}),
    'crab':       ('insect',   'orange',  {'claws': True, 'wide': True, 'legs': 6}),
    'scorpion':   ('insect',   'purple',  {'claws': True, 'sting': True, 'legs': 6}),
    'hawk':       ('flyer',    'tan',     {'wings': 'bird', 'beak': True}),
    'panther':    ('beast',    'void',    {'ears': 'point', 'tail': True, 'sleek': True}),
    'golem':      ('humanoid', 'stone',   {'blocky': True, 'big': True}),
    'wraith':     ('ghost',    'ghost',   {'tatter': True}),
    'troll':      ('humanoid', 'green',   {'hunch': True, 'big': True, 'tusks': True}),
    'harpy':      ('flyer',    'tan',     {'wings': 'bird', 'humanoid': True}),
    'wyvern':     ('flyer',    'crimson', {'wings': 'bat', 'dragon': True}),
    'mantis':     ('insect',   'lime',    {'tall': True, 'scythes': True, 'legs': 4}),
    'cyclops':    ('humanoid', 'tan',     {'oneeye': True, 'big': True}),
    'minotaur':   ('humanoid', 'brown',   {'horns': True, 'big': True, 'snout': True}),
    'phoenix':    ('flyer',    'orange',  {'wings': 'bird', 'fire': True, 'beak': True}),
    'ghoul':      ('humanoid', 'teal',    {'thin': True, 'undead': True}),
    'elemental':  ('blob',     'cyan',    {'eyes': 2, 'energy': True}),
    'hydra':      ('serpent',  'teal',    {'heads': 3}),
    'kraken':     ('blob',     'purple',  {'tentacles': True, 'eyes': 2}),
    'banshee':    ('ghost',    'cyan',    {'hair': True, 'scream': True}),
    'chimera':    ('beast',    'orange',  {'mane': True, 'tail': True, 'big': True}),
    'vampire':    ('humanoid', 'crimson', {'cape': True, 'fangs': True}),
    'lich':       ('humanoid', 'bone',    {'robe': True, 'skull': True, 'crown': True}),
    'titan':      ('humanoid', 'stone',   {'blocky': True, 'big': True, 'crown': True}),
    'demon':      ('humanoid', 'red',     {'horns': True, 'wings': 'bat', 'big': True}),
    'dragon':     ('flyer',    'green',   {'wings': 'bat', 'dragon': True, 'big': True}),
    'undead':     ('humanoid', 'ash',     {'big': True, 'undead': True, 'blocky': True}),
    'void_beast': ('blob',     'void',    {'tentacles': True, 'eyes': 3, 'energy': True}),
    'ancient':    ('blob',     'magenta', {'tentacles': True, 'eyes': 3, 'eldritch': True}),
    'overlord':   ('humanoid', 'gold',    {'big': True, 'crown': True, 'cape': True}),
}


def eyes(c, ramp, cx_list, ey, glow=None):
    """Draw glowing eyes at given x columns (not mirrored — pass explicit cols)."""
    for cx in cx_list:
        c.put(cx, ey, glow or EYE_WHITE)
        c.put(cx, ey, glow or EYE_WHITE)


def shaded_blob(c, dark, base, light, cx, cy, rx, ry):
    """Filled squashed ellipse with top highlight / bottom shadow."""
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            if dx * dx + dy * dy <= 1.05:
                if y <= cy - ry * 0.4:
                    col = light
                elif y >= cy + ry * 0.45:
                    col = dark
                else:
                    col = base
                c.put(x, y, col + (255,))


def draw_eyes_pair(c, ramp, cx, ey, spread=3, glow=None):
    g = glow or (RAMPS[ramp][2][0] + 60, 40, 40, 255) if False else None
    for sx in (cx - spread, cx + spread):
        c.put(sx, ey, EYE_WHITE)
        c.put(sx, ey - 1, (200, 210, 230, 255))


def make_enemy(eid, arche, ramp, f):
    c = Canvas(W, H)
    dark, base, light = RAMPS[ramp]
    cx = W // 2  # 10; use mirror about 9.5 via mput
    rng = random.Random(seed_of(eid))
    ground = 24

    def body_blob(top, bot, rx_top, rx_bot):
        for y in range(top, bot + 1):
            t = (y - top) / max(1, (bot - top))
            rx = int(round(rx_top + (rx_bot - rx_top) * t))
            for x in range(cx - rx, cx):
                col = light if y < top + 2 else (dark if y > bot - 2 else base)
                c.mput(x, y, col + (255,))

    # ── Archetypes ──────────────────────────────────────────────────────────
    if arche == 'blob':
        big = f.get('cap') or f.get('tentacles')
        top, bot = 7, ground
        if f.get('wide'):
            top = 9
        rx_top = 6 if not f.get('cap') else 8
        rx_bot = 8
        # mushroom: cap on top, stem body
        if f.get('cap'):
            # stem
            for y in range(15, ground + 1):
                for x in range(cx - 3, cx):
                    col = light if y < 17 else (dark if y > ground - 1 else (220, 210, 200))
                    c.mput(x, y, (220, 212, 198, 255) if col != light else (240, 236, 228, 255))
            # cap (ramp colour)
            shaded_blob(c, dark, base, light, cx, 10, 9, 5)
            # spots
            for _ in range(5):
                sx = rng.randint(cx - 7, cx + 7); sy = rng.randint(7, 12)
                c.put(sx, sy, (245, 240, 235, 255))
            ey = 18
            c.put(cx - 2, ey, EYE_DARK); c.put(cx + 2, ey, EYE_DARK)
        else:
            shaded_blob(c, dark, base, light, cx, (top + bot) // 2, rx_bot, (bot - top) // 2)
            if f.get('legs') == 'frog':
                for sx in (cx - 7, cx + 6):
                    c.put(sx, ground, dark + (255,)); c.put(sx, ground - 1, base + (255,))
            if f.get('tentacles'):
                for i, sx in enumerate(range(cx - 7, cx + 8, 3)):
                    yy = ground - 1 + (i % 2)
                    c.put(sx, yy, base + (255,)); c.put(sx, yy + 1, dark + (255,))
            n = f.get('eyes', 2)
            ey = (top + bot) // 2 - 1
            if n == 2:
                c.put(cx - 3, ey, EYE_WHITE); c.put(cx + 3, ey, EYE_WHITE)
                c.put(cx - 3, ey, EYE_DARK if f.get('eldritch') else EYE_WHITE)
                cols = [(cx - 3), (cx + 3)]
                for sx in cols:
                    c.put(sx, ey, EYE_WHITE); c.put(sx, ey + 1, EYE_DARK)
            else:
                for sx in (cx - 4, cx, cx + 4):
                    c.put(sx, ey, EYE_WHITE); c.put(sx, ey + 1, EYE_DARK)
            if f.get('drip'):
                c.put(cx + 4, bot + 1, base + (255,))
            if f.get('energy'):
                for _ in range(6):
                    sx = rng.randint(cx - 6, cx + 6); sy = rng.randint(top + 1, bot - 1)
                    c.put(sx, sy, light + (255,))

    elif arche == 'critter':
        # small ground animal: body + head + snout
        shaded_blob(c, dark, base, light, cx + 1, 18, 6, 4)   # body
        shaded_blob(c, dark, base, light, cx - 4, 15, 4, 4)   # head (to the left)
        # ears
        if f.get('ears') == 'round':
            c.put(cx - 6, 11, base + (255,)); c.put(cx - 6, 12, light + (255,))
            c.put(cx - 3, 11, base + (255,)); c.put(cx - 3, 12, light + (255,))
        # snout
        if f.get('snout'):
            c.put(cx - 8, 16, base + (255,)); c.put(cx - 9, 16, dark + (255,))
        # eye
        c.put(cx - 5, 14, EYE_DARK)
        # legs
        for sx in (cx - 2, cx + 4):
            c.put(sx, 22, dark + (255,))
        # tail
        if f.get('tail'):
            c.line(cx + 6, 18, cx + 9, 14, base, mirror=False)

    elif arche == 'serpent':
        heads = f.get('heads', 1)

        def coil(cxc, cyc, rr, thick):
            # a fat ring (coil loop) with shading
            for y in range(cyc - rr - thick, cyc + rr + thick + 1):
                for x in range(cxc - rr - thick, cxc + rr + thick + 1):
                    d2 = (x - cxc) ** 2 + (y - cyc) ** 2
                    if (rr - thick) ** 2 <= d2 <= (rr + thick) ** 2:
                        col = light if y < cyc - rr * 0.3 else (dark if y > cyc + rr * 0.4 else base)
                        c.put(x, y, col + (255,))

        if heads > 1:
            # hydra: a low coiled mound with several rising necks + heads
            coil(cx, 20, 4, 2)
            necks = [cx - 6, cx, cx + 6][:heads]
            for hx in necks:
                for y in range(7, 18):
                    nx = hx + (1 if hx < cx else (-1 if hx > cx else 0)) * ((17 - y) // 4)
                    c.put(nx, y, base + (255,)); c.put(nx + (1 if hx >= cx else -1), y, dark + (255,))
                shaded_blob(c, dark, base, light, hx, 6, 2, 2)
                c.put(hx - 1, 6, EYE_WHITE); c.put(hx + 1, 6, EYE_WHITE)
        else:
            # snake: stacked coils + a raised S-neck and head
            coil(cx + 1, 20, 5, 2)
            coil(cx - 1, 15, 4, 2)
            # neck rising to the left then head
            for i, (px, py) in enumerate([(cx - 4, 12), (cx - 5, 10), (cx - 4, 8), (cx - 2, 7)]):
                c.put(px, py, base + (255,)); c.put(px, py + 1, dark + (255,))
            shaded_blob(c, dark, base, light, cx - 1, 6, 3, 2)
            c.put(cx - 2, 5, EYE_WHITE); c.put(cx + 1, 5, EYE_WHITE)
            c.put(cx - 4, 7, RAMPS['red'][1] + (255,))  # forked tongue
            c.put(cx - 5, 7, RAMPS['red'][1] + (255,))

    elif arche == 'insect':
        wide = f.get('wide'); tall = f.get('tall')
        legs = f.get('legs', 6)
        by = 16 if not tall else 17
        rx = 6 if wide else (4 if tall else 5)
        ry = 4 if not tall else 7
        if f.get('shell'):
            shaded_blob(c, dark, base, light, cx, by, rx, ry)
            c.line(cx, by - ry, cx, by + ry, dark)  # shell seam (centre)
        else:
            shaded_blob(c, dark, base, light, cx, by, rx, ry)
        # head
        hy = by - ry - 1 if not tall else 7
        shaded_blob(c, dark, base, light, cx, hy, 3, 2)
        c.put(cx - 2, hy, EYE_WHITE); c.put(cx + 2, hy, EYE_WHITE)
        # legs (mirrored)
        per = legs // 2
        for i in range(per):
            ly = by - 1 + i * 2
            ex = rx + 2 + i
            c.line(cx - rx + 1, ly, cx - rx - 2, ly + 2, dark)
            c.line(cx + rx - 1, ly, cx + rx + 2, ly + 2, dark)
        if f.get('horn'):
            c.line(cx, hy - 2, cx, hy - 5, light)
        if f.get('claws'):
            for sx in (cx - rx - 3, cx + rx + 3):
                shaded_blob(c, dark, base, light, sx, by, 2, 3)
                c.put(sx, by - 2, light + (255,))
        if f.get('sting'):
            c.line(cx, by + ry, cx + 4, by + ry - 4, base)
            c.put(cx + 5, by + ry - 5, RAMPS['gold'][2] + (255,))
        if f.get('scythes'):
            for sx, d in ((cx - rx - 1, -1),):
                c.line(cx - rx, hy + 1, cx - rx - 3, hy - 2, light)
                c.line(cx + rx, hy + 1, cx + rx + 3, hy - 2, light)

    elif arche == 'beast':
        big = f.get('big'); low = f.get('low')
        by = 16 if not low else 19
        bw = 7 if big else 6
        # body
        shaded_blob(c, dark, base, light, cx, by, bw, 4 if not low else 3)
        # head front-left
        hx = cx - bw + 1
        shaded_blob(c, dark, base, light, hx, by - 2, 3, 3)
        # ears
        if f.get('ears') == 'point':
            c.line(hx - 1, by - 5, hx - 2, by - 8, base)
            c.line(hx + 1, by - 5, hx + 2, by - 8, base)
        # snout / tusks
        if f.get('snout'):
            c.put(hx - 3, by - 1, base + (255,)); c.put(hx - 4, by - 1, dark + (255,))
        if f.get('tusks'):
            c.put(hx - 3, by, EYE_WHITE); c.put(hx - 4, by + 1, EYE_WHITE)
        # eye
        c.put(hx - 1, by - 3, EYE_WHITE if not f.get('sleek') else (220, 80, 80, 255))
        # legs
        for sx in (cx - bw + 2, cx - 1, cx + 2, cx + bw - 2):
            c.line(sx, by + 3, sx, 24, dark)
        # tail
        if f.get('tail'):
            c.line(cx + bw, by, cx + bw + 2, by - 3, base)
        if f.get('mane'):
            for ang in range(-3, 4):
                c.put(hx + 1, by - 4 + ang, RAMPS['gold'][1] + (255,))
            shaded_blob(c, RAMPS['gold'][0], RAMPS['gold'][1], RAMPS['gold'][2], hx, by - 2, 4, 4)
            c.put(hx - 1, by - 3, EYE_DARK)
        if f.get('crest'):
            for sx in range(cx - 3, cx + 4, 2):
                c.put(sx, by - 4, light + (255,))

    elif arche == 'flyer':
        small = f.get('small'); big = f.get('big')
        by = 14
        bw = 3 if small else (5 if not big else 6)
        # wings first (behind)
        if f.get('wings') == 'bat':
            for k in range(1, 8):
                yy = by - 4 + k
                c.mput(cx - 3 - k, yy, dark + (255,))
                if k % 2 == 0:
                    c.mput(cx - 3 - k, yy, base + (255,))
            # membrane fill
            for k in range(1, 7):
                for j in range(k):
                    c.mput(cx - 3 - k, by - 3 + j, base + (255,))
        elif f.get('wings') == 'bird':
            for k in range(1, 8):
                c.mput(cx - 3 - k, by - 5 + (k // 2), light + (255,))
                c.mput(cx - 3 - k, by - 4 + (k // 2), base + (255,))
                c.mput(cx - 3 - k, by - 3 + (k // 2), dark + (255,))
        # body
        shaded_blob(c, dark, base, light, cx, by + 2, bw, 5)
        # head
        shaded_blob(c, dark, base, light, cx, by - 3, bw - 1, 2)
        c.put(cx - 2, by - 3, EYE_WHITE); c.put(cx + 2, by - 3, EYE_WHITE)
        if f.get('ears') == 'bat':
            c.line(cx - 2, by - 5, cx - 3, by - 8, base)
            c.line(cx + 2, by - 5, cx + 3, by - 8, base)
        if f.get('beak'):
            c.put(cx, by - 1, RAMPS['gold'][1] + (255,)); c.put(cx, by, RAMPS['gold'][0] + (255,))
        if f.get('dragon'):
            # horns + tail
            c.line(cx - 2, by - 5, cx - 3, by - 7, light)
            c.line(cx + 2, by - 5, cx + 3, by - 7, light)
            c.line(cx, by + 7, cx, 24, base)
            c.put(cx, 24, light + (255,))
        if f.get('humanoid'):
            c.line(cx, by + 6, cx, 23, base)  # legs
            c.put(cx - 1, 23, dark + (255,)); c.put(cx + 1, 23, dark + (255,))
        if f.get('fire'):
            for _ in range(8):
                sx = rng.randint(cx - 7, cx + 7); sy = rng.randint(by - 6, by + 6)
                c.put(sx, sy, RAMPS['gold'][2] + (255,))

    elif arche == 'ghost':
        # floating sheet with tattered bottom
        top = 6
        bot = 22
        for y in range(top, bot + 1):
            rx = 6 if y > top + 1 else 4
            for x in range(cx - rx, cx + rx + 1):
                col = light if y < top + 3 else (dark if y > bot - 3 else base)
                # tattered bottom edge
                if y >= bot - 2 and ((x // 2) % 2 == (y % 2)):
                    continue
                c.put(x, y, col + (255,))
        # hollow eyes
        c.put(cx - 3, 11, EYE_DARK); c.put(cx - 3, 12, EYE_DARK)
        c.put(cx + 3, 11, EYE_DARK); c.put(cx + 3, 12, EYE_DARK)
        if f.get('scream') or f.get('hair'):
            c.rect(cx - 1, 14, cx + 1, 16, EYE_DARK)  # open mouth
        if f.get('hair'):
            for sx in range(cx - 5, cx + 6, 2):
                c.line(sx, top, sx, top - 2, light)

    elif arche == 'humanoid':
        big = f.get('big'); thin = f.get('thin'); small = f.get('small')
        hw = 4 if big else 3
        bw = 5 if big else (2 if thin else 4)
        head_y = 6 if big else 7
        # legs
        leg_top = 19
        for sx in (cx - 2, cx + 2):
            c.rect(sx - 1, leg_top, sx, 24, dark, mirror=False)
            c.put(sx, leg_top, base + (255,))
        # torso
        for y in range(12, leg_top + 1):
            rx = bw - (1 if y > leg_top - 3 else 0)
            for x in range(cx - rx, cx + rx + 1):
                col = light if y < 14 else (dark if y > leg_top - 2 else base)
                c.put(x, y, col + (255,))
        # arms
        for sx, d in ((cx - bw, -1), (cx + bw, 1)):
            c.line(sx, 13, sx + d, 19, base)
            c.put(sx + d, 19, dark + (255,))
        # head
        shaded_blob(c, dark, base, light, cx, head_y + 2, hw, hw)
        # eyes
        if f.get('oneeye'):
            c.put(cx, head_y + 1, EYE_WHITE); c.put(cx, head_y + 2, (220, 60, 60, 255))
        elif f.get('skull') or f.get('undead'):
            c.put(cx - 2, head_y + 1, EYE_DARK); c.put(cx + 2, head_y + 1, EYE_DARK)
            c.put(cx, head_y + 3, EYE_DARK)
        else:
            c.put(cx - 2, head_y + 1, EYE_WHITE); c.put(cx + 2, head_y + 1, EYE_WHITE)
        # features
        if f.get('horns'):
            c.line(cx - hw + 1, head_y - 1, cx - hw - 1, head_y - 4, light)
            c.line(cx + hw - 1, head_y - 1, cx + hw + 1, head_y - 4, light)
        if f.get('tusks'):
            c.put(cx - 1, head_y + 4, EYE_WHITE); c.put(cx + 1, head_y + 4, EYE_WHITE)
        if f.get('fangs'):
            c.put(cx - 1, head_y + 4, EYE_WHITE); c.put(cx + 1, head_y + 4, EYE_WHITE)
        if f.get('snout'):
            c.put(cx, head_y + 4, dark + (255,))
        if f.get('crown'):
            gd, gb, gl = RAMPS['gold']
            for sx in (cx - 2, cx, cx + 2):
                c.put(sx, head_y - hw, gl + (255,))
            c.rect(cx - 2, head_y - hw + 1, cx + 2, head_y - hw + 1, gb)
        if f.get('cape'):
            for y in range(12, 22):
                c.put(cx - bw - 1, y, dark + (255,)); c.put(cx + bw + 1, y, dark + (255,))
        if f.get('robe'):
            for y in range(14, 24):
                rx = bw + (y - 14) // 3
                c.put(cx - rx, y, dark + (255,)); c.put(cx + rx, y, dark + (255,))
        if f.get('wings') == 'bat':
            for k in range(1, 6):
                for j in range(k):
                    c.mput(cx - bw - 1 - k, 11 + j, base + (255,))
        if f.get('blocky'):
            # square off the silhouette a bit
            c.rect(cx - bw, 13, cx - bw, 18, light)
            c.rect(cx + bw, 13, cx + bw, 18, dark)

    c.add_outline(OUTLINE)
    return c


def gen_player():
    """Top-down-ish hunter facing right, 24x32 -> 48x64."""
    pw, ph = 24, 32
    c = Canvas(pw, ph)
    cx = pw // 2
    skin = (224, 178, 132); skin_d = (180, 130, 92)
    shirt = RAMPS['green']; pants = RAMPS['brown']
    # legs
    for sx in (cx - 3, cx + 2):
        for y in range(22, 30):
            c.put(sx, y, pants[1] + (255,)); c.put(sx + 1, y, pants[0] + (255,))
        c.put(sx, 30, (40, 36, 40, 255)); c.put(sx + 1, 30, (40, 36, 40, 255))  # boots
    # torso (vest)
    for y in range(13, 23):
        for x in range(cx - 5, cx + 5):
            col = shirt[2] if y < 15 else (shirt[0] if y > 21 else shirt[1])
            c.put(x, y, col + (255,))
    # belt + ammo
    c.rect(cx - 5, 21, cx + 4, 21, RAMPS['brown'][0])
    for sx in range(cx - 4, cx + 4, 2):
        c.put(sx, 21, RAMPS['gold'][1] + (255,))
    # arms
    for sx in (cx - 6, cx + 5):
        c.rect(sx, 14, sx, 19, skin)
    # head
    for y in range(5, 13):
        for x in range(cx - 4, cx + 4):
            c.put(x, y, skin if y > 6 else skin_d, )
    # hat (explorer)
    c.rect(cx - 6, 5, cx + 5, 5, RAMPS['tan'][0])
    c.rect(cx - 4, 2, cx + 3, 4, RAMPS['tan'][1])
    c.rect(cx - 4, 4, cx + 3, 4, RAMPS['tan'][0])
    # face
    c.put(cx - 2, 9, EYE_DARK); c.put(cx + 1, 9, EYE_DARK)
    c.rect(cx - 4, 11, cx + 3, 12, skin_d)  # jaw shadow / stubble
    c.add_outline(OUTLINE)
    return c.to_image(2, (48, 64))


def main():
    os.makedirs(OUT, exist_ok=True)
    for eid, (arche, ramp, f) in ENEMIES.items():
        c = make_enemy(eid, arche, ramp, f)
        img = c.to_image(SCALE, (40, 52))
        img.save(os.path.join(OUT, f'e_{eid}.png'))
    # generic fallback
    c = make_enemy('slime', 'blob', 'green', {'eyes': 2, 'drip': True})
    c.to_image(SCALE, (40, 52)).save(os.path.join(OUT, 'enemy.png'))
    gen_player().save(os.path.join(OUT, 'player.png'))
    print(f'generated {len(ENEMIES)} enemies + player + fallback')


if __name__ == '__main__':
    main()
