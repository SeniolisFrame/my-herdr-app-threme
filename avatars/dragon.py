# Fire dragon, 56x56, facing left toward the party: upright on two legs, orange with a cream belly, teal wings, horns swept
# back, a flame on its tail. Frames: idle (wings up/down, flame flicker), attack (jaw open, glowing maw), hit (flashes pink),
# sleep (eyes shut, wings folded, "z"). python avatars/dragon.py avatars/dragon.json, then node avatars/build.mjs
import json, sys
N = 56
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def inside(x, y, poly):                                   # even-odd point in polygon
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def line(g, a, b, w, c, keep=None):                       # thick line, width w tapering to w2 if b has a third value
    (x1, y1), (x2, y2) = a[:2], b[:2]
    w1, w2 = (a[2] if len(a) > 2 else w), (b[2] if len(b) > 2 else w)
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

def figure(mode, f=0):                                    # mode: idle | attack | sleep
    g = [["."] * N for _ in range(N)]
    up = f == 0 and mode != "sleep"
    # wings behind: teal membrane M, orange arm bone V, scalloped lower edge
    sh = (31, 25)
    if mode == "sleep": tips = [(38, 14), (44, 22), (41, 31)]
    elif up:            tips = [(36, 2), (48, 6), (55, 18), (52, 31)]
    else:               tips = [(42, 12), (53, 18), (56, 29), (51, 39)]
    poly = [sh] + tips[:1]
    for a, b in zip(tips, tips[1:]):
        poly += [a, ((a[0] + b[0]) / 2 - 2, (a[1] + b[1]) / 2 + 2)]
    poly += [tips[-1], (36, 36)]
    fill(g, lambda x, y: inside(x, y, poly), "M")
    for t in tips: line(g, sh, t, 1.6, "V")
    line(g, (sh[0], sh[1], 3.4), (tips[0][0], tips[0][1], 2), 2, "V")
    # tail up behind, ending in a flame (flickers by frame)
    line(g, (34, 44, 6), (42, 48, 5), 5, "B"); line(g, (42, 48, 5), (49, 44, 4), 4, "B"); line(g, (49, 44, 4), (51, 36, 3), 3, "B")
    fx, fy = 51, 33
    fl = (0, 1)[f % 2]
    fill(g, lambda x, y: ell(x, y, fx, fy - 1, 4, 5 + fl), "F")
    fill(g, lambda x, y: ell(x, y, fx, fy, 2.4, 3.4 + fl), "C")
    fill(g, lambda x, y: inside(x, y, [(fx - 2, fy - 4), (fx + fl, fy - 9 - fl), (fx + 2, fy - 4)]), "F")
    # legs and feet
    for lx in (20, 32):
        fill(g, lambda x, y, lx=lx: ell(x, y, lx + 3, 46, 5.6, 6.5), "B")
        fill(g, lambda x, y, lx=lx: lx - 3 <= x <= lx + 7 and 49 <= y <= 52, "B")
        fill(g, lambda x, y, lx=lx: lx - 3 <= x <= lx + 7 and y == 52, "S")
        for k in range(3): fill(g, lambda x, y, lx=lx, k=k: x == lx - 3 + k * 2 and 53 <= y <= 54, "H")
    # torso and belly
    fill(g, lambda x, y: ell(x, y, 28, 33, 11.5, 13), "B")
    fill(g, lambda x, y: ell(x, y, 25, 35, 7, 11.5), "Y")
    for yy in range(26, 46, 3): fill(g, lambda x, y, yy=yy: y == yy, "L", "Y")                   # belly plates
    fill(g, lambda x, y: ell(x, y, 33, 26, 7, 8) and x > 31, "S", "B")                           # shaded back
    # far arm (behind) and near arm reaching forward, clawed
    line(g, (33, 29, 4), (31, 38, 3.4), 3.6, "S")
    line(g, (21, 29, 5), (15, 34, 4.2), 4.6, "B"); line(g, (15, 34, 4.2), (13, 39, 4.6), 4.2, "B")
    for k in range(3): fill(g, lambda x, y, k=k: x == 10 + k * 2 and 41 <= y <= 42 or x == 11 + k * 2 and y == 43, "H")
    # neck and head
    fill(g, lambda x, y: ell(x, y, 22, 22, 6, 6), "B")
    fill(g, lambda x, y: ell(x, y, 18, 14, 10, 8), "B")                                          # head
    fill(g, lambda x, y: ell(x, y, 9, 17, 7, 4.2), "B")                                          # snout
    fill(g, lambda x, y: ell(x, y, 10, 19, 6.4, 2.6) and y >= 19, "Y", "B")                      # cream chin
    fill(g, lambda x, y: ell(x, y, 22, 17, 3, 2.4), "L", "B")                                    # cheek light
    # horns swept back, small ridge
    line(g, (24, 8, 3.6), (33, 5, 1.6), 3, "H"); line(g, (22, 6, 3), (29, 1, 1.4), 2.6, "H")
    # face: nostril, mouth, fang, big eye with a lid
    fill(g, lambda x, y: ell(x, y, 3, 15.5, 1.1, 1.1), "K")
    if mode == "attack":
        fill(g, lambda x, y: ell(x, y, 10, 23, 6.6, 3.2), "B")
        fill(g, lambda x, y: ell(x, y, 9, 20.5, 5.6, 2.6), "F")
        fill(g, lambda x, y: ell(x, y, 8, 20.5, 3, 1.3), "C")
        for xx in (4, 7, 10): fill(g, lambda x, y, xx=xx: x == xx and 18 <= y <= 19, "H")
    else:
        fill(g, lambda x, y: y == 20 and 3 <= x <= 14, "K")                                      # mouth line
        fill(g, lambda x, y: x == 5 and 21 <= y <= 22, "H")                                      # fang
    if mode == "sleep":
        fill(g, lambda x, y: y == 13 and 14 <= x <= 19, "K")
    else:
        fill(g, lambda x, y: 14 <= x <= 19 and 11 <= y <= 15, "W")                               # eye white
        fill(g, lambda x, y: 14 <= x <= 16 and 12 <= y <= 14, "E")                               # iris
        fill(g, lambda x, y: x == 15 and 12 <= y <= 14, "K")                                     # pupil
        line(g, (13, 10), (21, 12.5), 2, "S")                                                   # lid slants: confident, a bit fierce
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
                if c != "." and 0 <= 3 + f * 3 + dy < N: g[3 + f * 3 + dy][1 + dx] = "Z"
    return g

def flash(g):                                             # got hit: the body goes pink
    return [["P" if c in "BSLMVYHFC" else c for c in r] for r in g]

pal = {"B": "#f08a2d", "S": "#c4561c", "L": "#ffb347", "Y": "#ffe3a3", "M": "#2fa3a8", "V": "#d96a1f", "H": "#fff4d6",
       "W": "#ffffff", "E": "#2a8fd6", "K": "#3a1a14", "F": "#ff5a1a", "C": "#fff08a", "Z": "#cfd8ff", "P": "#ff9aa8"}
grids = {"dragon-idle": figure("idle", 0), "dragon-idle-1": figure("idle", 1), "dragon-attack": figure("attack", 0),
         "dragon-hit": flash(figure("idle", 1)), "dragon-sleep": figure("sleep", 0), "dragon-sleep-1": figure("sleep", 1),
         "dragon-sleep-2": figure("sleep", 2)}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert len(g) == N and all(len(r) == N for r in g), name
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
