import { div, image } from "gpui-kit";

// kage: the dungeon in the tab bar. Every working agent is a class-character swinging at the dragon.
// Art is in mods/kage-agents (avatars/*.svg: 32x32 sprites drawn 1:1, the dragon 40x40).
const ART = "mods/kage-agents/";
const MAX = 4;          // characters shown; more show as "+N"
const STEP = 28;        // each character overlaps the last by 4px
export const HEIGHT = 41;

const SWING = ["awake", "awake-mid", "awake-down", "awake-mid"];

// party: [{ id, cls }] of working agents; now: Date.now(). Frames step every 250ms, as the cards' art does.
export function scene(party, now, color) {
  const beat = Math.floor(now / 250);
  const shown = party.slice(0, MAX);
  const frames = shown.map((_p, i) => SWING[(beat + i) % 4]);
  // The blow lands on the "down" frame: the dragon flashes, breathes fire now and then, else flaps.
  const dragon = !party.length ? "dragon-sleep-1"
    : frames.includes("awake-down") ? "dragon-hit"
    : beat % 8 === 5 ? "dragon-attack"
    : ["dragon-idle", "dragon-idle-1"][Math.floor(now / 500) % 2];
  const width = 20 + MAX * STEP + 8 + 40 + 2;
  const flame = (left) => div().absolute().left(left).top(5).w(6).h(10)
    .child(div().absolute().left(2).top(5).w(2).h(5).bg("#5a3a22"))
    .child(div().absolute().left(1).top(beat % 2 ? 0 : 1).w(4).h(5).bg(beat % 2 ? "#ffd23f" : "#ff8a1f"));
  const joint = (left, top) => div().absolute().left(left).top(top).w(1).h(6).bg("#241c3a");
  return div().relative().flex_none().w(width).h(HEIGHT).overflow_hidden().bg("#14101f")
    .child(div().absolute().left(0).right(0).top(12).h(1).bg("#241c3a"))
    .child(div().absolute().left(0).right(0).top(26).h(1).bg("#241c3a"))
    .child(joint(30, 6)).child(joint(80, 6)).child(joint(120, 6)).child(joint(55, 20)).child(joint(100, 20)).child(joint(150, 20))
    .child(flame(6)).child(flame(Math.floor(width / 2) - 20))
    .child(div().absolute().left(0).right(0).bottom(0).h(3).bg("#3a2f4f"))
    .children(shown.map((p, i) => image(`${ART}${p.cls}-${frames[i]}.svg`).absolute()
      .left(14 + i * STEP + (frames[i] === "awake-down" ? 5 : 0)).top(HEIGHT - 32 - 3).w(32).h(32)))
    .when(party.length > MAX, el => el.child(div().absolute().left(14 + MAX * STEP + 6).top(3).text_size(16).text_color(color).child(`+${party.length - MAX}`)))
    .child(image(`${ART}${dragon}.svg`).absolute().right(2).top(HEIGHT - 40).w(40).h(40));
}
