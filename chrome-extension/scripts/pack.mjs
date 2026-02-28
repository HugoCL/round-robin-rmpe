// Builds and packages the extension into a .zip ready for distribution.
// Usage: node scripts/pack.mjs

import { execSync } from "child_process";
import {
  createWriteStream,
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { createDeflateRaw } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");
const outDir = join(root, "releases");

// 1. Build
console.log("Building extension...");
execSync("npx vite build", { cwd: root, stdio: "inherit" });

// 2. Read version from manifest
const manifest = JSON.parse(
  readFileSync(join(distDir, "manifest.json"), "utf-8")
);
const version = manifest.version || "1.0.0";
const zipName = `la-lista-extension-v${version}.zip`;

// 3. Collect files
function collectFiles(dir, base = dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(collectFiles(full, base));
    } else {
      files.push({ path: relative(base, full).replace(/\\/g, "/"), full });
    }
  }
  return files;
}

const files = collectFiles(distDir);

// 4. Create zip using Node's built-in zlib (minimal zip implementation)
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const zipPath = join(outDir, zipName);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deflateSync(buf) {
  const { deflateRawSync } = await_import();
  return deflateRawSync(buf);
}

// Use synchronous zlib
import { deflateRawSync } from "zlib";

function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dateVal =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: dateVal };
}

const entries = [];
const now = new Date();
const { time: dosTime, date: dosDate } = dosDateTime(now);

for (const file of files) {
  const raw = readFileSync(file.full);
  const compressed = deflateRawSync(raw);
  const crc = crc32(raw);
  entries.push({
    name: file.path,
    raw,
    compressed,
    crc,
    rawSize: raw.length,
    compressedSize: compressed.length,
  });
}

// Build zip binary
const parts = [];
const centralDir = [];
let offset = 0;

for (const entry of entries) {
  const nameBuffer = Buffer.from(entry.name, "utf-8");

  // Local file header
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(8, 8); // compression: deflate
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(entry.crc, 14);
  localHeader.writeUInt32LE(entry.compressedSize, 18);
  localHeader.writeUInt32LE(entry.rawSize, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra field length

  parts.push(localHeader, nameBuffer, entry.compressed);

  // Central directory entry
  const centralEntry = Buffer.alloc(46);
  centralEntry.writeUInt32LE(0x02014b50, 0); // signature
  centralEntry.writeUInt16LE(20, 4); // version made by
  centralEntry.writeUInt16LE(20, 6); // version needed
  centralEntry.writeUInt16LE(0, 8); // flags
  centralEntry.writeUInt16LE(8, 10); // compression: deflate
  centralEntry.writeUInt16LE(dosTime, 12);
  centralEntry.writeUInt16LE(dosDate, 14);
  centralEntry.writeUInt32LE(entry.crc, 16);
  centralEntry.writeUInt32LE(entry.compressedSize, 20);
  centralEntry.writeUInt32LE(entry.rawSize, 24);
  centralEntry.writeUInt16LE(nameBuffer.length, 28);
  centralEntry.writeUInt16LE(0, 30); // extra field length
  centralEntry.writeUInt16LE(0, 32); // comment length
  centralEntry.writeUInt16LE(0, 34); // disk start
  centralEntry.writeUInt16LE(0, 36); // internal attrs
  centralEntry.writeUInt32LE(0, 38); // external attrs
  centralEntry.writeUInt32LE(offset, 42); // local header offset

  centralDir.push(centralEntry, nameBuffer);

  offset += localHeader.length + nameBuffer.length + entry.compressed.length;
}

const centralDirSize = centralDir.reduce((s, b) => s + b.length, 0);

// End of central directory
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); // signature
eocd.writeUInt16LE(0, 4); // disk number
eocd.writeUInt16LE(0, 6); // central dir disk
eocd.writeUInt16LE(entries.length, 8); // entries on disk
eocd.writeUInt16LE(entries.length, 10); // total entries
eocd.writeUInt32LE(centralDirSize, 12);
eocd.writeUInt32LE(offset, 16); // central dir offset
eocd.writeUInt16LE(0, 20); // comment length

const zipBuffer = Buffer.concat([...parts, ...centralDir, eocd]);

const { writeFileSync } = await import("fs");
writeFileSync(zipPath, zipBuffer);

const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);
console.log(`\n✓ Packed: releases/${zipName} (${sizeMB} MB)`);
console.log(`  ${entries.length} files`);
console.log(`\nTo install:`);
console.log(`  1. Extract the zip`);
console.log(`  2. Open chrome://extensions`);
console.log(`  3. Enable "Developer mode"`);
console.log(`  4. Click "Load unpacked" and select the extracted folder`);
