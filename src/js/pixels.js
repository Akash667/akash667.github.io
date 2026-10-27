// Small pixel-art icons and the hero cluster diagram. Each icon is a grid of palette
// letters drawn as SVG rects, so it stays crisp at any size; the diagram is plain vector
// shapes. Both use the page's CSS colour variables.
(() => {
  const PALETTE = {
    X: '--px-ink', w: '--cloud', s: '--cloud-shade', W: '--cloud', k: '--screen',
    p: '--pink', P: '--pink-deep', l: '--lav', m: '--mint', M: '--mint-deep',
    b: '--sky', y: '--butter', o: '--peach', d: '--peach-deep',
  };

  const SPRITES = {
    heart: [
      '.XXX.XXX.',
      'XpWpXpppX',
      'XWppppppX',
      'XpppppppX',
      '.XpppppX.',
      '..XpppX..',
      '...XpX...',
      '....X....',
    ],
    cloud: [
      '......XXXX......',
      '....XXwwwwXX....',
      '..XXwwwwwwwwX...',
      '.XwwwwwwwwwwwXX.',
      'XwwwwwwwwwwwwwwX',
      'XwwwwwwwwwwwwwwX',
      'XswwwwwwwwwwwwsX',
      '.XssssssssssssX.',
      '..XXXXXXXXXXXX..',
    ],
    code: [
      'XXXXXXXXXXXXXXXX',
      'XPWyWMWWWWWWWWWX',
      'XXXXXXXXXXXXXXXX',
      'XkkkkkkkkkkkkkkX',
      'XkMkkkkkkkkkkkkX',
      'XkkMkkkkkkkkkkkX',
      'XkMkkMMMMkkkkkkX',
      'XkkkkkkkkkkkkkkX',
      'XkbbbbbkbbbkkkkX',
      'XkkkkkkkkkkkkkkX',
      'XkyyykyyyyykkkkX',
      'XkkkkkkkkkkkkkkX',
      'XXXXXXXXXXXXXXXX',
    ],
    case: [
      '.....XXXXXX.....',
      '....XX....XX....',
      '....X......X....',
      'XXXXXXXXXXXXXXXX',
      'XooooooooooooooX',
      'XoWWoooooooooooX',
      'XooooooooooooooX',
      'XXXXXXXyyXXXXXXX',
      'XddddddyyddddddX',
      'XddddddddddddddX',
      'XddddddddddddddX',
      'XddddddddddddddX',
      'XXXXXXXXXXXXXXXX',
    ],
  };

  const NS = 'http://www.w3.org/2000/svg';
  const rect = (x, y, w, h, color) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.style.fill = `var(${color})`;
    return r;
  };
  const fill = (r, color) => { r.style.fill = `var(${color})`; };

  // Append a sprite's rects (runs of one colour merged) to a parent at (ox, oy).
  function draw(parent, rows, ox = 0, oy = 0) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let end = x + 1;
        while (row[end] === c) end++;
        if (PALETTE[c]) parent.append(rect(ox + x, oy + y, end - x, 1, PALETTE[c]));
        x = end;
      }
    });
  }

  for (const svg of document.querySelectorAll('svg[data-sprite]')) {
    const rows = SPRITES[svg.dataset.sprite];
    svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
    draw(svg, rows);
  }

  // ---------- hero: a control plane scheduling pods onto three worker nodes ----------
  const scene = document.getElementById('cluster-diagram');
  if (!scene) return;
  scene.setAttribute('viewBox', '0 0 160 58');
  const layer = () => scene.appendChild(document.createElementNS(NS, 'g'));
  const pipes = layer(), boxes = layer(), packets = layer();

  const CP = { x: 58, y: 1, w: 44, h: 15 };
  const WORKERS_X = [26, 80, 134];          // worker centres; pipe columns sit at x-1..x
  const BUS = 27, WORKER_Y = 35, WORKER_W = 40, WORKER_H = 22;

  // Drawn as clean vector shapes (rounded boxes, hairline strokes), not pixel art.
  scene.setAttribute('shape-rendering', 'geometricPrecision');
  const shape = (x, y, w, h, fillVar, { rx = 0, stroke, strokeWidth = 0.6 } = {}) => {
    const r = rect(x, y, w, h, fillVar);
    if (rx) r.setAttribute('rx', rx);
    if (stroke) { r.style.stroke = `var(${stroke})`; r.style.strokeWidth = strokeWidth; }
    return r;
  };

  // pipes: thin lavender lines; packets ride centred on them
  const pipe = (x, y, w, h) => pipes.append(shape(x, y, w, h, '--lav', { rx: 0.5 }));
  pipes.style.opacity = 0.55;
  pipe(79.5, CP.y + CP.h, 1, BUS + 1 - (CP.y + CP.h));
  for (const cx of WORKERS_X) pipe(cx - 0.5, BUS + 0.5, 1, WORKER_Y - BUS - 0.5);
  pipe(WORKERS_X[0] - 0.5, BUS + 0.5, WORKERS_X[2] - WORKERS_X[0] + 1, 1);

  // control plane: two racks with status lights
  boxes.append(shape(CP.x, CP.y, CP.w, CP.h, '--node', { rx: 2.5, stroke: '--lav', strokeWidth: 0.7 }));
  boxes.append(shape(CP.x + 4, CP.y + 4, CP.w - 15, 2.5, '--slot', { rx: 1 }));
  boxes.append(shape(CP.x + 4, CP.y + 8.5, CP.w - 15, 2.5, '--slot', { rx: 1 }));
  const cpLights = [shape(CP.x + CP.w - 8, CP.y + 4, 2.5, 2.5, '--led', { rx: 1.25 }), shape(CP.x + CP.w - 8, CP.y + 8.5, 2.5, 2.5, '--led', { rx: 1.25 })];
  boxes.append(...cpLights);

  // workers: 3×2 pod slots and a Ready light
  const workers = WORKERS_X.map((cx) => {
    const bx = cx - WORKER_W / 2;
    boxes.append(shape(bx, WORKER_Y, WORKER_W, WORKER_H, '--node', { rx: 2.5, stroke: '--node-edge', strokeWidth: 0.7 }));
    const slots = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const r = shape(bx + 3.5 + col * 11.5, WORKER_Y + 6 + row * 7.5, 9, 5, '--slot', { rx: 1.2 });
        boxes.append(r);
        slots.push({ r, pod: null, born: 0 });
      }
    }
    const light = shape(bx + WORKER_W - 5, WORKER_Y + 2.5, 2, 2, '--led', { rx: 1 });
    boxes.append(light);
    return { cx, slots, light, flash: 0 };
  });

  // Each route: down from the control plane, along the bus, down into a worker.
  function route(cx) {
    const pts = [];
    for (let y = CP.y + CP.h; y <= BUS; y++) pts.push([79, y]);
    const dir = Math.sign(cx - 80);
    for (let x = 79; x !== cx - 1; x += dir) pts.push([x + dir, BUS]);
    for (let y = BUS + 1; y <= WORKER_Y; y++) pts.push([cx - 1, y]);
    return pts;
  }
  const ROUTES = WORKERS_X.map(route);
  const COLORS = ['--pink', '--sky', '--mint', '--butter', '--peach', '--lav'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  let tick = 0;
  const live = [];

  function place(w, color) {
    let free = w.slots.filter((s) => !s.pod);
    if (!free.length) { const s = pick(w.slots); s.pod = null; free = [s]; } // full node: evict one
    const s = pick(free);
    s.pod = color; s.born = tick;
  }
  function paint() {
    for (const w of workers) {
      for (const s of w.slots) {
        // ContainerCreating (faint, blinking) for a moment, then Running (solid)
        const creating = s.pod && tick - s.born < 10;
        fill(s.r, s.pod || '--slot');
        s.r.style.opacity = creating ? (tick % 4 < 2 ? 0.35 : 0.6) : 1;
      }
      fill(w.light, tick < w.flash ? '--butter' : '--led');
    }
    cpLights.forEach((l, i) => fill(l, (Math.floor(tick / 6) + i) % 2 ? '--led' : '--slot'));
  }

  // start with a few running pods
  for (const w of workers) for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) place(w, pick(COLORS));
  tick = 100;
  paint();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  setInterval(() => {
    tick++;
    if (tick % 16 === 0) {
      const k = Math.floor(Math.random() * workers.length);
      const el = rect(0, 0, 2, 2, pick(COLORS));
      el.setAttribute('rx', 0.6);
      packets.append(el);
      live.push({ k, i: 0, el });
    }
    // pods finish and terminate now and then
    if (tick % 20 === 0) {
      const s = pick(pick(workers).slots);
      if (s.pod && tick - s.born > 40) s.pod = null;
    }
    for (let j = live.length - 1; j >= 0; j--) {
      const p = live[j], pts = ROUTES[p.k];
      p.i++;
      if (p.i >= pts.length) {
        place(workers[p.k], p.el.style.fill.slice(4, -1));
        workers[p.k].flash = tick + 5;
        p.el.remove(); live.splice(j, 1);
        continue;
      }
      p.el.setAttribute('x', pts[p.i][0]); p.el.setAttribute('y', pts[p.i][1]);
    }
    paint();
  }, 55);
})();
