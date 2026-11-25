// Files: search and replace across files, @path to the chat, new / rename / delete.
import { h_flex, v_flex } from "gpui-base";
import { exec, readTextFile, writeTextFile, window } from "herdr";
import { READ, sendToChat, untab, button, menuBox, nameForm, confirmButton } from "./common.js";
import { MAX_EDIT } from "./editor.js";
import { replaceOnLines } from "./text.js";
import { psQuote } from "./tree.js";

export const actionsMethods = {
  // Replaces the search text (any case, as the search matched it) on the hit lines
  // only, file by file; a file changed since the search is skipped, not overwritten.
  replaceHits(hits, cx) {
    const q = this.results?.q, to = this.replaceWith.value();
    if (!q || this.replacing) return;
    // Reads and writes below are local: a remote hit's path could name a local file.
    if (this.on) { this.note = "File actions work on this computer only"; cx.notify(); return; }
    const byFile = new Map();
    for (const h of hits) byFile.set(h.path, [...(byFile.get(h.path) ?? []), h.line]);
    this.replacing = true; this.note = null;
    cx.spawn(async (cx) => {
      let count = 0, files = 0;
      const skipped = [];
      try {
        for (const [path, lines] of byFile) {
          try {
            const full = this.full(path), text = await readTextFile(full);
            if (text === null) { skipped.push(`${path} (gone)`); continue; }
            // readTextFile stops at 1 MiB: never write back a file that may be cut short.
            if (text.length > MAX_EDIT) { skipped.push(`${path} (too big)`); continue; }
            const { text: next, n } = replaceOnLines(text, lines, q, to);
            if (!n) continue;
            await writeTextFile(full, next, text);
            count += n; files++;
          } catch (e) { skipped.push(`${path} (${e.message ?? e})`); }
        }
        this.note = `Replaced ${count} in ${files} file${files === 1 ? "" : "s"}${skipped.length ? ` · skipped ${skipped.join(", ")}` : ""}${this.results?.more ? " · only the first 500 matches: search again for more" : ""}`;
      } catch (e) { this.note = `Replace failed: ${e.message ?? e}`; }
      finally { this.replacing = false; this.runSearch(cx); this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  },

  runSearch(cx) {
    const q = this.search.value().trim();
    if (!q || !this.root) { this.results = null; cx.notify(); return; }
    const root = this.root, on = this.on;
    this.results = { q, rows: [], loading: true };
    cx.spawn(async cx => {
      // git grep also searches untracked files; outside a repo it reads the folder as is.
      const args = [...READ, "grep", "-n", "-I", "-i", "-F", "--no-color", ...(this.isRepo ? ["--untracked"] : ["--no-index"]), "-e", q];
      const r = await exec("git", args, { cwd: root, on }).catch(e => ({ code: 2, stderr: String(e) }));
      if (this.results?.q !== q) return;
      const rows = r.code === 0 ? r.stdout.split(/\r?\n/).filter(Boolean).slice(0, 500).map(l => {
        const m = /^(.*?):(\d+):(.*)$/.exec(l);
        return m && { path: m[1], line: +m[2], text: untab(m[3]).trim() };
      }).filter(Boolean) : [];
      this.results = { q, rows, error: r.code > 1 ? (r.stderr || "search failed").trim() : null, more: r.stdout?.split("\n").length > 501 };
      cx.notify();
    });
    cx.notify();
  },

  send(path, cx) {
    cx.spawn(async cx => {
      try { await sendToChat(`@${path} `, cx); this.note = null; }
      catch (e) { this.note = `Not sent: ${e.message ?? e}`; }
      cx.notify();
    });
  },

  // menu: { path, dir } of that row ("" = the tree's folder); confirm: Delete was clicked once.
  openMenu(path, cx) {
    const i = path.lastIndexOf("/"), entry = (this.entries.get(i < 0 ? "" : path.slice(0, i)) ?? []).find((e) => e.name === path.slice(i + 1));
    this.menu = this.menu?.path === path ? null : { path, dir: path === "" || Boolean(entry?.dir) };
    this.nameAction = null;
    cx.notify();
  },

  // New file / New folder / Rename ask for a name first (a command can pass it).
  nameThen(action, name, cx) {
    if (!this.menu) return;
    if (name) { this.nameInput.set_value(name); return this.fileOp(action, cx); }
    this.nameAction = action;
    this.nameInput.set_value(action === "rename" ? this.menu.path.split("/").pop() : "");
    this.nameInput.focus();
    cx.notify();
  },

  fileOp(action, cx) {
    const m = this.menu;
    if (!m || !action || (m.path === "" && (action === "rename" || action === "delete"))) return;
    // New file opens in place of the open one, a rename of it closes it: either would drop the edits.
    if (this.dirty()) { this.note = "Save or close the open file first"; cx.notify(); return; }
    if (this.on) { this.note = "File actions work on this computer only"; cx.notify(); return; }
    if (action === "delete" && !m.confirm) { m.confirm = true; cx.notify(); return; }
    const name = this.nameInput.value().trim();
    if (action !== "delete" && (!name || /[\\/]/.test(name) || name === "." || name === "..")) { this.note = "Type a name (without / or \\)"; cx.notify(); return; }
    const parentOf = (p) => p.replace(/\/?[^/]*$/, ""), join = (dir, n) => (dir ? `${dir}/${n}` : n);
    const where = action === "rename" || action === "delete" ? parentOf(m.path) : m.dir ? m.path : parentOf(m.path);
    const target = action === "delete" ? m.path : join(where, name);
    this.menu = null; this.nameAction = null;
    cx.spawn(async (cx) => {
      try {
        if (action === "new-file") await writeTextFile(this.full(target), "", null);
        else await this.shell(action, this.full(action === "new-folder" ? target : m.path), this.full(target));
        if (where) this.folders.add(where); // show where it went
        if (this.file && (action === "delete" || action === "rename") && (this.file === m.path || this.file.startsWith(m.path + "/"))) this.close();
        this.note = { "new-file": `Created ${target}`, "new-folder": `Created ${target}/`, rename: `Renamed to ${target}`, delete: `Deleted ${m.path}` }[action];
        this.refresh(cx);
        if (action === "new-file") this.open(target, null, cx);
      } catch (e) { this.note = `Not done: ${e.message ?? e}`; }
      cx.notify();
    });
    cx.notify();
  },

  // mkdir, move (never over an existing file) and delete: PowerShell on Windows, else sh.
  async shell(action, a, b) {
    const [ps, sh] = {
      "new-folder": ["New-Item -ItemType Directory -Path $a | Out-Null", 'mkdir -- "$1"'],
      // Move-Item onto an existing folder moves into it: refused, like the sh one. -ne ignores
      // case, so a case-only rename (the same file on Windows) still goes through.
      rename: ["if ((Test-Path -LiteralPath $b) -and $a -ne $b) { throw ($b + ' already exists') }; Move-Item -LiteralPath $a -Destination $b", '[ -e "$2" ] && { echo "$2 already exists" >&2; exit 1; }; mv -- "$1" "$2"'],
      delete: ["Remove-Item -LiteralPath $a -Recurse -Force", 'rm -rf -- "$1"'],
    }[action];
    const r = window()?.platform === "windows"
      ? await exec("powershell", ["-NoProfile", "-Command", `& { param($a, $b) $ErrorActionPreference = 'Stop'; ${ps} } ${psQuote(a)} ${psQuote(b)}`])
      : await exec("sh", ["-c", sh, "files", a, b]);
    if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split(/\r?\n/)[0] || `${action} failed`);
  },

  // Under the row it is for; its items keep the same inset at any folder depth (as History's menu).
  menuRow(t) {
    const m = this.menu, isRoot = m.path === "", a = this.nameAction;
    if (a) {
      // Where it goes, as fileOp works it out: a folder's own path, else the file's folder.
      const folder = (a === "rename" || !m.dir ? m.path.replace(/\/?[^/]*$/, "") : m.path) || "the top folder";
      const label = a === "rename" ? `Rename ${m.path.split("/").pop()}` : `New ${a === "new-file" ? "file" : "folder"} in ${folder}`;
      return menuBox("file-menu", t, [nameForm("file-name", t, label, this.nameInput, this.typing === "name",
        { "new-file": "Create file", "new-folder": "Create folder", rename: "Rename" }[a], (_e, cx) => this.fileOp(a, cx), (_e, cx) => { this.nameAction = null; cx.notify(); })]);
    }
    return menuBox("file-menu", t, [
      ...(isRoot ? [] : [button("file-send", "@ chat", t, (_e, cx) => { this.menu = null; this.send(m.path, cx); })]),
      button("file-new", "New file", t, (_e, cx) => this.nameThen("new-file", "", cx)),
      button("file-new-dir", "New folder", t, (_e, cx) => this.nameThen("new-folder", "", cx)),
      ...(isRoot ? [] : [
        button("file-rename", "Rename", t, (_e, cx) => this.nameThen("rename", "", cx)),
        confirmButton("file-delete", "Delete", Boolean(m.confirm), t, (_e, cx) => this.fileOp("delete", cx)),
      ]),
    ]);
  },
};
