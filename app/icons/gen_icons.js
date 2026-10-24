// Generate PWA icons (pure Node, no deps): icon-192, icon-512, maskable-512
// Run:  node gen_icons.js
const zlib = require("zlib"), fs = require("fs"), path = require("path");

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) { raw[o++] = 0;
    for (let x = 0; x < size; x++) { const [r, g, b, a] = pixel(x, y, size); raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a; } }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const G_TOP = hex("#B4501F"), G_BOT = hex("#933E17"), LEAF = hex("#F6F1E6"), LIGHT = hex("#E1A036");
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function draw(x, y, s, maskable) {
  const cx = x / s - .5, cy = y / s - .5;                 // centered -0.5..0.5
  const grad = lerp(G_TOP, G_BOT, y / s);                  // vertical gradient bg
  const rLeaf = maskable ? .21 : .26, rIn = maskable ? .13 : .16;
  const dMain = Math.hypot(cx + .05, cy - .02), dIn = Math.hypot(cx - .09, cy + .07);
  if (dMain < rLeaf && dIn >= rIn) return [...LEAF, 255];  // leaf disc with notch cut
  if (dMain < rLeaf && dIn < rIn && cx - .09 < -.02) return [...LEAF, 255];
  if (Math.hypot(cx + .16, cy - .13) < (maskable ? .028 : .035)) return [...LIGHT, 255]; // shine dot
  return [...grad, 255];
}
for (const [name, size, maskable] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true]]) {
  fs.writeFileSync(path.join(__dirname, name), png(size, (x, y) => draw(x, y, size, maskable)));
  console.log("wrote", name);
}
