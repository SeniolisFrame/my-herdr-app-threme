# Swordsman, detailed (76x64 art px): steel cuirass over a blue tabard, round pauldrons, a buckler, a red scarf and cape, short brown
# hair, a long sword. Frames: awake (sword raised), awake-mid, awake-down (slash, with a trail), sleep/-1/-2 (leaning on the planted sword).
#   python avatars/swordsman_hd.py avatars/swordsman.json [preview.png]   then   node avatars/build.mjs
import math, sys
from PIL import Image
from hd import Canvas, S, to_cells, bbox, outline, write_json, z_marks

SZ = (760, 640)
STEEL, STEEL_R, STEEL_S = (138, 156, 192), (232, 242, 255), (66, 78, 114)
BLUE, BLUE_R, BLUE_S = (52, 92, 172), (96, 140, 224), (26, 46, 96)
RED, RED_R, RED_S = (176, 40, 52), (236, 96, 96), (98, 20, 32)
LEATHER, LEATHER_R, LEATHER_S = (84, 54, 34), (140, 98, 64), (44, 28, 18)
GOLD, GOLD_R, GOLD_S = (232, 184, 70), (255, 232, 140), (150, 108, 30)
SKIN, SKIN_R, SKIN_S = (252, 212, 174), (255, 238, 214), (214, 158, 118)
HAIR, HAIR_R, HAIR_S = (104, 62, 34), (162, 108, 62), (58, 34, 20)
BLADE, BLADE_R, BLADE_S = (206, 218, 238), (255, 255, 255), (120, 138, 172)
TRAIL = (214, 238, 255)
INK = (14, 14, 34)
DEEP = (34, 40, 70)
PALETTE = [STEEL, STEEL_R, STEEL_S, BLUE, BLUE_R, BLUE_S, RED, RED_R, RED_S, LEATHER, LEATHER_R, LEATHER_S, GOLD, GOLD_R, GOLD_S,
           SKIN, SKIN_R, SKIN_S, HAIR, HAIR_R, HAIR_S, BLADE, BLADE_R, BLADE_S, TRAIL, (255, 255, 255), (50, 90, 170), INK, DEEP, (166, 78, 78)]

def figure(frame):
    """frame: up | mid | down | sleep"""
    c = Canvas(SZ)
    sleep = frame == "sleep"
    hand = {"up": (462, 292), "mid": (492, 304), "down": (506, 330), "sleep": (470, 372)}[frame]
    ang = {"up": -76, "mid": -38, "down": 6, "sleep": 90}[frame]
    hd = (26, 44) if sleep else (0, 0)                       # head dips when asleep
    sway = {"up": 0, "mid": 14, "down": 28, "sleep": -8}[frame]

    # cape behind everything
    c.paint(c.blob([(278, 226), (214, 300 - sway // 2), (180 - sway, 430), (190 - sway, 540), (252, 520 + sway // 2), (282, 430), (322, 310)]), RED, RED_R, RED_S, 10)
    # far leg: cloth thigh, steel greave and sabaton
    c.paint(c.ribbon([(318, 404), (302, 490), (292, 540)], [76, 62, 56]), BLUE, BLUE_R, BLUE_S, 8)
    c.paint(c.ribbon([(300, 512), (292, 592)], [58, 50]), STEEL, STEEL_R, STEEL_S, 7)
    c.paint(c.blob([(246, 604), (262, 580), (316, 576), (328, 604), (330, 618), (246, 620)]), STEEL, STEEL_R, STEEL_S, 6)
    # near leg
    c.paint(c.ribbon([(362, 404), (392, 478), (408, 534)], [88, 70, 58]), BLUE, BLUE_R, BLUE_S, 8)
    c.paint(c.ribbon([(406, 516), (420, 596)], [64, 54]), STEEL, STEEL_R, STEEL_S, 8)
    c.paint(c.ellipse(398, 506, 38, 32), STEEL, STEEL_R, STEEL_S, 7)                       # poleyn (knee)
    c.paint(c.ribbon([(398, 490), (398, 522)], [6, 6]), GOLD)
    c.paint(c.blob([(380, 606), (400, 580), (462, 572), (498, 600), (502, 620), (380, 622)]), STEEL, STEEL_R, STEEL_S, 6)
    c.paint(c.ribbon([(398, 592), (470, 590)], [8, 8]), STEEL_S)
    # torso: a plate with a tapered waist, a centre ridge, gold emblem; faulds below; gorget at the neck
    torso = c.mask([(262, 236), (300, 214), (404, 214), (442, 238), (428, 300), (412, 388), (296, 388), (278, 300)])
    c.paint(torso, STEEL, STEEL_R, STEEL_S, 10)
    c.paint(c.ribbon([(352, 226), (354, 384)], [16, 16]), STEEL_R)
    c.paint(c.ribbon([(310, 250), (300, 340)], [10, 10]), STEEL_S)
    c.paint(c.ribbon([(396, 250), (406, 340)], [10, 10]), STEEL_S)
    c.paint(c.mask([(354, 262), (370, 284), (354, 306), (338, 284)]), GOLD, GOLD_R, GOLD_S, 4)       # emblem
    for y, w in ((392, 128), (410, 134), (428, 138)):                                                  # faulds, overlapping bands
        c.paint(c.ribbon([(354 - w / 2, y), (354 + w / 2, y)], [22, 22]), STEEL, STEEL_R, STEEL_S, 5)
    c.paint(c.ribbon([(296, 374), (412, 376)], [14, 14]), LEATHER, LEATHER_R, LEATHER_S, 4)
    c.paint(c.ellipse(354, 376, 12, 12), GOLD, GOLD_R, GOLD_S, 3)
    for tx, tw in ((318, 56), (388, 62)):                                                              # tassets over the thighs
        c.paint(c.mask([(tx - tw / 2, 440), (tx + tw / 2, 440), (tx + tw / 2 - 6, 504), (tx, 520), (tx - tw / 2 + 6, 504)]), STEEL, STEEL_R, STEEL_S, 6)
    c.paint(c.mask([(334, 440), (372, 440), (366, 500), (354, 512), (342, 500)]), BLUE, BLUE_R, BLUE_S, 4)      # tabard between them
    c.paint(c.ellipse(354, 222, 52, 26), STEEL, STEEL_R, STEEL_S, 6)                                   # gorget
    # far arm, with the kite shield held in front
    c.paint(c.ribbon([(272, 246), (244, 316), (252, 372)], [52, 44, 38]), BLUE_S, BLUE, BLUE_S, 5)
    shield = c.blob([(186, 262), (262, 270), (276, 344), (240, 432), (196, 348)])
    c.paint(shield, STEEL, STEEL_R, STEEL_S, 9)
    c.paint(c.blob([(200, 282), (252, 288), (262, 344), (236, 408), (208, 346)]), BLUE, BLUE_R, BLUE_S, 7)
    c.paint(c.mask([(232, 296), (246, 330), (232, 372), (218, 330)]), GOLD, GOLD_R, GOLD_S, 4)
    c.paint(c.ribbon([(196, 320), (268, 320)], [10, 10]), GOLD)
    # near pauldron, stacked plates, and the sword arm
    sh = (434, 252)
    elbow = ((sh[0] + hand[0]) / 2 + 8, (sh[1] + hand[1]) / 2 + 24)
    c.paint(c.ribbon([sh, elbow], [56, 44]), BLUE_S, BLUE, BLUE_S, 5)
    c.paint(c.ribbon([elbow, hand], [48, 38]), STEEL, STEEL_R, STEEL_S, 6)                              # vambrace
    c.paint(c.ribbon([elbow, (elbow[0] + (hand[0] - elbow[0]) * .3, elbow[1] + (hand[1] - elbow[1]) * .3)], [14, 14]), GOLD)
    for cy, rx, ry in ((284, 44, 24), (262, 50, 30), (240, 56, 38)):
        c.paint(c.ellipse(440, cy, rx, ry), STEEL, STEEL_R, STEEL_S, 8)
    for rv in (416, 440, 464): c.paint(c.ellipse(rv, 238, 5, 5), GOLD, GOLD_R)
    # head: angular face, open helm with a nasal bar, cheek guards, a plume
    hx, hy = 352 + hd[0], 136 + hd[1]
    c.paint(c.ribbon([(352 + hd[0] * .6, 196 + hd[1] * .6), (352, 222)], [48, 48]), SKIN_S)
    face = c.mask([(hx - 56, hy - 40), (hx + 54, hy - 42), (hx + 62, hy + 6), (hx + 42, hy + 46), (hx + 2, hy + 66), (hx - 34, hy + 44), (hx - 58, hy + 6)])
    c.paint(face, SKIN, SKIN_R, SKIN_S, 8)
    c.paint(c.mask([(hx - 62, hy - 4), (hx - 36, hy - 4), (hx - 30, hy + 42), (hx - 56, hy + 10)]), STEEL, STEEL_R, STEEL_S, 5)   # cheek guard
    dome = c.mask([(hx - 66, hy - 30), (hx - 62, hy - 78), (hx - 20, hy - 112), (hx + 42, hy - 108), (hx + 68, hy - 66), (hx + 66, hy - 36), (hx + 30, hy - 48), (hx - 20, hy - 46)])
    c.paint(dome, STEEL, STEEL_R, STEEL_S, 9)
    c.paint(c.ribbon([(hx - 64, hy - 42), (hx + 66, hy - 46)], [18, 18]), STEEL_S, STEEL, DEEP, 4)
    c.paint(c.ribbon([(hx + 6, hy - 112), (hx + 8, hy - 52)], [12, 12]), STEEL_R)                      # crest ridge
    c.paint(c.ribbon([(hx + 8, hy - 44), (hx + 10, hy + 20)], [14, 14]), STEEL, STEEL_R, STEEL_S, 4)    # nasal bar
    c.paint(c.ribbon([(hx + 4, hy - 108), (hx - 50, hy - 132), (hx - 108, hy - 118), (hx - 150, hy - 70)], [34, 30, 20, 4]), RED, RED_R, RED_S, 6)   # plume
    if sleep:
        for ex in (hx - 24, hx + 34): c.line([(ex - 14, hy - 2), (ex + 14, hy + 2)], INK, 7)
    else:
        for ex, ey, w in ((hx + 36, hy - 4, 13), (hx - 16, hy - 4, 12)):
            c.paint(c.ellipse(ex, ey, w, w - 3), (255, 255, 255))
            c.paint(c.ellipse(ex + 3, ey, 7, 9), (50, 90, 170))
            c.paint(c.ellipse(ex + 4, ey, 3, 5), INK)
        c.line([(hx + 18, hy - 24), (hx + 56, hy - 18)], DEEP, 6)
        c.line([(hx - 34, hy - 22), (hx - 4, hy - 16)], DEEP, 6)
    c.line([(hx + 14, hy + 36), (hx + 40, hy + 38)], (166, 78, 78), 6)                                 # mouth
    c.line([(hx + 20, hy + 14), (hx + 28, hy + 22)], SKIN_S, 5)                                        # nose
    c.paint(c.mask([(hx - 6, hy + 52), (hx + 38, hy + 36), (hx + 42, hy + 46), (hx + 2, hy + 66)]), SKIN_S)      # jaw shadow
    # sword: grip, guard, blade with a fuller and an edge, pommel, a steel gauntlet
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = -dy, dx
    L = 236
    tip = (hand[0] + dx * (L + 34), hand[1] + dy * (L + 34))
    c.paint(c.ribbon([(hand[0] - dx * 50, hand[1] - dy * 50), (hand[0] + dx * 18, hand[1] + dy * 18)], [22, 22]), LEATHER, LEATHER_R, LEATHER_S, 4)
    c.paint(c.ellipse(hand[0] - dx * 56, hand[1] - dy * 56, 16, 16), GOLD, GOLD_R, GOLD_S, 4)
    c.paint(c.ribbon([(hand[0] + dx * 18, hand[1] + dy * 18), tip], [30, 28, 6]), BLADE, BLADE_R, BLADE_S, 5)
    c.paint(c.ribbon([(hand[0] + dx * 44, hand[1] + dy * 44), (hand[0] + dx * (L - 20), hand[1] + dy * (L - 20))], [7, 6]), BLADE_S)
    c.paint(c.ribbon([(hand[0] + dx * 20 - nx * 40, hand[1] + dy * 20 - ny * 40), (hand[0] + dx * 20 + nx * 40, hand[1] + dy * 20 + ny * 40)], [16, 16]), GOLD, GOLD_R, GOLD_S, 4)
    c.paint(c.ellipse(hand[0] + dx * 2, hand[1] + dy * 2, 24, 22), STEEL, STEEL_R, STEEL_S, 5)
    for k in range(3): c.line([(hand[0] + dx * (k * 9 - 8) - nx * 22, hand[1] + dy * (k * 9 - 8) - ny * 22), (hand[0] + dx * (k * 9 - 8) + nx * 22, hand[1] + dy * (k * 9 - 8) + ny * 22)], STEEL_S, 3)
    if frame == "down":                                                                     # the slash leaves a pale arc
        arc = [(hand[0] + math.cos(math.radians(t)) * 250, hand[1] + math.sin(math.radians(t)) * 250) for t in range(-72, -6, 8)]
        c.paint(c.ribbon(arc, [4] + [28] * (len(arc) - 2) + [2]), TRAIL)
    return c.img

if __name__ == "__main__":
    big = {"awake": figure("up"), "awake-mid": figure("mid"), "awake-down": figure("down"), "sleep": figure("sleep")}
    if len(sys.argv) > 2:
        sheet = Image.new("RGBA", (SZ[0] * 2, SZ[1] * 2), (14, 24, 52, 255))
        for i, k in enumerate(big): sheet.alpha_composite(big[k], ((i % 2) * SZ[0], (i // 2) * SZ[1]))
        sheet.save(sys.argv[2])
    raw = {k: to_cells(v, PALETTE) for k, v in big.items()}
    box = bbox(raw.values())
    cells = {k: outline([r[box[0]:box[2]] for r in v[box[1]:box[3]]], INK) for k, v in raw.items()}
    frames = {"swordsman-awake": cells["awake"], "swordsman-awake-mid": cells["awake-mid"], "swordsman-awake-down": cells["awake-down"],
              "swordsman-sleep": z_marks(cells["sleep"], 0), "swordsman-sleep-1": z_marks(cells["sleep"], 1), "swordsman-sleep-2": z_marks(cells["sleep"], 2)}
    n = write_json(frames, sys.argv[1])
    print(f"{len(cells['awake'][0])}x{len(cells['awake'])}, {n} colours")
