# Bat, 32x32. Awake: wings spread, red eyes, fangs, a violet aura. Asleep: hanging upside
# down from a branch, wings wrapped round, eyes shut, a "z" drifting up.
# python avatars/draw.py avatars/avatars.json, then node avatars/build.mjs
# Palette letters must differ ignoring case (preview.ps1 reads them with ConvertFrom-Json).
import json, math, sys
N, CX = 32, 15.5
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def tri(x, y, a, b, c):
    s = lambda p, q: (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1])
    d1, d2, d3 = s(a, b), s(b, c), s(c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

def blank(): return [["."] * N for _ in range(N)]

def awake(droop=0.0):
    # droop: how far the wing tips swing down, per column from the shoulder (0 = raised)
    g = blank()
    for y0 in range(N):
        for x in range(N):
            fx = x if x < CX else 31 - x                 # left half, mirrored
            y = y0 - max(0, 12 - fx) * droop             # shear the wing about the shoulder
            # wing: top edge rises from the shoulder to the tip, bottom edge in three scallops
            top = 12.5 - (12 - fx) * 0.62
            scallop = 2.6 * abs(math.sin(math.pi * (fx - 1) / 3.75))
            bottom = 21.5 - (12 - fx) * 0.45 - scallop
            if 1 <= fx <= 12 and top <= y <= bottom: g[y0][x] = "M"
            # finger bones from the shoulder to the scallop points
            for px, py in ((1.2, 5.2), (4.8, 15.1), (8.5, 17.2)):
                t = (fx - 12) / (px - 12) if px != 12 else 0
                if 0 <= t <= 1 and abs(y - (13 + t * (py - 13))) < 0.6 and g[y0][x] == "M": g[y0][x] = "G"
            y = y0                                       # the body doesn't swing
            if ell(x, y, CX, 18, 4.3, 5.8): g[y][x] = "F"
            if ell(x, y, CX, 19, 2.3, 3.6): g[y][x] = "H"   # belly
            if ell(x, y, CX, 11.5, 4.6, 4.1): g[y][x] = "F"
            if tri(fx, y, (11, 10), (10.2, 3), (14, 9)): g[y][x] = "F"
            if tri(fx, y, (11.6, 9.5), (11, 5.5), (13, 9)): g[y][x] = "P"   # inside the ear
    for ex in (13, 18):                                  # red eyes, 2x2
        for dx in (0, 1 if ex < CX else -1):
            g[10][ex + dx] = g[11][ex + dx] = "E"
    g[13][15] = g[13][16] = "K"                          # mouth
    # the left eye glows: a white core and a flare, a long streak outward and a short cross
    ex, ey = 13, 11
    g[ey][ex] = "W"
    g[ey - 1][ex] = g[ey][ex - 1] = "P"
    g[ey - 2][ex] = g[ey + 1][ex] = "P"
    for i in range(2, 9):
        if g[ey][ex - i] != ".": g[ey][ex - i] = "P" if i < 5 else "A"
    g[ey - 3][ex] = "A"
    for x in (13, 18): g[24][x] = g[25][x] = "K"         # feet
    return g

def asleep(f=0):
    # f: snore frame 0-2
    g = blank()
    for x in range(3, 27): g[2][x] = "Z"                 # the branch
    for x in (6, 11, 20, 25): g[1][x] = "Z"
    g[3][9] = g[3][24] = "Z"
    for x in (13, 18):                                   # feet gripping it
        g[3][x] = g[4][x] = "K"; g[3][x - 1] = "K"
    for y in range(N):
        for x in range(N):
            if ell(x, y, CX, 13, 6.4, 8.6) and y >= 5 and abs(x - CX) <= 6.4 - max(0, y - 14) * 0.25: g[y][x] = "M"  # wings wrapped round, tapering
            if ell(x, y, CX, 13, 2.4, 6.8) and y >= 6: g[y][x] = "F"     # the body peeking between them
            if ell(x, y, CX, 25, 4.6, 3.6): g[y][x] = "H"                # head, upside down
            fx = x if x < CX else 31 - x
            if tri(fx, y, (10.6, 25), (10, 31), (13.6, 26.5)): g[y][x] = "F"  # ears pointing down
            if tri(fx, y, (11.3, 26.5), (10.9, 29.5), (12.7, 27)): g[y][x] = "P"
            if tri(fx, y, (9.4, 6), (8.4, 4.4), (10.6, 6.6)): g[y][x] = "G"   # wing thumbs by the feet
    for y in range(7, 22):                               # wing folds
        for x in (11, 20):
            if g[y][x] == "M" and y % 3: g[y][x] = "G"
    for x in (13, 18): g[22][x] = "K"                    # neck: a shadow between body and head
    for x in (12, 13, 18, 19): g[25][x] = "K"            # shut eyes, curved (upside down)
    g[24][12] = g[24][19] = "K"
    g[23][15] = g[23][16] = "F"                          # mouth, now on top
    def stamp(x0, y0, rows):
        for dy, row in enumerate(rows):
            for dx, c in enumerate(row):
                if c != ".": g[y0 + dy][x0 + dx] = c
    # snoring: each frame the z's rise a step and a smaller one comes out below
    big = ["YYYYYY", "....Y.", "...Y..", "..Y...", ".Y....", "YYYYYY"]
    mid = ["YYYYY", "...Y.", "..Y..", ".Y...", "YYYYY"]
    small = ["YYYY", "..Y.", ".Y..", "YYYY"]
    for zx, zy, z in ([(23, 15, big)], [(25, 8, big), (23, 16, mid)], [(26, 3, big), (24, 10, mid), (23, 16, small)])[f]:
        stamp(zx, zy, z)
    return g

def rim(g, c="R"):                                       # outline: lit while awake, dark asleep
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] in "MFG" and any(not (0 <= y + dy < N and 0 <= x + dx < N) or g[y + dy][x + dx] in ".A"
                                        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = c
    return out

def aura(g):
    # violet fire: a solid glow hugging the bat, tongues of flame rising off its top edge
    out = [r[:] for r in g]
    near = lambda y, x: any(0 <= y + dy < N and 0 <= x + dx < N and g[y + dy][x + dx] != "."
                            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    for y in range(N):
        for x in range(N):
            if g[y][x] == "." and near(y, x): out[y][x] = "B"
    for x in range(N):
        top = next((y for y in range(N) if out[y][x] != "."), None)
        if top is None: continue
        peaks = ((2, 4), (5, 6), (9, 3), (12, 6), (15, 4), (19, 6), (22, 3), (26, 6), (29, 4))
        h = max(0, max(ph - abs(x - px) * 2 for px, ph in peaks))          # pointed tongues
        if h == 0: continue
        for i in range(1, h + 1):
            y = top - i
            if y < 0: break
            out[y][x] = "A" if i <= max(1, h // 3) else ("B" if i < h else "V")
    return out

pal = {"M": "#1d1830", "G": "#4a3d78", "F": "#2c2545", "H": "#3e3560", "R": "#9a7cff", "P": "#7a3f66",
       "E": "#ff2d55", "W": "#fff2f5", "K": "#07060c", "Z": "#5a4a3a", "A": "#b98cff", "B": "#4b3a85",
       "V": "#2e2257", "O": "#3a3060", "Y": "#e4d6ff"}
down = lambda g, n: [["."] * N for _ in range(n)] + g[:N - n]       # room above for the flames
# Awake flaps: wings up, halfway, down (the mod steps up, mid, down, mid).
grids = {"bat-awake": aura(down(rim(awake()), 3)), "bat-awake-mid": aura(down(rim(awake(0.7)), 3)),
         "bat-awake-down": aura(down(rim(awake(1.0)), 3)), "bat-sleep": rim(asleep(), "O"),
         "bat-sleep-1": rim(asleep(1), "O"), "bat-sleep-2": rim(asleep(2), "O")}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert len(g) == N and all(len(r) == N for r in g), name
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
