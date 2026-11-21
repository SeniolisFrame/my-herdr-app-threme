# Witch (cute, long pink hair), 32x32. Awake: staff raised, its orb pulsing, sparks round it. Asleep: hat over the eyes,
# dozing on the staff, a "z" drifting up. python avatars/witch.py avatars/witch.json, then node avatars/build.mjs
import json, sys
N, CX = 32, 15.5
ell = lambda x, y, cx, cy, rx, ry: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def figure(asleep, f=0):
    g = [["."] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            fx = x if x < CX else 31 - x
            hw = 3 + max(0, y - 20) * 0.6
            if 20 <= y <= 30 and abs(x - CX) <= hw: g[y][x] = "M"                          # dress
            if 20 <= y <= 30 and abs(x - CX) <= hw and (abs(x - CX) >= hw - 1 or y >= 29): g[y][x] = "G"   # trim
            if 20 <= y <= 30 and abs(x - CX) <= hw - 2 and (y + x) % 5 == 0: g[y][x] = "F"   # dress sparkle
            if 13 <= y <= 25 and 4 <= abs(x - CX) <= 6.4 - max(0, y - 20) * 0.3: g[y][x] = "L"   # long hair
            if ell(x, y, CX, 18.5, 3.6, 2): g[y][x] = "F"                                  # shoulders
            if ell(x, y, CX, 16.5, 4.2, 3.6): g[y][x] = "S"                                # face
            if y == 14 and abs(x - CX) <= 4: g[y][x] = "L"                           # fringe
            top = 4 if asleep else 2                                                       # the tip's row
            if ell(x, y, CX, 12.5, 10, 2): g[y][x] = "H"                                   # brim
            if top <= y <= 12:                                                             # cone, its tip bending right
                t = (12 - y) / (12 - top)
                mid, half = CX + (6 if asleep else 3.5) * t * t, 0.8 + (y - top) * 0.6
                if abs(x - mid) <= half: g[y][x] = "J" if x > mid + half * 0.3 else "H"   # lit right side
                if 10 <= y <= 11 and abs(x - mid) <= half + 1.5: g[y][x] = "N"             # hat band
    for x in (15, 16): g[10][x] = g[11][x] = "G"                                           # buckle
    for dx, dy in ((0, 0), (1, 0), (0, -1), (0, 1), (-1, 0)) if not asleep else ((0, 1),):    # a star on the cone
        g[(7 if not asleep else 8) + dy][15 + dx] = "G"
    for y in range(N):                                                                     # hat outline, darker than the hat
        for x in range(N):
            if g[y][x] in "HJN" and any(not (0 <= y + dy < N and 0 <= x + dx < N) or g[y + dy][x + dx] == "."
                                        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))): g[y][x] = "Q"
    for x in (13, 14, 17, 18): g[19][x] = g[20][x] = "C"                                   # bow at the collar
    g[19][15] = g[19][16] = g[20][15] = g[20][16] = "G"
    for x in (12, 13, 18, 19): g[17][x] = "C"                                             # blush
    for y in range(8, 31): g[y][26] = "Z"                                                  # staff
    for y in range(19, 22):                                                                # hand on it
        g[y][25] = g[y][26] = "S"
    for x in range(21, 26): g[20][x] = g[21][x] = "F"                                      # sleeve
    if not asleep:
        for ex in (13, 18): g[15][ex] = "W"; g[16][ex] = g[17][ex] = "E"                         # big sparkly eyes
        g[18][15] = g[18][16] = "P"                                                        # smile
        for x in range(4, 9): g[21][x] = g[22][x] = "F"                                    # casting arm
        g[21][3] = g[22][3] = "S"
        r = (2.5, 3.2, 3.8, 3.2)[f]                                                        # orb pulses
        for y in range(N):
            for x in range(N):
                if ell(x, y, 26.5, 6, r + 1.5, r + 1.5): g[y][x] = "B"
                if ell(x, y, 26.5, 6, r, r): g[y][x] = "A"
                if ell(x, y, 26.5, 6, r / 2, r / 2): g[y][x] = "Y"
        for sx, sy in (((4, 17), (2, 24), (7, 13)), ((3, 15), (5, 25), (8, 16)), ((6, 14), (3, 26), (2, 19)), ((5, 16), (1, 22), (7, 25)))[f]:
            g[sy][sx] = "E"; g[sy - 1][sx] = g[sy + 1][sx] = g[sy][sx - 1] = g[sy][sx + 1] = "B"
    else:
        for x in (12, 13, 18, 19): g[16][x] = "K"                                          # shut eyes
        g[18][15] = g[18][16] = "P"
        for y in range(5, 8):
            for x in range(25, 28): g[y][x] = "B" if (x + y) % 2 else "V"                  # dim orb
        g[6][26] = "A"
        def stamp(x0, y0, rows):
            for dy, row in enumerate(rows):
                for dx, c in enumerate(row):
                    if c != "." and 0 <= y0 + dy < N and 0 <= x0 + dx < N: g[y0 + dy][x0 + dx] = c
        big = ["YYYYYY", "....Y.", "...Y..", "..Y...", ".Y....", "YYYYYY"]
        mid = ["YYYYY", "...Y.", "..Y..", ".Y...", "YYYYY"]
        small = ["YYYY", "..Y.", ".Y..", "YYYY"]
        for zx, zy, z in ([(2, 12, big)], [(1, 6, big), (3, 14, mid)], [(2, 1, big), (1, 8, mid), (3, 15, small)])[f]:
            stamp(zx, zy, z)
    return g

def rim(g, c):                                           # outline on the figure's edge
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] in "MFLG" and any(not (0 <= y + dy < N and 0 <= x + dx < N) or g[y + dy][x + dx] == "."
                                          for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = c
    return out

pal = {"M": "#5b2a86", "G": "#ffd166", "F": "#8a4fc0", "H": "#4a2a9a", "J": "#6a45c8", "N": "#ff7aa8", "Q": "#241450", "S": "#ffd9bd", "W": "#ffffff", "L": "#ff8fc7", "C": "#ff7aa8", "P": "#d94f7a",
       "E": "#7b5cff", "R": "#ffb3dc", "Z": "#6b4a2e", "A": "#b98cff", "B": "#4b3a85", "V": "#2e2257",
       "K": "#07060c", "O": "#3a3060", "Y": "#e4d6ff"}
grids = {"witch-awake": rim(figure(False, 0), "R"), "witch-awake-mid": rim(figure(False, 1), "R"),
         "witch-awake-down": rim(figure(False, 2), "R"), "witch-sleep": rim(figure(True, 0), "O"),
         "witch-sleep-1": rim(figure(True, 1), "O"), "witch-sleep-2": rim(figure(True, 2), "O")}
assert len({k.lower() for k in pal}) == len(pal), "palette letters must differ ignoring case"
for name, g in grids.items():
    assert {c for r in g for c in r} <= set(pal) | {"."}, name
json.dump({"palette": pal, "avatars": {k: ["".join(r) for r in g] for k, g in grids.items()}},
          open(sys.argv[1], "w"), indent=2)
