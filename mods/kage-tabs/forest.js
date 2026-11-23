import { div, image } from "gpui-kit";

// kage: a forest behind the whole tab bar. Every working agent is a class-character swinging at the dragon,
// which stands in the middle of the bar. Art is in mods/kage-agents (avatars/*.svg: 32x32 sprites and a 56x56 dragon),
// all drawn at 2.5x so the party and the boss share one pixel size.
const ART = "mods/kage-agents/";
const MAX = 4;                                   // characters shown; more show as "+N"
const CHAR = 80, DRAGON = 140, STEP = 70, FLOOR = 8;
export const HEIGHT = 171;                       // the tab bar's height while the forest is on (the layout's tabs block)
export const PLAIN = 42;                         // and with it off

const SWING = ["awake", "awake-mid", "awake-down", "awake-mid"];

// A pixel pine: trunk and four tiers, its foot at `base` from the bar's top.
const pine = (x, base, s, leaf, trunk) => {
  const tiers = [46, 36, 26, 14];
  const h = 14 * s;
  return div().absolute().left(x).top(base - 12 * s - h * tiers.length).w(46 * s).h(12 * s + h * tiers.length)
    .children(tiers.map((w, i) => div().absolute().left((46 - w) * s / 2).top(i * h).w(w * s).h(h).bg(leaf)))
    .child(div().absolute().left(20 * s).top(h * tiers.length).w(6 * s).h(12 * s).bg(trunk));
};

// Forest and floor, absolute behind everything in the bar. Far pines (dark, small), near pines (lit), fireflies, a moon.
export function backdrop(now) {
  const beat = Math.floor(now / 250);
  const ground = HEIGHT - FLOOR;
  const far = Array.from({ length: 30 }, (_v, i) => pine(i * 88 + (i % 3) * 14, ground - 4, 1, "#0f2d22", "#1a1f1a"));
  const near = Array.from({ length: 14 }, (_v, i) => pine(i * 190 + 60 + (i % 4) * 22, ground + 2, 2, "#17452d", "#33261a"));
  const fly = (x, y, i) => (beat + i) % 4 < 2 ? div().absolute().left(x + ((beat + i) % 8 < 4 ? 0 : 6)).top(y).w(4).h(4).bg("#e6ff7a") : null;
  const flies = [[300, 60], [520, 100], [760, 40], [1010, 90], [1290, 55], [1540, 105], [1800, 70]].map(([x, y], i) => fly(x, y, i)).filter(Boolean);
  return div().absolute().left(0).right(0).top(0).bottom(0).overflow_hidden().bg("#0b1a1e")
    .child(div().absolute().left(1400).top(14).w(26).h(26).rounded(13).bg("#e8f0c8"))
    .child(div().absolute().left(1410).top(14).w(20).h(20).rounded(10).bg("#0b1a1e"))
    .children(far).children(near).children(flies)
    .child(div().absolute().left(0).right(0).bottom(0).h(FLOOR).bg("#1c3a24"))
    .child(div().absolute().left(0).right(0).bottom(FLOOR).h(3).bg("#46963f"))
    .children(Array.from({ length: 60 }, (_v, i) => div().absolute().left(i * 41 + 5).bottom(FLOOR + 3).w(3).h(i % 2 ? 6 : 9).bg("#2f7a3e")));
}

// party: [{ id, cls }] of working agents; now: Date.now(). A full-bar layer under the tabs (so tabs stay clickable);
// the dragon is in the middle of the bar, the party in a row to its left. Frames step every 250ms.
export function arena(party, now, color) {
  const beat = Math.floor(now / 250);
  const shown = party.slice(0, MAX);
  const frames = shown.map((_p, i) => SWING[(beat + i) % 4]);
  // The blow lands on the "down" frame: the dragon flashes, breathes fire now and then, else flaps.
  const dragon = !party.length ? "dragon-sleep-1"
    : frames.includes("awake-down") ? "dragon-hit"
    : beat % 8 === 5 ? "dragon-attack"
    : ["dragon-idle", "dragon-idle-1"][Math.floor(now / 500) % 2];
  const top = (size) => HEIGHT - size - FLOOR;
  const half = MAX * STEP + 24;                  // room for the party on each side, so the dragon is centred
  const dx = half;                               // the dragon's left edge in this box
  return div().absolute().left(0).right(0).top(0).bottom(0).flex().justify_center()
    .child(div().relative().flex_none().w(half * 2 + DRAGON).h(HEIGHT - 1)
      .children(shown.map((p, i) => image(`${ART}${p.cls}-${frames[i]}.svg`).absolute()
        .left(dx - 24 - (shown.length - i) * STEP + (frames[i] === "awake-down" ? 14 : 0)).top(top(CHAR)).w(CHAR).h(CHAR)))
      .when(party.length > MAX, el => el.child(div().absolute().left(dx - 24 - (MAX + 1) * STEP + 20).top(top(CHAR) - 22).text_size(16).text_color(color).child(`+${party.length - MAX}`)))
      // Its breath: flames out of the maw (about 17px right, 62px down in the art) toward the party.
      .when(dragon === "dragon-attack", el => el.children([0, 1, 2, 3].map((k) => div().absolute()
        .left(dx + 17 - 32 * (k + 1)).top(top(DRAGON) + 50 + k * 2).w(32).h(32 - k * 6)
        .bg(["#fff3a0", "#ffb02e", "#ff6a1a", "#b83a1a"][k]))))
      .child(image(`${ART}${dragon}.svg`).absolute().left(dx).top(top(DRAGON)).w(DRAGON).h(DRAGON)));
}
