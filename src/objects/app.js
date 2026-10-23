// Objects table: photo cut-outs lying on a table, rendered with three.js.
// Each cut-out becomes a soft "pillow" grown from its own silhouette so it
// catches light and casts a real shadow. Units are centimetres.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const manifest = await fetch('objects.json').then((r) => r.json());

// ---------- renderer / scene ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
scene.add(camera);

const THEMES = {
  light: { bg: '#f2eee6', table: [242, 238, 230], grain: 7, hemi: 0.85, key: 2.7 },
  dark: { bg: '#212123', table: [48, 48, 50], grain: 12, hemi: 0.9, key: 2.6 },
};

const hemi = new THREE.HemisphereLight('#ffffff', '#8a847a', 1);
const key = new THREE.DirectionalLight('#fff4e4', 2);
key.castShadow = true;
key.shadow.mapSize.setScalar(innerWidth < 700 ? 1024 : 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
key.shadow.radius = 4;
const fill = new THREE.DirectionalLight('#e2eaff', 0.35);
fill.position.set(120, 80, -60);
scene.add(hemi, key, key.target, fill);

function grainTexture([r, g, b], amp) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i] = r + n; img.data[i + 1] = g + n; img.data[i + 2] = b + n; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

const table = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ roughness: 1 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// The veil hides the table behind an object that has been picked up.
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
camera.add(veil);

let theme = (() => { try { return localStorage.getItem('object-table-theme'); } catch { return null; } })()
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme() {
  const t = THEMES[theme];
  document.documentElement.dataset.theme = theme;
  scene.background = new THREE.Color(t.bg);
  table.material.map?.dispose();
  table.material.map = grainTexture(t.table, t.grain);
  table.material.needsUpdate = true;
  veil.material.color.set(t.bg);
  hemi.intensity = t.hemi;
  key.intensity = t.key;
  $('theme').textContent = theme === 'dark' ? 'light' : 'dark';
}
applyTheme();
$('theme').onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('object-table-theme', theme); } catch {}
  applyTheme();
};

// ---------- objects ----------
const loader = new THREE.TextureLoader();
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

// Sample the cut-out's alpha onto a grid, blur it into a dome, and raise a plane by it.
function pillow(image, w, h, thick) {
  const long = 84;
  const gx = Math.max(8, Math.round((long * w) / Math.max(w, h)));
  const gy = Math.max(8, Math.round((long * h) / Math.max(w, h)));
  const cw = gx + 1, ch = gy + 1;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(image, 0, 0, cw, ch);
  const px = x.getImageData(0, 0, cw, ch).data;
  const mask = new Float32Array(cw * ch);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] / 255;

  let a = mask.slice(), b = new Float32Array(a.length);
  const r = Math.max(1, Math.round(Math.min(gx, gy) / 10));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < ch; y++) for (let i = 0; i < cw; i++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < cw) { s += a[y * cw + j]; n++; } else n++; }
      b[y * cw + i] = s / n;
    }
    for (let y = 0; y < ch; y++) for (let i = 0; i < cw; i++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const j = y + k; if (j >= 0 && j < ch) { s += b[j * cw + i]; n++; } else n++; }
      a[y * cw + i] = s / n;
    }
  }

  const geo = new THREE.PlaneGeometry(w, h, gx, gy);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (a[i] - 0.5) * 2));
    pos.setZ(i, thick * Math.sqrt(t) * (mask[i] > 0.02 ? 1 : 0));
  }
  geo.computeVertexNormals();
  return { geo, mask, cw, ch };
}

function maskTexture(image) {
  const s = Math.min(1, 512 / Math.max(image.width, image.height));
  const c = document.createElement('canvas');
  c.width = Math.round(image.width * s); c.height = Math.round(image.height * s);
  const x = c.getContext('2d');
  x.drawImage(image, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  return new THREE.CanvasTexture(c);
}

async function makeObject(item, i) {
  const tex = await loader.loadAsync(item.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  const scale = item.size / Math.max(item.w, item.h);
  const w = item.w * scale, h = item.h * scale;
  const thick = THREE.MathUtils.clamp(Math.min(w, h) * 0.035, 0.35, 1.4);
  const { geo, mask, cw, ch } = pillow(tex.image, w, h, thick);

  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.62, metalness: 0,
  }));
  const alpha = maskTexture(tex.image);
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: '#d9d4ca', alphaMap: alpha, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.9,
  }));
  back.scale.z = -1;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  for (const m of [front, back]) { m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = depth; }

  const group = new THREE.Group();
  group.add(front, back);
  scene.add(group);

  const o = {
    item, group, front, back, w, h, thick, mask, cw, ch,
    x: 0, z: 0, yaw: 0, y: thick, // current
    tx: 0, tz: 0, tyaw: 0, // target
    rest: thick, lift: 0, hover: 0, tiltX: 0, tiltZ: 0,
    layer: i, pick: 0, spin: new THREE.Quaternion(),
  };
  front.userData.o = back.userData.o = o;
  return o;
}

const objects = await Promise.all(manifest.map(makeObject));
let topLayer = objects.length;
$('loading').style.opacity = 0;

// ---------- layout ----------
const rand = (a, b) => a + Math.random() * (b - a);
const radius = (o) => Math.hypot(o.w, o.h) / 2;
const viewAspect = () => innerWidth / innerHeight;

const LAYOUTS = {
  scatter() {
    const area = objects.reduce((s, o) => s + o.w * o.h, 0);
    const W = Math.sqrt(area * 2.6 * viewAspect()), D = W / viewAspect();
    const placed = [];
    for (const o of [...objects].sort((a, b) => b.w * b.h - a.w * a.h)) {
      let best = null, bestScore = Infinity;
      for (let t = 0; t < 80; t++) {
        const c = { x: rand(-W / 2, W / 2), z: rand(-D / 2, D / 2) };
        let score = 0;
        for (const p of placed) {
          const d = Math.hypot(c.x - p.tx, c.z - p.tz), need = (Math.min(o.w, o.h) + Math.min(p.w, p.h)) * 0.55;
          if (d < need) score += need - d;
        }
        if (score < bestScore) { bestScore = score; best = c; if (score === 0) break; }
      }
      o.tx = best.x; o.tz = best.z; o.tyaw = rand(-0.6, 0.6);
      placed.push(o);
    }
  },
  grid() {
    const sorted = [...objects].sort((a, b) => a.item.title.localeCompare(b.item.title));
    const gap = 5;
    const rowWidth = Math.max(Math.sqrt(sorted.reduce((s, o) => s + (o.w + gap) * (o.h + gap), 0) * viewAspect()), Math.max(...sorted.map((o) => o.w)));
    const rows = [[]];
    let x = 0;
    for (const o of sorted) {
      if (x + o.w > rowWidth && rows.at(-1).length) { rows.push([]); x = 0; }
      rows.at(-1).push(o); x += o.w + gap;
    }
    const heights = rows.map((r) => Math.max(...r.map((o) => o.h)));
    let z = -(heights.reduce((s, h) => s + h + gap, -gap)) / 2;
    rows.forEach((row, ri) => {
      const total = row.reduce((s, o) => s + o.w + gap, -gap);
      let cx = -total / 2;
      for (const o of row) { o.tx = cx + o.w / 2; o.tz = z + heights[ri] / 2; o.tyaw = 0; cx += o.w + gap; }
      z += heights[ri] + gap;
    });
  },
  pile() {
    const spread = Math.sqrt(objects.reduce((s, o) => s + o.w * o.h, 0)) * 0.18;
    for (const o of [...objects].sort(() => Math.random() - 0.5)) {
      o.tx = rand(-spread, spread); o.tz = rand(-spread, spread); o.tyaw = rand(-Math.PI, Math.PI);
      o.layer = ++topLayer;
    }
  },
};

// ---------- camera ----------
const ELEV = THREE.MathUtils.degToRad(58);
const view = { cx: 0, cz: 0, dist: 200 };
const viewTarget = { ...view };

function fit() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const o of objects) {
    const r = radius(o) * 0.8;
    x0 = Math.min(x0, o.tx - r); x1 = Math.max(x1, o.tx + r);
    z0 = Math.min(z0, o.tz - r); z1 = Math.max(z1, o.tz + r);
  }
  const ex = Math.max(x1 - x0, 60), ez = Math.max(z1 - z0, 40);
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const margin = innerWidth < 600 ? 1.15 : 1.35;
  viewTarget.cx = (x0 + x1) / 2;
  viewTarget.cz = (z0 + z1) / 2;
  viewTarget.dist = Math.max(ex / (2 * vt * viewAspect()), (ez * Math.sin(ELEV)) / (2 * vt)) * margin;
  const s = Math.max(ex, ez) * 0.75 + 40;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 800 });
  key.shadow.camera.updateProjectionMatrix();
}

function placeCamera() {
  camera.position.set(view.cx, Math.sin(ELEV) * view.dist, view.cz + Math.cos(ELEV) * view.dist);
  camera.lookAt(view.cx, 0, view.cz);
  key.position.set(view.cx - 110, 170, view.cz + 100);
  key.target.position.set(view.cx, 0, view.cz);
}

let layout = 'scatter';
function arrange(k, instant = false) {
  layout = k;
  LAYOUTS[k]();
  fit();
  for (const b of document.querySelectorAll('#arrange button')) b.setAttribute('aria-pressed', b.dataset.k === k);
  if (instant) {
    for (const o of objects) { o.x = o.tx; o.z = o.tz; o.yaw = o.tyaw; }
    Object.assign(view, viewTarget);
  }
}
$('arrange').onclick = (e) => { const k = e.target.dataset?.k; if (k) { putDown(); arrange(k); } };

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = viewAspect();
  camera.updateProjectionMatrix();
  fit();
}
addEventListener('resize', resize);
resize();
arrange('scatter', true);

// ---------- stacking ----------
// Oriented rectangles (shrunk a little, since cut-outs rarely fill their box) tested with SAT.
function rect(o) {
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
  return { x: o.x, z: o.z, ax: [[c, -s], [s, c]], hw: [o.w * 0.4, o.h * 0.4] };
}
function overlaps(a, b) {
  for (const axis of [...a.ax, ...b.ax]) {
    const proj = (r) => Math.abs(r.ax[0][0] * axis[0] + r.ax[0][1] * axis[1]) * r.hw[0] + Math.abs(r.ax[1][0] * axis[0] + r.ax[1][1] * axis[1]) * r.hw[1];
    const d = Math.abs((a.x - b.x) * axis[0] + (a.z - b.z) * axis[1]);
    if (d > proj(a) + proj(b)) return false;
  }
  return true;
}
function settle() {
  const order = [...objects].sort((a, b) => a.layer - b.layer);
  const rects = new Map(order.map((o) => [o, rect(o)]));
  order.forEach((o, i) => {
    let floor = 0;
    for (let j = 0; j < i; j++) {
      const p = order[j];
      if (p.pick < 0.5 && overlaps(rects.get(o), rects.get(p))) floor = Math.max(floor, p.rest + p.thick * 0.9);
    }
    o.rest = floor + o.thick;
  });
}

// ---------- interaction ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmp = new THREE.Vector3();
let hovered = null, dragging = null, picked = null;
let down = null; // { x, y, t, o, spin }
const grab = { dx: 0, dz: 0, vx: 0, vz: 0, lastX: 0, lastZ: 0, lastT: 0 };

function setRay(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
// Hit test that ignores the transparent parts of each cut-out.
function hit(e) {
  setRay(e);
  const meshes = picked ? [picked.front, picked.back] : objects.flatMap((o) => [o.front]);
  for (const h of ray.intersectObjects(meshes, false)) {
    const o = h.object.userData.o;
    const i = Math.round(h.uv.x * (o.cw - 1)) + Math.round((1 - h.uv.y) * (o.ch - 1)) * o.cw;
    if (o.mask[i] > 0.5) return o;
  }
  return null;
}
function groundPoint(e) {
  setRay(e);
  return ray.ray.intersectPlane(ground, tmp) ? tmp.clone() : null;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const o = hit(e);
  down = { x: e.clientX, y: e.clientY, t: performance.now(), o, moved: false };
  if (picked) return;
  if (o) {
    dragging = o;
    o.layer = ++topLayer;
    const p = groundPoint(e);
    grab.dx = o.x - p.x; grab.dz = o.z - p.z;
    grab.lastX = p.x; grab.lastZ = p.z; grab.lastT = performance.now();
    grab.vx = grab.vz = 0;
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) down.moved = true;
  if (picked) {
    if (down) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.movementY * 0.008, e.movementX * 0.008, 0));
      picked.spin.premultiply(q);
    }
    return;
  }
  if (dragging) {
    const p = groundPoint(e);
    if (!p) return;
    const now = performance.now(), dt = Math.max(1, now - grab.lastT);
    grab.vx = THREE.MathUtils.lerp(grab.vx, (p.x - grab.lastX) / dt, 0.3);
    grab.vz = THREE.MathUtils.lerp(grab.vz, (p.z - grab.lastZ) / dt, 0.3);
    grab.lastX = p.x; grab.lastZ = p.z; grab.lastT = now;
    dragging.tx = p.x + grab.dx; dragging.tz = p.z + grab.dz;
    return;
  }
  setHover(e.pointerType === 'mouse' ? hit(e) : null, e);
});

canvas.addEventListener('pointerup', (e) => {
  const click = down && !down.moved && performance.now() - down.t < 400;
  if (picked) { if (click) putDown(); }
  else if (click && down.o) pickUp(down.o);
  if (dragging) { dragging.tiltX = dragging.tiltZ = 0; dragging = null; }
  down = null;
  canvas.style.cursor = hovered ? 'grab' : '';
});
canvas.addEventListener('pointercancel', () => { dragging = null; down = null; });
canvas.addEventListener('pointerleave', () => setHover(null));

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const d = (e.deltaY + e.deltaX) * 0.004;
  if (picked) picked.spin.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), d));
  else if (dragging || hovered) (dragging || hovered).tyaw += d;
}, { passive: false });

addEventListener('keydown', (e) => { if (e.key === 'Escape') putDown(); });

const tag = $('tag');
function setHover(o, e) {
  hovered = o;
  canvas.style.cursor = o ? 'grab' : '';
  tag.style.opacity = o ? 1 : 0;
  if (o && e) {
    tag.textContent = o.item.title;
    tag.style.left = `${e.clientX + 14}px`;
    tag.style.top = `${e.clientY + 14}px`;
  }
}

const caption = $('caption');
function pickUp(o) {
  setHover(null);
  picked = o;
  o.spin.identity();
  o.layer = ++topLayer;
  caption.innerHTML = '';
  caption.append(o.item.title);
  const small = document.createElement('small');
  small.textContent = `${Math.round(o.w)} × ${Math.round(o.h)} cm · drag to turn · click to put down`;
  caption.append(small);
  caption.style.opacity = 1;
}
function putDown() {
  if (!picked) return;
  picked = null;
  caption.style.opacity = 0;
}

// ---------- frame loop ----------
const qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), qTable = new THREE.Quaternion();
const qHeld = new THREE.Quaternion(), vHeld = new THREE.Vector3(), vTable = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  for (const k of ['cx', 'cz', 'dist']) view[k] += (viewTarget[k] - view[k]) * damp(4, dt);
  placeCamera();
  camera.updateMatrixWorld();

  settle();

  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  for (const o of objects) {
    const isDrag = o === dragging;
    o.x += (o.tx - o.x) * damp(isDrag ? 30 : 7, dt);
    o.z += (o.tz - o.z) * damp(isDrag ? 30 : 7, dt);
    o.yaw += (o.tyaw - o.yaw) * damp(9, dt);
    o.lift += ((isDrag ? 3 : 0) - o.lift) * damp(12, dt);
    o.hover += ((o === hovered ? 0.6 : 0) - o.hover) * damp(12, dt);
    o.y += (o.rest - o.y) * damp(10, dt);
    const tx = isDrag ? THREE.MathUtils.clamp(grab.vz * 6, -0.35, 0.35) : 0;
    const tz = isDrag ? THREE.MathUtils.clamp(-grab.vx * 6, -0.35, 0.35) : 0;
    o.tiltX += (tx - o.tiltX) * damp(10, dt);
    o.tiltZ += (tz - o.tiltZ) * damp(10, dt);
    o.pick += ((o === picked ? 1 : 0) - o.pick) * damp(7, dt);
    o.front.castShadow = o.back.castShadow = o.pick < 0.3;

    qYaw.setFromAxisAngle(Y, o.yaw);
    qTilt.setFromEuler(new THREE.Euler(o.tiltX, 0, o.tiltZ));
    qTable.copy(qTilt).multiply(qYaw).multiply(FLAT);
    vTable.set(o.x, o.y + o.lift + o.hover, o.z);

    if (o.pick > 0.001) {
      // Held up in front of the camera, filling most of the view.
      const fitH = o.h / (2 * vt * 0.72), fitW = o.w / (2 * vt * 0.8 * camera.aspect);
      const D = Math.max(fitH, fitW, 20);
      vHeld.set(0, 0, -D).applyMatrix4(camera.matrixWorld);
      qHeld.copy(camera.quaternion).multiply(o.spin);
      const t = o.pick * o.pick * (3 - 2 * o.pick);
      o.group.position.lerpVectors(vTable, vHeld, t);
      o.group.quaternion.slerpQuaternions(qTable, qHeld, t);
      if (o.pick > 0.5) o.spin.slerp(new THREE.Quaternion(), down ? 0 : damp(1.2, dt));
    } else {
      o.group.position.copy(vTable);
      o.group.quaternion.copy(qTable);
    }
  }

  // Veil sits just behind the held object.
  const held = objects.reduce((m, o) => (o.pick > m.pick ? o : m), objects[0]);
  veil.material.opacity = held.pick * 0.88;
  veil.visible = held.pick > 0.002;
  if (veil.visible) {
    const d = camera.position.distanceTo(held.group.position) + radius(held) + 2;
    const hgt = 2 * d * vt * 1.1;
    veil.position.set(0, 0, -d);
    veil.scale.set(hgt * camera.aspect, hgt, 1);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
