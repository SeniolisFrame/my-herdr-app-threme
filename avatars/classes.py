# Swordsman, rogue, priest, reaper: 32x32 chibis like the witch (witch.py), facing front, weapon on the right toward the dragon.
# Awake frames 0-2 are the swing/cast; asleep: eyes shut, weapon held upright, a "z" drifting up.
# python avatars/classes.py avatars   -> avatars/<class>.json each with its own palette, then node avatars/build.mjs
import json, os, sys
N, CX = 32, 15.5
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def line(g, a, b, w, c):                                  # thick line
    (x1, y1), (x2, y2) = a, b
    steps = int(max(abs(x2 - x1), abs(y2 - y1)) * 2) + 1
    for s in range(steps + 1):
        px, py = x1 + (x2 - x1) * s / steps, y1 + (y2 - y1) * s / steps
        for y in range(N):
            for x in range(N):
                if (x - px) ** 2 + (y - py) ** 2 <= (w / 2) ** 2: g[y][x] = c

HAND = (23, 20)

def body(k, asleep, f):
    g = [["."] * N for _ in range(N)]
    hood, long_hair = k.get("hood"), k.get("long")
    for y in range(27, 31):                                                            # legs
        for x in list(range(12, 15)) + list(range(17, 20)): g[y][x] = "B"
    for x in list(range(11, 15)) + list(range(17, 21)): g[30][x] = g[31][x] = "B"       # boots
    hem = 30 if k.get("cape") else 26
    for y in range(17, hem + 1):                                                       # torso (a cape/robe reaches lower and wider)
        hw = 4.6 + (y - 17) * (0.45 if k.get("cape") or k.get("robe") else 0.12)
        for x in range(N):
            if abs(x - CX) <= hw: g[y][x] = "T" if x < CX + 2 else "U"
    for x in range(N):
        for y in (hem - 1, hem):
            if g[y][x] != "." and (x + y) % 3 == 0 and k.get("cape"): g[y][x] = "."     # ragged hem
    for y in (23, 24):
        for x in range(11, 21): g[y][x] = "A"                                           # belt
    for y in range(18, 24):
        for x in (9, 10, 11): g[y][x] = "T"                                             # left arm
        for x in (20, 21, 22): g[y][x] = "U"                                            # right arm
    g[24][10] = g[20][23] = g[21][23] = g[20][22] = "S"                                  # hands
    if long_hair:
        for y in range(10, 25):
            for x in range(N):
                if 5.2 <= abs(x - CX) <= 7.4 and g[y][x] == ".": g[y][x] = "H"
    if hood:
        for y in range(N):
            for x in range(N):
                if ell(x, y, CX, 11, 7.4, 7.2): g[y][x] = "T"                           # hood
    for y in range(N):
        for x in range(N):
            if ell(x, y, CX, 12, 5, 4.6): g[y][x] = "S"                                 # face
            if ell(x, y, CX, 12, 5.4, 5) and not hood and (y <= 9 or (y <= 11 and abs(x - CX) >= 4.3)): g[y][x] = "H"   # hair
    if hood:
        for y in range(6, 11):
            for x in range(11, 21):
                if g[y][x] == "S" and (y <= 8 or x < 13 or x > 18): g[y][x] = "T"       # hood shadows the brow
    for x in range(12, 20):
        if not hood and g[10][x] == "S" and x % 2 == 0: g[10][x] = "H"                  # fringe
    if k.get("scarf"):
        for y in (16, 17):
            for x in range(10, 22): g[y][x] = "A"
        for y in range(18, 21): g[y][11] = "A"
    if k.get("mask"):
        for y in range(14, 17):
            for x in range(11, 20): g[y][x] = "T"
    if k.get("halo"):
        for y in range(N):
            for x in range(N):
                if ell(x, y, CX, 3.5, 6.5, 2.3) and not ell(x, y, CX, 3.5, 4.3, 1.1): g[y][x] = "Y"
    if asleep:
        for x in (12, 13, 18, 19): g[12][x] = "K"
    else:
        for ex in (13, 18): g[11][ex] = "W"; g[12][ex] = g[13][ex] = "E"
    if not k.get("mask"): g[15][15] = g[15][16] = "P"
    for x in (12, 19): g[14][x] = "C"
    return g

def weapon(k, g, asleep, f):
    kind = k["weapon"]
    f = 0 if asleep else f
    if kind == "sword":
        tip = ((25, 5), (29, 11), (30, 21))[f]
        line(g, HAND, tip, 2.2, "G"); line(g, HAND, (HAND[0] - (tip[0] - HAND[0]) * .15, HAND[1] - (tip[1] - HAND[1]) * .15), 2, "L")
        gx, gy = HAND[0] + (tip[0] - HAND[0]) * .18, HAND[1] + (tip[1] - HAND[1]) * .18
        line(g, (gx - 2, gy + 2), (gx + 2, gy - 2), 1.4, "A")                          # crossguard
    elif kind == "scythe":
        tip = ((25, 3), (28, 7), (30, 17))[f]
        line(g, (HAND[0] - (tip[0] - HAND[0]) * .4, HAND[1] - (tip[1] - HAND[1]) * .4), tip, 1.6, "L")
        line(g, tip, (tip[0] + 5, tip[1] + 2), 2.2, "G"); line(g, (tip[0] + 5, tip[1] + 2), (tip[0] + 6, tip[1] + 5), 1.4, "G")
    elif kind == "staff":
        tip = (25, 6)
        line(g, (24, 27), tip, 1.6, "L")
        line(g, (tip[0], tip[1] - 3), (tip[0], tip[1] + 3), 1.6, "Y"); line(g, (tip[0] - 2, tip[1] - 1), (tip[0] + 2, tip[1] - 1), 1.6, "Y")
        if not asleep:
            r = (2.2, 3, 3.6)[f]
            for y in range(N):
                for x in range(N):
                    if ell(x, y, tip[0], tip[1] - 1, r + 1.2, r + 1.2) and g[y][x] == ".": g[y][x] = "N"
            for sx, sy in (((28, 9), (30, 12)), ((29, 8), (27, 13)), ((31, 10), (29, 15)))[f]:
                g[sy][sx] = "Y"; g[sy - 1][sx] = g[sy + 1][sx] = g[sy][sx - 1] = "N"
    elif kind == "daggers":
        tip = ((27, 14), (28, 18), (29, 22))[f]
        line(g, HAND, tip, 1.8, "G"); line(g, HAND, (HAND[0] - 1, HAND[1] + 1), 2, "L")
        lt = ((4, 20), (3, 23), (4, 26))[(f + 1) % 3]
        line(g, (9.5, 23), lt, 1.8, "G")

def stamp(g, x0, y0, rows):
    for dy, row in enumerate(rows):
        for dx, c in enumerate(row):
            if c != "." and 0 <= y0 + dy < N and 0 <= x0 + dx < N: g[y0 + dy][x0 + dx] = c

def figure(k, asleep, f=0):
    g = body(k, asleep, f)
    weapon(k, g, asleep, f)
    if asleep:
        big, mid, small = ["ZZZZZZ", "....Z.", "...Z..", "..Z...", ".Z....", "ZZZZZZ"], ["ZZZZZ", "...Z.", "..Z..", ".Z...", "ZZZZZ"], ["ZZZZ", "..Z.", ".Z..", "ZZZZ"]
        for zx, zy, z in ([(2, 8, big)], [(1, 3, big), (3, 11, mid)], [(2, 0, big), (1, 6, mid), (3, 12, small)])[f]: stamp(g, zx, zy, z)
    return g

def rim(g, c):                                           # outline on the figure's edge
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] not in ".Z" and any(not (0 <= y + dy < N and 0 <= x + dx < N) or g[y + dy][x + dx] == "."
                                           for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))): out[y][x] = c
    return out

# Palette letters (same meaning in every class, own colours): S skin, E eye, W eye white, P mouth, C cheek, K shut eye, H hair,
# T tunic, U tunic shade, A trim, B boots, G blade, L handle, Y glow/gold, N glow dark, Z zzz, R rim awake, O rim asleep.
base = {"S": "#ffd9bd", "E": "#2a2140", "W": "#ffffff", "P": "#d94f7a", "C": "#ff9aa8", "K": "#07060c", "Z": "#e4d6ff"}
CLASSES = {
    "swordsman": dict(weapon="sword", scarf=True, pal={"H": "#7a4a2a", "T": "#4a78c8", "U": "#365a9a", "A": "#d63a3a", "B": "#3a3050", "G": "#dfe8f5", "L": "#6b4a2e", "Y": "#ffd166", "N": "#4b3a85", "R": "#a9c4ff", "O": "#2a3a60"}),
    "rogue": dict(weapon="daggers", hood=True, mask=True, pal={"H": "#2a2438", "T": "#3a3a4c", "U": "#2a2a3a", "A": "#7a5fff", "B": "#1f1a2c", "G": "#cfd8e8", "L": "#6b4a2e", "Y": "#ffd166", "N": "#4b3a85", "R": "#9aa0c8", "O": "#242030"}),
    "priest": dict(weapon="staff", long=True, robe=True, halo=True, pal={"H": "#ffd86b", "T": "#f3efe6", "U": "#cfc8dc", "A": "#e0b341", "B": "#8a6a3a", "G": "#dfe8f5", "L": "#8a5a32", "Y": "#fff3a0", "N": "#c9a43a", "R": "#fff0c2", "O": "#5a4a30"}),
    "reaper": dict(weapon="scythe", hood=True, cape=True, pal={"H": "#ffb3dc", "T": "#3b2a5c", "U": "#2a1f45", "A": "#d94f7a", "B": "#1a1230", "G": "#d6e2ff", "L": "#5a4a3a", "Y": "#ff6b86", "N": "#2a1f45", "R": "#a98cff", "O": "#201838"}),
}
for name, k in CLASSES.items():
    pal = {**base, **k["pal"]}
    assert len({c.lower() for c in pal}) == len(pal), f"{name}: palette letters must differ ignoring case"
    grids = {f"{name}-awake": rim(figure(k, False, 0), "R"), f"{name}-awake-mid": rim(figure(k, False, 1), "R"),
             f"{name}-awake-down": rim(figure(k, False, 2), "R"), f"{name}-sleep": rim(figure(k, True, 0), "O"),
             f"{name}-sleep-1": rim(figure(k, True, 1), "O"), f"{name}-sleep-2": rim(figure(k, True, 2), "O")}
    pal.update(R=k["pal"]["R"], O=k["pal"]["O"])
    for n, g in grids.items():
        assert len(g) == N and all(len(r) == N for r in g), n
        assert {c for r in g for c in r} <= set(pal) | {"."}, (n, {c for r in g for c in r} - set(pal))
    json.dump({"palette": pal, "avatars": {n: ["".join(r) for r in g] for n, g in grids.items()}},
              open(os.path.join(sys.argv[1], f"{name}.json"), "w"), indent=2)
