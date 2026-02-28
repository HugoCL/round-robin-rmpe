// Script to generate simple extension icons
// Run with: node scripts/generate-icons.mjs

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon and convert to data URL for reference
// For now, generate placeholder PNGs using canvas-less approach
// Users should replace these with proper icons

function createSVGIcon(size) {
  const padding = Math.round(size * 0.1);
  const fontSize = Math.round(size * 0.55);
  const radius = Math.round(size * 0.2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}" rx="${radius}" fill="#6d28d9"/>
  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">L</text>
</svg>`;
}

// Write SVG icons (Chrome supports SVG in manifest v3)
for (const size of [16, 48, 128]) {
  const svg = createSVGIcon(size);
  writeFileSync(join(iconsDir, `icon-${size}.svg`), svg);
  console.log(`Created icon-${size}.svg`);
}

console.log(
  "\nNote: Update manifest.json to use .svg extensions, or convert these to .png"
);
