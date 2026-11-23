# Dragon boss, 56x56, facing left toward the party: dark crimson, angry yellow slit eyes, curled horns, fangs, spiked back,
# bat wings. Frames: idle (wing up/down), attack (jaw open, glowing maw), hit (flashes pink), sleep (eyes shut, wings folded, "z").
# python avatars/dragon.py avatars/dragon.json, then node avatars/build.mjs
import json, sys
N = 56
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def inside(x, y, poly):                                   # even-odd point in polygon
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def line(g, a, b, w, c, keep=None):                       # thick line; keep: only paint over these letters
    (x1, y1), (x2, y2) = a, b
    steps = int(max(abs(x2 - x1), abs(y2 - y1)) * 2) + 1
    for s in range(steps + 1):
        px, py = x1 + (x2 - x1) * s / steps, y1 + (y2 - y1) * s / steps
        for y in range(max(0, int(py - w)), min(N, int(py + w) + 2)):
            for x in range(max(0, int(px - w)), min(N, int(px + w) + 2)):
                if (x - px) ** 2 + (y - py) ** 2 <= (w / 2) ** 2 and (keep is None or g[y][x] in keep): g[y][x] = c

def fill(g, fn, c, keep=None):
    for y in range(N):
        for x in range(N):
            if fn(x, y) and (keep is None or g[y][x] in keep): g[y][x] = c

def figure(mode, f=0):                                    # mode: idle | attack | sleep
    g = [["."] * N for _ in range(N)]
    up = f == 0 and mode != "sleep"
    # bat wing behind the body: membrane M, finger bones V
    if mode == "sleep":
        tips = [(44, 20), (52, 26), (50, 33)]
    elif up:
        tips = [(40, 1), (51, 7), (55, 20)]
    else:
        tips = [(48, 12), (55, 22), (54, 33)]
    sh = (36, 29)
    poly = [sh, tips[0], (tips[0][0] + 5, (tips[0][1] + tips[1][1]) // 2 + 1), tips[1], (tips[1][0] - 2, (tips[1][1] + tips[2][1]) // 2 + 1), tips[2], (44, 33)]
    fill(g, lambda x, y: inside(x, y, poly), "M")
    for t in tips: line(g, sh, t, 1.8, "V")
    line(g, sh, tips[0], 2.6, "V")
    # tail: curls up behind, ending in a spade
    line(g, (46, 40), (51, 45), 6, "B"); line(g, (51, 45), (55, 41), 4, "B"); line(g, (55, 41), (54, 34), 2.6, "B")
    fill(g, lambda x, y: inside(x, y, [(52, 36), (55, 30), (56, 37)]), "H")
    # legs and claws (back leg, front leg)
    for lx, ly, w in ((43, 41, 7), (23, 42, 6)):
        fill(g, lambda x, y: lx <= x < lx + w and ly <= y <= 51, "B")
        fill(g, lambda x, y: lx - 1 <= x < lx + w + 2 and 49 <= y <= 51, "B")
        for k in range(3):
            fill(g, lambda x, y, k=k: x == lx - 1 + k * 3 and 52 <= y <= 54 or x == lx + k * 3 and y == 54, "H")
    # body, haunch, belly plates
    fill(g, lambda x, y: ell(x, y, 35, 36, 14, 10), "B")
    fill(g, lambda x, y: ell(x, y, 44, 40, 7, 8), "B")
    fill(g, lambda x, y: ell(x, y, 32, 41, 11, 5) and y > 37, "Y", "B")
    for yy in (39, 42, 45): fill(g, lambda x, y, yy=yy: y == yy and 22 <= x <= 42, "S", "Y")      # belly plate lines
    fill(g, lambda x, y: ell(x, y, 40, 30, 9, 3) and y < 31, "L", "B")                          # lit back
    # neck and head
    line(g, (28, 31), (19, 20), 9, "B")
    fill(g, lambda x, y: ell(x, y, 15, 17, 9, 6.5), "B")                                         # head
    fill(g, lambda x, y: ell(x, y, 7, 20, 7, 3.6), "B")                                          # snout
    fill(g, lambda x, y: ell(x, y, 9, 24, 7, 2.2) and y >= 23, "S") if mode != "attack" else None
    for xx, h in ((2, 3), (5, 4), (8, 3), (11, 3)):                                              # upper fangs
        fill(g, lambda x, y, xx=xx, h=h: x == xx and 22 <= y < 22 + h, "H")
    if mode == "attack":                                                                         # jaw open, maw glowing
        fill(g, lambda x, y: ell(x, y, 9, 28, 7, 2.6), "B")
        fill(g, lambda x, y: ell(x, y, 8, 25, 6, 2.2), "F")
        fill(g, lambda x, y: ell(x, y, 7, 25, 3, 1.2), "C")
        for xx in (3, 6, 9): fill(g, lambda x, y, xx=xx: x == xx and 26 <= y <= 27, "H")         # lower fangs
    else:
        for xx in (4, 8): fill(g, lambda x, y, xx=xx: x == xx and 20 <= y <= 21, "K")             # nostril and mouth line
        fill(g, lambda x, y: y == 22 and 1 <= x <= 12, "K")
    fill(g, lambda x, y: ell(x, y, 1.5, 19, 1.2, 1.2), "K")                                      # nostril
    # curled horns, back spikes
    line(g, (13, 12), (17, 5), 3.4, "H"); line(g, (17, 5), (23, 2), 2.6, "H"); line(g, (23, 2), (27, 3), 1.6, "H")
    line(g, (19, 12), (25, 7), 3, "H"); line(g, (25, 7), (30, 6), 2, "H")
    for sx, sy in ((24, 25), (28, 27), (32, 27), (37, 27), (42, 29), (46, 33)):
        if mode == "sleep" and sx > 38: continue
        fill(g, lambda x, y, sx=sx, sy=sy: abs(x - sx) <= (sy - y) * 0.45 and sy - 5 <= y <= sy, "H", "B.")
    # angry eye (slit pupil under a heavy brow) or a shut one
    if mode == "sleep":
        fill(g, lambda x, y: y == 15 and 9 <= x <= 14, "K")
    else:
        fill(g, lambda x, y: 9 <= x <= 14 and 14 <= y <= 16, "E")
        fill(g, lambda x, y: x in (11, 12) and 14 <= y <= 16, "K")
        line(g, (7, 11), (16, 15), 2.2, "S")                                                      # brow slants down toward the nose
    # outline
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == "." and any(0 <= y + dy < N and 0 <= x + dx < N and g[y + dy][x + dx] in "BSLMVYH"
                                      for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))): out[y][x] = "K"
    g = out
    if mode == "sleep":
        z = ["XXXX", "..X.", ".X..", "XXXX"]
        for dy, row in enumerate(z):
            for dx, c in enumerate(row):
                if c != "." and 0 <= 3 + f * 3 + dy < N: g[3 + f * 3 + dy][3 + dx] = "Z"
    return g

def flash(g):                                             # got hit: the body goes pink
    return [["P" if c in "BSLMVYH" else c for c in r] for r in g]

pal = {"B": "#7a1f2b", "S": "#4a1220", "L": "#b83a45", "Y": "#d9a35a", "M": "#3b1530", "V": "#8a2a4a", "H": "#efe2c4",
       "E": "#ffe14a", "K": "#0d0a14", "F": "#ff6a1a", "C": "#fff3a0", "Z": "#cfd8ff", "P": "#ff9aa8"}
grids = {"dragon-idle": figure("idle", 0), "dragon-idle-1": figure("idle", 1), "dragon-attack": figure("attack", 0),
         "dragon-hit": flash(figure("idle", 1)), "dragon-sleep": figure("sleep", 0), "dragon-sleep-1": figure("sleep", 1),
         "dragon-sleep-2": figure("sleep", 2)}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert len(g) == N and all(len(r) == N for r in g), name
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
