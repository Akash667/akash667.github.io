// Background: a cluster of servers. Nodes sit on a loose grid joined by network links;
// traffic packets flow between them, pods get rescheduled to neighbours, and now and
// then a node goes NotReady and its pods are evicted. The simulation runs on a coarse
// grid (UNIT css px per step); drawing is crisp vector at full device resolution.
(() => {
  const canvas = document.getElementById('cluster');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const UNIT = 3;                          // css px per simulation step
  const NODE_W = 12, NODE_H = 9;           // node footprint on the grid, used for spacing
  const BOX_W = 22, BOX_H = 14;            // drawn node size in css px
  const SLOTS = [[4, 4], [9, 4], [4, 8], [9, 8]]; // pod positions inside a box, 4×2 px each

  const css = getComputedStyle(document.body);
  const v = (name) => css.getPropertyValue(name).trim();
  const COL = {
    grid: v('--grid'), node: v('--node'), edge: v('--node-edge'), slot: v('--slot'),
    ok: v('--led'), bad: v('--led-bad'),
    pods: ['--pink', '--sky', '--mint', '--butter', '--lav', '--peach'].map(v),
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  let W, H, nodes, links, packets, tick = 0;

  // Integer points along a line (Bresenham), so packets move one pixel at a time.
  function line(x0, y0, x1, y1) {
    const pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) return pts;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function layout() {
    W = Math.ceil(innerWidth / UNIT);
    H = Math.ceil(innerHeight / UNIT);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gap = Math.max(40, Math.round(Math.min(W, H) / 5));
    nodes = []; links = []; packets = [];
    let row = 0;
    for (let y = 8; y < H - 4; y += Math.round(gap * 0.75), row++) {
      for (let x = 6 + (row % 2) * Math.round(gap / 2); x < W - 4; x += gap) {
        if (Math.random() < 0.18) continue;
        nodes.push({
          x: Math.round(x + (Math.random() - 0.5) * gap * 0.4),
          y: Math.round(y + (Math.random() - 0.5) * gap * 0.3),
          pods: SLOTS.map(() => (Math.random() < 0.55 ? pick(COL.pods) : null)),
          down: 0, links: [],
        });
      }
    }
    // Link each node to its two nearest neighbours.
    const centre = (n) => [n.x + (NODE_W >> 1), n.y + (NODE_H >> 1)];
    for (const a of nodes) {
      const near = nodes.filter((b) => b !== a)
        .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))
        .slice(0, 2);
      for (const b of near) {
        if (a.links.some((l) => l.to === b)) continue;
        const pts = line(...centre(a), ...centre(b));
        links.push(pts);
        a.links.push({ to: b, pts });
        b.links.push({ to: a, pts: [...pts].reverse() });
      }
    }
  }

  function send(from, link, color, pod) {
    packets.push({ pts: link.pts, i: 0, color, pod, to: link.to });
  }

  function step() {
    tick++;
    if (!nodes.length) return;
    // background traffic
    if (tick % 3 === 0) {
      const n = pick(nodes);
      if (n.links.length && !n.down) send(n, pick(n.links), pick(COL.pods), false);
    }
    // a pod gets rescheduled onto a neighbour
    if (tick % 25 === 0) {
      const n = pick(nodes), i = n.pods.findIndex(Boolean);
      const link = n.links.length && pick(n.links);
      if (i >= 0 && link && link.to.pods.includes(null)) { send(n, link, n.pods[i], true); n.pods[i] = null; }
    }
    // a node goes NotReady and its pods are evicted
    if (tick % 90 === 0) {
      const n = pick(nodes);
      n.down = 40;
      n.pods.forEach((p, i) => {
        if (!p) return;
        const ok = n.links.filter((l) => !l.to.down && l.to.pods.includes(null));
        if (ok.length) send(n, pick(ok), p, true);
        n.pods[i] = null;
      });
    }
    for (const n of nodes) if (n.down) n.down--;
    for (let k = packets.length - 1; k >= 0; k--) {
      const p = packets[k];
      p.i += 1;
      if (p.i < p.pts.length) continue;
      if (p.pod) { const free = p.to.pods.indexOf(null); if (free >= 0) p.to.pods[free] = p.color; }
      packets.splice(k, 1);
    }
  }

  // A small, bright light with a tight halo.
  function light(color, x, y, w, h, halo = 4) {
    ctx.shadowColor = color; ctx.shadowBlur = halo;
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }
  const box = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  };

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const centre = (n) => [(n.x + NODE_W / 2) * UNIT, (n.y + NODE_H / 2) * UNIT];
    // links: 1px hairlines, snapped to the pixel grid so they stay sharp
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const pts of links) {
      const [a, b] = [pts[0], pts[pts.length - 1]];
      ctx.moveTo(Math.round(a[0] * UNIT) + .5, Math.round(a[1] * UNIT) + .5);
      ctx.lineTo(Math.round(b[0] * UNIT) + .5, Math.round(b[1] * UNIT) + .5);
    }
    ctx.stroke();
    for (const p of packets) {
      const [x, y] = p.pts[Math.min(p.i, p.pts.length - 1)];
      const px = Math.round(x * UNIT), py = Math.round(y * UNIT);
      if (p.pod) light(p.color, px - 2, py - 1, 4, 3, 5); else light(p.color, px - 1, py - 1, 2, 2, 4);
    }
    for (const n of nodes) {
      const [cx, cy] = centre(n);
      const x = Math.round(cx - BOX_W / 2), y = Math.round(cy - BOX_H / 2);
      box(x + .5, y + .5, BOX_W, BOX_H, 3);
      ctx.fillStyle = COL.node; ctx.fill();
      ctx.strokeStyle = n.down ? COL.bad : COL.edge; ctx.stroke();
      n.pods.forEach((p, i) => {
        const [sx, sy] = SLOTS[i];
        ctx.fillStyle = p || COL.slot;
        ctx.fillRect(x + sx, y + sy, 4, 2);
      });
      // status light: steady green when Ready, blinking pink when NotReady
      if (!n.down) light(COL.ok, x + BOX_W - 5, y + 3, 2, 2);
      else if (tick % 6 < 3) light(COL.bad, x + BOX_W - 5, y + 3, 2, 2, 6);
    }
  }

  layout();
  draw();
  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); draw(); }, 200); });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setInterval(() => { if (!document.hidden) { step(); draw(); } }, 70);
})();
