# Fire dragon, 60x60, facing left toward the party: a low predatory crouch, long S-curved neck, horns swept up and forward,
# big shoulder spikes, large bat wings, a heavy tail along the ground. Crimson with an amber underside and violet wings.
# Frames: idle (wings up/down, head bobs), attack (jaw open, glowing maw; the flame stream is drawn by the tab bar),
# hit (flashes pink), sleep (eyes shut, wings folded, "z").  python avatars/dragon.py avatars/dragon.json, then node avatars/build.mjs
import json, sys
N = 60
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def inside(x, y, poly):                                   # even-odd point in polygon
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def line(g, a, b, c, keep=None):                          # thick line; a and b are (x, y, width), width tapers from a to b
    (x1, y1, w1), (x2, y2, w2) = a, b
    steps = int(max(abs(x2 - x1), abs(y2 - y1)) * 2) + 1
    for s in range(steps + 1):
        t = s / steps
        px, py, ww = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w1 + (w2 - w1) * t
        for y in range(max(0, int(py - ww)), min(N, int(py + ww) + 2)):
            for x in range(max(0, int(px - ww)), min(N, int(px + ww) + 2)):
                if (x - px) ** 2 + (y - py) ** 2 <= (ww / 2) ** 2 and (keep is None or g[y][x] in keep): g[y][x] = c

def fill(g, fn, c, keep=None):
    for y in range(N):
        for x in range(N):
            if fn(x, y) and (keep is None or g[y][x] in keep): g[y][x] = c

def spike(g, base, tip, w, c):                            # a thorn: wide at the base, a point at the tip
    line(g, (base[0], base[1], w), (tip[0], tip[1], 0.6), c)

def figure(mode, f=0):                                    # mode: idle | attack | sleep
    g = [["."] * N for _ in range(N)]
    up = f == 0 and mode != "sleep"
    bob = 1 if f == 1 and mode != "sleep" else 0          # head and neck dip a pixel on the second idle frame
    # wing behind: membrane M with a lighter inner panel I, bones V, scalloped lower edge
    sh = (35, 32)
    if mode == "sleep": tips = [(41, 20), (47, 25), (46, 33)]
    elif up:            tips = [(42, 3), (54, 2), (59, 15), (57, 31)]
    else:               tips = [(47, 14), (57, 19), (59, 31), (55, 44)]
    poly = [sh, tips[0]]
    for a, b in zip(tips, tips[1:]):
        poly += [a, ((a[0] + b[0]) / 2 - 2, (a[1] + b[1]) / 2 + 3)]
    poly += [tips[-1], (42, 40)]
    fill(g, lambda x, y: inside(x, y, poly), "M")
    inner = [sh, tips[1], ((tips[1][0] + tips[2][0]) / 2 - 2, (tips[1][1] + tips[2][1]) / 2 + 2), tips[2], (44, 38)]
    fill(g, lambda x, y: inside(x, y, inner) and (x + y) % 7 > 1, "I", "M") if mode != "sleep" else None
    for t in tips: line(g, (sh[0], sh[1], 1.8), (t[0], t[1], 1.4), "V")
    line(g, (sh[0], sh[1], 4), (tips[0][0], tips[0][1], 2), "V")
    # tail along the ground, tapering to a thorn
    line(g, (48, 42, 9), (55, 47, 6), "B"); line(g, (55, 47, 6), (59, 52, 3.4), "B"); line(g, (59, 52, 3.4), (58, 55, 1), "B")
    for sx, sy in ((51, 40), (55, 44), (58, 49)): spike(g, (sx, sy), (sx + 2, sy - 4), 2, "S")
    # far arm and hind leg
    line(g, (31, 42, 4), (27, 49, 3), "S"); line(g, (27, 49, 3), (24, 53, 3.4), "S")
    line(g, (44, 45, 8), (40, 51, 4.4), "B"); line(g, (40, 51, 4.4), (44, 55, 4.6), "B")          # hind leg bends back at the knee
    fill(g, lambda x, y: 36 <= x <= 47 and 54 <= y <= 56, "B")                                   # hind foot
    for k in range(3): fill(g, lambda x, y, k=k: x == 34 + k * 3 and 55 <= y <= 57, "H")
    # torso (deep chest forward), haunch, underside
    fill(g, lambda x, y: ell(x, y, 38, 40, 13, 6.4), "B")
    fill(g, lambda x, y: ell(x, y, 31, 40, 7, 7), "B")
    fill(g, lambda x, y: ell(x, y, 45, 43, 6.4, 8), "B")                                         # haunch
    fill(g, lambda x, y: ell(x, y, 33, 45, 9, 2.6) and y >= 44, "Y", "B")                         # amber underside
    fill(g, lambda x, y: ell(x, y, 40, 35, 10, 2.4) and y < 37, "L", "B")                         # lit back
    # near arm reaching forward, clawed
    line(g, (29, 40, 4.6), (23, 46, 3.2), "B"); line(g, (23, 46, 3.2), (19, 51, 3.6), "B")
    for k in range(3): fill(g, lambda x, y, k=k: x == 14 + k * 2 and 52 <= y <= 54 or x == 15 + k * 2 and y == 51, "H")
    # shoulder and back spikes, big near the shoulder
    for base, tip, w in (((31, 34), (30, 22), 4), ((35, 34), (38, 20), 5), ((40, 34), (46, 25), 5), ((45, 36), (53, 31), 4)):
        spike(g, base, tip, w, "S")
    # long S-curved neck dipping toward the head, pale underside
    line(g, (30, 38, 9), (27, 28, 5.6), "B"); line(g, (27, 28, 5.6), (22, 20 + bob, 5), "B"); line(g, (22, 20 + bob, 5), (15, 21 + bob, 5), "B")
    line(g, (27, 36, 2.6), (24, 28, 2.2), "Y", "B"); line(g, (24, 28, 2.2), (19, 22 + bob, 2), "Y", "B")
    # head: long, low, pointing down-left
    hy = 22 + bob
    fill(g, lambda x, y: ell(x, y, 13, hy, 6.4, 4.6), "B")
    fill(g, lambda x, y: ell(x, y, 7, hy + 2, 5.2, 2.8), "B")                                    # snout
    fill(g, lambda x, y: ell(x, y, 8, hy + 4, 5, 1.8) and y >= hy + 3, "Y", "B")                  # chin
    # horns: two long ones swept up and forward, a short one back
    line(g, (14, hy - 3, 3), (7, hy - 17, 0.8), "H"); line(g, (17, hy - 3, 2.6), (15, hy - 14, 0.8), "H")
    line(g, (18, hy, 2.4), (25, hy - 4, 0.8), "H")
    if mode == "attack":                                                                         # jaw open, maw glowing
        fill(g, lambda x, y: ell(x, y, 8, hy + 6, 5.4, 2.4), "B")
        fill(g, lambda x, y: ell(x, y, 7, hy + 3.5, 4.6, 2), "F")
        fill(g, lambda x, y: ell(x, y, 6, hy + 3.5, 2.4, 1.1), "C")
        for xx in (3, 6, 9): fill(g, lambda x, y, xx=xx: x == xx and hy + 1 <= y <= hy + 2, "H")
    else:
        fill(g, lambda x, y: y == hy + 4 and 3 <= x <= 12, "K")                                  # mouth line
        fill(g, lambda x, y: x == 4 and hy + 5 <= y <= hy + 6, "H")                              # fang
    fill(g, lambda x, y: ell(x, y, 2.5, hy + 0.5, 1, 1), "K")                                    # nostril
    if mode == "sleep":
        fill(g, lambda x, y: y == hy - 1 and 11 <= x <= 15, "K")
    else:
        fill(g, lambda x, y: 11 <= x <= 15 and hy - 2 <= y <= hy, "E")                           # glaring slit eye
        fill(g, lambda x, y: x == 13 and hy - 2 <= y <= hy, "K")
        line(g, (9, hy - 4, 1.8), (17, hy - 1, 1.8), "S")                                       # heavy brow
    # outline
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == "." and any(0 <= y + dy < N and 0 <= x + dx < N and g[y + dy][x + dx] != "."
                                      for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))): out[y][x] = "K"
    g = out
    if mode == "sleep":
        z = ["XXXX", "..X.", ".X..", "XXXX"]
        for dy, row in enumerate(z):
            for dx, c in enumerate(row):
                if c != "." and 0 <= 3 + f * 3 + dy < N: g[3 + f * 3 + dy][2 + dx] = "Z"
    return g

def flash(g):                                             # got hit: the body goes pink
    return [["P" if c in "BSLMVYHIFC" else c for c in r] for r in g]

pal = {"B": "#b8283a", "S": "#7a1426", "L": "#e04a56", "Y": "#ffb35a", "M": "#4b2a8a", "I": "#6a45c0", "V": "#5a1a30", "H": "#fff0d0",
       "E": "#ffe14a", "K": "#2a0d14", "F": "#ff5a1a", "C": "#fff08a", "Z": "#cfd8ff", "P": "#ff9aa8"}
grids = {"dragon-idle": figure("idle", 0), "dragon-idle-1": figure("idle", 1), "dragon-attack": figure("attack", 0),
         "dragon-hit": flash(figure("idle", 1)), "dragon-sleep": figure("sleep", 0), "dragon-sleep-1": figure("sleep", 1),
         "dragon-sleep-2": figure("sleep", 2)}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert len(g) == N and all(len(r) == N for r in g), name
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
