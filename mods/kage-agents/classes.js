// The dungeon classes (art: <id>-awake*.svg and <id>-sleep*.svg next to this file). Shared by the agent cards and the tab bar scene.
export const CLASSES = [
  { id: "swordsman", label: "Swordsman" }, { id: "rogue", label: "Rogue" }, { id: "priest", label: "Priest" },
  { id: "reaper", label: "Reaper" }, { id: "witch", label: "Witch" },
];

// An agent's class: the one the person picked (chosen: { [agent id]: class id }), else a stable random one from its id.
export function classFor(id, chosen) {
  const picked = chosen?.[id];
  if (CLASSES.some((c) => c.id === picked)) return picked;
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CLASSES[h % CLASSES.length].id;
}
