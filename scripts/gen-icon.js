// Generates public/icon.ico and public/icon.png — no external dependencies
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 256, H = 256;
const px = new Uint8Array(W * H * 4); // RGBA, zeroed = transparent

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
}

function fillRect(x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x+dx, y+dy, r, g, b, a);
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx*dx + dy*dy <= radius*radius)
        setPixel(cx+dx, cy+dy, r, g, b, a);
}

// Rounded rect: fill via 3 overlapping rects + 4 corner circles
function fillRoundRect(x, y, w, h, rad, r, g, b, a = 255) {
  fillRect(x+rad, y,   w-2*rad, h,       r, g, b, a);
  fillRect(x,     y+rad, w,   h-2*rad,   r, g, b, a);
  fillCircle(x+rad,   y+rad,   rad, r, g, b, a);
  fillCircle(x+w-rad, y+rad,   rad, r, g, b, a);
  fillCircle(x+rad,   y+h-rad, rad, r, g, b, a);
  fillCircle(x+w-rad, y+h-rad, rad, r, g, b, a);
}

// ── Background ─────────────────────────────────────────────────────────────
// Dark blue-purple, matches app dark theme
fillRoundRect(8, 8, 240, 240, 40, 0x1e, 0x1e, 0x2e, 255);

// ── Curly braces ───────────────────────────────────────────────────────────
// Color: #89ddff (sky blue accent)
const [BR, BG, BB] = [0x89, 0xdd, 0xff];
const T  = 14;   // stroke thickness
const AW = 34;   // arm width
const HH = 72;   // half-height of brace
const MX = 16;   // how far middle tooth protrudes
const CY = 128;  // vertical center

// Left brace "{" — arms point right, tooth points left
const LX = 52;
fillRect(LX+MX, CY-HH,       AW-MX, T,    BR, BG, BB); // top arm
fillRect(LX+AW-T, CY-HH,     T, HH-T,     BR, BG, BB); // top vertical
fillRect(LX, CY-T/2,         AW, T,        BR, BG, BB); // middle tooth left
fillRect(LX+AW-T, CY+T,      T, HH-T,     BR, BG, BB); // bottom vertical
fillRect(LX+MX, CY+HH-T,     AW-MX, T,    BR, BG, BB); // bottom arm

// Right brace "}" — mirror
const RX = W - 52 - AW;
fillRect(RX, CY-HH,          AW-MX, T,    BR, BG, BB); // top arm
fillRect(RX, CY-HH,          T, HH-T,     BR, BG, BB); // top vertical
fillRect(RX, CY-T/2,         AW, T,        BR, BG, BB); // middle tooth right
fillRect(RX, CY+T,           T, HH-T,     BR, BG, BB); // bottom vertical
fillRect(RX, CY+HH-T,        AW-MX, T,    BR, BG, BB); // bottom arm

// ── Tree nodes — three dots in the center ──────────────────────────────────
// Color: #f78c6c (warm coral accent)
const [DR, DG, DB] = [0xf7, 0x8c, 0x6c];
const DOT = 9;
const CX  = W/2;
fillCircle(CX, CY-28, DOT, DR, DG, DB);
fillCircle(CX, CY,    DOT, DR, DG, DB);
fillCircle(CX, CY+28, DOT, DR, DG, DB);
// connector lines between dots
fillRect(CX-1, CY-28+DOT, 3, 19-DOT, DR, DG, DB);
fillRect(CX-1, CY+DOT,    3, 19-DOT, DR, DG, DB);

// ── PNG encoder ────────────────────────────────────────────────────────────
function crc32(buf) {
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    T[n] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crcBuf]);
}

function makePNG(w, h, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w*4)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const pi = (y*w + x)*4, ri = y*(1+w*4)+1+x*4;
      raw[ri]=pixels[pi]; raw[ri+1]=pixels[pi+1]; raw[ri+2]=pixels[pi+2]; raw[ri+3]=pixels[pi+3];
    }
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const pngData = makePNG(W, H, px);

// ── ICO wrapper (Vista+ supports embedded PNG) ─────────────────────────────
function makeICO(png) {
  const hdr = Buffer.alloc(6);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
  const dir = Buffer.alloc(16);
  dir[0] = 0; dir[1] = 0; // 0 = 256px
  dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(png.length, 8); dir.writeUInt32LE(22, 12);
  return Buffer.concat([hdr, dir, png]);
}

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), makeICO(pngData));
fs.writeFileSync(path.join(outDir, 'icon.png'), pngData);
console.log('✓ public/icon.ico and public/icon.png created');
