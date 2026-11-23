# The tab bar's backdrop: a misty twilight pine forest in layers (pale far trees fading into a glowing mist, darker mid trees,
# near trees, black foreground trunks with branches), a lit path in the middle where the fight happens.
# 640x60 art pixels, written 3x as a PNG (1920x180). python avatars/forest.py mods/kage-tabs/forest-bg.png
import math, random, sys
from PIL import Image, ImageDraw

W, H, S = 640, 60, 3
random.seed(7)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
SKY = [(8, 18, 42), (13, 33, 68), (22, 54, 98), (36, 82, 128), (58, 118, 160), (92, 160, 190), (146, 204, 220)]   # dark rim to bright glow
FAR, MID, NEAR, FORE, DEEP = (44, 92, 134), (30, 68, 108), (19, 46, 82), (10, 22, 50), (5, 10, 26)
GROUND, PATH, PATH_LIT = (10, 26, 52), (24, 62, 100), (44, 98, 138)
HORIZON = 47

img = Image.new("RGB", (W, H))
px = img.load()
# sky and mist: a glow behind the middle, dithered so it stays pixel art
for y in range(H):
    for x in range(W):
        d = math.hypot((x - 320) / 250, (y - 30) / 42)
        t = max(0.0, 1 - d) ** 0.9 * (len(SKY) - 1)
        lo = int(t)
        frac = t - lo
        i = min(len(SKY) - 1, lo + (1 if frac * 16 > BAYER[y % 4][x % 4] else 0))
        px[x, y] = SKY[i]
draw = ImageDraw.Draw(img)

def pine(cx, base, height, half, color, trunk=3):
    top = base - height
    for y in range(top, base - trunk):
        prog = (y - top) / max(1, height - trunk)
        tier = ((y - top) % 7) / 7
        w = int(half * (0.12 + 0.88 * prog) * (0.62 + 0.38 * tier) + random.choice((0, 0, 1)))
        draw.line([(cx - w, y), (cx + w, y)], fill=color)
    draw.rectangle([cx - 1, base - trunk, cx, base], fill=color)

# far trees: pale, everywhere, fading into the mist at their feet
for cx in range(-6, W + 12, 11):
    pine(cx + random.randint(-3, 3), HORIZON, random.randint(26, 40), random.randint(5, 8), FAR)
for y in range(34, HORIZON + 2):                                   # mist lying at their feet
    for x in range(W):
        if (x + y * 2) % 4 < 2 and y > 38 or y > 43:
            r, g, b = px[x, y]; px[x, y] = tuple((a * 3 + c) // 4 for a, c in zip((r, g, b), SKY[4]))
# mid trees, thinned out in the lit middle
for cx in range(-8, W + 14, 19):
    if 255 < cx < 385 and random.random() < 0.7: continue
    pine(cx + random.randint(-4, 4), 50, random.randint(40, 54), random.randint(8, 11), MID)
# ground and the lit path
draw.rectangle([0, HORIZON + 1, W, H], fill=GROUND)
for y in range(HORIZON + 1, H):
    k = (y - HORIZON) / (H - HORIZON)
    half = 70 + 190 * k
    for x in range(int(320 - half), int(320 + half)):
        e = abs(x - 320) / half
        near_edge = e > 0.82
        c = PATH_LIT if (e < 0.45 and (x + y) % 3 == 0 or e < 0.25) else PATH
        px[x, y] = GROUND if near_edge and (x + y) % 2 else c
# near trees along both sides
for cx in list(range(-10, 190, 27)) + list(range(450, W + 14, 27)):
    pine(cx + random.randint(-5, 5), 55, random.randint(58, 74), random.randint(11, 15), NEAR, 4)
# foreground: black trunks with sparse branches and needle tufts, left and right, plus bushes
def trunk(x, w, color):
    draw.rectangle([x, 0, x + w - 1, H], fill=color)
    for y in range(6, 46, random.randint(9, 13)):
        side = random.choice((-1, 1))
        for k in range(random.randint(10, 20)):
            bx, by = x + (w if side > 0 else 0) + side * k, y - k // 3
            draw.point((bx, by), fill=color)
            if k % 4 == 3:
                for dy, dx in ((-1, 0), (1, 0), (0, side), (-1, side), (1, -side)): draw.point((bx + dx, by + dy), fill=color)
for x, w in ((14, 9), (46, 6), (96, 8), (150, 5)): trunk(x, w, DEEP if w > 6 else FORE)
for x, w in ((612, 9), (578, 7), (528, 8), (478, 5)): trunk(x, w, DEEP if w > 6 else FORE)
for x in list(range(0, 215, 2)) + list(range(425, W, 2)):           # grass and ferns along the path
    if random.random() < 0.55:
        h = random.randint(2, 6)
        draw.line([(x, H - 4 - random.randint(0, 6)), (x, H - 4 - random.randint(0, 6) - h)], fill=DEEP if random.random() < 0.6 else FORE)
for x in range(0, W):                                               # dark floor edge
    draw.point((x, H - 1), fill=DEEP); draw.point((x, H - 2), fill=FORE if x % 3 else DEEP)

img.resize((W * S, H * S), Image.NEAREST).save(sys.argv[1])
