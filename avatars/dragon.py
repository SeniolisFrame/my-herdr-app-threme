# Dragon boss, 40x40, facing left toward the party. Frames: idle (wing up/down), attack (jaw open, fire), hit (flashes pink),
# sleep (eyes shut, wing folded, a "z" drifting up). python avatars/dragon.py avatars/dragon.json, then node avatars/build.mjs
import json, sys
N = 40
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def inside(x, y, poly):                                   # even-odd point in polygon
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def line(g, a, b, w, c):                                  # thick line
    (x1, y1), (x2, y2) = a, b
    steps = int(max(abs(x2 - x1), abs(y2 - y1)) * 2) + 1
    for s in range(steps + 1):
        px, py = x1 + (x2 - x1) * s / steps, y1 + (y2 - y1) * s / steps
        for y in range(N):
            for x in range(N):
                if (x - px) ** 2 + (y - py) ** 2 <= (w / 2) ** 2: g[y][x] = c

def figure(mode, f=0):                                    # mode: idle | attack | sleep
    g = [["."] * N for _ in range(N)]
    up = f == 0 and mode != "sleep"
    # wing behind the body: bones S, membrane R
    tip = (31, 2) if up else (33, 9)
    wing = [(23, 21), tip, (38, 14 if up else 17), (34, 21), (28, 22)] if mode != "sleep" else [(23, 21), (30, 14), (35, 19), (30, 23)]
    for y in range(N):
        for x in range(N):
            if inside(x, y, wing): g[y][x] = "R"
    line(g, (24, 22), wing[1], 1.6, "S"); line(g, (24, 22), wing[2], 1.6, "S")
    line(g, (36, 29), (39, 21), 3, "B"); line(g, (34, 30), (37, 27), 4, "B")           # tail
    for lx in (19, 29):                                                                  # legs and claws
        for y in range(31, 38):
            for x in range(lx, lx + 4): g[y][x] = "B"
        for x in range(lx - 1, lx + 4): g[37][x] = g[38][x] = "H" if x in (lx - 1, lx + 1, lx + 3) else "S"
    for y in range(N):
        for x in range(N):
            if ell(x, y, 26, 27, 10, 7): g[y][x] = "B"                                  # body
            if ell(x, y, 24, 31, 8, 3.5) and g[y][x] == "B": g[y][x] = "Y"              # belly
    line(g, (20, 24), (14, 15), 5, "B")                                                  # neck
    for i, (x, y) in enumerate(((21, 18), (24, 19), (27, 20), (30, 22))):                # back spikes
        if mode != "sleep" or i > 1: g[y][x] = g[y - 1][x] = g[y - 2][x] = "H"
    for y in range(N):
        for x in range(N):
            if ell(x, y, 12, 13, 5.5, 4.5): g[y][x] = "B"                                # head
            if ell(x, y, 7, 15.5, 4, 2.3): g[y][x] = "B"                                 # snout
    line(g, (11, 9), (15, 3), 2, "H")                                                   # horn
    if mode == "attack":                                                                 # jaw open, fire out the front
        for y in range(N):
            for x in range(N):
                if ell(x, y, 8, 18.5, 4, 2): g[y][x] = "B"
                if ell(x, y, 8, 16.5, 3, 1.4): g[y][x] = "K"
        for y in range(N):
            for x in range(N):
                if ell(x, y, 2, 17, 3, 3): g[y][x] = "F"
                if ell(x, y, 2, 17, 1.6, 1.6): g[y][x] = "C"
    for x in (4, 6): g[17 if mode != "attack" else 20][x] = "H"                         # fangs
    if mode == "sleep":
        for x in (9, 10, 11): g[12][x] = "K"                                             # shut eye
    else:
        g[11][10] = g[11][11] = g[12][10] = g[12][11] = "E"; g[12][10] = "K"            # eye
    # outline: any body-ish cell touching empty space
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == "." and any(0 <= y + dy < N and 0 <= x + dx < N and g[y + dy][x + dx] in "BSRYH"
                                      for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))): out[y][x] = "K"
    g = out
    if mode == "sleep":
        z = ["XXXX", "..X.", ".X..", "XXXX"]
        for dy, row in enumerate(z):
            for dx, c in enumerate(row):
                if c != "." and 0 <= 3 + f + dy < N: g[3 + f * 3 + dy][1 + dx] = "Z"
    return g

def flash(g):                                             # got hit: the body goes pink
    return [["P" if c in "BSRYH" else c for c in r] for r in g]

pal = {"B": "#2f7d4f", "S": "#1d4d33", "R": "#b3263f", "Y": "#e8c36a", "H": "#f2e6c8", "E": "#ffd23f", "K": "#0d0a14",
       "F": "#ff8a1f", "C": "#fff3a0", "Z": "#cfd8ff", "P": "#ff9aa8"}
grids = {"dragon-idle": figure("idle", 0), "dragon-idle-1": figure("idle", 1), "dragon-attack": figure("attack", 0),
         "dragon-hit": flash(figure("idle", 1)), "dragon-sleep": figure("sleep", 0), "dragon-sleep-1": figure("sleep", 1),
         "dragon-sleep-2": figure("sleep", 2)}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert len(g) == N and all(len(r) == N for r in g), name
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
