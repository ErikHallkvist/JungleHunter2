"""Generate all weapon icons + projectiles in one pixel style.

Weapons: 36x16 grid -> x2 -> 72x32 (matches shop / held-weapon sizes).
Side view, barrel pointing right, shared gunmetal palette + per-tier accent.
"""
import os
from pixelkit import Canvas, RAMPS, OUTLINE

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites')
GW, GH = 36, 16

METAL_D = (58, 62, 74, 255)
METAL = (104, 112, 128, 255)
METAL_L = (168, 176, 196, 255)
GRIP_D = (44, 38, 34, 255)
GRIP = (74, 60, 48, 255)
WOOD = (132, 92, 54, 255)
WOOD_L = (176, 130, 80, 255)

# id -> params. len=barrel reach, body width, flags.
# kind: pistol|smg|rifle|shotgun|sniper|energy|cannon
WEAPONS = {
    'pistol':        dict(kind='pistol', accent=None),
    'revolver':      dict(kind='pistol', accent='gold', cylinder=True),
    'magnum':        dict(kind='pistol', accent='gold', big=True),
    'smg':           dict(kind='smg', accent=None),
    'tactical_smg':  dict(kind='smg', accent='blue', rail=True),
    'lmg':           dict(kind='smg', accent=None, big=True, drum=True),
    'shotgun':       dict(kind='shotgun', accent='brown'),
    'double_barrel': dict(kind='shotgun', accent='brown', double=True),
    'combat_shotgun':dict(kind='shotgun', accent='gray', mag=True),
    'auto_shotgun':  dict(kind='shotgun', accent='gray', mag=True, drum=True),
    'flak_cannon':   dict(kind='cannon', accent='orange'),
    'burst_rifle':   dict(kind='rifle', accent=None),
    'assault_rifle': dict(kind='rifle', accent=None, mag=True),
    'marksman':      dict(kind='rifle', accent='blue', scope=True, long=True),
    'sniper':        dict(kind='sniper', accent='blue', scope=True),
    'plasma_rifle':  dict(kind='energy', accent='teal'),
    'pulse_rifle':   dict(kind='energy', accent='cyan'),
    'railgun':       dict(kind='energy', accent='blue', long=True, coils=True),
    'laser_minigun': dict(kind='energy', accent='red', barrels=True, big=True),
    'devastator':    dict(kind='cannon', accent='purple', glow=True, big=True),
}


def hbar(c, x0, x1, y0, y1, top, mid, bot):
    for y in range(y0, y1 + 1):
        col = top if y == y0 else (bot if y == y1 else mid)
        for x in range(x0, x1 + 1):
            c.put(x, y, col)


def gun(eid, p):
    c = Canvas(GW, GH)
    kind = p['kind']
    accent = RAMPS[p['accent']] if p.get('accent') else None
    midy = 8
    # ── receiver body ──
    if kind == 'pistol':
        bx0, bx1 = 14, 24
        hbar(c, bx0, bx1, midy - 2, midy + 2, METAL_L, METAL, METAL_D)
        # barrel
        hbar(c, bx1, 30, midy - 1, midy, METAL_L, METAL, METAL)
        # grip
        for i, y in enumerate(range(midy + 2, midy + 8)):
            x0 = bx0 + i
            for x in range(x0, x0 + 4):
                c.put(x, y, GRIP if y < midy + 6 else GRIP_D)
        if p.get('cylinder'):
            c.disc(bx0 + 4, midy, 3, METAL_L, squash=1)
            c.disc(bx0 + 4, midy, 1, METAL_D, squash=1)
        if p.get('big'):
            hbar(c, 10, bx0, midy - 1, midy + 1, METAL_L, METAL, METAL_D)
    elif kind == 'smg':
        bx0, bx1 = 8, 22
        hbar(c, bx0, bx1, midy - 3, midy + 2, METAL_L, METAL, METAL_D)
        hbar(c, bx1, 31, midy - 2, midy, METAL_L, METAL, METAL)
        # grip + mag
        for i, y in enumerate(range(midy + 2, midy + 8)):
            for x in range(bx0 + 6 + i, bx0 + 10 + i):
                c.put(x, y, GRIP if y < midy + 6 else GRIP_D)
        if p.get('drum'):
            c.disc(bx0 + 3, midy + 5, 4, METAL, squash=1)
            c.disc(bx0 + 3, midy + 5, 4, METAL, squash=1)
            c.disc(bx0 + 3, midy + 5, 2, METAL_D, squash=1)
        else:
            for y in range(midy + 3, midy + 9):
                for x in range(bx0 + 1, bx0 + 4):
                    c.put(x, y, METAL_D if y > midy + 6 else METAL)
        # stock
        hbar(c, 3, bx0, midy - 2, midy, METAL_D, METAL_D, METAL_D)
    elif kind in ('rifle', 'sniper'):
        long = p.get('long') or kind == 'sniper'
        bx0, bx1 = 6, 22
        hbar(c, bx0, bx1, midy - 3, midy + 1, METAL_L, METAL, METAL_D)
        barrel_end = 34 if long else 31
        hbar(c, bx1, barrel_end, midy - 2, midy - 1, METAL_L, METAL, METAL)
        # stock (wood)
        for i, x in enumerate(range(2, bx0 + 1)):
            c.put(x, midy + 1, WOOD); c.put(x, midy, WOOD_L); c.put(x, midy + 2, GRIP_D)
        # grip
        for i, y in enumerate(range(midy + 1, midy + 7)):
            for x in range(bx0 + 7 + i, bx0 + 10 + i):
                c.put(x, y, GRIP if y < midy + 5 else GRIP_D)
        if p.get('mag'):
            for y in range(midy + 2, midy + 8):
                for x in range(bx0 + 2, bx0 + 5):
                    c.put(x, y, METAL_D if y > midy + 5 else METAL)
        if p.get('scope'):
            hbar(c, bx0 + 5, bx0 + 12, midy - 6, midy - 4, METAL_L, METAL, METAL_D)
            c.put(bx0 + 5, midy - 3, METAL_D); c.put(bx0 + 12, midy - 3, METAL_D)
            if accent:
                c.put(bx0 + 12, midy - 5, accent[2] + (255,))
        if kind == 'sniper':
            # muzzle brake
            for x in range(barrel_end - 3, barrel_end + 1):
                c.put(x, midy - 3, METAL_D); c.put(x, midy, METAL_D)
    elif kind == 'shotgun':
        bx0, bx1 = 6, 22
        hbar(c, bx0, bx1, midy - 2, midy + 1, METAL_L, METAL, METAL_D)
        if p.get('double'):
            hbar(c, bx1, 33, midy - 2, midy - 1, METAL_L, METAL, METAL)
            hbar(c, bx1, 33, midy + 1, midy + 2, METAL, METAL, METAL_D)
        else:
            hbar(c, bx1, 33, midy - 1, midy, METAL_L, METAL, METAL)
            # pump
            hbar(c, bx1 + 3, bx1 + 8, midy + 1, midy + 2, WOOD_L, WOOD, GRIP_D)
        # wood stock
        for x in range(2, bx0 + 1):
            c.put(x, midy, WOOD_L); c.put(x, midy + 1, WOOD); c.put(x, midy + 2, GRIP_D)
        for i, y in enumerate(range(midy + 2, midy + 7)):
            for x in range(bx0 + 6 + i, bx0 + 9 + i):
                c.put(x, y, WOOD if y < midy + 5 else GRIP_D)
        if p.get('mag'):
            for y in range(midy + 2, midy + 8):
                for x in range(bx0 + 1, bx0 + 4):
                    c.put(x, y, METAL_D if y > midy + 5 else METAL)
        if p.get('drum'):
            c.disc(bx0 + 2, midy + 5, 4, METAL, squash=1)
            c.disc(bx0 + 2, midy + 5, 2, METAL_D, squash=1)
    elif kind == 'energy':
        bx0, bx1 = 6, 22
        hbar(c, bx0, bx1, midy - 3, midy + 2, METAL_L, METAL, METAL_D)
        # emitter barrel
        hbar(c, bx1, 32, midy - 2, midy, METAL_L, METAL, METAL_D)
        glow = (accent or RAMPS['cyan'])
        # energy core
        c.disc(bx0 + 8, midy, 2, glow[2] + (255,), squash=1)
        c.disc(bx0 + 8, midy, 1, (255, 255, 255, 255), squash=1)
        # muzzle glow
        for x in range(30, 34):
            c.put(x, midy - 1, glow[2] + (255,)); c.put(x, midy, glow[1] + (255,))
        c.put(34, midy - 1, glow[2] + (255,))
        # grip
        for i, y in enumerate(range(midy + 2, midy + 8)):
            for x in range(bx0 + 6 + i, bx0 + 9 + i):
                c.put(x, y, GRIP if y < midy + 6 else GRIP_D)
        # stock
        hbar(c, 3, bx0, midy - 1, midy + 1, METAL_D, METAL_D, METAL_D)
        if p.get('coils'):
            for x in range(bx1 + 1, 31, 2):
                c.put(x, midy - 3, glow[2] + (255,)); c.put(x, midy + 1, glow[2] + (255,))
        if p.get('barrels'):
            for dy in (-3, 0, 3):
                hbar(c, bx1, 33, midy + dy, midy + dy, METAL_L, METAL, METAL)
            c.disc(bx0 + 4, midy, 4, METAL, squash=1)
            c.disc(bx0 + 4, midy, 2, glow[2] + (255,), squash=1)
    elif kind == 'cannon':
        bx0, bx1 = 5, 24
        hbar(c, bx0, bx1, midy - 4, midy + 3, METAL_L, METAL, METAL_D)
        # wide barrel
        hbar(c, bx1, 33, midy - 3, midy + 1, METAL_L, METAL, METAL_D)
        # muzzle ring
        for y in range(midy - 4, midy + 2):
            c.put(33, y, METAL_L); c.put(32, y, METAL_D)
        glow = (accent or RAMPS['orange'])
        c.disc(33, midy - 1, 2, glow[2] + (255,), squash=1)
        # grip
        for i, y in enumerate(range(midy + 3, midy + 9)):
            for x in range(bx0 + 6 + i, bx0 + 10 + i):
                c.put(x, y, GRIP if y < midy + 7 else GRIP_D)
        hbar(c, 2, bx0, midy - 1, midy + 2, METAL_D, METAL_D, METAL_D)
        if p.get('glow'):
            c.disc(bx0 + 9, midy, 3, glow[1] + (255,), squash=1)
            c.disc(bx0 + 9, midy, 1, (255, 255, 255, 255), squash=1)

    # subtle accent stripe on receiver for non-energy tiers
    if accent and kind not in ('energy', 'cannon'):
        for x in range(15, 21):
            if c.get(x, midy + 1):
                c.put(x, midy + 1, accent[1] + (255,))

    c.add_outline(OUTLINE)
    return c.to_image(2, (72, 32))


# ── Projectiles ──────────────────────────────────────────────────────────────
def proj_bullet():
    c = Canvas(12, 4)
    c.rect(2, 1, 9, 2, RAMPS['gold'][1])
    c.rect(8, 1, 10, 2, RAMPS['gold'][2])
    c.add_outline(OUTLINE)
    return c.to_image(2, (24, 8))

def proj_pellet():
    c = Canvas(6, 6)
    c.disc(3, 3, 2, RAMPS['gold'][1] + (255,), squash=1)
    c.put(2, 2, RAMPS['gold'][2] + (255,))
    c.add_outline(OUTLINE)
    return c.to_image(2, (12, 12))

def proj_heavy():
    c = Canvas(12, 5)
    c.rect(2, 1, 9, 3, RAMPS['orange'][1])
    c.rect(7, 1, 10, 3, RAMPS['orange'][2])
    c.put(3, 1, RAMPS['orange'][2] + (255,))
    c.add_outline(OUTLINE)
    return c.to_image(2, (24, 10))

def proj_plasma():
    c = Canvas(9, 9)
    c.disc(4, 4, 4, RAMPS['teal'][0] + (255,), squash=1)
    c.disc(4, 4, 3, RAMPS['teal'][1] + (255,), squash=1)
    c.disc(4, 4, 1, (235, 255, 255, 255), squash=1)
    c.add_outline(OUTLINE)
    return c.to_image(2, (18, 18))

def proj_rail():
    c = Canvas(18, 4)
    c.rect(0, 1, 17, 2, RAMPS['blue'][2])
    c.rect(2, 1, 15, 1, (235, 245, 255))
    c.add_outline(OUTLINE)
    return c.to_image(2, (36, 8))

def proj_laser():
    c = Canvas(14, 3)
    c.rect(0, 1, 13, 1, (255, 120, 110))
    c.rect(2, 0, 11, 2, (255, 80, 70))
    c.rect(4, 1, 9, 1, (255, 230, 220))
    return c.to_image(2, (28, 6))

def proj_energy():
    c = Canvas(14, 14)
    c.disc(7, 7, 6, RAMPS['purple'][0] + (255,), squash=1)
    c.disc(7, 7, 5, RAMPS['purple'][1] + (255,), squash=1)
    c.disc(7, 7, 3, RAMPS['magenta'][2] + (255,), squash=1)
    c.disc(7, 7, 1, (255, 255, 255, 255), squash=1)
    c.add_outline(OUTLINE)
    return c.to_image(2, (28, 28))


def main():
    os.makedirs(OUT, exist_ok=True)
    for eid, p in WEAPONS.items():
        gun(eid, p).save(os.path.join(OUT, f'w_{eid}.png'))
    proj_bullet().save(os.path.join(OUT, 'p_bullet.png'))
    proj_bullet().save(os.path.join(OUT, 'bullet.png'))
    proj_pellet().save(os.path.join(OUT, 'p_pellet.png'))
    proj_pellet().save(os.path.join(OUT, 'pellet.png'))
    proj_heavy().save(os.path.join(OUT, 'p_heavy.png'))
    proj_plasma().save(os.path.join(OUT, 'p_plasma.png'))
    proj_rail().save(os.path.join(OUT, 'p_rail.png'))
    proj_laser().save(os.path.join(OUT, 'p_laser.png'))
    proj_energy().save(os.path.join(OUT, 'p_energy.png'))
    print(f'generated {len(WEAPONS)} weapons + 7 projectiles')


if __name__ == '__main__':
    main()
