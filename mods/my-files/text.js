// Text changes that end up written to files. No imports, so node can test them:
// node mods/my-files/text.test.mjs

// The editor draws a tab as nothing, so tab indents show as 4 spaces and turn back
// into tabs on save. Only when no line starts with a space, or with tabs then 4 spaces
// (a Go raw string, say: they would come back as one more tab), so it round-trips.
export const usesTabs = (text) => /^\t/m.test(text) && !/^ /m.test(text) && !/^\t+ {4}/m.test(text);
export const tabsToSpaces = (text) => text.replace(/^\t+/gm, (m) => "    ".repeat(m.length));
export const spacesToTabs = (text) => text.replace(/^( {4})+/gm, (m) => "\t".repeat(m.length / 4));

// The selection [start, end) of text as a chat message: "path:line-line" and the code in
// a fence (a longer one when the code has ```). A selection ending at a line's start
// doesn't count that line.
export function snippet(path, text, start, end) {
  const from = text.slice(0, start).split("\n").length, to = text.slice(0, Math.max(start, end - 1)).split("\n").length;
  const code = text.slice(start, end).replace(/\n$/, ""), fence = code.includes("```") ? "````" : "```";
  const lang = path.includes(".") ? path.split(".").pop() : "";
  return `${path}:${from === to ? from : `${from}-${to}`}\n${fence}${lang}\n${code}\n${fence}\n`;
}

// CSV text → rows of cells, split on `sep`. A cell in "..." may hold sep, line breaks
// and "" (one quote); CRLF and a last empty line are fine.
export function parseCsv(text, sep) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// The separator the first line uses most: , ; tab or | (outside quotes); "," if none.
export function guessSeparator(text) {
  const line = text.slice(0, text.search(/\r?\n|$/)).replace(/"[^"]*"/g, "");
  let best = ",", most = 0;
  for (const s of [",", ";", "\t", "|"]) { const n = line.split(s).length - 1; if (n > most) { best = s; most = n; } }
  return best;
}

// Blame rows → the same rows with a head row before each run of lines from one commit:
// { head: true, ...that commit's first row }. The code lines stay one after another.
export function blameBlocks(rows) {
  const out = [];
  rows.forEach((r, i) => { if (i === 0 || rows[i - 1].hash !== r.hash) out.push({ ...r, head: true }); out.push(r); });
  return out;
}

// Seconds since the epoch → "3 days ago" (now: the epoch seconds to count from).
export function ago(sec, now = Date.now() / 1000) {
  const s = Math.max(0, now - sec);
  for (const [unit, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (s >= n) { const k = Math.floor(s / n); return `${k} ${unit}${k > 1 ? "s" : ""} ago`; }
  }
  return "just now";
}

// Where q starts in text, any case, not overlapping: [3, 17, …].
export function findAll(text, q) {
  const low = text.toLowerCase(), want = q.toLowerCase(), out = [];
  if (!want) return out;
  for (let at = low.indexOf(want); at >= 0; at = low.indexOf(want, at + want.length)) out.push(at);
  return out;
}

// The match to go to from a selection [start, end): the first one after it, or with back
// the last one before it, wrapping round at the ends. -1 when there is none.
export function nextMatch(starts, start, end, back) {
  if (!starts.length) return -1;
  if (back) { for (let i = starts.length - 1; i >= 0; i--) if (starts[i] < start) return i; return starts.length - 1; }
  const i = starts.findIndex((s) => s >= end);
  return i < 0 ? 0 : i;
}

// A line cut into pieces for the find view: [{ text, at, hit }], hit marking each match of q
// (any case) and at its column, so the current one can be told from the rest.
export function hitSegments(line, q) {
  const out = [];
  let from = 0;
  for (const at of findAll(line, q)) {
    if (at > from) out.push({ text: line.slice(from, at), at: from, hit: false });
    out.push({ text: line.slice(at, at + q.length), at, hit: true });
    from = at + q.length;
  }
  if (from < line.length || !out.length) out.push({ text: line.slice(from), at: from, hit: false });
  return out;
}

// q found literally, in any case.
const literal = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

// Replaces q with `to` on the given 1-based lines only; line endings stay as they
// are. Returns the new text and how many were replaced.
export function replaceOnLines(text, lines, q, to) {
  const re = literal(q), parts = text.split(/(?<=\n)/);
  let n = 0;
  for (const l of lines) if (parts[l - 1]) parts[l - 1] = parts[l - 1].replace(re, () => { n++; return to; });
  return { text: parts.join(""), n };
}

// Replaces every q in the text (ctrl+h, Replace all).
export function replaceAll(text, q, to) {
  let n = 0;
  return { text: text.replace(literal(q), () => { n++; return to; }), n };
}
