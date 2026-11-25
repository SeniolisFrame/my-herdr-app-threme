// Shared by my-files and my-changes. A mod can't import from outside its own folder, so
// install.ps1 copies this file into both (as ./common.js); edit it here, not there.
import { div, svg } from "gpui-kit";
import { pickSize } from "./size.js";
import { h_flex, v_flex, v_virtual_list, Input, Scrollbar } from "gpui-base";
import { spaces, panes, focused, agents, exec, run, watchFolder, layout, shared, setShared, appHome, readTextFile } from "herdr";

// Text sizes and the list row height, in px. A my-herdr-text.json in herdr-app's folder
// ({"xs":16,"sm":16,...}) overrides any of them; read when a panel starts, so restart
// herdr-app after editing it. No file: these defaults.
const SIZES = { xs: 11, sm: 12, md: 13, logS: 11, logM: 12, row: 20 };
export const sz = (k) => pickSize(shared("my-herdr.text"), k, SIZES);
export async function loadTextSizes() {
  let want = null;
  try { want = JSON.parse(await readTextFile(`${appHome()}/my-herdr-text.json`)); } catch { /* none or invalid: defaults */ }
  if (JSON.stringify(want) !== JSON.stringify(shared("my-herdr.text") ?? null)) setShared("my-herdr.text", want);
}

// Where the panels look: the focused pane's live folder (as the shipped panels do).
export function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
// Each workspace and each of its tabs keeps its own state (open file, open folders) even
// when two are in the same folder (agents started in the home folder, say).
export const locationKey = () => JSON.stringify({ ...location(), space: spaces().find(s => s.active)?.id ?? null, tab: focused()?.tab ?? null });

// git that throws with git's own message; READ writes nothing under .git, so the
// folder watch doesn't wake itself up.
export const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
export async function git(root, on, args, timeout) {
  const r = await exec("git", args, { cwd: root, on, timeout });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || `git ${args[0]} failed`);
  return r.stdout;
}

// Command output (or file text) as lines: no \r, no empty last line.
export const toLines = (text) => text.replace(/\r/g, "").replace(/\n$/, "").split("\n");

// Runs onChange each time something under dir changes, for as long as alive() holds;
// onFail when the watch can't be kept (a later refresh starts one again).
export function watchWhile(dir, alive, onChange, onFail, cx) {
  cx.spawn(async (cx) => {
    try { while (alive()) { await watchFolder(dir); if (alive()) onChange(cx); } }
    catch { if (alive()) onFail(); }
  });
}

// The chat: the agent in the shown tab, else the focused terminal.
export function chatTerminal() {
  const f = focused();
  return agents().find(a => a.tab === f?.tab)?.address ?? f?.terminal ?? null;
}

// Types text into the chat without Enter: through the clipboard (hc send presses
// Enter), which is put back afterwards.
export async function sendToChat(text, cx) {
  const term = chatTerminal();
  if (!term) throw new Error("no chat terminal in this tab");
  const old = cx.read_from_clipboard();
  cx.write_to_clipboard(text);
  run("pane.focus", { terminal: term });
  run("terminal.paste");
  await cx.sleep(300);
  if (old !== undefined) cx.write_to_clipboard(old);
}

// Back to the chat pane (Esc).
export function focusChat() {
  const term = chatTerminal();
  if (term) run("pane.focus", { terminal: term });
}

// Text draws a tab as nothing: pad each to the next 4-column stop.
export const untab = (text) => text.replace(/[^\t]*\t/g, (s) => s.slice(0, -1).padEnd((s.length - 1) - (s.length - 1) % 4 + 4));

// Numbers each diff line; `hunk` is the hunk's index within its file and `pos` a
// line's place in that hunk's body (what patch.js someLines counts).
// In a file's header (between "diff --git" and its first @@) the index / --- / +++ lines are
// left out: the file row already names the file. Mode, rename and binary lines stay.
export function diffRows(lines) {
  let old = 0, next = 0, hunk = -1, pos = -1, inHunk = false, inHeader = false;
  return lines.flatMap((line) => {
    if (line.startsWith("diff --git ")) { hunk = -1; inHunk = false; inHeader = true; return { kind: "file", text: line.replace(/^diff --git a\/(.*) b\/.*$/, "$1") }; }
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; hunk++; pos = -1; inHunk = true; inHeader = false; return { kind: "@", hunk, text: line }; }
    const kind = line[0];
    if (inHeader && /^(index |--- |\+\+\+ )/.test(line)) return [];
    if (!inHunk) return { kind: "", text: line };
    if (kind === "-") return { kind, hunk, pos: ++pos, number: old++, text: untab(line.slice(1)) || " " };
    if (kind === "+") return { kind, hunk, pos: ++pos, number: next++, text: untab(line.slice(1)) || " " };
    if (kind === " ") { old++; return { kind, hunk, pos: ++pos, number: next++, text: untab(line.slice(1)) || " " }; }
    return { kind: "", text: line };
  });
}

// One diff row, 20px high, with no clicks of its own (it is drawn inside a lazy list).
// opts.picked(row) makes "+"/"-" lines look clickable and marks the picked ones.
export function diffRow(row, t, opts = {}) {
  const { kind, number, text } = row;
  if (kind === "file") return div().w_full().px(12).h(sz("row")).flex_none().truncate().bg(t.selected).font_semibold().child(text);
  if (kind === "@") return div().w_full().h(sz("row")).flex_none().px(12).bg(t.raised).text_color(t.dim).truncate().child(text);
  const pickable = Boolean(opts.picked) && (kind === "+" || kind === "-"), picked = pickable && opts.picked(row);
  return h_flex().w_full().h(sz("row")).flex_none().gap(10)
    .when(kind === "+", (e) => e.bg(t.ansi2 + (picked ? "66" : "22"))).when(kind === "-", (e) => e.bg(t.ansi1 + (picked ? "66" : "22")))
    .when(pickable, (e) => e.cursor_pointer())
    .child(div().w(36).flex_none().text_right().text_color(picked ? t.foreground : t.dim).child(picked ? "✓" : number === undefined ? "" : String(number)))
    // + / − as well as green / red: added and removed lines don't depend on telling the colours apart.
    .child(div().w(8).flex_none().text_color(kind === "+" ? t.ansi2 : t.ansi1).child(kind === "+" ? "+" : kind === "-" ? "−" : ""))
    .child(div().flex_1().min_w(0).truncate().text_color(kind === "" ? t.dim : t.foreground).child(text));
}

// A scrolling list of rows (sz("row") px), in a code font, that builds only the rows on screen. row(i)
// must not take its own clicks (nor be dragged): o.click(i, cx) and o.rightClick(i, event,
// cx) get the row instead. The box is `relative`, so a caller can add an absolute menu to it.
export function lazyRows(id, count, row, o = {}) {
  const build = (range) => { const out = []; for (let i = range.start; i < range.end; i++) out.push(row(i)); return out; };
  // Keys are indexes: o.click gets the row by its index.
  return v_flex().id(`${id}-box`).relative().flex_1().min_h(0).font_family(o.font).text_size(sz("sm"))
    .child(v_virtual_list(id, count, sz("row"), String, build).size_full()
      .when(Boolean(o.click), (e) => e.on_item_click((key, cx) => o.click(Number(key), cx)))
      .when(Boolean(o.rightClick), (e) => e.on_item_secondary_click((key, ev, cx) => o.rightClick(Number(key), ev, cx))))
    .child(Scrollbar.vertical(id).viewport_from_layout().absolute().inset_0());
}

// Folding a side panel into a thin strip and back: its layout node is resized; the panel keeps
// all its state (open file, edits, lists) and carries on refreshing, it only draws the strip.
export const FOLDED = 36;
export function foldPanel(view, node, fold) { run("layout.resize", { id: node, px: fold ? FOLDED : view.openWidth }); }

// Full window for one side panel: the layout's other blocks are hidden and the panel takes the room.
// Hidden is the layout's own state, so it holds across a restart; the layout names these blocks.
const PANELS = ["top", "main", "files", "changes"];
const findNode = (node, id) => node?.id === id ? node : (node?.children ?? []).reduce((hit, c) => hit ?? findNode(c, id), null);
export const isFull = (node) => { const l = layout(); return Boolean(findNode(l, "main")?.hidden && !findNode(l, node)?.hidden); };
// The width to go back to is kept in shared state: the other panel may be the one that ends it
// (Changes' Open shows the file in Files over the whole window, in place of Changes).
export function setFull(view, node, on) {
  if (on === isFull(node) || !findNode(layout(), "main")) return;
  const other = PANELS.find((id) => id !== node && (id === "files" || id === "changes") && isFull(id));
  if (other) run("layout.resize", { id: other, px: shared(`my-herdr.width.${other}`) ?? (other === "changes" ? 460 : 360) }); // none saved (a restart): the layout's widths
  if (on) { setShared(`my-herdr.width.${node}`, view.openWidth); run("layout.show", { id: node }); }
  for (const id of PANELS) if (id !== node) run(on ? "layout.hide" : "layout.show", { id });
  run("layout.resize", on ? { id: node, weight: 1 } : { id: node, px: shared(`my-herdr.width.${node}`) ?? view.openWidth });
}

// From the panel root's on_size_change: folded under 80px (a fold, or dragged that thin); the
// last open width is what unfolding goes back to.
export function trackWidth(view, width, cx) {
  const folded = width < 80;
  if (!folded) view.openWidth = width;
  if (folded !== Boolean(view.folded)) { view.folded = folded; cx.notify(); }
}

// A panel wears the layout's pane frame (its radius, a 1 or 2px border), so a theme that squares
// the terminal panes squares the panels too. No pane frame: rounded 10, 1px, as before.
function paneFrame(node) {
  if (node?.content?.pane) return node.content.pane;
  for (const child of node?.children ?? []) {
    const f = paneFrame(child);
    if (f) return f;
  }
  return null;
}
// A corner radius, or 0 under square (pixel) pane frames, so buttons and boxes match the frame.
export function rad(n) { return paneFrame(layout())?.radius === 0 ? 0 : n; }
export function framed(el, t) {
  const f = paneFrame(layout());
  el = el.rounded(f?.radius ?? 10).border_color(t.border);
  return (f?.border?.width ?? 1) >= 2 ? el.border_2() : el.border_1();
}

// The folded panel: one button (» or «) that opens it again.
export function foldedStrip(id, label, name, t, onOpen) {
  return framed(v_flex().size_full().items_center().pt(8).bg(t.background), t)
    .child(button(`${id}-unfold`, label, t, onOpen, { name }));
}

// A pop-up menu: one item per line, each as wide as the menu. Where it sits is the caller's
// (under a row, or .absolute() at the pointer). onClose(cx): a press anywhere outside it.
export function menuBox(id, t, items, onClose) {
  return v_flex().id(id).flex_none().p(4).gap(2).items_start().rounded(rad(6)).bg(t.raised).border_1().border_color(t.border)
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .when(Boolean(onClose), (e) => e.on_mouse_down_out((_e, cx) => onClose(cx)))
    .children(items.map((b) => b.w_full()));
}

// Naming something new (a file, a branch, a tag): a label that says what and where (it stays
// while typing, a placeholder would not), the box, Create and Cancel. Enter is the input's
// own submit, set where the InputState is made.
export function nameForm(id, t, label, input, focused, createLabel, onCreate, onCancel) {
  return v_flex().gap(4)
    .child(div().text_size(sz("xs")).text_color(t.dim).child(label))
    .child(h_flex().gap(6).items_center().flex_wrap()
      .child(textInput(`${id}-input`, input, focused, t).min_w(120)) // fills the row; the buttons wrap under it when narrow
      .child(button(`${id}-ok`, createLabel, t, onCreate, { primary: true }))
      .child(button(`${id}-cancel`, "Cancel", t, onCancel)));
}

// A check box (16px): ✓ when checked, ! when warn (a conflict). Its clicks are the caller's.
export function checkbox(checked, t, warn = false, enabled = true) {
  return div().w(16).h(16).flex_none().flex().items_center().justify_center().rounded(rad(4)).border_1().text_size(sz("xs"))
    .border_color(!enabled ? t.dim : warn ? t.ansi1 : t.accent).bg(checked ? t.accent : t.background)
    .text_color(checked ? t.accent_foreground : t.ansi1).child(checked ? "✓" : warn ? "!" : "");
}

// A button that asks first: asking (after its first click) it reads "<label>? click again"
// (opts.ask: a shorter word for that) in red. opts as button; opts.danger overrides the red.
export function confirmButton(id, label, asking, t, onClick, opts = {}) {
  return button(id, asking ? `${opts.ask ?? label}? click again` : label, t, onClick, { danger: true, ...opts });
}

// A small text button. opts.name: what it does, for a button whose label is an icon or a
// glyph (« × +): its tooltip and what a screen reader says (it would say nothing, or "×").
export function button(id, label, t, onClick, opts = {}) {
  const on = opts.enabled !== false;
  return div().id(id).h(24).px(8).flex().flex_none().items_center().rounded(rad(6)).text_size(sz("sm"))
    .bg(opts.primary && on ? t.solid : opts.active ? t.selected : t.raised)
    .text_color(!on ? t.dim : opts.primary ? t.solid_foreground : opts.danger ? t.ansi1 : t.foreground)
    .when(on, e => e.cursor_pointer().hover(s => s.bg(opts.primary ? t.solid : t.hover)).on_click((ev, cx) => { cx.stop_propagation(); onClick(ev, cx); }))
    .when(Boolean(opts.name), e => e.tooltip(opts.name).accessibility_label(opts.name))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .child(label);
}

// A button with an icon (an svg path from the app folder, mods/<mod>/icon-x.svg) and its
// name; opts.iconOnly drops the name, which stays its tooltip and screen-reader name.
export function iconButton(id, icon, name, t, onClick, opts = {}) {
  const color = opts.enabled === false ? t.dim : opts.primary ? t.solid_foreground : t.foreground;
  const label = h_flex().gap(5).items_center().child(svg(icon).size(14).flex_none().text_color(color)).when(!opts.iconOnly, (e) => e.child(name));
  return button(id, label, t, onClick, { ...opts, name });
}

// Buttons joined into one bar: the 1px gaps show the border colour as dividers.
export function buttonGroup(t, buttons) {
  return h_flex().flex_none().gap(1).rounded(rad(7)).overflow_hidden().border_1().border_color(t.border).bg(t.border).children(buttons.map((b) => b.rounded(rad(0))));
}

// A one-line text box; focusedNow draws its accent border.
export function textInput(id, state, focusedNow, t) {
  return div().id(id).flex_1().min_w(0).h(28).px(8).flex().items_center().rounded(rad(7)).border_1()
    .border_color(focusedNow ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .child(Input.new(state).h_full().text_size(sz("sm")).text_color(t.foreground));
}
