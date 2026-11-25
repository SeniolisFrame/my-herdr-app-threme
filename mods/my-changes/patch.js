// Patches for `git apply --cached`. No imports, so node can test them:
// node mods/my-changes/patch.test.mjs

// The file header and hunk n of a one-file diff, byte for byte (CRLF kept); "" if none.
export function oneHunk(diff, n) {
  let head = "", hunk = "", i = -1;
  for (const l of diff.split(/(?<=\n)/)) {
    if (l.startsWith("@@")) i++;
    if (i < 0) head += l; else if (i === n) hunk += l;
  }
  return hunk ? head + hunk : "";
}

// Hunk n with only the chosen body lines changed (0-based, counting " ", "+" and "-"
// lines; "\ No newline" lines don't count). Apply it with --recount: the @@ counts
// are left as they were.
// Staging (a worktree diff): an unchosen "+" is dropped, an unchosen "-" stays as context.
// Unstaging (an index diff, applied with -R): an unchosen "-" is dropped, an unchosen "+" stays.
export function someLines(diff, n, chosen, unstage) {
  const parts = oneHunk(diff, n).split(/(?<=\n)/);
  const at = parts.findIndex((l) => l.startsWith("@@"));
  if (at < 0) return "";
  const out = parts.slice(0, at + 1);
  let i = -1, dropped = false;
  for (const l of parts.slice(at + 1)) {
    if (l.startsWith("\\")) { if (!dropped) out.push(l); continue; }
    i++; dropped = false;
    if (l[0] === " " || chosen.has(i)) out.push(l);
    else if (l[0] === (unstage ? "-" : "+")) dropped = true;
    else out.push(" " + l.slice(1)); // the side that stays as it is: context
  }
  return out.join("");
}

// A whole-repo `git diff` → each file's part, the same text `git diff -- <path>` gives.
// Quoted paths (unusual characters) are left out: those load on their own.
export function splitDiff(raw) {
  const out = new Map();
  for (const part of raw.split(/^(?=diff --git )/m)) {
    const head = part.slice(0, part.indexOf("\n")), n = (head.length - 16) / 2, path = head.substr(13, n);
    if (n > 0 && head === `diff --git a/${path} b/${path}`) out.set(path, part);
  }
  return out;
}

// A patch for a CRLF file, applied with core.autocrlf=false (so git doesn't rewrite the
// whole file's line endings): its body lines get the "\r" the file has.
export const toCrlf = (patch) => patch.split(/(?<=\n)/)
  .map((l) => /^[ +-]/.test(l) && !/^(\+\+\+|---) /.test(l) ? l.replace(/(?<!\r)\n$/, "\r\n") : l).join("");
