import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, '..', 'public');

const ROUTE_MARKUP = `
  <circle cx="6" cy="19" r="3"/>
  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
  <circle cx="18" cy="5" r="3"/>
`;

function iconSvg({ size, radius = 0, scale = 0.62 }) {
  const inner = size * scale;
  const offset = (size - inner) / 2;
  const iconScale = inner / 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#2563eb"/>
  <g
    fill="none"
    stroke="#ffffff"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    transform="translate(${offset} ${offset}) scale(${iconScale})"
  >
    ${ROUTE_MARKUP}
  </g>
</svg>`;
}

async function writePng(name, svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(publicDir, name), png);
  console.log(`wrote public/${name}`);
}

const targets = [
  { name: 'favicon-16x16.png', size: 16, scale: 0.7 },
  { name: 'favicon-32x32.png', size: 32, scale: 0.7 },
  { name: 'apple-touch-icon.png', size: 180, scale: 0.62 },
  { name: 'icon-192.png', size: 192, scale: 0.62 },
  { name: 'icon-512.png', size: 512, scale: 0.62 },
  { name: 'icon-maskable-192.png', size: 192, scale: 0.5 },
  { name: 'icon-maskable-512.png', size: 512, scale: 0.5 },
];

for (const target of targets) {
  await writePng(target.name, iconSvg(target));
}

console.log('app icons generated');
