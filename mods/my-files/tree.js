// Files: listing folders (in-process where readdir reaches, else sh or PowerShell) and the refresh.
import { exec, window } from "herdr";
import { readdir } from "fs/promises";
import { location, locationKey, READ, watchWhile } from "./common.js";

export const PER_FOLDER = 500, TOTAL = 5000;

// PowerShell takes a 'single-quoted' string with its quote marks (curly ones too) doubled.
export const psQuote = (s) => "'" + s.replace(/['‘’‚‛]/g, "$&$&") + "'";

// Windows where readdir can't reach (another machine, a folder outside home): several
// folders in one PowerShell (UTF-8 output, links checked), as starting it costs 0.3s to 2s.
export async function windowsDirectories(root, rels, on, deep) {
  const script = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($root, $deep, [string[]]$rels) "
    + "function L($p) { ,@(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) } "
    + "$out = @{}; foreach ($r in $rels) { $full = if ($r) { Join-Path $root $r } else { $root }; "
    + "try { $e = L $full; $out[$r] = $e } catch { $out[$r] = $null; continue }; "
    + "if ($deep -eq 1) { foreach ($d in @($e | Where-Object { $_.dir } | Select-Object -First 40)) { $k = if ($r) { $r + '/' + $d.name } else { $d.name }; try { $out[$k] = L (Join-Path $full $d.name) } catch {} } } }; "
    + "ConvertTo-Json -InputObject $out -Depth 4 -Compress } "
    + `${psQuote(root)} ${deep ? 1 : 0} ${rels.map(psQuote).join(",")}`;
  const r = await exec("powershell", ["-NoProfile", "-Command", script], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  return new Map(Object.entries(JSON.parse(r.stdout || "{}")).map(([k, v]) => [k, v === null ? null : Array.isArray(v) ? v : [v]]));
}

// One local folder, read in-process (a PowerShell listing costs 0.6s): its entries, or null.
// PER_FOLDER + 1 kept, so store() can tell the folder was cut.
async function localDirectory(path, links) {
  let list;
  try { list = (await readdir(path, { withFileTypes: true })).filter((e) => e.name !== ".git").slice(0, PER_FOLDER + 1); }
  catch { return null; }
  // A link (junction, symlink) to a folder isn't isDirectory(): it is one when it can be listed.
  // Tried only with `links` (an open folder): a prefetched one is listed again when opened.
  const isDir = (e) => e.isDirectory() || (links && readdir(`${path}/${e.name}`).then(() => true, () => false));
  return Promise.all(list.map(async (e) => ({ name: e.name, dir: await isDir(e) })));
}

// Roots readdir can't read (a mod's readdir reaches the home folder, not C:\demo, say): those
// are listed by a program, as before.
const noReaddir = new Set();

// Folders under root, by path from root ("" is root) → their entries, or null when gone.
// `deep` lists each folder's subfolders too (the first 40), so opening one shows at once.
export async function directories(root, rels, on, deep) {
  if (!on && !noReaddir.has(root)) {
    const out = new Map();
    await Promise.all(rels.map(async (rel) => {
      const entries = await localDirectory(rel ? `${root}/${rel}` : root, true);
      out.set(rel, entries);
      if (deep && entries) await Promise.all(entries.filter((e) => e.dir).slice(0, 40).map(async (d) => {
        const sub = rel ? `${rel}/${d.name}` : d.name, list = await localDirectory(`${root}/${sub}`, false);
        if (list && !out.has(sub)) out.set(sub, list);
      }));
    }));
    if (out.get("") !== null) return out; // no root asked (a folder opened), or it was read
    noReaddir.add(root);
  }
  if (!on && window()?.platform === "windows") return windowsDirectories(root, rels, on, deep);
  const out = new Map();
  for (const rel of rels) {
    try { out.set(rel, await directory(rel ? `${root}/${rel}` : root, on)); }
    catch (e) {
      if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectories(root, rels, on, deep);
      out.set(rel, null);
    }
  }
  return out;
}

export async function directory(path, on) {
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export const treeMethods = {
  watch(root, cx) {
    if (this.on || this.watched === root) return;
    // A new watch ends the old one (coming back to the same folder must not run two).
    const token = this.watchToken = {}, context = this.context;
    this.watched = root;
    watchWhile(root, () => this.watchToken === token, (cx) => { if (this.current(context)) this.refresh(cx); }, () => { this.watched = null; }, cx);
  },

  current(context) { return this.context === context && locationKey() === context.key; },

  // Lists folders (with `deep`, their subfolders too) into this.entries; a listed folder that
  // is gone closes. Closed folders keep their entries, so opening one again shows at once.
  // Writes into the place's own entries and folders (context.entries / .folders), so a list
  // that arrives after a switch to another tab is kept for when this one shows again.
  async loadFolders(paths, context, deep, fresh = () => true) {
    const lists = await directories(context.cwd, paths, context.on, deep);
    if (!fresh()) return; // a later load of this place started: this list may be older
    for (const [path, entries] of lists) {
      if (entries) { this.store(path, entries, context); continue; }
      if (!path) throw new Error("Cannot list this folder");
      for (const folder of [...context.folders]) if (folder === path || folder.startsWith(path + "/")) context.folders.delete(folder);
      context.entries.delete(path);
    }
  },

  store(path, entries, context) {
    const shown = (p) => !p || context.folders.has(p);
    const used = [...context.entries.entries()].filter(([p]) => p !== path && shown(p)).reduce((n, [, e]) => n + e.length, 0);
    context.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (context === this.context && shown(path) && (entries.length > PER_FOLDER || used + entries.length > TOTAL)) this.limited = true;
  },

  refresh(cx) {
    const { cwd, on } = location(), next = locationKey();
    if (next !== this.context?.key) {
      if (this.dirty()) return; // keep unsaved edits: follow the chat once they're saved or dropped
      // Each workspace's last tree and marks show at once when it comes back; the refresh below updates them.
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file, entries: this.entries, marks: this.marks, isRepo: this.isRepo, top: this.context.top });
      const saved = this.saved.get(next);
      this.entries = saved?.entries ?? new Map(); this.folders = saved?.folders ?? new Set();
      this.context = { key: next, cwd, on, top: saved?.top, entries: this.entries, folders: this.folders }; this.root = cwd; this.on = on;
      this.pending = new Set(); this.marks = saved?.marks ?? {}; this.close(); this.watched = null; this.watchToken = null; this.error = null; this.limited = false;
      this.loading = false; this.results = null; this.search.set_value(""); this.replaceWith.set_value(""); // another place: its own search
      this.isRepo = saved?.isRepo ?? false; this.menu = null; this.nameAction = null;
      if (saved?.file) this.open(saved.file, null, cx);
    }
    if (!cwd) return;
    if (this.loading) { this.again = true; return; } // a change mid-refresh: once more after it
    const context = this.context, run = {};
    this.latest.set(context.key, run);
    const fresh = () => this.latest.get(context.key) === run;
    this.loading = true; this.again = false;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        // The folders and git's marks load side by side; the repo's top is asked once per location.
        const marksOf = async () => {
          if (!context.top) { // not a repo yet is asked again: a `git init` may come later
            const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
            context.top = top?.code === 0 ? top.stdout.trim() : null;
          }
          if (!context.top) return null;
          const status = await exec("git", [...READ, "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          const marks = {};
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${context.top}/${entry.slice(3)}`.toLowerCase()] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
          }
          return marks;
        };
        // An open folder that is gone (deleted, renamed) just closes; only the top one is an error.
        // The first listing of a folder also reads the top level's subfolders.
        const [, marks] = await Promise.all([this.loadFolders(["", ...context.folders], context, !context.entries.size, fresh), marksOf(), this.reloadOpen(context, cx)]);
        if (!fresh()) return;
        // Moved to another tab meanwhile: kept for this one. Still shown (a switch pending): the
        // switch's snapshot takes it from the panel.
        if (this.context !== context) {
          const s = this.saved.get(context.key);
          if (s) Object.assign(s, { marks: marks ?? {}, isRepo: Boolean(context.top), top: context.top });
          return;
        }
        this.isRepo = Boolean(context.top); this.marks = marks ?? {}; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally {
        if (this.context === context) { this.loading = false; if (this.again) this.refresh(cx); }
        cx.notify();
      }
    });
  },

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) this.folders.delete(folder);
    } else {
      this.folders.add(path);
      // Shown at once when listed before; read again (with its subfolders) meanwhile.
      if (!this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolders([path], context, true); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  },

  mark(path) {
    return this.marks[`${this.root}/${path}`.replace(/\\/g, "/").toLowerCase()];
  },
};
