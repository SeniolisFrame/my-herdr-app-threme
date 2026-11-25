// Files: the focused pane's folder as a tree. Open a file to edit it (ctrl+s saves),
// search every file, see blame and history, and send @path to the chat.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, InputState } from "gpui-base";
import { theme, settings, nextCommand, shared } from "herdr";
import { framed, rad, locationKey, focusChat, diffRow, button, iconButton, buttonGroup, textInput, lazyRows, foldPanel, trackWidth, foldedStrip, menuBox, sz, loadTextSizes, isFull, setFull } from "./common.js";
import { TOTAL } from "./tree.js";
import { iconFor } from "./icons.js";
import { blameBlocks, ago, hitSegments } from "./text.js";
import { treeMethods } from "./tree.js";
import { editorMethods } from "./editor.js";
import { actionsMethods } from "./actions.js";

export default class Files extends View {
  init(_props, cx) {
    loadTextSizes();
    this.handle = cx.focus_handle();
    // Ctrl+F through the app's keymap, under this panel's key context: it reaches us even with the
    // editor holding the keyboard (a plain key handler only hears what the editor lets through).
    cx.bind_keys([{ keystroke: "ctrl-f", action: "my-files-find", context: "MyFiles" }, { keystroke: "cmd-f", action: "my-files-find", context: "MyFiles" }]);
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    // Per place, its newest load. shortcut: like this.saved, kept until the app closes; fine for a handful of tabs.
    this.latest = new Map();
    this.search = InputState.new({ placeholder: "Search all files  ( / )" });
    this.search.on("submit", (_e, cx) => this.runSearch(cx));
    this.search.on("focus", (_e, cx) => { this.typing = "search"; cx.notify(); });
    this.search.on("blur", (_e, cx) => { this.typing = null; cx.notify(); });
    this.replaceWith = InputState.new({ placeholder: "Replace with" });
    this.replaceWith.on("submit", (_e, cx) => this.results?.rows.length && this.replaceHits(this.results.rows, cx));
    this.replaceWith.on("focus", (_e, cx) => { this.typing = "replace"; cx.notify(); });
    this.replaceWith.on("blur", (_e, cx) => { this.typing = null; cx.notify(); });
    this.find = InputState.new({ placeholder: "Find in file" });
    this.find.on("submit", (e, cx) => this.findNext(cx, Boolean(e.shift))); // Enter: next, Shift+Enter: previous
    this.find.on("focus", (_e, cx) => { this.typing = "find"; cx.notify(); });
    this.find.on("blur", (_e, cx) => { this.typing = null; cx.notify(); });
    this.find.on("change", (_e, cx) => { if (this.mode === "table") cx.notify(); else this.countFinds(cx); }); // the table filters as you type; a file counts its matches
    this.replaceIn = InputState.new({ placeholder: "Replace with" });
    this.replaceIn.on("submit", (_e, cx) => this.replaceOne(cx));
    this.nameInput = InputState.new({ placeholder: "Name" });
    this.nameInput.on("submit", (_e, cx) => this.fileOp(this.nameAction, cx));
    // A CSV table's separator: typing another one splits the table again.
    this.sepIn = InputState.new({ placeholder: "auto" });
    this.sepIn.on("change", (_e, cx) => { if (this.mode === "table" && this.sepIn.value() !== this.table?.sep) { this.makeTable(); cx.notify(); } });
    for (const [state, name] of [[this.replaceIn, "replace-in"], [this.nameInput, "name"], [this.sepIn, "sep"]]) {
      state.on("focus", (_e, cx) => { this.typing = name; cx.notify(); });
      state.on("blur", (_e, cx) => { this.typing = null; cx.notify(); });
    }
    this.openRequest = shared("my-files.open")?.n; // an old request from Changes stays done
    this.openWidth = 360; // unfolding goes back to this until the panel has been seen open (layout's px)
    // No timer (each refresh starts PowerShell and git): the folder watch and Sync do it.
    this.refresh(cx);
    cx.spawn(async cx => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
  }

  // Commands from keys.json ("my-files.save") or `herdr-app do my-files.save`;
  // "name:value" passes a value (open:src/a.go:12, search:text, type:text).
  command(c, cx) {
    const i = c.indexOf(":"), name = i < 0 ? c : c.slice(0, i), arg = i < 0 ? "" : c.slice(i + 1);
    const run = {
      focus: () => this.handle.focus(),
      fold: () => foldPanel(this, "files", !this.folded), // fold into a strip, or open again
      sync: () => this.refresh(cx),
      toggle: () => arg && this.toggle(arg, cx), // open or close a folder
      open: () => { const m = /^(.*?)(?::(\d+))?$/.exec(arg); this.open(m[1], m[2] ? { line: +m[2] } : null, cx); },
      close: () => this.close(),
      save: () => this.save(cx),
      type: () => this.code && !this.readonly && this.code.replace(arg),
      // Set from here the box sends no change event: an empty find: ends the search itself.
      find: () => { this.find.set_value(arg); if (arg) this.findNext(cx); else this.countFinds(cx); },
      search: () => { this.search.set_value(arg); this.runSearch(cx); },
      "replace-all": () => { this.replaceWith.set_value(arg); if (this.results?.rows.length) this.replaceHits(this.results.rows, cx); },
      blame: () => this.file && this.showBlame(cx),
      history: () => this.file && this.showHistory(cx),
      send: () => (arg || this.file) && this.send(arg || this.file, cx),
      "find-box": () => this.openFind(cx), // what Ctrl+F does
      "send-code": () => this.code && this.sendCode(cx), // the selected code, with its file and lines
      table: () => this.isTable() && this.showTable(cx), // a CSV as a table, or back to its text
      separator: () => { this.sepIn.set_value(arg); if (this.mode === "table") this.makeTable(); },
      "replace-in-file": () => { const [q, to] = arg.split("|"); this.find.set_value(q); this.replaceIn.set_value(to ?? ""); this.replaceEvery(cx); },
      menu: () => this.openMenu(arg, cx),
      "new-file": () => this.nameThen("new-file", arg, cx),
      "new-folder": () => this.nameThen("new-folder", arg, cx),
      rename: () => this.nameThen("rename", arg, cx),
      delete: () => { this.menu && (this.menu.confirm = true); this.fileOp("delete", cx); },
    }[name];
    run?.();
  }

  // Back from a file: the table or blame view first, then the file (unsaved: asks first).
  back(cx) {
    if (this.mode !== "edit") { this.mode = "edit"; cx.notify(); return; }
    if (this.dirty() && !this.confirmClose) { this.confirmClose = true; cx.notify(); return; }
    this.close(); cx.notify();
  }

  isFull() { return isFull("files"); }
  setFull(on) { setFull(this, "files", on); }

  // --- keys ----------------------------------------------------------------------

  key(e, cx) {
    const k = e.key, ctrl = e.modifiers.control || e.modifiers.platform;
    if (ctrl && k === "s") { this.save(cx); cx.stop_propagation(); return; }
    if (ctrl && k === "f") { this.openFind(cx); cx.stop_propagation(); return; }
    if (ctrl && k === "h" && this.code && !this.readonly) { this.showReplace = true; this.replaceIn.focus(); cx.stop_propagation(); cx.notify(); return; }
    if (k === "escape") {
      cx.stop_propagation();
      if (this.typing === "find" && this.findAt?.n) this.leaveFind(undefined, cx); // to the file, on the match
      else if (this.typing) { this.typing = null; this.handle.focus(); }
      else if (this.codeMenu) this.codeMenu = null; // the right-click Send to chat menu
      else if (this.menu) { this.menu = null; this.nameAction = null; }
      else if (this.mode !== "edit") this.mode = "edit";
      else if (this.file) this.back(cx); // the file is the whole window: Esc closes it (asks first if unsaved)
      else if (this.isFull()) this.setFull(false);
      else focusChat();
      cx.notify();
      return;
    }
    if (this.typing || (this.code && !this.readonly && this.mode === "edit") || ctrl || e.modifiers.alt) return; // typing text
    if (k === "/" ) { this.search.focus(); cx.stop_propagation(); }
    else if (k === "s" && this.file) { this.send(this.file, cx); cx.stop_propagation(); }
    else if (k === "b" && this.file) { this.showBlame(cx); cx.stop_propagation(); }
    else if (k === "l" && this.file) { this.showHistory(cx); cx.stop_propagation(); }
  }

  // --- drawing -------------------------------------------------------------------

  // Every shown row is built (no lazy list): a lazy list's rows can't be dragged to a terminal.
  treeRows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    const r = rad(6); // once per folder, not per row: rad reads the whole layout
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.mark(path);
      out.push(h_flex().id(`file-${path}`).h(26).flex_none().pl(8 + depth * 16).pr(8).gap(7).items_center().rounded(r).cursor_pointer().hover(s => s.bg(t.hover))
        .when(path === this.file, s => s.bg(t.selected))
        .drag_paths([`${this.root}/${path}`], { on: this.on })
        .on_click((e, cx) => {
          if (entry.dir) this.toggle(path, cx);
          // A file: double-click opens it (it takes the window); with one open, a click switches to another.
          else if ((e.click_count < 2 && !this.file) || path === this.file) return;
          else if (this.dirty()) { this.note = "Save or close the open file first"; cx.notify(); } // open() would drop the edits
          else this.open(path, null, cx);
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.openMenu(path, cx); })
        .child(entry.dir ? svg(`mods/my-files/icon-caret-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(image(iconFor(entry.name, entry.dir, open)).size(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(sz("xs")).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark))));
      if (this.menu?.path === path) out.push(this.menuRow(t));
      if (entry.dir && open) this.treeRows(path, depth + 1, out, t);
    }
    return out;
  }

  // A CSV as a table: its first row the header, the rest filtered by Find (any cell, any
  // case), only the rows on screen built; wide tables scroll sideways.
  tableView(t, font) {
    const tb = this.table, q = this.find.value().trim().toLowerCase();
    if (tb.q !== q) {
      tb.q = q; tb.shown = [];
      for (let i = 1; i < tb.rows.length; i++) if (!q || tb.rows[i].some((c) => c.toLowerCase().includes(q))) tb.shown.push(i);
    }
    const line = (cells, n, head) => h_flex().h(sz("row")).flex_none().items_center().when(head, (e) => e.bg(t.raised).font_semibold())
      .child(div().w(44).flex_none().px(6).text_right().text_color(t.dim).child(head ? "" : String(n)))
      .children(tb.widths.map((w, j) => div().w(w).flex_none().px(6).truncate().child((cells[j] ?? "").replace(/\r?\n/g, " ↵ "))));
    // min_w(0) down to the scroll box: a wide table scrolls inside the panel, not widens it.
    return v_flex().flex_1().min_h(0).w_full().min_w(0)
      .child(h_flex().flex_none().px(10).py(4).gap(6).items_center().text_size(sz("sm")).text_color(t.dim).border_b(1).border_color(t.border)
        .child("Separator").child(div().w(64).child(textInput("files-sep", this.sepIn, this.typing === "sep", t)))
        .child(div().flex_1()).child(`${tb.shown.length}${q ? ` of ${Math.max(0, tb.rows.length - 1)}` : ""} rows`))
      .child(div().flex_1().min_h(0).w_full().min_w(0).relative()
        .child(div().id("files-table-x").size_full().overflow_x_scrollbar()
          .child(v_flex().w(44 + tb.widths.reduce((a, b) => a + b, 0)).h_full().font_family(font).text_size(sz("sm"))
            .child(line(tb.rows[0] ?? [], 0, true))
            .child(lazyRows("files-table", tb.shown.length, (i) => line(tb.rows[tb.shown[i]], tb.shown[i], false), { font }))))
        // A filter that keeps nothing says so and how to get the rows back, not a blank table.
        .when(Boolean(q) && !tb.shown.length, (e) => e.child(div().absolute().top(28).left(0).right(0).p(12).text_size(sz("sm")).text_color(t.dim)
          .child(`No row contains “${this.find.value().trim()}”. Clear Find in file to see all ${Math.max(0, tb.rows.length - 1)} rows.`))));
  }

  // The open file while Find is in use, drawn here so every match can be coloured (the editor
  // colours only its one selection): the matches tinted, the current one solid. A click on a
  // line goes back to the editor there; Esc goes back on the current match.
  findView(t) {
    const f = this.findAt, font = settings().font_family ?? "JetBrains Mono";
    // It starts a few lines above the current match, so that one is on screen without scrolling
    // (a list here can't be told to scroll): a new start is a new list id, which starts at its top.
    // Lines above it: Esc, back in the file.
    const top = Math.max(0, f.line - 8);
    return lazyRows(`files-find-${top}`, f.lines.length - top, (r) => { const i = top + r; return h_flex().w_full().h(sz("row")).flex_none().gap(10).cursor_pointer().hover((s) => s.bg(t.hover))
      .child(div().w(36).flex_none().text_right().text_color(i === f.line ? t.foreground : t.dim).child(String(i + 1)))
      .child(h_flex().flex_1().min_w(0).overflow_hidden().children(hitSegments(f.lines[i], f.q).map((g) => {
        const current = g.hit && i === f.line && g.at === f.col;
        // As VS Code: every match a light yellow, the current one solid yellow with dark text.
        return div().flex_none().text_color(current ? t.background : t.foreground).when(g.hit, (e) => e.rounded(rad(3)).bg(current ? t.ansi3 : t.ansi3 + "40")).child(g.text || " ");
      }))); }, { font, click: (r, cx) => this.leaveFind(top + r, cx) });
  }

  fileBody(t) {
    if (!this.code) return div().p(12).text_color(t.dim).child(this.fileError || "Loading file…");
    // A search with matches, and the editor without the keyboard: the find view instead.
    if (this.mode === "edit" && this.findAt?.n && !this.editing) return this.findView(t);
    if (this.mode === "edit") {
      // Right-click: a small menu at the pointer to send the selected code to the chat.
      const m = this.codeMenu;
      return div().id("files-code").relative().flex_1().min_h(0).flex().flex_col()
        // Kept inside the panel near its right or bottom edge (the menu is about 150 x 40).
        .on_mouse_down("right", (e, cx) => {
          const p = e.local_position, b = e.bounds;
          if (p && b) { this.codeMenu = { x: Math.max(0, Math.min(p.x, b.width - 150)), y: Math.max(0, Math.min(p.y, b.height - 40)) }; cx.notify(); }
        })
        .child(Editor.new(this.code).flex_1().min_h(0))
        .when(Boolean(m), (el) => el.child(menuBox("code-menu", t, [iconButton("code-send", "mods/my-files/icon-chat.svg", "Send to chat", t, (_e, cx) => this.sendCode(cx))],
          (cx) => { this.codeMenu = null; cx.notify(); }).absolute().left(m.x).top(m.y)));
    }
    const font = settings().font_family ?? "JetBrains Mono";
    if (this.mode === "table" && this.table) return this.tableView(t, font);
    if (!this.rows) return div().p(12).text_color(t.dim).child("Loading…");
    if (this.mode === "blame") {
      // A head row before each run of lines from one commit (who, when, its message), so nothing
      // is cut short and the code keeps the full width; a click on either opens that commit.
      // Grouped once per read (kept on the rows array), not on every redraw: a big file has 20k lines.
      const rows = (this.rows.blocks ??= blameBlocks(this.rows)), none = (r) => /^0+$/.test(r.hash);
      return lazyRows("files-blame", rows.length, (i) => {
        const r = rows[i];
        if (r.head) return div().w_full().h(sz("row")).flex_none().px(6).bg(t.raised).text_color(t.muted).truncate().cursor_pointer()
          .child(none(r) ? "not committed" : `${r.author} · ${ago(r.time)} · ${r.summary ?? ""}`);
        return h_flex().w_full().h(sz("row")).flex_none().gap(8).px(6).cursor_pointer().hover(s => s.bg(t.hover))
          .child(div().w(36).flex_none().text_right().text_color(t.dim).child(String(r.line)))
          .child(div().flex_1().min_w(0).truncate().child(r.text));
      }, { font, click: (i, cx) => { if (!none(rows[i])) this.showCommit(rows[i].hash, cx); } });
    }
    if (this.mode === "history") {
      if (!this.rows.length) return div().p(12).text_color(t.dim).child("No commits for this file yet");
      return v_flex().id("files-history").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows.map((r) =>
        v_flex().id(`hist-${r.hash}`).flex_none().px(8).py(5).rounded(rad(6)).cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => this.showCommit(r.hash, cx))
          .child(div().truncate().child(r.subject))
          .child(div().text_size(sz("xs")).text_color(t.dim).truncate().child(`${r.hash} · ${r.date} · ${r.author}`))));
    }
    // a commit's change to this file
    const rows = this.rows;
    return lazyRows("files-commit", rows.length, (i) => diffRow(rows[i], t), { font });
  }

  render(cx) {
    if (locationKey() !== this.context?.key) this.refresh(cx);
    // Changes asked to open a file (its Open button, a double-click there).
    const asked = shared("my-files.open");
    if (asked?.n && asked.n !== this.openRequest && this.root) {
      this.openRequest = asked.n;
      if (this.folded) foldPanel(this, "files", false); // folded: open to show it (first: the open's full window then wins)
      if (this.dirty()) this.note = "Save or close the open file first";
      else this.open(this.rel(asked.path), null, cx);
      this.handle.focus(); // the keys (Esc) now go to Files, not the hidden Changes
    }
    const t = theme(), file = this.file, dirty = this.dirty(), full = this.isFull();
    if (this.folded) return foldedStrip("files", "»", "Show Files", t, () => foldPanel(this, "files", false))
      .id("my-files").on_size_change(({ width }, cx) => trackWidth(this, width, cx));
    const tool = (id, icon, name, onClick, opts) => iconButton(`files-${id}`, `mods/my-files/icon-${icon}.svg`, name, t, onClick, { iconOnly: !this.wide, ...opts });
    const header = h_flex().h(42).flex_none().px(12).gap(6).items_center().border_b(1).border_color(t.border)
      .when(Boolean(file), el => el.child(tool("back", "back", "Back (Esc)", (_e, cx) => this.back(cx), { iconOnly: true })))
      .child(div().font_semibold().child("Files"))
      .child(div().flex_1().min_w(0).truncate().text_right().text_size(sz("sm")).text_color(dirty ? t.blocked : t.dim)
        .child(file ? `${file}${dirty ? " ●" : ""}` : this.root?.split(/[\\/]/).pop() ?? ""))
      .when(!file && Boolean(this.root), el => el.child(tool("sync", "sync", "Sync", (_e, cx) => this.refresh(cx), { enabled: !this.loading, iconOnly: true }))
        .child(button("files-new", "+", t, (_e, cx) => this.openMenu("", cx), { active: this.menu?.path === "", name: "New file or folder" })))
      // No file over the whole window (left so by a restart): a way back to the panels.
      .when(!file && full, el => el.child(button("files-full", "⤡", t, () => this.setFull(false), { active: true, name: "Back to the panels (Esc)" })))
      .when(!full, el => el.child(button("files-fold", "«", t, () => foldPanel(this, "files", true), { name: "Hide Files" })));
    // The find box gets a row of its own; too narrow for the names, the buttons show icons only.
    const fileBar = file && v_flex().flex_none().px(10).py(6).gap(6).when(!this.showReplace, el => el.border_b(1).border_color(t.border))
      .child(h_flex().id("files-bar").gap(6).items_center().flex_wrap()
        .on_size_change(({ width }, cx) => { const wide = width >= 400; if (wide !== this.wide) { this.wide = wide; cx.notify(); } })
        .when(this.isRepo, el => el.child(buttonGroup(t, [
          tool("blame", "blame", "Blame", (_e, cx) => this.showBlame(cx), { active: this.mode === "blame" }),
          tool("history", "history", "History", (_e, cx) => this.showHistory(cx), { active: this.mode === "history" || this.mode === "commit" })])))
        .when(this.isTable() && Boolean(this.code), el => el.child(tool("table", "table", "Table", (_e, cx) => this.showTable(cx), { active: this.mode === "table" })))
        .child(tool("send", "chat", "Chat", (_e, cx) => this.send(file, cx)))
        .when(!this.readonly && Boolean(this.code), el => el.child(tool("replace-toggle", "replace", "Replace", (_e, cx) => { this.showReplace = !this.showReplace; cx.notify(); }, { active: this.showReplace }))
          .child(div().flex_1())
          .child(tool("save", "save", "Save", (_e, cx) => this.save(cx), { primary: true, enabled: dirty }))))
      // "2/5" (or "5" before Enter picks one) and ↑ ↓ through them; a table only filters, no counter.
      .child(h_flex().gap(6).items_center().child(textInput("files-find", this.find, this.typing === "find", t))
        .when(Boolean(this.findAt) && this.mode !== "table", (el) => el
          .child(div().flex_none().text_size(sz("xs")).text_color(this.findAt.n ? t.dim : t.ansi1).child(this.findAt.n ? (this.findAt.i < 0 ? `${this.findAt.n}` : `${this.findAt.i + 1}/${this.findAt.n}`) : "0"))
          .child(button("files-find-prev", "↑", t, (_e, cx) => this.findNext(cx, true), { name: "Previous match (Shift+Enter)", enabled: this.findAt.n > 0 }))
          .child(button("files-find-next", "↓", t, (_e, cx) => this.findNext(cx), { name: "Next match (Enter)", enabled: this.findAt.n > 0 }))));
    const replaceInBar = file && this.showReplace && !this.readonly && Boolean(this.code) && h_flex().flex_none().px(10).pb(6).gap(6).items_center().border_b(1).border_color(t.border)
      .child(textInput("files-replace-in", this.replaceIn, this.typing === "replace-in", t))
      .child(button("files-replace-one", "Next", t, (_e, cx) => this.replaceOne(cx)))
      .child(button("files-replace-every", "All", t, (_e, cx) => this.replaceEvery(cx)))
      .child(button("files-replace-close", "×", t, (_e, cx) => { this.showReplace = false; cx.notify(); }, { name: "Close replace" }));
    const confirm = this.confirmClose && dirty && h_flex().flex_none().px(10).py(6).gap(6).items_center().bg(t.raised)
      .child(div().flex_1().text_size(sz("sm")).child("Unsaved changes."))
      .child(button("files-save-close", "Save", t, (_e, cx) => { this.save(cx); this.confirmClose = false; }, { primary: true }))
      .child(button("files-drop", "Don't save", t, (_e, cx) => { this.close(); cx.notify(); }, { danger: true }))
      .child(button("files-keep", "Cancel", t, (_e, cx) => { this.confirmClose = false; cx.notify(); }));
    const results = this.results && v_flex().id("files-results").flex_1().min_h(0).overflow_y_scrollbar().p(6)
      .child(h_flex().px(6).pb(4).gap(6).text_size(sz("xs")).text_color(t.dim)
        .child(div().flex_1().child(this.results.loading ? "Searching…" : this.results.error ?? `${this.results.rows.length}${this.results.more ? "+" : ""} matches for “${this.results.q}”`))
        .child(button("files-results-close", "×", t, (_e, cx) => { this.results = null; this.search.set_value(""); cx.notify(); }, { name: "Close search" })))
      .children(this.results.rows.map((r, i) => v_flex().id(`hit-${i}`).flex_none().px(8).py(3).rounded(rad(6)).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((e, cx) => e.click_count > 1 && this.open(r.path, { line: r.line, word: this.results.q }, cx))
        .child(h_flex().gap(6).items_center().child(div().flex_1().min_w(0).text_size(sz("xs")).text_color(t.muted).truncate().child(`${r.path}:${r.line}`))
          .child(button(`hit-replace-${i}`, "Replace", t, (_e, cx) => this.replaceHits([r], cx), { enabled: !this.replacing })))
        .child(div().text_size(sz("sm")).truncate().font_family(settings().font_family ?? "JetBrains Mono").child(r.text))));
    const hitFiles = this.results ? new Set(this.results.rows.map((r) => r.path)).size : 0;
    const replaceBar = this.results && !this.results.loading && this.results.rows.length > 0 && h_flex().flex_none().px(10).pb(6).gap(6).items_center().border_b(1).border_color(t.border)
      .child(textInput("files-replace", this.replaceWith, this.typing === "replace", t))
      .child(button("files-replace-all", this.replacing ? "Replacing…" : `Replace all (${hitFiles} file${hitFiles === 1 ? "" : "s"})`, t,
        (_e, cx) => this.replaceHits(this.results.rows, cx), { primary: true, enabled: !this.replacing }));
    const tree = v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6)
      // A click anywhere in the tree (a row too) closes an open menu; the menu row stops its own clicks.
      .on_mouse_down("left", (_e, cx) => { if (this.menu) { this.menu = null; this.nameAction = null; cx.notify(); } })
      .when(this.menu?.path === "", el => el.child(this.menuRow(t))).children(this.treeRows("", 0, [], t))
      .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(sz("sm")).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
      .when(this.limited, el => el.child(div().p(8).text_size(sz("xs")).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")));
    return framed(v_flex().id("my-files").size_full().min_h(0).overflow_hidden().bg(t.background), t).text_color(t.foreground).text_size(sz("md"))
      .track_focus(this.handle).key_context("MyFiles").on_action("my-files-find", (_e, cx) => this.openFind(cx)).on_key_down((e, cx) => this.key(e, cx)).on_size_change(({ width }, cx) => trackWidth(this, width, cx))
      .child(header)
      .when(!file, el => el.child(h_flex().flex_none().px(10).py(6).when(!replaceBar, e => e.border_b(1).border_color(t.border)).child(textInput("files-search", this.search, this.typing === "search", t))))
      .when(!file && Boolean(replaceBar), el => el.child(replaceBar))
      .when(Boolean(fileBar), el => el.child(fileBar))
      .when(Boolean(replaceInBar), el => el.child(replaceInBar))
      .when(Boolean(confirm), el => el.child(confirm))
      .when(Boolean(this.note), el => el.child(div().px(12).py(4).text_size(sz("xs")).text_color(/^(Saved|Replaced|Created|Renamed|Deleted)/.test(this.note) ? t.ansi2 : this.note.endsWith("…") ? t.dim : t.ansi1).child(this.note)))
      // An open file has the tree beside it, so another file is a click away.
      .child(file ? h_flex().flex_1().min_h(0).w_full()
        .child(v_flex().w(280).flex_none().h_full().min_h(0).border_r(1).border_color(t.border).child(tree))
        .child(v_flex().flex_1().min_w(0).h_full().min_h(0).child(this.fileBody(t))) : results || tree)
      .child(div().flex_none().px(12).py(4).border_t(1).border_color(t.border).text_size(sz("xs")).text_color(t.dim).truncate()
        .child(file ? `ctrl+s save · ctrl+f find · ctrl+h replace · right-click: send code · esc back` : "double-click: open · right-click: @chat, new, rename, delete · drag: path to a terminal · / search"));
  }
}

Object.assign(Files.prototype, treeMethods, editorMethods, actionsMethods);
