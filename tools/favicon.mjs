// Draws the site icon, a pixel-art node running pods like the ones on the home page,
// and writes favicon.svg, favicon.ico and apple-touch-icon.png into src/.
//
//   cd tools && npm run favicon
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

const COLORS = {
  X: '#0f0d18', // outline
  L: '#d6c6ff', // lavender frame
  n: '#2f2b45', // node body
  s: '#221f33', // empty pod slot
  G: '#7fd9a8', // Ready light
  P: '#ffc8dc', B: '#c2e2ff', Y: '#fff0a6', M: '#c3f1d6', O: '#ffd5b5', // pods
};

const ICON = [
  'XXXXXXXXXXXXXXXX',
  'XLLLLLLLLLLLLLLX',
  'XLnnnnnnnnnnnnLX',
  'XLnnnnnnnnnnGnLX',
  'XLnnnnnnnnnnnnLX',
  'XLnPPPnBBBnYYYLX',
  'XLnPPPnBBBnYYYLX',
  'XLnPPPnBBBnYYYLX',
  'XLnnnnnnnnnnnnLX',
  'XLnMMMnOOOnsssLX',
  'XLnMMMnOOOnsssLX',
  'XLnMMMnOOOnsssLX',
  'XLnnnnnnnnnnnnLX',
  'XLnnnnnnnnnnnnLX',
  'XLLLLLLLLLLLLLLX',
  'XXXXXXXXXXXXXXXX',
];

function svg(rows) {
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x + 1;
      while (row[end] === row[x]) end++;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${COLORS[row[x]]}"/>`);
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

// Nearest-neighbour scaling keeps the pixels square at every size.
const png = (source, size) => sharp(Buffer.from(source), { density: 72 * (size / 16) })
  .resize(size, size, { kernel: 'nearest' })
  .png()
  .toBuffer();

// An .ico is a small directory header followed by PNG images.
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}

const source = svg(ICON);
await fs.writeFile(path.join(OUT, 'favicon.svg'), source);
const sizes = [16, 32, 48];
await fs.writeFile(path.join(OUT, 'favicon.ico'), ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(source, size) })))));
// The touch icon gets a margin of background colour, since iOS rounds the corners.
const touch = await sharp({ create: { width: 180, height: 180, channels: 4, background: '#1c1a2b' } })
  .composite([{ input: await png(source, 144), top: 18, left: 18 }])
  .png()
  .toBuffer();
await fs.writeFile(path.join(OUT, 'apple-touch-icon.png'), touch);
console.log('wrote src/favicon.svg, src/favicon.ico, src/apple-touch-icon.png');
