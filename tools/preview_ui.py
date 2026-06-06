"""Render approximate previews of the Lobby and Shop using the real fonts +
generated textures, so layout/overflow can be checked without a browser."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
SPR = os.path.join(ROOT, 'public', 'assets', 'sprites')
BGP = os.path.join(ROOT, 'public', 'assets', 'background')
FNT = os.path.join(ROOT, 'public', 'assets', 'fonts')

HEAD = lambda s: ImageFont.truetype(os.path.join(FNT, 'PressStart2P.ttf'), s)
BODY = lambda s: ImageFont.truetype(os.path.join(FNT, 'VT323.ttf'), s)

panel_img = Image.open(os.path.join(SPR, 'ui_panel.png')).convert('RGBA')
btn_img = Image.open(os.path.join(SPR, 'ui_button.png')).convert('RGBA')


def nineslice(tex, w, h, corner):
    out = Image.new('RGBA', (w, h))
    tw, th = tex.size
    c = corner
    parts = {
        'tl': (0, 0, c, c), 'tr': (tw - c, 0, tw, c),
        'bl': (0, th - c, c, th), 'br': (tw - c, th - c, tw, th),
    }
    cr = {k: tex.crop(v) for k, v in parts.items()}
    top = tex.crop((c, 0, tw - c, c)).resize((w - 2 * c, c), Image.NEAREST)
    bot = tex.crop((c, th - c, tw - c, th)).resize((w - 2 * c, c), Image.NEAREST)
    lft = tex.crop((0, c, c, th - c)).resize((c, h - 2 * c), Image.NEAREST)
    rgt = tex.crop((tw - c, c, tw, th - c)).resize((c, h - 2 * c), Image.NEAREST)
    mid = tex.crop((c, c, tw - c, th - c)).resize((w - 2 * c, h - 2 * c), Image.NEAREST)
    out.paste(mid, (c, c)); out.paste(top, (c, 0)); out.paste(bot, (c, h - c))
    out.paste(lft, (0, c)); out.paste(rgt, (w - c, c))
    out.paste(cr['tl'], (0, 0)); out.paste(cr['tr'], (w - c, 0))
    out.paste(cr['bl'], (0, h - c)); out.paste(cr['br'], (w - c, h - c))
    return out


def tint(img, color):
    r, g, b = color
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            pr, pg, pb, pa = px[x, y]
            px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out


def ctext(d, x, y, s, font, fill, anchor='mm'):
    d.text((x, y), s, font=font, fill=fill, anchor=anchor)


def lobby():
    W, H = 1280, 720
    img = Image.new('RGBA', (W, H), (12, 12, 20, 255))
    bg = Image.open(os.path.join(BGP, 'jungle.png')).convert('RGBA')
    for i in range(0, W, bg.width):
        for j in range(0, H, bg.height):
            img.paste(bg, (i, j))
    scrim = Image.new('RGBA', (W, H), (10, 14, 26, 140)); img = Image.alpha_composite(img, scrim)
    d = ImageDraw.Draw(img)
    ctext(d, W // 2, 84, 'JUNGLE HUNTER 2', HEAD(40), (240, 192, 32))
    pl = Image.open(os.path.join(SPR, 'player.png')).convert('RGBA')
    img.paste(pl, (W // 2 - 344, 52), pl)
    img.paste(pl.transpose(Image.FLIP_LEFT_RIGHT), (W // 2 + 296, 52), pl.transpose(Image.FLIP_LEFT_RIGHT))
    px, py, pw, ph = W // 2, H // 2 + 30, 520, 410
    pn = nineslice(panel_img, pw, ph, 16)
    img.paste(pn, (px - pw // 2, py - ph // 2), pn)
    d = ImageDraw.Draw(img)
    ctext(d, px, py - ph // 2 + 34, 'LOBBY', HEAD(18), (138, 160, 184))
    ctext(d, px, py - ph // 2 + 88, 'Playing as: Hunter42', BODY(22), (240, 192, 32))
    names = ['Hunter42  (you)', 'Ace', 'Ripley']
    for i, n in enumerate(names):
        y = py - ph // 2 + 124 + i * 38
        me = i == 0
        d.rectangle([px - (pw - 70) // 2, y - 16, px + (pw - 70) // 2, y + 16],
                    fill=(28, 44, 82, 220) if me else (20, 26, 48, 200))
        d.rectangle([px - 114, y - 4, px - 106, y + 4], fill=(226, 183, 20) if me else (86, 170, 78))
        ctext(d, px - 92, y, n, BODY(22), (240, 192, 32) if me else (244, 244, 248), anchor='lm')
    by = py + ph // 2 - 48
    bn = tint(nineslice(btn_img, 320, 56, 12), (86, 170, 78))
    img.paste(bn, (px - 160, by - 28), bn)
    d = ImageDraw.Draw(img)
    ctext(d, px, by, 'START GAME', HEAD(18), (244, 244, 248))
    return img


def shop():
    W, H = 1280, 720
    img = Image.new('RGBA', (W, H), (16, 22, 30, 255))
    pn = nineslice(panel_img, 1180, 600, 16)
    img.paste(pn, (640 - 590, 362 - 300), pn)
    d = ImageDraw.Draw(img)
    ctext(d, 640, 96, 'WEAPON SHOP', HEAD(26), (240, 192, 32))
    ctext(d, 640, 134, 'GOLD: 1240', BODY(24), (240, 192, 32))
    d.rectangle([70, 155, 1210, 157], fill=(51, 64, 106))
    rows = [
        ('w_devastator', 'Devastator', 'DMG 160  350ms  x3', '6000g', 'BUY', (68, 72, 90)),
        ('w_combat_shotgun', 'Combat Shotgun', 'DMG 12  550ms  x7', '820g', 'EQUIP', (46, 111, 176)),
        ('w_laser_minigun', 'Laser Minigun', 'DMG 24  50ms', '4200g', 'ACTIVE', (226, 183, 20)),
        ('w_magnum', 'Magnum', 'DMG 65  500ms', '560g', 'BUY', (86, 170, 78)),
    ]
    COL_X = [60, 645]
    for ci, x0 in enumerate(COL_X):
        for ri, (icon, name, stats, price, btn, col) in enumerate(rows):
            y = 182 + ri * 45
            ic = Image.open(os.path.join(SPR, f'{icon}.png')).convert('RGBA').resize((56, 25), Image.NEAREST)
            img.paste(ic, (x0 + 30 - 28, y - 12), ic)
            d = ImageDraw.Draw(img)
            ctext(d, x0 + 64, y - 9, name, BODY(21), (244, 244, 248), anchor='lm')
            ctext(d, x0 + 64, y + 11, stats, BODY(16), (138, 160, 184), anchor='lm')
            ctext(d, x0 + 380, y, price, BODY(21), (240, 192, 32), anchor='rm')
            bn = tint(nineslice(btn_img, 90, 32, 12), col)
            img.paste(bn, (x0 + 470 - 45, y - 16), bn)
            d = ImageDraw.Draw(img)
            tc = (16, 24, 46) if btn == 'ACTIVE' else (244, 244, 248)
            ctext(d, x0 + 470, y, btn, HEAD(11), tc)
    # shop toggle
    bn = tint(nineslice(btn_img, 124, 40, 12), (226, 183, 20))
    img.paste(bn, (1206 - 62, 686 - 20), bn)
    d = ImageDraw.Draw(img)
    ctext(d, 1206, 686, '[E] SHOP', HEAD(12), (16, 24, 46))
    return img


lobby().convert('RGB').save('/tmp/prev_lobby.png')
shop().convert('RGB').save('/tmp/prev_shop.png')
print('ok')
