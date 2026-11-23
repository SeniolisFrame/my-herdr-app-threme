import { div, image } from "gpui-kit";

// kage: a twilight forest behind the whole tab bar. Every working agent is a class-character swinging at the dragon,
// which stands in the middle of the bar. Art is in mods/kage-agents (avatars/*.svg: 32x32 sprites and a 96x68 dragon),
// all drawn at 2.5x so the party and the boss share one pixel size.
const ART = "mods/kage-agents/";
const MAX = 4;                                   // characters shown; more show as "+N"
const CHAR = 80, DRAGON_W = 240, DRAGON_H = 170, STEP = 70, FLOOR = 8;
export const HEIGHT = 180;                       // the tab bar's height while the forest is on (the layout's tabs block)
export const PLAIN = 42;                         // and with it off

const SWING = ["awake", "awake-mid", "awake-down", "awake-mid"];

// The forest, absolute behind everything in the bar: a misty twilight pine forest drawn by avatars/forest.py
// (mods/kage-tabs/forest-bg.png, 1920x180, centred; a wider bar shows plain dark at the sides), and drifting motes of light.
export function backdrop(now) {
  const beat = Math.floor(now / 250);
  const mote = (x, y, i) => (beat + i) % 6 < 3 ? div().absolute().left(x + ((beat + i) % 12 < 6 ? 0 : 6)).top(y + ((beat + i) % 8 < 4 ? 0 : 3)).w(4).h(4).bg("#bfe8ff") : null;
  const motes = [[300, 70], [520, 100], [760, 50], [1010, 90], [1290, 60], [1540, 105], [1800, 75]].map(([x, y], i) => mote(x, y, i)).filter(Boolean);
  return div().absolute().left(0).right(0).top(0).bottom(0).overflow_hidden().bg("#0a1226").flex().justify_center()
    .child(image("mods/kage-tabs/forest-bg.png").flex_none().w(1920).h(180))
    .children(motes);
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
    .child(div().relative().flex_none().w(half * 2 + DRAGON_W).h(HEIGHT - 1)
      .children(shown.map((p, i) => image(`${ART}${p.cls}-${frames[i]}.svg`).absolute()
        .left(dx - 24 - (shown.length - i) * STEP + (frames[i] === "awake-down" ? 14 : 0)).top(top(CHAR)).w(CHAR).h(CHAR)))
      .when(party.length > MAX, el => el.child(div().absolute().left(dx - 24 - (MAX + 1) * STEP + 20).top(top(CHAR) - 22).text_size(16).text_color(color).child(`+${party.length - MAX}`)))
      // Its breath: a wavy stream of flames out of the maw (10px right, 84px down in the art) toward the party.
      .when(dragon === "dragon-attack", el => el.children([0, 1, 2, 3, 4].map((k) => div().absolute()
        .left(dx + 10 - 30 * (k + 1)).top(top(DRAGON_H) + 84 - (24 - k * 3) / 2 + [0, -5, 2, -4, 3][(k + beat) % 5]).w(30).h(24 - k * 3)
        .bg(["#fff3a0", "#ffd23f", "#ffb02e", "#ff6a1a", "#b83a1a"][k]))))
      .child(image(`${ART}${dragon}.svg`).absolute().left(dx).top(top(DRAGON_H)).w(DRAGON_W).h(DRAGON_H)));
}
