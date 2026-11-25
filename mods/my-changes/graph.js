// Lays out the commit graph, one lane per open line of history (no imports, so
// node can test it: node mods/my-changes/graph.test.mjs).
//
// commits: [{ hash, parents }] newest first (git log --date-order).
// Each row: col (the commit's lane), color (its lane's color number), width (lanes
// in use), top / bottom: half-row lines [fromLane, toLane, color]. Top lines run
// from the row's top edge to its middle, bottom lines from the middle down.
export function layoutGraph(commits) {
  let lanes = [];
  const colors = [];
  let next = 0;
  const free = () => { const i = lanes.findIndex((h) => !h); return i < 0 ? lanes.length : i; };
  return commits.map((c) => {
    // Lines coming down from the rows above; the ones waiting for this commit bend into it.
    const top = [];
    lanes.forEach((h, j) => { if (h) top.push([j, h === c.hash ? -1 : j, colors[j]]); });
    let col = lanes.indexOf(c.hash);
    if (col < 0) { col = free(); colors[col] = next++; }
    const color = colors[col];
    for (const e of top) if (e[1] === -1) e[1] = col;
    lanes = lanes.map((h) => (h === c.hash ? null : h));

    const [first, ...rest] = c.parents;
    const bottom = [], fresh = new Set();
    if (first) { lanes[col] = first; colors[col] = color; }
    for (const p of rest) {
      let k = lanes.indexOf(p);
      if (k < 0) { k = free(); lanes[k] = p; colors[k] = next++; fresh.add(k); }
      bottom.push([col, k, colors[k]]); // a merge's second parent, drawn in that line's color
    }
    lanes.forEach((h, j) => {
      if (!h || fresh.has(j)) return;
      bottom.push(j === col ? [col, col, color] : [j, j, colors[j]]);
    });
    while (lanes.length && !lanes[lanes.length - 1]) lanes.pop();
    const width = Math.max(col + 1, ...top.map((e) => Math.max(e[0], e[1]) + 1), ...bottom.map((e) => Math.max(e[0], e[1]) + 1));
    return { col, color, top, bottom, width };
  });
}
