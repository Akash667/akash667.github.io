// Cut every photo in photos/ out of its background and add it to the objects table.
//
//   cd tools && npm run cutout              process new photos only
//   cd tools && npm run cutout -- --force   redo every photo
//
// Writes a trimmed transparent PNG per photo to src/objects/objects/ and keeps
// src/objects/objects.json in sync. Edits you make to objects.json (title, size)
// are preserved on later runs.
import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS = path.join(here, '..', 'photos');
const OUT = path.join(here, '..', 'src', 'objects', 'objects');
const MANIFEST = path.join(here, '..', 'src', 'objects', 'objects.json');
const MAX_SIDE = 1024; // texture size cap; keeps the page light
const ALPHA_LO = 110, ALPHA_HI = 200; // matte firming range (0-255)
const force = process.argv.includes('--force');

const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleOf = (id) => id.replace(/-/g, ' ');

await fs.mkdir(OUT, { recursive: true });
let manifest = [];
try { manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch {}
const byId = new Map(manifest.map((m) => [m.id, m]));

const photos = (await fs.readdir(PHOTOS)).filter((f) => /\.(jpe?g|png|webp|heic|avif)$/i.test(f)).sort();
for (const file of photos) {
  const id = slug(file);
  const outFile = path.join(OUT, `${id}.png`);
  const exists = await fs.stat(outFile).then(() => true, () => false);
  if (exists && !force && byId.has(id)) { console.log(`skip  ${file}`); continue; }

  process.stdout.write(`cut   ${file} … `);
  // Bake EXIF rotation in first so phone photos come out upright.
  const upright = await sharp(path.join(PHOTOS, file)).rotate().png().toBuffer();
  const blob = await removeBackground(new Blob([upright], { type: 'image/png' }), {
    model: 'medium',
    output: { format: 'image/png' },
  });
  const cut = Buffer.from(await blob.arrayBuffer());

  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  // The model leaves half-transparent ghosts (hands, shadows). Firm the matte up,
  // then keep only the biggest solid blob so stray bits fall away.
  for (let i = 0; i < N; i++) {
    const a = data[i * 4 + 3];
    data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(((a - ALPHA_LO) / (ALPHA_HI - ALPHA_LO)) * 255)));
  }
  const label = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0;
  for (let s = 0, n = 0; s < N; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] === 0) continue;
    const stack = [s]; label[s] = n; let size = 0;
    while (stack.length) {
      const p = stack.pop(); size++;
      const px = p % W, py = (p - px) / W;
      for (const q of [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, py > 0 ? p - W : -1, py < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] === -1 && data[q * 4 + 3] > 0) { label[q] = n; stack.push(q); }
      }
    }
    if (size > bestSize) { bestSize = size; best = n; }
    n++;
  }
  for (let i = 0; i < N; i++) if (label[i] !== best) data[i * 4 + 3] = 0;

  // Trim to the object's bounding box, then cap the size.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { console.log('no object found, skipped'); continue; }
  const pad = 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(info.width - 1, x1 + pad); y1 = Math.min(info.height - 1, y1 + pad);

  const outInfo = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  const prev = byId.get(id) || {};
  byId.set(id, {
    id,
    title: prev.title ?? titleOf(id),
    src: `objects/${id}.png`,
    w: outInfo.width,
    h: outInfo.height,
    size: prev.size ?? 24, // real-world longest side in cm; edit to taste
  });
  console.log(`${outInfo.width}×${outInfo.height}`);
}

const out = [...byId.values()].filter((m) => photos.some((f) => slug(f) === m.id));
await fs.writeFile(MANIFEST, JSON.stringify(out, null, 2) + '\n');
console.log(`\n${out.length} object(s) in src/objects/objects.json`);
