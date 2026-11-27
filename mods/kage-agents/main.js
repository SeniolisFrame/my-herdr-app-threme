// Agents in grouped or priority views; parents take their most urgent sub-agent's place.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, hc, theme, shared, setShared, setAgentOrder, openOverlay, closeOverlay, props, window, layout } from "herdr";

import { saying } from "./saying.js";
import { PIXEL, NAME, find, narrow, clean, folder } from "./kage.js";

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const current = leads.get(p.tab);
    // First agent, else first focused terminal, else first terminal in the tab.
    if (!current || (!current.program?.agent && (p.program?.agent || (!current.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

// A space's tabs with a terminal but no agent (a new terminal, an agent that hasn't reported).
function idleTabs(sp) {
  const leads = leadPanes(panes()), busy = new Set(agents().map((a) => a.tab));
  return sp.tabs.map((tab) => ({ tab, p: leads.get(tab.id) })).filter((g) => g.p && !busy.has(g.tab.id));
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  // clean() would strip a path's leading ~ or /: test the title with only its status glyph gone.
  const path = /^[~/]|^[A-Za-z]:\\/.test((l?.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== (l?.terminal ?? l?.address) && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];
// The card's witch, picked in the sort popup: <id>-atk-0..8.png while the agent works, <id>-sleep-0..n.png while it
// idles (the blue witch nods off in 8 quick frames, the black one dozes in 3 slow ones, the fire mage in 6 at 400ms).
// The art is drawn at this size (avatars/witch_attack.py), so it is shown 1:1.
const PETS = [{ id: "witch", label: "Blue witch", sleep: 8, ms: 250 }, { id: "witch-black", label: "Black witch", sleep: 3, ms: 750 },
  { id: "witch-fire", label: "Fire mage", sleep: 6, ms: 400 }];
// One agent's own witch and move, set by right-clicking its card: { [address]: { pet?, move? } } (persisted).
const picks = () => shared("agents.picks") ?? {};
const pick = (address, key, value) => {
  const all = { ...picks() }, own = { ...all[address], [key]: value };
  if (value === undefined) delete own[key];
  if (Object.keys(own).length) all[address] = own; else delete all[address];
  setShared("agents.picks", all);
};
const petAll = () => PETS.find((p) => p.id === shared("agents.pet"))?.id ?? "witch-black";
const petObj = (address) => PETS.find((p) => p.id === (picks()[address]?.pet ?? petAll())) ?? PETS.find((p) => p.id === "witch-black");
const petOf = (address) => petObj(address).id;
const snoreAt = (now, pet) => Math.floor(now / pet.ms) % pet.sleep;
// Each witch's moves while an agent works (<pet>-<id>-0..8.png; the cast is atk). "random" gives each agent one of
// them, drawn again each time its state changes (by its address and when it changed).
const MOVES = [
  { id: "atk", label: "Cast" }, { id: "strike", label: "Staff strike" }, { id: "fireball", label: "Fireball" },
  { id: "circle", label: "Magic circle" }, { id: "lightning", label: "Lightning" }, { id: "hand", label: "Hand spell" },
  { id: "twirl", label: "Staff twirl" },
];
const moveSetting = () => MOVES.find((m) => m.id === shared("agents.move"))?.id ?? "random";
const ownMove = (address) => MOVES.find((m) => m.id === picks()[address]?.move)?.id;
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261); // FNV-1a
const moveOf = (address, since) => {
  const m = ownMove(address) ?? moveSetting();
  return m === "random" ? MOVES[hash(`${address}@${since}`) % MOVES.length].id : m;
};
// DONE cheers (hand up, a jump) and NEEDS YOU pleads (hands clasped), whatever the move.
const STATUS_MOVE = { done: "done", blocked: "plead" };
// Popup heights: the fixed rows plus one 31px row (menuRow) per pet, so a new pet doesn't push the last move off.
const openSortMenu = () => openOverlay({ mod: "kage-agents", kind: "popup", width: 200, height: 408 + 31 * PETS.length, props: { sortMenu: true } });
const openAgentMenu = (address) => openOverlay({ mod: "kage-agents", kind: "popup", width: 200, height: 368 + 31 * PETS.length, props: { agentMenu: address } });
const FACE = 96;
const BEAT = 125, FRAMES = 9; // ms per cast frame, frames
const FIRE = 250, CAMP = 8; // ms per campfire frame; witches round one fire (more show as "+N")
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// kage: space tiles in the theme's hues instead of the stock teal/orange/blue.
// Herdr gives a new space the theme color name ("ansi6") fewest spaces use; once all are hex
// it would always pick ansi6, so each name is swapped for the kage hue fewest spaces have.
const KAGE_SPACE = ["#6b4fb3", "#c4224a", "#3d4fb8", "#8a3fa8", "#5a4a8a", "#a8325e"];
const LABEL = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "IDLE" };
const asleep = (a) => !LABEL[a.status] || a.status === "idle";

// A popup menu's row (icon, label, a check when on; a click picks and closes) and its section heading.
const menuRow = (t) => (id, label, icon, on, pick) => h_flex()
  .id(id)
  .h(31)
  .px(8)
  .gap(9)
  .rounded(7)
  .items_center()
  .text_color(t.foreground)
  .hover((el) => el.bg(t.hover))
  .on_click(() => { pick(); closeOverlay(props().overlay); })
  .child(icon)
  .child(div().flex_1().child(label))
  .when(on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.foreground)));
const menuHead = (t) => (text, pt) => div().px(8).pt(pt).pb(6).text_size(11).text_color(t.dim).child(text);

export default class Agents extends View {
  init(_props, cx) {
    if (props()?.sortMenu || props()?.agentMenu || props()?.campMenu) return;
    this.folded = new Set();
    // Each agent's last state and when it changed (ms), in the shared store (persisted), so the sidebar and the
    // board stamp a change once and agree on it (the random move is drawn from it). Older installs kept it here.
    if (!shared("agents.changed")) {
      let saved; try { saved = JSON.parse(localStorage.getItem("changed") ?? "{}"); } catch { saved = {}; }
      setShared("agents.changed", saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      localStorage.removeItem("changed");
    }
    try { this.pendingPins = JSON.parse(localStorage.getItem("pins") ?? "[]"); } catch { this.pendingPins = []; }
    if (!Array.isArray(this.pendingPins)) this.pendingPins = [];
    if (!this.pendingPins.length) localStorage.removeItem("pins");
    this.migratingPins = new Set();
    this.sleepers = []; // the witches asleep on a card now, each stepping on her own clock
    this.snore = new Map();
    cx.timer.every(30000, (cx) => cx.notify());
    // The board reads each working agent's screen every 3s for its speech bubble.
    this.says = new Map();
    if (props()?.board) cx.timer.every(3000, (cx) => this.listen(cx));
    // The awake witch changes frame 8 times a second; asleep, every 250 or 750ms. No cards, no redraws.
    // Checked twice per step and redrawn only when the step changes, so a late tick can't skip one.
    cx.timer.every(BEAT, (cx) => {
      const now = Date.now();
      if ((this.awake && Math.floor(now / BEAT) % FRAMES !== this.step) || this.sleepers.some((p) => snoreAt(now, p) !== this.snore.get(p.id))
        || (this.fire !== undefined && Math.floor(now / FIRE) !== this.fire)) cx.notify();
    });
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    const changed = { ...this.changed };
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (changed[a.address]?.s === s) continue;
      changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete changed[k];
    setShared("agents.changed", changed);
  }

  get changed() {
    return shared("agents.changed") ?? {};
  }

  // Keep offline pins until their terminal returns, and keep each pending until
  // core echoes the label so a failed write doesn't erase the old pin.
  migratePins(all) {
    const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
    const pending = this.pendingPins.filter((address) => {
      const terminal = listed.get(address);
      if (!terminal) return true;
      if (terminal.labels?.["herdr.pinned"]) return false;
      if (!this.migratingPins.has(address)) {
        this.migratingPins.add(address);
        run("terminal.pin", { terminal: address, pinned: true });
      }
      return true;
    });
    if (pending.length === this.pendingPins.length) return;
    this.pendingPins = pending;
    if (pending.length) localStorage.setItem("pins", JSON.stringify(pending));
    else localStorage.removeItem("pins");
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  // Only the open spaces' working agents; one that stops loses its bubble.
  listen(cx) {
    const open = new Set(spaces().filter((sp) => sp.active).map((sp) => sp.id));
    const working = agents().filter((a) => a.status === "working" && open.has(a.space)).map((a) => a.address);
    // One round at a time: a slow read (another machine over ssh) skips ticks instead of piling up.
    if (this.reading || (!working.length && !this.says.size)) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const heard = await Promise.all(working.map((k) => hc(["read", k]).then((r) => [k, r.code === 0 ? saying(r.stdout) : null], () => [k, null])));
        const says = new Map(heard.filter(([, s]) => s));
        if ([...says].some(([k, s]) => this.says.get(k) !== s) || says.size !== this.says.size) { this.says = says; cx.notify(); }
      } finally { this.reading = false; }
    });
  }

  rank(a) {
    return RANK[a.status] ?? 0;
  }

  sortMenu(t) {
    const row = menuRow(t), head = menuHead(t);
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .child(head("Sort agents", 4))
      .children(SORTS.map((s) => row(`sort-${s.id}`, s.label, svg(`mods/workspace-chrome/${s.icon}.svg`).size(14).flex_none().text_color(t.muted),
        s.id === sortOf().id, () => setShared("agents.sort", s.id))))
      .child(head("Avatar", 8))
      .children(PETS.map((p) => row(`pet-${p.id}`, p.label, image(`mods/kage-agents/${p.id}-sleep-0.png`).w(18).h(18).flex_none(),
        p.id === petAll(), () => setShared("agents.pet", p.id))))
      .child(head("Move", 8))
      .child(row("move-random", "Random", div().w(18).flex_none().text_color(t.muted).child("?"), moveSetting() === "random",
        () => setShared("agents.move", "random")))
      .children(MOVES.map((m) => row(`move-${m.id}`, m.label, image(`mods/kage-agents/${petAll()}-${m.id}-4.png`).w(18).h(18).flex_none(),
        m.id === moveSetting(), () => setShared("agents.move", m.id))));
  }

  // Right-click on a card: this agent's own witch and move; "As all" goes back to the sort menu's choice.
  agentMenu(t, address) {
    const own = picks()[address] ?? {};
    const row = menuRow(t), head = menuHead(t), none = () => div().w(18).flex_none();
    const pet = petOf(address);
    return v_flex().w_full().p(5).bg(t.popover).text_size(12.8)
      .child(head("This agent's witch", 4))
      .child(row("own-pet-all", "As all", none(), !own.pet, () => pick(address, "pet", undefined)))
      .children(PETS.map((p) => row(`own-pet-${p.id}`, p.label, image(`mods/kage-agents/${p.id}-sleep-0.png`).w(18).h(18).flex_none(),
        own.pet === p.id, () => pick(address, "pet", p.id))))
      .child(head("Move", 8))
      .child(row("own-move-all", "As all", none(), !own.move, () => pick(address, "move", undefined)))
      .children(MOVES.map((m) => row(`own-move-${m.id}`, m.label, image(`mods/kage-agents/${pet}-${m.id}-4.png`).w(18).h(18).flex_none(),
        own.move === m.id, () => pick(address, "move", m.id))));
  }

  // A click on a camp's fire: its terminals with no agent yet, by name; a click goes there.
  campMenu(t, id) {
    const sp = spaces().find((s) => s.id === id), row = menuRow(t);
    const tabs = sp ? idleTabs(sp) : [];
    return v_flex().w_full().p(5).bg(t.popover).text_size(12.8)
      .child(menuHead(t)(sp ? `${sp.name}: no agent yet` : "Space closed", 4))
      .when(tabs.length === 0, (el) => el.child(div().px(8).py(6).text_color(t.dim).child("Every terminal has an agent")))
      // 31px rows, at most 10 shown: keep in step with the popup height the fire opens it at (board()).
      .child(v_flex().id("camp-list").max_h(31 * 10).overflow_y_scrollbar().children(tabs.map(({ tab, p }) => row(`camp-tab-${tab.id}`, tab.named ? tab.name : folder(p.cwd) ?? tab.name,
        svg("mods/workspace-chrome/terminal.svg").size(14).flex_none().text_color(t.muted), p.focused, () => run("pane.focus", { pane: p.pane }))
        // ✕ closes that terminal's tab; the menu stays open for the rest.
        .child(div().id(`camp-close-${tab.id}`).p(3).rounded(4).flex_none().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip("Close this terminal").on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: tab.id }); cx.notify(); })
          .child(svg("mods/workspace-chrome/x.svg").size(12))))));
  }

  // The witch's picture now: dozing while the agent idles, else its move (or done / plead). Notes who is
  // awake or asleep, so the frame timer redraws only when a shown frame changes.
  frame(a, step) {
    const pet = petObj(a.address);
    if (asleep(a)) {
      if (!this.sleepers.includes(pet)) this.sleepers.push(pet);
      return `mods/kage-agents/${pet.id}-sleep-${this.snore.get(pet.id)}.png`;
    }
    this.awake = true;
    return `mods/kage-agents/${pet.id}-${STATUS_MOVE[a.status] ?? moveOf(a.address, this.since(a))}-${step}.png`;
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = icon(k.program, 14, t.foreground);
    const on = k.address === shown;
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(39)
      .pr(8)
      .rounded(8)
      .h(26)
      .flex_none()
      .gap(0)
      .items_center()
      .text_size(12.5)
      .when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click(() => (this.listed.has(k.address) ? run("pane.focus", { terminal: k.address }) : this.peek(k.address)))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", el => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), el => el.child(div().mr(8).child(pic)))
      .child(div().flex_1().truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked" && compact) return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none().rounded(4).bg(a.status === "done" ? color : t.dim + "00");
  }

  // props.board (my-herdr-app's top band, through kage-layout.ps1): the open space's camp, a twilight forest
  // (forest-bg.png, 2080x200: avatars/pixellab/forest.png widened with mirrored edges, one moon; a different stretch of it per space) with a campfire in the middle and that
  // space's witches round it: asleep while the agent idles, casting while it works (no monster yet).
  // It sets no agent order: next / previous follow the sidebar's.
  board(t, list, now, step) {
    this.fire = Math.floor(now / FIRE); // the fire flickers on its own, slower clock
    const ink = shared("space.colors") ?? {}, ps = panes();
    const witch = (a) => {
      const name = folder(ps.find((p) => p.pane === a.pane)?.cwd) ?? a.tab_name;
      return v_flex().id(`camp-${a.address}`).min_w(FACE).flex_none().items_center().cursor_pointer()
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openAgentMenu(a.address); })
        .tooltip(`${name}: ${LABEL[a.status] ?? "IDLE"}`)
        .when(a.status === "working" && this.says.has(a.address), (el) => el.child(div().max_w(160).mb(2).px(6).py(1)
          .bg(t.background).border_2().border_color(t.foreground).text_color(t.foreground).child(this.says.get(a.address))))
        .child(div().max_w(160).truncate().text_color(a.focused ? t.foreground : t[a.status] ?? t.muted).child(name))
        .child(image(this.frame(a, step)).w(FACE).h(FACE));
    };
    // The fire: campfire-0..5.png (avatars/campfire.py), a frame a beat. A click lists the space's
    // terminals with no agent yet (a new one has no witch to click).
    const fire = (sp, n = idleTabs(sp).length) => v_flex().id(`fire-${sp.id}`).flex_none().items_center().cursor_pointer().tooltip(`${sp.name}: terminals with no agent`)
      .text_color(t.muted).hover((s) => s.text_color(t.foreground))
      .on_click(() => openOverlay({ mod: "kage-agents", kind: "popup", width: 220, height: 50 + 31 * Math.max(1, Math.min(10, n)), props: { campMenu: sp.id } }))
      .child(div().child(`terminals (${n})`))
      // Its light on the ground (campfire-glow, 400x40, centred at 200,16: the middle of the stone ring), under it.
      .child(div().relative().w(64).h(64)
        .child(image(`mods/kage-agents/campfire-glow-${this.fire % 6}.png`).absolute().left(-168).top(36).w(400).h(40))
        .child(image(`mods/kage-agents/campfire-${this.fire % 6}.png`).w(64).h(64)));
    const camp = (sp) => {
      // The most urgent first, so a NEEDS YOU agent is never the one left out.
      const all = list.filter((a) => a.space === sp.id).sort((x, y) => this.rank(y) - this.rank(x) || this.since(y) - this.since(x));
      // Then each keeps its place by the fire (by address, which never changes): a status change doesn't move it.
      const here = all.slice(0, CAMP).sort((x, y) => x.address.localeCompare(y.address, undefined, { numeric: true })), more = all.length - here.length;
      const left = here.filter((_a, k) => k % 2 === 0), right = here.filter((_a, k) => k % 2 === 1);
      return div().id(`camp-${sp.id}`).relative().flex_1().min_w(0).h_full().overflow_hidden().bg("#0a1226")
        // Twice side by side: the band can be wider than one picture (no sidebar on a 1920px screen).
        .children([0, 2080].map((x) => image("mods/kage-agents/forest-bg.png").absolute().bottom(0).left(x - (sp.index * 90) % 270).w(2080).h(200)))
        .child(h_flex().absolute().left(0).right(0).bottom(6).gap(48).justify_center().items_end()
          .children(left.reverse().map(witch)).child(fire(sp)).children(right.map(witch))
          .when(more > 0, (el) => el.child(div().mb(40).text_color(t.muted).child(`+${more}`))))
        .child(div().absolute().left(8).top(6).px(4).bg("#0a1226cc").text_color(NAME[ink[sp.id]] ?? t.accent).child(sp.name));
    };
    return h_flex().relative().size_full().min_h(0).bg(t.chrome).font_family(PIXEL).text_size(16)
      .children(spaces().filter((sp) => sp.active).map(camp))
      .child(div().id("ag-sort").absolute().right(8).top(6).text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .on_click(openSortMenu).tooltip("Avatar and move").child(svg("mods/workspace-chrome/layers.svg").size(14)));
  }

  render(cx) {
    const t = theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    if (props()?.agentMenu) return this.agentMenu(t, props().agentMenu);
    if (props()?.campMenu) return this.campMenu(t, props().campMenu);
    const cols = { ...(shared("space.colors") ?? {}) };
    const named = Object.keys(cols).filter((k) => !cols[k].startsWith("#"));
    for (const k of named) {
      const uses = (c) => Object.values(cols).filter((v) => v === c).length;
      cols[k] = KAGE_SPACE.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    }
    if (named.length) setShared("space.colors", cols);
    // The board is wide whatever the sidebar's width: always full cards.
    const board = Boolean(props()?.board), collapsed = !board && narrow();
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();
    this.migratePins(all);
    const shown = focused()?.agent;
    const now = Date.now();
    this.track(list, now);
    this.awake = false;
    this.fire = undefined;
    this.sleepers = [];
    this.snore = new Map(PETS.map((p) => [p.id, snoreAt(now, p)]));
    const step = this.step = Math.floor(now / BEAT) % FRAMES;
    // A kept sub-agent (one with a pane) is in agents() too: where a tree shows
    // it, it gets no row of its own, unless it's pinned.
    // The board has no sub-rows, so there a kept sub-agent gets a card of its own.
    const nested = new Set(collapsed || board ? [] : list.flatMap((a) => this.tree(all, a.address).map((s) => s.t.address)));
    list = list.filter((a) => a.pinned || !nested.has(a.address));
    const tabCounts = new Map();
    for (const a of list) tabCounts.set(a.tab, (tabCounts.get(a.tab) ?? 0) + 1);
    const byPriority = sort.id === "priority";
    const urgency = new Map(list.map((a) => [a.address, Math.max(this.rank(a), ...this.tree(all, a.address).map((s) => RANK[kidStatus(s.t, this.listed)] ?? 0))]));
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority) list = [...list].sort((x, y) => rankOf(y) - rankOf(x) || this.since(y) - this.since(x) || y.seq - x.seq);
    const pinned = list.filter((a) => a.pinned);
    const rest = list.filter((a) => !a.pinned);
    list = [...pinned, ...rest];
    // The sidebar owns next / previous agent; the board's list (kept sub-agents too) would take turns with it.
    if (!board) setAgentOrder(list.map((a) => a.address));

    const withKids = (a, i) => {
      const subs = collapsed ? [] : this.tree(all, a.address);
      const r = row(a, i, subs);
      if (this.folded.has(a.address)) return [r];
      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // The fold chevron; folded, the count too, colored by the most urgent one.
    const fold = (a, subs) => {
      const sts = subs.map((s) => kidStatus(s.t, this.listed));
      const top = sts.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
      const open = !this.folded.has(a.address);
      return div()
        .id(`fold-${a.address}`)
        .h(18)
        .px(3)
        .gap(3)
        .flex()
        .items_center()
        .rounded(4)
        .text_size(11)
        .text_color(open ? t.dim : (t[top] ?? t.dim))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.folded.add(a.address) : this.folded.delete(a.address);
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
        .when(!open, (el) => el.child(String(subs.length)));
    };

    // A row reads "space \u00b7 detail": the detail is a tab someone named or the
    // agent's own title, never an automatic tab number unless two rows would
    // otherwise read the same.
    // Read the pane snapshot once: every host read copies the whole list into JS.
    const paneList = panes();
    const leads = leadPanes(paneList);
    const cwdOf = new Map(paneList.map((p) => [p.pane, p.cwd]));
    const tabs = new Map(spaces().flatMap(s => s.tabs).map(tab => [tab.id, tab]));
    const labels = new Map(list.map(a => {
      const tab = tabs.get(a.tab);
      const many = tabCounts.get(a.tab) > 1;
      return [a.address, tab ? title(many ? { ...tab, named: false } : tab, many ? a : leads.get(a.tab)) : (a.title || a.program?.name || "")];
    }));
    const label = (a) => labels.get(a.address);
    const detail = new Map(list.map(a => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
    const seen = {};
    for (const a of list) { const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`; seen[k] = (seen[k] ?? 0) + 1; }
    for (const a of list) {
      if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1) detail.set(a.address, label(a));
    }

    const row = (a, i, subs = []) => {
      const pic = icon(a.program, 16, t.foreground);
      const more = detail.get(a.address);
      // An agent on another machine (`vps/t7`) says which.
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().text_color(t.muted).child(String(i + 1)))
          .child(h_flex().w(14).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const isPinned = a.pinned;
      const pin = div()
        .id(`pin-${a.address}`)
        .flex_none()
        .p(2)
        .rounded(4)
        .text_color(t.dim)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(isPinned ? "Unpin" : "Pin to the top")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("terminal.pin", { terminal: a.address, pinned: !isPinned });
          // The row moves away from under the pointer, and no hover-out comes.
          this.hovered = null;
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(13));
      // Under a space header the space goes without saying; an automatic tab number says nothing.
      // Without a space header above (priority, pinned) the row names its space.
      const full = byPriority || isPinned;
      const tab = tabs.get(a.tab);
      const own = tab?.named && tab.name !== a.program?.name ? tab.name : null;
      const name = own ?? folder(cwdOf.get(a.pane)) ?? (full ? label(a) : more ?? (/^\d+$/.test(label(a)) ? a.program?.name || label(a) : label(a)));
      // Witch card: dozing while the agent idles, casting while it works.
      const face = div().relative().w(FACE + 2).h(FACE + 2).flex_none().rounded(6).border_1().border_color(asleep(a) ? t.border : t.accent).bg(t.canvas)
        .child(image(this.frame(a, step)).absolute().left(0).top(0).w(FACE).h(FACE));
      const tint = t[a.status] ?? t.dim;
      const badge = div().flex_none().px(5).h(20).rounded(3).border_1().border_color(tint).text_size(16).font_bold().text_color(tint).flex().items_center().child(LABEL[a.status] ?? "IDLE");
      return h_flex()
        .id(`ag-${a.address}`)
        .px(6)
        .py(6)
        .mb(4)
        .flex_none()
        .rounded(8)
        .border_1()
        .border_color(a.focused ? t.accent : t.border)
        .bg(a.focused ? t.selected : t.surface)
        .items_center()
        .gap(9)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => {
          if (on) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          openAgentMenu(a.address);
        })
        .tooltip("Right-click: this agent's witch and move")
        .child(div().id(`agent-fold-${a.address}`)
          .when(subs.length > 0, el => el.on_click((_e, cx) => {
            cx.stop_propagation();
            this.folded.has(a.address) ? this.folded.delete(a.address) : this.folded.add(a.address);
            cx.notify();
          })).child(face))
        .child(v_flex().flex_1().min_w(0).gap(3).font_family(PIXEL).text_size(16).line_height("18px")
          .child(h_flex().gap(6).items_center().child(badge)
            .when(Boolean(when), (r) => r.child(div().text_size(16).text_color(t.dim).child(duration(now - when)))))
          .child(div().min_w(0).truncate().font_bold().text_color(idle ? t.muted : t.foreground).child(name)))
        .when(Boolean(machine), el => el.child(div().text_size(10).text_color(t.dim).child(machine)))
        .when(subs.length > 0, el => el.child(fold(a, subs)))
        .when(this.hovered === a.address, el => el.child(pin));
    };
    if (board) return this.board(t, list, now, step);

    // Groups in list order: spaces (grouped) or priority sections. Agents of a
    // space are next to each other in agents(), so neighbours make a group.
    const groups = pinned.length ? [{ id: "pinned", label: "Pinned", status: null, members: pinned }] : [];
    for (const a of rest) {
      const r = rankOf(a) || RANK.idle;
      const id = byPriority ? `sec-${r}` : `sp-${a.space}`;
      if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
      else groups.push({ id, label: byPriority ? SECTION[r] : a.space_name || "", status: byPriority ? SECTION_STATUS[r] : null, members: [a] });
    }

    // A group's header; it folds the group. Folded, it says how many and the most urgent state.
    const header = (g) => {
      const open = !this.folded.has(g.id);
      const top = g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);
      return h_flex()
        .id(g.id)
        .px(8)
        .pt(8)
        .h(30)
        .flex_none()
        .gap(6)
        .items_center()
        .text_size(11)
        .font_medium()
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          open ? this.folded.add(g.id) : this.folded.delete(g.id);
          cx.notify();
        })
        .child(div().truncate().font_family(PIXEL).text_size(16).text_color(t[g.status] ?? t.dim).child(g.label))
        .when(byPriority || !open, (el) => el.child(div().font_family(PIXEL).text_size(16).text_color(t.dim).child(String(g.members.length))))
        .child(div().flex_1())
        .when(!open, (el) => el
          .when(!byPriority && top && top !== "idle", (el) => el.child(this.status(t, { status: top }, true)))
          .child(svg("mods/workspace-chrome/chevron-right.svg").size(11).flex_none().text_color(t.dim)));
    };
    const rows = collapsed
      ? list.flatMap(withKids)
      : groups.flatMap((g) => [header(g), ...(this.folded.has(g.id) ? [] : g.members.flatMap(withKids))]);

    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(13)
      .when(!collapsed, (el) =>
        el.child(
          h_flex()
            .px(16)
            .h(41)
            .pt(14)
            .pb(5)
            .flex_none()
            .items_center()
            .justify_between()
            .child(div().font_family(PIXEL).text_size(16).text_color(t.dim).child("AGENTS"))
            .child(
              div()
                .id("ag-sort")
                .text_size(11)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(openSortMenu)
                .tooltip(`Sort agents: ${sort.label}; avatar, move`)
                .child(svg(`mods/workspace-chrome/${sort.icon}.svg`).size(14)),
            ),
        ),
      )
      .when(list.length === 0 && !collapsed, (el) =>
        el.child(div().px(12).text_size(12).text_color(t.dim).child("No agent status yet. Agents show up here when they report their status. Older versions and agents inside tmux may not.")),
      )
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(collapsed ? 0 : 8).overflow_y_scrollbar().mode("always").children(rows))
      .when(collapsed, (el) =>
        el.child(
          h_flex()
            .h(28)
            .items_center()
            .justify_center()
            .child(
              div()
                .id("collapse")
                .text_size(13)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(toggleSidebar)
                .child("»"),
            ),
        ),
      );
  }
}
