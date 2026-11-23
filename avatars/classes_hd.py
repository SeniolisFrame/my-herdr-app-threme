# The five classes as 8-bit big-head RPG sprites (about 48 art px tall), drawn big with smooth curves and shrunk to pixels.
# Designs come from the user's references (white-haired samurai, hooded masked rogue, bishop, scythe girl, hooded witch), as
# original drawings. Frames: awake (ready), awake-mid (wind-up), awake-down (strike), sleep (+ z).
#   python avatars/classes_hd.py avatars [preview.png]      then      node avatars/build.mjs
import math, os, sys
from PIL import Image
from hd import Canvas, to_cells, bbox, outline, write_json, z_marks

SZ = (700, 580)
INK = (18, 16, 36)
SKIN, EYEW = (255, 222, 190), (255, 255, 255)

def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def T(base): return base, lerp(base, (255, 246, 222), 0.42), lerp(base, (22, 18, 70), 0.46)      # lit rim warm, shade cool

HANDS = {0: (396, 376), 1: (380, 286), 2: (446, 396), 3: (372, 436)}
FAR = {0: (178, 426), 1: (172, 404), 2: (164, 414), 3: (186, 440)}

def spike(c, base, tip, w, col): c.paint(c.tri((base[0] - w, base[1]), (base[0] + w, base[1]), tip), *T(col), d=4)

def face(c, k, frame, dy):
    sleep = frame == 3
    c.paint(c.blob([(168, 160 + dy), (270, 104 + dy), (372, 160 + dy), (388, 236 + dy), (352, 298 + dy), (270, 318 + dy), (188, 298 + dy), (154, 236 + dy)]), SKIN, lerp(SKIN, (255, 250, 236), .5), lerp(SKIN, (150, 96, 110), .5), 8)
    for ex, ey, w, h in ((322, 236, 22, 34), (236, 238, 20, 32)):
        if sleep:
            c.line([(ex - w, ey + 8 + dy), (ex + w, ey + 12 + dy)], INK, 7)
        else:
            c.paint(c.ellipse(ex, ey + dy, w, h), EYEW)
            c.paint(c.ellipse(ex + 4, ey + 4 + dy, w - 7, h - 5), k["eye"], lerp(k["eye"], (255, 255, 255), .4), lerp(k["eye"], (10, 10, 40), .4), 5)
            c.paint(c.ellipse(ex + 5, ey + 5 + dy, 7, 11), INK)
            c.paint(c.ellipse(ex + 12, ey - 8 + dy, 5, 5), EYEW)
    c.line([(284, 288 + dy), (308, 290 + dy)], (170, 80, 90), 6)
    for bx in (206, 350): c.paint(c.ellipse(bx, 268 + dy, 20, 11), (255, 168, 168))

def body(c, k, frame):
    dy = 36 if frame == 3 else 0
    H, G = HANDS[frame], FAR[frame]
    k["back"](c, frame)
    # legs and boots
    for lx in (246, 312):
        c.paint(c.ribbon([(lx, 440), (lx - 2, 522)], [54, 48]), *T(k["leg"]), d=6)
        c.paint(c.blob([(lx - 40, 536), (lx - 30, 508), (lx + 30, 506), (lx + 46, 526), (lx + 46, 544), (lx - 40, 546)]), *T(k["boot"]), d=5)
    k["lower"](c, frame)
    # torso and arms
    c.paint(c.blob([(206, 334), (334, 334), (350, 452), (192, 452)]), *T(k["torso"]), d=8)
    k["torso_fx"](c, frame)
    c.paint(c.ribbon([(214, 356), (186, 400), G], [48, 42, 36]), *T(k["sleeve"]), d=6)
    c.paint(c.ellipse(G[0], G[1], 24, 22), *T(SKIN), d=5)
    face(c, k, frame, dy)
    k["head"](c, frame, dy)
    el = ((338 + H[0]) / 2 + 6, (354 + H[1]) / 2 + 18)
    c.paint(c.ribbon([(336, 358), el, H], [50, 44, 38]), *T(k["sleeve"]), d=6)
    c.paint(c.ellipse(H[0], H[1], 25, 23), *T(SKIN), d=5)
    k["weapon"](c, frame, H, G)
    return c.img

# ----------------------------------------------------------------------------------------------- samurai
def sam_back(c, frame):
    s = {0: 0, 1: 10, 2: 26, 3: -6}[frame]
    c.paint(c.blob([(176, 340), (236, 326), (244, 470), (160, 536), (110 - s, 450)]), *T((46, 46, 64)), d=8)
    c.paint(c.blob([(330, 330), (404, 346), (448 + s, 450), (390, 526), (338, 470)]), *T((46, 46, 64)), d=8)
    c.paint(c.blob([(190, 360), (232, 350), (232, 460), (170, 510), (140 - s, 450)]), *T((176, 40, 54)), d=5)
    c.paint(c.blob([(336, 350), (392, 362), (424 + s, 452), (384, 504), (340, 460)]), *T((176, 40, 54)), d=5)

def sam_lower(c, frame):
    c.paint(c.blob([(192, 444), (356, 444), (386, 534), (164, 534)]), *T((240, 244, 254)), d=8)
    for x in (226, 270, 314): c.line([(x, 456), (x - 8 + (x - 270) // 4, 528)], (176, 188, 224), 5)
    for x in (226, 314): c.paint(c.ribbon([(x - 22, 530), (x + 22, 530)], [14, 14]), *T((176, 40, 54)), d=3)    # red sandal straps

def sam_torso(c, frame):
    for x in (216, 334):
        c.paint(c.ribbon([(x, 336), (x - (6 if x < 270 else -6), 456)], [46, 44]), *T((46, 46, 64)), d=6)
    c.line([(194, 338), (204, 452)], (176, 40, 54), 5); c.line([(346, 338), (338, 452)], (176, 40, 54), 5)
    c.paint(c.ribbon([(208, 440), (342, 440)], [22, 22]), *T((36, 36, 50)), d=4)
    c.paint(c.ellipse(275, 440, 14, 14), *T((220, 190, 90)), d=3)
    c.paint(c.ribbon([(214, 326), (272, 340), (334, 326)], [42, 40, 38]), *T((244, 246, 255)), d=6)           # scarf
    c.paint(c.ribbon([(328, 332), (352, 400), (346, 428)], [32, 28, 22]), *T((244, 246, 255)), d=5)

def sam_head(c, frame, dy):
    hair = (234, 240, 254)
    c.paint(c.blob([(158, 176 + dy), (180, 108 + dy), (250, 76 + dy), (330, 84 + dy), (388, 136 + dy), (386, 190 + dy), (336, 150 + dy), (270, 160 + dy), (212, 148 + dy)]), *T(hair), d=7)
    for (bx, by), (tx, ty) in (((190, 112), (166, 54)), ((236, 90), (224, 28)), ((290, 84), (306, 24)), ((340, 98), (382, 46)), ((378, 140), (432, 118)), ((166, 150), (120, 120))):
        spike(c, (bx, by + dy), (tx, ty + dy), 24, hair)
    for bx in (222, 268): spike(c, (bx, 150 + dy), (bx + 8, 204 + dy), 18, hair)

def sam_weapon(c, frame, H, G):
    ang = {0: -42, 1: -108, 2: 14, 3: 90}[frame]
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    L = 250 if frame != 3 else 120
    tip = (H[0] + dx * (L + 30), H[1] + dy * (L + 30))
    c.paint(c.ribbon([(H[0] - dx * 56, H[1] - dy * 56), (H[0] + dx * 16, H[1] + dy * 16)], [24, 24]), *T((54, 24, 36)), d=4)
    c.paint(c.ellipse(H[0] - dx * 60, H[1] - dy * 60, 15, 15), *T((220, 190, 90)), d=3)
    c.paint(c.ribbon([(H[0] + dx * 16, H[1] + dy * 16), tip], [20, 18, 5]), *T((214, 224, 242)), d=4)
    c.line([(H[0] + dx * 60, H[1] + dy * 60), (H[0] + dx * (L - 20), H[1] + dy * (L - 20))], (130, 148, 186), 4)
    c.paint(c.ribbon([(H[0] + dx * 18 - nx * 30, H[1] + dy * 18 - ny * 30), (H[0] + dx * 18 + nx * 30, H[1] + dy * 18 + ny * 30)], [12, 12]), *T((220, 190, 90)), d=3)
    if frame == 2:
        arc = [(H[0] + math.cos(math.radians(t)) * 240, H[1] + math.sin(math.radians(t)) * 240) for t in range(-80, -8, 8)]
        c.paint(c.ribbon(arc, [4] + [26] * (len(arc) - 2) + [2]), (226, 244, 255), d=3)

SAM = dict(eye=(200, 150, 60), leg=(236, 240, 250), boot=(120, 40, 52), torso=(246, 248, 255), sleeve=(46, 46, 64), back=sam_back, lower=sam_lower,
           torso_fx=sam_torso, head=sam_head, weapon=sam_weapon)

# ----------------------------------------------------------------------------------------------- rogue
CLOAK = (54, 56, 84)
def rog_back(c, frame):
    s = {0: 0, 1: 8, 2: 22, 3: -6}[frame]
    c.paint(c.blob([(200, 240), (128 - s, 340), (96 - s, 470), (126 - s, 546), (176, 520), (208, 548), (258, 512), (312, 548), (362, 520), (430, 546), (462 + s, 450), (410, 330), (344, 244)]), *T(CLOAK), d=9)
    c.paint(c.ribbon([(384, 190), (456, 204), (526, 156 - s), (548, 120 - s)], [16, 12, 3]), *T((196, 40, 62)), d=3)

def rog_lower(c, frame):
    for lx in (246, 312):
        for y in (470, 494): c.line([(lx - 24, y), (lx + 24, y + 6)], (170, 172, 200), 5)                  # wrapped shins

def rog_torso(c, frame):
    c.paint(c.blob([(200, 334), (342, 334), (366, 474), (180, 484)]), *T((64, 66, 98)), d=8)
    c.paint(c.ribbon([(210, 332), (272, 350), (336, 332)], [34, 34, 28]), *T((74, 78, 112)), d=5)
    for k in range(4): c.line([(214 + k * 36, 400 + (k % 2) * 8), (230 + k * 36, 414 + (k % 2) * 8)], (150, 156, 190), 4)

def rog_head(c, frame, dy):
    hood = (46, 48, 74)
    c.paint(c.blob([(146, 262 + dy), (150, 130 + dy), (270, 36 + dy), (392, 130 + dy), (398, 262 + dy), (350, 300 + dy), (270, 312 + dy), (190, 300 + dy)]), *T(hood), d=8)
    c.paint(c.blob([(190, 200 + dy), (270, 162 + dy), (350, 200 + dy), (346, 262 + dy), (270, 292 + dy), (194, 262 + dy)]), *T(SKIN), d=6)
    c.paint(c.mask([(190, 258 + dy), (352, 258 + dy), (340, 316 + dy), (270, 336 + dy), (200, 316 + dy)]), *T((74, 80, 112)), d=5)               # face mask
    c.paint(c.mask([(262, 276 + dy), (272, 262 + dy), (282, 276 + dy), (272, 290 + dy)]), *T((150, 156, 196)), d=3)
    c.paint(c.ribbon([(250, 190 + dy), (290, 188 + dy)], [10, 10]), (24, 20, 40))                                                                 # brow shadow
    for x in range(176, 372, 22): c.paint(c.ellipse(x, 176 + dy + abs(x - 270) // 6, 7, 6), *T((170, 176, 210)), d=3)                         # chain trim
    # re-draw the eyes over the mask line
    for ex, ey, w, h in ((322, 232, 20, 24), (236, 234, 18, 22)):
        if frame == 3: c.line([(ex - w, ey + dy + 6), (ex + w, ey + dy + 8)], INK, 7)
        else:
            c.paint(c.ellipse(ex, ey + dy, w, h), EYEW); c.paint(c.ellipse(ex + 3, ey + 3 + dy, w - 6, h - 4), (214, 56, 92)); c.paint(c.ellipse(ex + 4, ey + 3 + dy, 6, 9), INK)

def rog_weapon(c, frame, H, G):
    for hand, ang, L in ((H, {0: -24, 1: -78, 2: 12, 3: 96}[frame], 160), (G, {0: -156, 1: -118, 2: -168, 3: 84}[frame], 130)):
        a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
        tip = (hand[0] + dx * L, hand[1] + dy * L)
        c.paint(c.ribbon([(hand[0] - dx * 28, hand[1] - dy * 28), (hand[0] + dx * 10, hand[1] + dy * 10)], [20, 20]), *T((60, 40, 50)), d=3)
        c.paint(c.ribbon([(hand[0] + dx * 10, hand[1] + dy * 10), tip], [24, 20, 4]), *T((206, 216, 238)), d=4)
        c.paint(c.ribbon([(hand[0] + dx * 12 - nx * 22, hand[1] + dy * 12 - ny * 22), (hand[0] + dx * 12 + nx * 22, hand[1] + dy * 12 + ny * 22)], [10, 10]), *T((150, 156, 190)), d=3)
    if frame == 2:
        for k in range(3): c.paint(c.ribbon([(430 + k * 14, 300 + k * 40), (520 + k * 14, 330 + k * 40)], [4, 14, 2]), (226, 244, 255), d=2)

ROG = dict(eye=(214, 56, 92), leg=(52, 54, 80), boot=(70, 66, 96), torso=CLOAK, sleeve=(54, 56, 84), back=rog_back, lower=rog_lower, torso_fx=rog_torso, head=rog_head, weapon=rog_weapon)

# ----------------------------------------------------------------------------------------------- priest
GOLD, WHITE, PURPLE = (232, 178, 60), (244, 244, 252), (122, 62, 160)
def pri_back(c, frame):
    c.paint(c.blob([(176, 326), (136, 470), (150, 546), (410, 546), (424, 470), (366, 326)]), *T(PURPLE), d=8)
    c.paint(c.blob([(170, 170), (380, 170), (440, 340), (450, 530), (110, 534), (104, 340)]), *T((246, 210, 104)), d=9)

def pri_lower(c, frame):
    c.paint(c.blob([(200, 364), (346, 364), (392, 546), (156, 546)]), *T(WHITE), d=8)
    c.paint(c.ribbon([(158, 540), (390, 540)], [20, 20]), *T(GOLD), d=4)
    for x in (214, 330): c.line([(x, 380), (x - (30 if x < 270 else -30), 530)], (196, 198, 226), 5)

def pri_torso(c, frame):
    c.paint(c.ribbon([(272, 330), (274, 538)], [58, 62]), *T(GOLD), d=6)
    for y in (380, 440, 500): c.paint(c.mask([(274, y - 18), (290, y), (274, y + 18), (258, y)]), *T((255, 244, 180)), d=3)
    c.paint(c.ribbon([(206, 330), (272, 346), (338, 330)], [34, 34, 28]), *T(WHITE), d=5)
    c.paint(c.ellipse(272, 346, 12, 12), *T((70, 190, 120)), d=3)

def pri_head(c, frame, dy):
    hair = (246, 210, 104)
    c.paint(c.blob([(160, 214 + dy), (176, 136 + dy), (270, 112 + dy), (364, 136 + dy), (384, 214 + dy), (346, 156 + dy), (306, 182 + dy), (270, 156 + dy), (232, 182 + dy), (196, 156 + dy)]), *T(hair), d=7)
    for x, s in ((166, -1), (378, 1)): c.paint(c.ribbon([(x, 210 + dy), (x + 10 * s, 330)], [34, 30]), *T(hair), d=5)
    c.paint(c.mask([(188, 130 + dy), (214, 8 + dy), (332, 8 + dy), (358, 130 + dy)]), *T(WHITE), d=7)                    # mitre
    c.paint(c.ribbon([(184, 120 + dy), (362, 120 + dy)], [24, 24]), *T(GOLD), d=4)
    c.paint(c.ellipse(272, 120 + dy, 12, 12), *T((70, 190, 120)), d=3)
    c.paint(c.ribbon([(272, 34 + dy), (272, 92 + dy)], [14, 14]), *T(GOLD), d=3); c.paint(c.ribbon([(246, 58 + dy), (298, 58 + dy)], [14, 14]), *T(GOLD), d=3)
    c.paint(c.mask([(332, 20 + dy), (364, 14 + dy), (360, 110 + dy), (338, 100 + dy)]), *T(PURPLE), d=4)

def pri_weapon(c, frame, H, G):
    ang = {0: -88, 1: -100, 2: -62, 3: -90}[frame]
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    top = (H[0] + dx * 230, H[1] + dy * 230)
    c.paint(c.ribbon([(H[0] - dx * 190, H[1] - dy * 190), top], [14, 14]), *T((214, 218, 236)), d=4)
    ctrl = [top, (top[0] + nx * 8 + dx * 26, top[1] + ny * 8 + dy * 26), (top[0] + nx * 52 + dx * 50, top[1] + ny * 52 + dy * 50), (top[0] + nx * 82 + dx * 24, top[1] + ny * 82 + dy * 24), (top[0] + nx * 70 - dx * 6, top[1] + ny * 70 - dy * 6)]
    c.paint(c.ribbon(ctrl, [18, 16, 14, 12, 10]), *T(GOLD), d=4)
    # the open book in the other hand, glowing
    c.paint(c.ellipse(G[0] + 10, G[1] - 22, 52, 30), (255, 244, 170))
    c.paint(c.mask([(G[0] - 32, G[1] - 8), (G[0] + 8, G[1] - 40), (G[0] + 58, G[1] - 8), (G[0] + 14, G[1] + 6)]), *T((236, 236, 248)), d=4)
    c.line([(G[0] + 10, G[1] - 40), (G[0] + 14, G[1] + 4)], (150, 150, 190), 4)
    if frame:
        for k in range(5 if frame == 2 else 3):
            px, py = top[0] + 40 + k * 34, top[1] + 30 + (k % 3) * 26 - 30
            c.paint(c.mask([(px, py - 16), (px + 9, py), (px, py + 16), (px - 9, py)]), (255, 244, 170), d=2)

PRI = dict(eye=(70, 150, 220), leg=(236, 236, 246), boot=(140, 100, 50), torso=WHITE, sleeve=(244, 244, 252), back=pri_back, lower=pri_lower, torso_fx=pri_torso, head=pri_head, weapon=pri_weapon)

# ----------------------------------------------------------------------------------------------- reaper
BURG = (136, 40, 62)
def rea_back(c, frame):
    s = {0: 0, 1: 8, 2: 22, 3: -6}[frame]
    c.paint(c.blob([(192, 336), (124 - s, 470), (146 - s, 546), (210, 508), (252, 548), (302, 512), (372, 546), (410 + s, 430), (344, 336)]), *T((54, 42, 80)), d=8)
    c.paint(c.ribbon([(184, 168), (134 - s, 230), (118 - s, 330), (140 - s, 440)], [60, 56, 44, 8]), *T((214, 198, 178)), d=6)
    c.paint(c.ribbon([(362, 168), (410 + s, 230), (426 + s, 330), (404 + s, 440)], [60, 56, 44, 8]), *T((214, 198, 178)), d=6)

def rea_lower(c, frame):
    c.paint(c.blob([(204, 428), (348, 428), (370, 478), (180, 478)]), *T((50, 38, 70)), d=6)
    for lx in (246, 312): c.paint(c.ribbon([(lx, 470), (lx, 520)], [50, 46]), *T((70, 58, 110)), d=5)

def rea_torso(c, frame):
    c.paint(c.ribbon([(200, 334), (272, 350), (344, 334)], [34, 34, 28]), *T((60, 46, 86)), d=5)
    c.line([(242, 346), (246, 440)], (60, 46, 86), 7); c.line([(304, 346), (300, 440)], (60, 46, 86), 7)
    c.paint(c.ribbon([(210, 440), (340, 440)], [16, 16]), *T((224, 180, 80)), d=3)

def rea_head(c, frame, dy):
    hair = (214, 198, 178)
    c.paint(c.blob([(158, 200 + dy), (172, 130 + dy), (270, 104 + dy), (370, 130 + dy), (386, 200 + dy), (340, 170 + dy), (290, 196 + dy), (250, 160 + dy), (210, 190 + dy)]), *T(hair), d=7)
    c.paint(c.mask([(172, 168 + dy), (200, 186 + dy), (214, 262 + dy), (176, 220 + dy)]), *T(hair), d=4)
    for bx in (180, 366):                                                                                                 # bows on the tails
        c.paint(c.ellipse(bx, 150 + dy, 26, 20), *T((40, 34, 54)), d=4)

def rea_weapon(c, frame, H, G):
    ang = {0: -66, 1: -112, 2: 20, 3: 96}[frame]
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    L = 230 if frame != 3 else 150
    base = (H[0] - dx * 90, H[1] - dy * 90); top = (H[0] + dx * L, H[1] + dy * L)
    c.paint(c.ribbon([base, top], [14, 14]), *T((84, 62, 70)), d=4)
    blade = [(top[0] - dx * 10, top[1] - dy * 10), (top[0] + nx * 66 + dx * 10, top[1] + ny * 66 + dy * 10), (top[0] + nx * 124 - dx * 40, top[1] + ny * 124 - dy * 40), (top[0] + nx * 132 - dx * 112, top[1] + ny * 132 - dy * 112)]
    c.paint(c.ribbon(blade, [38, 34, 20, 4]), *T((112, 118, 160)), d=5)
    c.paint(c.ribbon([(blade[1][0], blade[1][1]), blade[2]], [8, 6]), (226, 236, 255))
    c.paint(c.ellipse(top[0], top[1], 14, 14), *T((200, 50, 80)), d=3)
    if frame == 2:
        arc = [(H[0] + math.cos(math.radians(t)) * 270, H[1] + math.sin(math.radians(t)) * 270) for t in range(-84, -6, 8)]
        c.paint(c.ribbon(arc, [4] + [28] * (len(arc) - 2) + [2]), (236, 226, 255), d=3)

REA = dict(eye=(200, 56, 84), leg=(70, 58, 110), boot=(120, 52, 64), torso=BURG, sleeve=BURG, back=rea_back, lower=rea_lower, torso_fx=rea_torso, head=rea_head, weapon=rea_weapon)

# ----------------------------------------------------------------------------------------------- witch
ROBE, HOODC = (30, 46, 92), (40, 70, 118)
def wit_back(c, frame):
    c.paint(c.blob([(190, 330), (140, 480), (158, 546), (404, 546), (424, 470), (352, 330)]), *T(ROBE), d=8)
    c.paint(c.blob([(176, 350), (160, 470), (184, 530), (206, 470)]), *T((156, 74, 138)), d=4)

def wit_lower(c, frame):
    c.paint(c.blob([(200, 380), (346, 380), (392, 546), (156, 546)]), *T(ROBE), d=8)
    c.paint(c.ribbon([(158, 538), (392, 538)], [22, 22]), *T((226, 176, 66)), d=4)
    for x in range(184, 380, 26): c.paint(c.mask([(x - 9, 520), (x + 9, 520), (x, 498)]), *T((226, 176, 66)), d=2)

def wit_torso(c, frame):
    c.paint(c.ribbon([(206, 332), (272, 350), (338, 332)], [36, 36, 30]), *T(HOODC), d=5)
    c.paint(c.ribbon([(272, 346), (274, 520)], [8, 8]), *T((226, 176, 66)), d=3)
    c.paint(c.ellipse(272, 392, 13, 13), *T((90, 176, 255)), d=3)

def wit_head(c, frame, dy):
    hair = (234, 202, 132)
    c.paint(c.blob([(142, 262 + dy), (148, 126 + dy), (270, 42 + dy), (394, 126 + dy), (402, 262 + dy), (354, 304 + dy), (270, 316 + dy), (186, 304 + dy)]), *T(HOODC), d=8)
    c.paint(c.blob([(176, 200 + dy), (270, 150 + dy), (364, 200 + dy), (366, 300 + dy), (270, 322 + dy), (176, 300 + dy)]), *T(hair), d=7)
    _orig_face(c, WIT, frame, dy)
    c.paint(c.blob([(170, 186 + dy), (210, 138 + dy), (288, 128 + dy), (356, 170 + dy), (330, 168 + dy), (286, 182 + dy), (250, 160 + dy), (214, 196 + dy), (196, 240 + dy)]), *T(hair), d=6)
    c.paint(c.ribbon([(150, 248 + dy), (160, 140 + dy), (270, 52 + dy), (390, 140 + dy), (398, 248 + dy)], [10, 10, 10, 10, 10]), *T((226, 176, 66)), d=3)

def wit_weapon(c, frame, H, G):
    ang = {0: -78, 1: -96, 2: -56, 3: -88}[frame]
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    top = (H[0] + dx * 250, H[1] + dy * 250)
    c.paint(c.ribbon([(H[0] - dx * 150, H[1] - dy * 150), top], [14, 14]), *T((226, 176, 66)), d=4)
    for s in (-1, 1):
        for k, (ox, oy) in enumerate(((52, -26), (78, 6))):
            c.paint(c.tri((top[0] + nx * s * ox - dx * 8, top[1] + ny * s * ox - dy * 8), (top[0] + nx * s * (ox - 14) + dx * oy, top[1] + ny * s * (ox - 14) + dy * oy - 2), (top[0] + nx * s * (ox + 22) + dx * (oy + 40), top[1] + ny * s * (ox + 22) + dy * (oy + 40))), *T((196, 204, 226)), d=3)
    c.paint(c.ellipse(top[0], top[1], 46, 46), *T((226, 176, 66)), d=5)
    c.paint(c.ellipse(top[0], top[1], 30, 30), *T((70, 150, 240)), d=4)
    c.paint(c.ellipse(top[0] - 8, top[1] - 10, 8, 8), (220, 244, 255))
    if frame:
        for k in range(6 if frame == 2 else 3):
            px, py = top[0] + 50 + k * 30, top[1] + (k % 3) * 34 - 20
            c.paint(c.mask([(px - 14, py), (px, py - 8), (px + 14, py), (px, py + 8)]), (170, 232, 255), d=2)
            c.paint(c.mask([(px - 4, py - 14), (px, py - 4), (px + 4, py - 14)]), (214, 244, 255), d=1)

WIT = dict(eye=(100, 150, 120), leg=(40, 40, 70), boot=(60, 44, 70), torso=ROBE, sleeve=ROBE, back=wit_back, lower=wit_lower, torso_fx=wit_torso, head=lambda c, f, dy: None, weapon=wit_weapon)
# the witch's hood is drawn behind the face, so its head() draws everything itself before the face
_orig_face = face
def face_witch(c, k, frame, dy):
    if k is WIT: wit_head(c, frame, dy)
    else: _orig_face(c, k, frame, dy)
face = face_witch

CLASSES = {"swordsman": SAM, "rogue": ROG, "priest": PRI, "reaper": REA, "witch": WIT}

def render(k, frame):
    c = Canvas(SZ)
    img = body(c, k, frame)
    return img, c.colors

if __name__ == "__main__":
    out = sys.argv[1]
    names = sys.argv[3:] or list(CLASSES)
    sheet = Image.new("RGBA", (SZ[0] * 4, SZ[1] * len(names)), (14, 24, 52, 255)) if len(sys.argv) > 2 else None
    for r, name in enumerate(names):
        k = CLASSES[name]
        big, pal = {}, []
        for f, key in enumerate(("awake", "awake-mid", "awake-down", "sleep")):
            big[key], cols = render(k, f)
            pal += [x for x in cols if x not in pal]
            if sheet: sheet.alpha_composite(big[key], (f * SZ[0], r * SZ[1]))
        pal = [INK] + pal
        raw = {key: to_cells(v, pal) for key, v in big.items()}
        box = bbox(raw.values())
        cells = {key: outline([row[box[0]:box[2]] for row in v[box[1]:box[3]]], INK) for key, v in raw.items()}
        frames = {f"{name}-awake": cells["awake"], f"{name}-awake-mid": cells["awake-mid"], f"{name}-awake-down": cells["awake-down"],
                  f"{name}-sleep": z_marks(cells["sleep"], 0), f"{name}-sleep-1": z_marks(cells["sleep"], 1), f"{name}-sleep-2": z_marks(cells["sleep"], 2)}
        n = write_json(frames, os.path.join(out, f"{name}.json"))
        print(name, f"{len(cells['awake'][0])}x{len(cells['awake'])}", n, "colours")
    if sheet: sheet.save(sys.argv[2])
