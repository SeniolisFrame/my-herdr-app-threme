// Limits, and the status-list helpers the other files use (no gpui or herdr in here).

export const MAX_FILES = 1000, MAX_LINES = 3000, NET = 120000, PREFETCH_LINES = 20000, LOG_PAGE = 50;
export const CONFLICTS = "Conflicts: fix each U file (Ours / Theirs, or edit it and Mark resolved), then Commit. Abort undoes it.";
// An operation that stopped half way, by the file git leaves for it.
export const IN_PROGRESS = [["merge", "MERGE_HEAD"], ["cherry-pick", "CHERRY_PICK_HEAD"], ["revert", "REVERT_HEAD"]];
export const ASK_FILE = "MY_HERDR_COMMIT_MSG"; // in .git: where the chat saves the message it wrote

// A status entry → its place in the Unstaged list, the Staged list, or both.
export function sides(f) {
  const out = [];
  if (f.fresh || f.conflict || f.y !== " ") out.push({ path: f.path, side: "unstaged", letter: f.conflict ? "U" : f.fresh ? "A" : f.y });
  if (!f.fresh && !f.conflict && f.x !== " ") out.push({ path: f.path, side: "staged", letter: f.x });
  return out;
}

// What git will make of a file once its unstaged side is staged (or staged side unstaged):
// shown at once, the refresh after git corrects any guess.
export function moveSide(f, from) {
  if (from === "unstaged") Object.assign(f, { x: f.fresh ? "A" : f.x !== " " ? f.x : f.y, y: " ", fresh: false });
  else Object.assign(f, f.x === "A" ? { x: "?", y: "?", fresh: true } : { x: " ", y: f.x });
}
