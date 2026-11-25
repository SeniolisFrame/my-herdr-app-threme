// Board: every agent in every space as a card, in four columns by status (Needs you,
// Working, Done, Idle). Click a card to go to that agent. Colors are the theme's status colors.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, theme, run, setAgentOrder } from "herdr";
import { sz, loadTextSizes } from "./common.js";

const GROUPS = [["blocked", "Needs you"], ["working", "Working"], ["done", "Done"], ["idle", "Idle"]];

const icon = (p, t) => !p?.icon ? div().size(14).rounded(3).bg(t.dim).flex_none()
  : (p.tint ? svg(p.icon).text_color(t.foreground) : image(p.icon)).size(14).flex_none();

function card(a, color, t) {
  return h_flex().id(`agent-${a.address}`).w_full().h(52).flex_none().rounded(6).overflow_hidden()
    .border_1().border_color(a.focused ? color : t.border).bg(a.focused ? t.selected : t.raised)
    .cursor_pointer().hover(s => s.border_color(color))
    .tooltip(`${a.program.name} · ${a.space_name} / ${a.tab_name} · ${a.address}`)
    .on_click(() => run("agent.focus", { terminal: a.address }))
    .child(div().w(3).h_full().bg(color).flex_none())
    .child(v_flex().flex_1().min_w(0).px(8).gap(3).justify_center()
      .child(h_flex().gap(6).items_center().child(icon(a.program, t))
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(a.pane_name ?? a.space_name)))
      .child(div().truncate().text_color(t.dim).child(`${a.program.name} · tab ${a.tab_name}`)));
}

export default class Board extends View {
  init() { loadTextSizes(); }
  render() {
    const t = theme(), list = agents();
    // The app's next/previous agent keys go column by column, as the board reads.
    setAgentOrder(GROUPS.flatMap(([key]) => list.filter(a => a.status === key).map(a => a.address)));
    return h_flex().size_full().px(12).py(10).gap(12).text_size(sz("xs")).text_color(t.foreground)
      .children(GROUPS.map(([key, label]) => {
        const mine = list.filter(a => a.status === key), color = t[key] ?? t.dim;
        return v_flex().flex_1().min_w(0).h_full().gap(6)
          .child(h_flex().h(22).flex_none().gap(7).items_center()
            .child(div().size(8).rounded(8).bg(color).flex_none())
            .child(div().font_semibold().text_size(sz("sm")).child(label))
            .child(div().px(6).rounded(4).bg(t.raised).text_color(mine.length ? color : t.dim).child(String(mine.length))))
          .child(v_flex().id(`col-${key}`).flex_1().min_h(0).overflow_y_scroll().gap(6)
            .children(mine.map(a => card(a, color, t))));
      }));
  }
}
