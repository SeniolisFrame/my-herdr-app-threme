import { div, image } from "gpui-kit";
import { SPR } from "./sprites.js";

// kage: a twilight forest behind the whole tab bar. Every working agent is a class-character swinging at the dragon,
// which stands in the middle of the bar. Art is in mods/kage-agents (Pixellab sprites, avatars/build_pixellab.py): each class's 9-frame attack and the dragon.
const ART = "mods/kage-agents/";
const MAX = 4;                                   // characters shown; more show as "+N"
const STEP = 100, FLOOR = 8;
export const HEIGHT = 222;                       // the tab bar's height while the forest is on (the layout's tabs block)
export const PLAIN = 42;                         // and with it off

// The forest, absolute behind everything in the bar: a misty twilight pine forest drawn by avatars/forest.py
// (mods/kage-tabs/forest-bg.png, 1920x222, centred; a wider bar shows plain dark at the sides), and drifting motes of light.
export function backdrop(now) {
  const beat = Math.floor(now / 250);
  const mote = (x, y, i) => (beat + i) % 6 < 3 ? div().absolute().left(x + ((beat + i) % 12 < 6 ? 0 : 6)).top(y + ((beat + i) % 8 < 4 ? 0 : 3)).w(4).h(4).bg("#bfe8ff") : null;
  const motes = [[300, 70], [520, 100], [760, 50], [1010, 90], [1290, 60], [1540, 105], [1800, 75]].map(([x, y], i) => mote(x, y, i)).filter(Boolean);
  return div().absolute().left(0).right(0).top(0).bottom(0).overflow_hidden().bg("#0a1226").flex().justify_center()
    .child(image("mods/kage-tabs/forest-bg.png").flex_none().w(1920).h(222))
    .children(motes);
}

// party: [{ id, cls }] of working agents; now: Date.now(). A full-bar layer under the tabs (so tabs stay clickable);
// the dragon is in the middle of the bar, the party in a row to its left. A class steps through its attack every 110ms, each agent
// a little apart; the dragon flashes while a blow lands, breathes fire now and then, else sways.
export function arena(party, now, color) {
  const tick = Math.floor(now / 110), beat = Math.floor(now / 250);
  const shown = party.slice(0, MAX);
  const frame = shown.map((p, i) => (tick + i * 3) % SPR[p.cls].n);
  const hit = shown.some((p, i) => SPR[p.cls].hit.includes(frame[i]));
  const dragon = !party.length ? "dragon-sleep-1"
    : hit ? "dragon-hit"
    : beat % 8 === 5 ? "dragon-attack"
    : ["dragon-idle", "dragon-idle-1"][Math.floor(now / 500) % 2];
  const D = SPR.dragon, top = (h) => HEIGHT - h - FLOOR;
  const half = MAX * STEP + 60;                  // room for the party on each side, so the dragon is centred
  const dx = half;                               // the dragon's left edge in this box
  return div().absolute().left(0).right(0).top(0).bottom(0).flex().justify_center()
    .child(div().relative().flex_none().w(half * 2 + D.w).h(HEIGHT - 1)
      .children(shown.map((p, i) => {
        const s = SPR[p.cls];
        return image(`${ART}${p.cls}-atk-${frame[i]}.png`).absolute().left(dx - s.w + 14 - (shown.length - 1 - i) * STEP).top(top(s.h)).w(s.w).h(s.h);
      }))
      .when(party.length > MAX, el => el.child(div().absolute().left(dx - 40 - MAX * STEP).top(top(150)).text_size(16).text_color(color).child(`+${party.length - MAX}`)))
      // Its breath: a wavy stream of flames out of the mouth toward the party.
      .when(dragon === "dragon-attack", el => el.children([0, 1, 2, 3, 4].map((k) => div().absolute()
        .left(dx + D.mouthX - 36 * (k + 1)).top(top(D.h) + D.mouthY - (30 - k * 4) / 2 + [0, -6, 2, -5, 3][(k + beat) % 5]).w(36).h(30 - k * 4)
        .bg(["#fff3a0", "#ffd23f", "#ffb02e", "#ff6a1a", "#b83a1a"][k]))))
      .child(image(`${ART}${dragon}.png`).absolute().left(dx).top(top(D.h)).w(D.w).h(D.h)));
}
