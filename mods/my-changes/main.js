// Changes: git status of the focused pane's repo. Unstaged and staged
// lists; stage files, hunks or single lines; discard, commit, amend, undo commit, ask
// the chat for a message; branches, merge, fetch/pull/push, stash; the history graph
// with checkout, merge, cherry-pick, revert, branch delete and tags.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState } from "gpui-base";
import { exec, readTextFile, theme, nextCommand } from "herdr";
import { framed, location, locationKey, READ, git, toLines, watchWhile, sendToChat, focusChat, untab, diffRows, button, foldPanel, trackWidth, foldedStrip, confirmButton, sz, loadTextSizes, isFull, setFull } from "./common.js";
import { splitDiff } from "./patch.js";
import { MAX_FILES, MAX_LINES, PREFETCH_LINES, LOG_PAGE, IN_PROGRESS, sides } from "./status.js";
import { actionsMethods } from "./actions.js";
import { historyMethods } from "./history.js";
import { viewMethods } from "./view.js";

export default class Changes extends View {
  init(_props, cx) {
    loadTextSizes();
    this.handle = cx.focus_handle();
    this.files = []; this.rows = []; this.raw = ""; this.view = "changes"; this.chosen = new Set();
    // Per place (workspace + tab + folder): its last state, and its newest load.
    // shortcut: kept until the app closes, even for closed tabs; fine for a handful, drop on tab close if many.
    this.saved = new Map(); this.latest = new Map();
    this.openWidth = 460; // unfolding goes back to this until the panel has been seen open (layout's px)
    // Per repo (git dir): the message file asked of the chat and its text before; kept across every
    // switch of pane, tab or workspace, so the message lands whenever that repo shows again.
    this.asks = new Map();
    // The commit message box is one box: what is typed in it is kept per repo (git dir), so
    // repos in other tabs or workspaces commit side by side. boxFor: the repo it shows now.
    this.typed = new Map(); this.boxFor = null;
    this.message = InputState.new({ placeholder: "Commit message" });
    this.message.on("submit", (_e, cx) => this.commit(cx));
    this.message.on("change", (_e, cx) => { const has = Boolean(this.message.value().trim()); if (has !== this.hasMessage) { this.hasMessage = has; cx.notify(); } });
    this.branchName = InputState.new({ placeholder: "New branch name" });
    this.branchName.on("submit", (_e, cx) => this.newBranch(cx));
    this.logBranch = InputState.new({ placeholder: "New branch name" });
    this.logBranch.on("submit", (_e, cx) => this.riskyFor && this.newBranch(cx, this.logBranch, this.riskyFor)); // at the commit whose menu is open
    this.tagName = InputState.new({ placeholder: "New tag name" });
    this.tagName.on("submit", (_e, cx) => this.riskyFor && this.newTag(this.tagName.value(), this.riskyFor, cx)); // on the commit whose menu is open
    this.logSearch = InputState.new({ placeholder: "Search commits (message, hash, author, branch)" });
    this.logSearch.on("change", (_e, cx) => { this.logQuery = this.logSearch.value().trim().toLowerCase(); this.logShown = LOG_PAGE; cx.notify(); });
    for (const [state, name] of [[this.message, "message"], [this.branchName, "branch"], [this.logBranch, "log-branch"], [this.tagName, "tag"], [this.logSearch, "log"]]) {
      state.on("focus", (_e, cx) => { this.typing = name; cx.notify(); });
      state.on("blur", (_e, cx) => { this.typing = null; cx.notify(); });
    }
    // No timer (each refresh starts git several times): the folder watch and Sync do it.
    this.refresh(cx);
    cx.spawn(async (cx) => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
  }

  // Commands from keys.json ("my-changes.pull") or `herdr-app do my-changes.pull`;
  // "name:value" passes a value (a path, a branch, a commit message, a hash).
  command(c, cx) {
    const i = c.indexOf(":"), name = i < 0 ? c : c.slice(0, i), arg = i < 0 ? "" : c.slice(i + 1);
    const f = this.selected(), item = this.sel;
    const run = {
      focus: () => this.handle.focus(),
      fold: () => foldPanel(this, "changes", !this.folded), // fold into a strip, or open again
      // Not over a file open in Files: hidden there, it would come back in a small panel.
      full: () => !isFull("files") && this.setFull(!this.isFull()), // the lists and diff over the whole window, or back
      // select:<path>, or select:staged:<path> / select:unstaged:<path> for one list
      select: () => {
        const m = /^(staged|unstaged):(.*)$/.exec(arg), p = m ? m[2] : arg;
        const it = this.items().find((x) => x.path === p && (!m || x.side === m[1]));
        if (it) this.pick(it, cx);
      },
      stage: () => item && this.toggleFile(item, cx),
      sync: () => this.sync(cx), "stage-all": () => this.stageAll(cx), "unstage-all": () => this.unstageAll(cx),
      hunk: () => this.applyHunk(Number(arg) || 0, cx),
      "discard-hunk": () => this.discardHunk(Number(arg) || 0, cx), // twice

      line: () => { const [h, p] = arg.split(":").map(Number); this.pickLine({ hunk: h, pos: p }, cx); },
      discard: () => f && this.discard(f, cx), "discard-all": () => this.discardAll(cx), // twice
      ours: () => f && this.resolve(f, "ours", cx), theirs: () => f && this.resolve(f, "theirs", cx),
      open: () => item && this.openInFiles(item.path),
      commit: () => { if (arg) this.message.set_value(arg); this.hasMessage = Boolean(this.message.value().trim()); this.commit(cx); },
      amend: () => this.toggleAmend(cx),
      undo: () => this.undoCommit(cx),
      ask: () => this.askChat(cx),
      fetch: () => this.fetch(cx), pull: () => this.pull(cx), push: () => this.push(cx),
      stash: () => this.stash(cx), pop: () => this.pop(cx), abort: () => this.abort(cx),
      branches: () => this.openBranches(cx),
      checkout: () => this.checkout(arg, undefined, cx),
      merge: () => this.merge(arg, cx),
      // new-branch:<name> from HEAD, new-branch:<name>:<hash> from that commit (a branch name can't hold ":")
      "new-branch": () => { const [n, h] = arg.split(":"); this.branchName.set_value(n); this.newBranch(cx, this.branchName, h); },
      "delete-branch": () => this.deleteBranch(arg, cx),
      "cherry-pick": () => this.cherryPick(arg, cx),
      // tag:<name> on HEAD, tag:<name>:<hash> on that commit (a tag name can't hold ":")
      tag: () => { const [n, h] = arg.split(":"); this.newTag(n, h, cx); },
      "delete-tag": () => this.deleteTag(arg, cx), // twice
      "push-tag": () => this.pushTag(arg, cx),
      // An empty hash would match every commit: the newest would be reverted.
      revert: () => { const c = arg && this.log?.find((r) => r.hash.startsWith(arg)); if (c) this.revert(c, cx); },
      history: () => this.openLog(cx),
      "log-search": () => { this.logSearch.set_value(arg); this.logQuery = arg.toLowerCase(); },
      show: () => this.showCommit(arg, cx),
      pick: () => { this.logName = null; this.picked = this.riskyFor = (arg && this.log?.find((r) => r.hash.startsWith(arg)))?.hash ?? null; if (this.picked) this.readCommit(this.picked, cx); },
    }[name];
    run?.();
  }

  // Shows repo gitDir's message in the box (null: an empty box), keeping the one it had.
  boxTo(gitDir) {
    if (gitDir === this.boxFor) return;
    if (this.boxFor) this.typed.set(this.boxFor, this.message.value());
    const text = (gitDir && this.typed.get(gitDir)) || "";
    this.message.set_value(text); this.hasMessage = Boolean(text.trim()); this.boxFor = gitDir;
  }

  isFull() { return isFull("changes"); }
  setFull(on) { setFull(this, "changes", on); }

  git(args, timeout) { return git(this.root, this.on, args, timeout); }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    // A new watch ends the old one (coming back to the same repo must not run two).
    const token = this.watchToken = {};
    this.watched = root;
    watchWhile(root, () => this.watchToken === token, (cx) => this.refresh(cx), () => { this.watched = null; }, cx);
  }

  // Unstaged first, then staged; a partly staged file is in both.
  items() { return this.files.flatMap(sides); }
  selected() { return this.files.find((f) => f.path === this.sel?.path); }

  // --- status ------------------------------------------------------------------

  refresh(cx) {
    // Not during an action: its git calls use this.root, which a switch would change under it.
    if (this.busy) { this.again = true; return; }
    const { cwd, on } = location(), context = locationKey();
    if (context === this.context && this.loading) { this.again = true; return; }
    if (context !== this.context) {
      // Each workspace's last lists and diff show at once when it comes back; the refresh below updates them.
      if (this.context && this.root) {
        const { root, gitDir, on, top, files, branch, upstream, track, hasHead, inProgress, limited, diffs, changed, sel, rows, raw, branches, commits, log, logRoot } = this;
        this.saved.set(this.context, { root, gitDir, on, top, files, branch, upstream, track, hasHead, inProgress, limited, diffs, changed, sel, rows, raw, branches, commits, log, logRoot });
      }
      this.context = context; this.root = null; this.files = []; this.sel = null; this.setLines([], "");
      this.error = null; this.note = null; this.watched = null; this.watchToken = null; this.view = "changes"; this.menu = null; this.confirm = null;
      this.riskyFor = null; this.mergeFor = null; this.amend = false; this.logSearch.set_value(""); this.logQuery = ""; this.diffs = null; this.changed = 0; this.branches = null; this.commits = new Map();
      this.log = null; this.logRoot = null; this.logToken = null; this.reading = null;
      const back = this.saved.get(context) ?? {};
      Object.assign(this, back);
      this.gitDir = back.gitDir ?? null; this.boxTo(this.gitDir);
      this.loading = false; // the old place's load carries on behind and keeps its result for it
    }
    if (!cwd) return;
    // here: the panel still shows this place (a switch may be pending: its snapshot then takes
    // the result). fresh: no later load of this place started, so this result isn't older.
    const run = this.run = {}, here = () => this.context === context, prevChanged = this.changed;
    this.latest.set(context, run);
    const fresh = () => this.latest.get(context) === run;
    this.loading = true; this.again = false;
    cx.spawn(async (cx) => {
      try {
        // The repo folders only change with the location: asked once per location, not every refresh.
        let top = this.top?.context === context ? this.top : null;
        if (!top) {
          const r = await exec("git", ["rev-parse", "--show-toplevel", "--absolute-git-dir"], { cwd, on });
          if (r.code !== 0) { if (here()) { this.top = null; this.root = null; this.files = []; this.setLines([], ""); this.error = "Not a git repository"; } return; }
          top = { context, dirs: r.stdout.trim().split(/\r?\n/) };
        }
        const [root, gitDir] = top.dirs, g = (args) => git(root, on, [...READ, ...args]);
        // All at once: each git start costs 40ms to 1s on Windows. The in-progress refs are plain files in .git.
        // Every file's diff comes too, so clicking a file shows it at once; not when the last
        // refresh saw a huge change (then each file loads on its own).
        const whole = (cached) => prevChanged > PREFETCH_LINES ? Promise.resolve(null)
          : g(["diff", ...(cached ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--no-renames"]).then(splitDiff, () => null);
        const [status, staged, unstaged, diffStaged, diffUnstaged, ...marks] = await Promise.all([
          g(["status", "--porcelain=v1", "-b", "-z", "--no-renames", "--untracked-files=all"]),
          g(["diff", "--cached", "--numstat", "-z", "--no-renames"]), g(["diff", "--numstat", "-z", "--no-renames"]),
          whole(true), whole(false),
          ...IN_PROGRESS.map(([, ref]) => readTextFile(`${gitDir}/${ref}`, { on }).then((t) => t !== null, () => false)),
        ]);
        const inProgress = IN_PROGRESS.find((_, i) => marks[i])?.[0] ?? null;
        const stats = { staged: {}, unstaged: {} };
        let changed = 0;
        for (const [side, out] of [["staged", staged], ["unstaged", unstaged]]) {
          for (const entry of out.split("\0")) {
            const [a, d, ...parts] = entry.split("\t");
            if (parts.length) stats[side][parts.join("\t")] = { add: Number(a) || 0, del: Number(d) || 0, binary: a === "-" };
            changed += (Number(a) || 0) + (Number(d) || 0);
          }
        }
        const entries = status.split("\0").filter(Boolean);
        const branchLine = entries[0]?.startsWith("## ") ? entries.shift().slice(3) : "";
        const files = entries.slice(0, MAX_FILES).map((entry) => {
          const x = entry[0], y = entry[1], path = entry.slice(3);
          const conflict = x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D");
          return { path, x, y, fresh: x === "?", conflict, stats: { staged: stats.staged[path], unstaged: stats.unstaged[path] } };
        });
        // "main...origin/main [ahead 1, behind 2]" or "No commits yet on main"
        const b = /^(?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/.exec(branchLine) ?? [];
        const state = { root, gitDir, on, top, files, changed, inProgress, hasHead: !/^(No commits yet|Initial commit) on /.test(branchLine),
          diffs: { staged: diffStaged, unstaged: diffUnstaged }, limited: entries.length > MAX_FILES,
          branch: b[1] === "HEAD (no branch)" ? "detached HEAD" : b[1], upstream: b[2], track: b[3] };
        if (!fresh()) return;
        // Moved elsewhere meanwhile: kept for when that place shows again.
        if (!here()) { this.saved.set(context, { ...this.saved.get(context), ...state }); return; }
        Object.assign(this, state); this.error = null; this.boxTo(gitDir);
        if (this.logRoot !== root && !this.logToken) this.loadLog(cx); // read the history ahead, once per repo
        if (inProgress) this.amend = false; // a merge started meanwhile: Commit must not rewrite the last commit
        this.watch(root, cx);
        await this.takeAskedMessage();
        const items = this.items();
        if (this.sel && !items.some((x) => x.path === this.sel.path && x.side === this.sel.side)) {
          this.sel = items.find((x) => x.path === this.sel.path) ?? null; // staged all of it: follow it to the other list
        }
        this.sel ??= items[0] ?? null;
        if (this.sel) await this.load(this.sel, context).catch((e) => { if (locationKey() === context) this.setLines([`Cannot show this diff: ${e.message ?? e}`], ""); });
        else this.setLines([], "");
      } catch (e) { if (here()) { this.top = null; this.error = String(e.message ?? e); } } // the repo may be gone: ask again
      finally {
        if (this.run === run) { this.loading = false; if (this.again) this.refresh(cx); }
        cx.notify();
      }
    });
  }

  // The diff a hunk or line button acts on: index → worktree (unstaged) or HEAD → index (staged).
  diffArgs(item) {
    return [...READ, "diff", ...(item.side === "staged" ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--", item.path];
  }

  async load(item, context) {
    const file = this.files.find((f) => f.path === item.path), root = this.root, on = this.on, same = () => locationKey() === context && this.sel === item;
    if (!file) return;
    if (file.conflict || (file.fresh && item.side === "unstaged")) {
      const text = await readTextFile(`${root}/${item.path}`, { on }).catch(() => null);
      if (!same()) return;
      if (text === null) return this.setLines(["Cannot show this file (deleted, binary, too large, or unreadable)"], "");
      if (text.includes("\0")) return this.setLines(["Binary file"], "");
      const lines = toLines(text);
      if (file.conflict) return this.setConflict(lines);
      return this.setLines(["@@ -0,0 +1 @@ new file: stage it with its box", ...lines.map((l) => `+${l}`)], "");
    }
    const raw = this.diffs?.[item.side]?.get(item.path) ?? await git(root, on, this.diffArgs(item));
    if (!same()) return;
    const all = toLines(raw), first = all.findIndex((l) => l.startsWith("@@"));
    if (first < 0) this.setLines([file.stats[item.side]?.binary ? "Binary file changed" : "No text change (mode or line endings only)"], "");
    else this.setLines(all.slice(first), raw);
  }

  setConflict(lines) {
    this.raw = ""; this.chosen = new Set();
    this.rows = lines.slice(0, MAX_LINES).map((text, i) => /^(<<<<<<<|=======|>>>>>>>)/.test(text) ? { kind: "@", text } : { kind: " ", number: i + 1, text: untab(text) || " " });
  }

  // A refresh that finds the same diff keeps the lines chosen in it.
  setLines(lines, raw) {
    if (!raw || raw !== this.raw) { this.chosen = new Set(); this.hunkMenu = null; }
    this.raw = raw;
    this.rows = diffRows(lines.slice(0, MAX_LINES).map((l) => l.length > 4000 ? l.slice(0, 4000) + "… (line truncated)" : l));
  }

  pick(item, cx) {
    this.sel = item; this.confirm = null; this.setLines([], "");
    const context = this.context;
    cx.spawn(async (cx) => {
      try { await this.load(item, context); }
      catch (e) { if (this.sel === item) this.setLines([`Cannot show this diff: ${e.message ?? e}`], ""); }
      cx.notify();
    });
    cx.notify();
  }

  // Click a "+" or "-" line to choose it; the hunk's button then stages only the chosen lines.
  pickLine(row, cx) {
    const line = this.rows.find((r) => r.hunk === row.hunk && r.pos === row.pos);
    if (!this.raw || (line?.kind !== "+" && line?.kind !== "-")) return; // only changed lines
    const key = `${row.hunk}:${row.pos}`;
    if (this.chosen.has(key)) this.chosen.delete(key); else this.chosen.add(key);
    cx.notify();
  }

  // --- keys ----------------------------------------------------------------------

  key(e, cx) {
    const k = e.key;
    if (k === "escape") {
      cx.stop_propagation();
      if (this.typing) { this.typing = null; this.handle.focus(); }
      else if (this.menu || this.confirm || this.riskyFor || this.mergeFor || this.hunkMenu) { this.menu = null; this.confirm = null; this.riskyFor = null; this.mergeFor = null; this.hunkMenu = null; }
      else if (this.view === "commit") this.view = "log";
      else if (this.view === "log") this.view = "changes";
      else if (this.isFull()) this.setFull(false); // the chat is hidden: back first
      else focusChat();
      cx.notify();
      return;
    }
    // Ctrl+C (Cmd+C) in History: the picked commit's hash (in a commit's changes, that commit's), as the menu's Copy hash.
    const hash = (e.modifiers.control || e.modifiers.platform) && k === "c" && !this.typing && (this.view === "log" ? this.picked : this.view === "commit" ? this.shown : null);
    if (hash) { cx.stop_propagation(); cx.write_to_clipboard(hash); this.note = { text: `Copied ${hash.slice(0, 7)}` }; cx.notify(); return; }
    if (this.typing || e.modifiers.control || e.modifiers.alt || e.modifiers.platform) return;
    const items = this.items(), i = items.findIndex((x) => x.path === this.sel?.path && x.side === this.sel?.side);
    const act = {
      up: () => i > 0 && this.pick(items[i - 1], cx),
      down: () => i < items.length - 1 && this.pick(items[i + 1], cx),
      space: () => this.sel && this.toggleFile(this.sel, cx),
      c: () => this.message.focus(),
      l: () => this.openLog(cx),
      s: () => this.sel && this.send(this.sel.path, cx),
      o: () => this.sel && this.openInFiles(this.sel.path),
    }[k];
    if (act && this.view === "changes") { cx.stop_propagation(); act(); cx.notify(); }
  }

  send(path, cx) {
    const rel = this.relative(path);
    cx.spawn(async (cx) => {
      try { await sendToChat(`@${rel} `, cx); }
      catch (e) { this.note = { text: `Not sent: ${e.message ?? e}`, error: true }; }
      cx.notify();
    });
  }

  // A repo path as the chat sees it (relative to the chat's folder when inside it).
  relative(path) {
    const cwd = (location().cwd ?? "").replace(/\\/g, "/").replace(/\/$/, ""), full = `${this.root}/${path}`;
    return cwd && full.toLowerCase().startsWith(cwd.toLowerCase() + "/") ? full.slice(cwd.length + 1) : full;
  }

  render(cx) {
    if (locationKey() !== this.context) this.refresh(cx);
    this.checkAsk(cx);
    const t = theme(), f = this.selected(), item = this.sel, full = this.isFull();
    if (this.folded) return foldedStrip("changes", "«", "Show Changes", t, () => foldPanel(this, "changes", false))
      .id("my-changes").on_size_change(({ width }, cx) => trackWidth(this, width, cx));
    // Lists that fill the panel stay direct children of the root: one more flex level
    // and they lay out at zero height.
    const body = this.menu ? this.branchMenu(t)
      : this.view === "log" ? this.logView(t)
      : this.view === "commit" ? [
        h_flex().flex_none().px(10).py(4).gap(6).items_center().child(button("commit-back", "← History", t, (_e, cx) => { this.view = "log"; cx.notify(); })),
        this.commitRows ? this.diffView("commit-diff", this.commitRows, t, false) : div().p(12).text_color(t.dim).child("Loading commit…")]
      : !this.root ? div().p(12).text_color(t.dim).child(this.error ?? (this.loading ? "Loading…" : "No folder"))
      : [
        ...this.fileList("unstaged", t, !full), // Staged keeps its few rows: it is short most of the time
        ...this.fileList("staged", t),
        // The diff shows only over the whole window; beside the chat the panel is just the lists.
        f && full ? h_flex().flex_none().px(10).py(4).gap(6).items_center().border_t(1).border_b(1).border_color(t.border)
          .child(div().flex_1().min_w(0).truncate().text_size(sz("sm")).font_semibold().child(`${f.path}${item.side === "staged" ? " (staged)" : ""}`))
          .child(button("open", "Open", t, () => this.openInFiles(f.path)))
          .when(f.conflict, (e) => e.child(button("ours", "Ours", t, (_e, cx) => this.resolve(f, "ours", cx), { name: "Use your version of the whole file" }))
            .child(button("theirs", "Theirs", t, (_e, cx) => this.resolve(f, "theirs", cx), { name: "Use the incoming version of the whole file" }))
            .child(button("resolved", "Mark resolved", t, (_e, cx) => this.toggleFile(item, cx))))
          .when(!f.conflict, (e) => e.child(confirmButton("discard", "Discard", this.confirm?.path === f.path, t, (_e, cx) => this.discard(f, cx))))
          : full ? div().flex_1() : null,
        ...(full ? [this.diffView("changes-diff", this.rows, t, true)] : [])];
    return framed(v_flex().id("my-changes").size_full().min_h(0).overflow_hidden().bg(t.background), t).text_color(t.foreground).text_size(sz("md"))
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx)).on_size_change(({ width }, cx) => trackWidth(this, width, cx))
      .child(this.tabs(t))
      .when(Boolean(this.root), (e) => e.child(this.toolbar(t)))
      .when(Boolean(this.note?.text), (e) => e.child(h_flex().flex_none().px(12).py(4).gap(6).text_size(sz("xs")).text_color(this.note.error ? t.ansi1 : t.ansi2)
        .child(div().flex_1().child(this.note.text)).child(button("note-close", "×", t, (_e, cx) => { this.note = null; cx.notify(); }, { name: "Close message" }))))
      .children([body].flat().filter(Boolean))
      .when(this.view === "changes" && !this.menu && Boolean(this.root), (e) => e.child(this.commitBox(t)));
  }
}

Object.assign(Changes.prototype, actionsMethods, historyMethods, viewMethods);
