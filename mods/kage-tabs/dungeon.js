import { div, image } from "gpui-kit";

// kage: the dungeon behind the whole tab bar. Every working agent is a class-character swinging at the dragon.
// Art is in mods/kage-agents (avatars/*.svg: 32x32 sprites and a 56x56 dragon, drawn at 2x: 2 device px per art pixel).
const ART = "mods/kage-agents/";
const MAX = 4;                    // characters shown; more show as "+N"
const CHAR = 64, DRAGON = 112, STEP = 56, FLOOR = 6;
export const HEIGHT = 128;        // the tab bar's height while the dungeon is on (the layout's tabs block)
export const PLAIN = 42;          // and with it off
const WALL = "#14101f", MORTAR = "#241c3a";

const SWING = ["awake", "awake-mid", "awake-down", "awake-mid"];

// The wall and floor, absolute behind everything in the bar. Bricks: 3 mortar rows, joints every 64px, staggered.
export function backdrop(now) {
  const beat = Math.floor(now / 250);
  const rows = [22, 44, 66, 88, 110];
  const flame = (left) => div().absolute().left(left).top(34).w(16).h(26)
    .child(div().absolute().left(6).top(14).w(4).h(12).bg("#5a3a22"))
    .child(div().absolute().left(3).top(beat % 2 ? 0 : 3).w(10).h(14).bg(beat % 2 ? "#ffd23f" : "#ff8a1f"))
    .child(div().absolute().left(6).top(beat % 2 ? 5 : 7).w(4).h(7).bg("#fff3a0"));
  return div().absolute().left(0).right(0).top(0).bottom(0).overflow_hidden().bg(WALL)
    .children(rows.map((y) => div().absolute().left(0).right(0).top(y).h(2).bg(MORTAR)))
    .children(rows.flatMap((y, r) => Array.from({ length: 27 }, (_v, i) =>
      div().absolute().left(i * 96 + (r % 2 ? 48 : 0)).top(y - 22).w(2).h(22).bg(MORTAR))))
    .children([260, 900, 1500].map(flame))
    .child(div().absolute().left(0).right(0).bottom(0).h(FLOOR).bg("#3a2f4f"))
    .child(div().absolute().left(0).right(0).bottom(FLOOR).h(2).bg("#4b3d66"));
}

// party: [{ id, cls }] of working agents; now: Date.now(). In the flow, right of the tabs. Frames step every 250ms.
export function fighters(party, now, color) {
  const beat = Math.floor(now / 250);
  const shown = party.slice(0, MAX);
  const frames = shown.map((_p, i) => SWING[(beat + i) % 4]);
  // The blow lands on the "down" frame: the dragon flashes, breathes fire now and then, else flaps.
  const dragon = !party.length ? "dragon-sleep-1"
    : frames.includes("awake-down") ? "dragon-hit"
    : beat % 8 === 5 ? "dragon-attack"
    : ["dragon-idle", "dragon-idle-1"][Math.floor(now / 500) % 2];
  const top = (size) => HEIGHT - size - FLOOR;
  return div().relative().flex_none().w(16 + MAX * STEP + 16 + DRAGON + 8).h(HEIGHT - 1)
    .children(shown.map((p, i) => image(`${ART}${p.cls}-${frames[i]}.svg`).absolute()
      .left(16 + (MAX - shown.length + i) * STEP + (frames[i] === "awake-down" ? 12 : 0)).top(top(CHAR)).w(CHAR).h(CHAR)))
    .when(party.length > MAX, el => el.child(div().absolute().left(16 + MAX * STEP + 4).top(8).text_size(16).text_color(color).child(`+${party.length - MAX}`)))
    // Its breath: flames out of the maw (about 14px right, 50px down in the art) toward the party.
    .when(dragon === "dragon-attack", el => el.children([0, 1, 2, 3].map((k) => div().absolute()
      .left(16 + MAX * STEP + 16 + 14 - 26 * (k + 1)).top(top(DRAGON) + 38 + k * 2).w(26).h(26 - k * 4)
      .bg(["#fff3a0", "#ffb02e", "#ff6a1a", "#b83a1a"][k]))))
    .child(image(`${ART}${dragon}.svg`).absolute().right(8).top(top(DRAGON)).w(DRAGON).h(DRAGON));
}
