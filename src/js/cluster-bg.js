// Background: a pixel-art cluster. Nodes sit on a loose grid joined by network links;
// traffic packets flow between them, pods get rescheduled to neighbours, and now and
// then a node goes NotReady and its pods are evicted. Drawn at 1/SCALE resolution and
// scaled up with `image-rendering: pixelated`.
(() => {
  const canvas = document.getElementById('cluster');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const SCALE = 3;
  const NODE_W = 12, NODE_H = 9;
  const SLOTS = [[2, 2], [6, 2], [2, 5], [6, 5]]; // 3×2 pod slots inside a node

  const css = getComputedStyle(document.body);
  const v = (name) => css.getPropertyValue(name).trim();
  const COL = {
    grid: v('--grid'), node: v('--node'), ink: v('--px-ink'), slot: v('--slot'),
    ok: v('--mint-deep'), bad: v('--pink-deep'),
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
    W = Math.ceil(innerWidth / SCALE);
    H = Math.ceil(innerHeight / SCALE);
    canvas.width = W; canvas.height = H;
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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COL.grid;
    ctx.globalAlpha = 0.7;
    for (const pts of links) for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i][0], pts[i][1], 1, 1);
    ctx.globalAlpha = 0.75;
    for (const p of packets) {
      const [x, y] = p.pts[Math.min(p.i, p.pts.length - 1)];
      ctx.fillStyle = p.color;
      if (p.pod) ctx.fillRect(x - 1, y - 1, 3, 2); else ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const n of nodes) {
      ctx.fillStyle = n.down ? COL.bad : COL.grid;
      ctx.fillRect(n.x, n.y, NODE_W, NODE_H);
      ctx.fillStyle = COL.node;
      ctx.fillRect(n.x + 1, n.y + 1, NODE_W - 2, NODE_H - 2);
      n.pods.forEach((p, i) => {
        const [sx, sy] = SLOTS[i];
        ctx.fillStyle = p || COL.slot;
        ctx.globalAlpha = p ? 0.8 : 1;
        ctx.fillRect(n.x + sx, n.y + sy, 3, 2);
        ctx.globalAlpha = 1;
      });
      // status light: steady green when Ready, blinking pink when NotReady
      ctx.fillStyle = n.down ? (tick % 6 < 3 ? COL.bad : COL.node) : COL.ok;
      ctx.fillRect(n.x + 10, n.y + 2, 1, 1);
    }
  }

  layout();
  draw();
  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); draw(); }, 200); });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setInterval(() => { if (!document.hidden) { step(); draw(); } }, 70);
})();
