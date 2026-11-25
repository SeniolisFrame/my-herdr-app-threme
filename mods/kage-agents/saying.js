// What a working agent's witch chants (the board's speech bubble): a spell for the step on its newest "●" line since
// the last prompt (❯), none from an earlier turn. Reading, changing, running, searching and summoning a helper each
// have their spell; anything else (the agent's own words) one of SPELLS, the same for the same line so it doesn't flicker.
// shortcut: Claude Code's ● marker only, other agents get no bubble; add their marker when one is on the board.
// A stem takes -e, -s, -es, -d, -ed or -ing ("updat": update, updated, updating); stems are cut before a
// final e, and irregular past forms are listed whole. Whole words only: "add" is not "Address".
const step = (stems) => new RegExp(`^(?:${stems})(?:e|s|es|d|ed|ing)?\\b`, "i");
const STEPS = [
  [step("read|view|look|see|check|open|show|inspect"), "Perspicio!"],
  [step("updat|edit|writ|wrote|fix|add|remov|creat|mak|made|chang|mov|delet|patch"), "Transmuto!"],
  [step("bash|powershell|run|runn|ran|execut|install|test|build|built|start"), "Ignis!"],
  [step("search|grep|glob|find|found|fetch|web"), "Inquiro!"],
  [step("agent|task|spawn|dispatch"), "Veni, familiaris!"],
];
const SPELLS = ["Arcanum aperio!", "Nox et lumen!", "Ventus canit!", "Stellae, audite!", "Umbra loquitur!", "Flamma memor!"];

export function saying(screen) {
  const lines = screen.split("\n").reverse();
  // The input box's ❯ (under a ─── rule) is not a sent prompt.
  const turn = lines.findIndex((l, k) => /^\s*❯/.test(l) && !/^\s*─/.test(lines[k + 1] ?? ""));
  const line = lines.slice(0, turn < 0 ? undefined : turn).find((l) => /^\s*●\s/.test(l))?.replace(/^\s*●\s+/, "").trim();
  if (!line) return null;
  const step = STEPS.find(([word]) => word.test(line));
  if (step) return step[1];
  let h = 0;
  for (const c of line) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return SPELLS[h % SPELLS.length];
}
