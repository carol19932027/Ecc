'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function renderIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const cornerRadius = maskable ? 0 : size * 0.23;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      // Rounded-rect alpha mask for non-maskable icons
      let alpha = 255;
      if (!maskable) {
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerRadius));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerRadius));
        const distCorner = Math.hypot(dx, dy);
        if (distCorner > cornerRadius + 1) {
          alpha = 0;
        } else if (distCorner > cornerRadius - 1) {
          alpha = clampByte(255 * (1 - (distCorner - (cornerRadius - 1)) / 2));
        }
      }

      if (alpha === 0) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }

      // Deep cosmic gradient base
      let r = lerp(7, 14, ny);
      let g = lerp(11, 20, ny);
      let b = lerp(24, 46, nx * 0.6 + ny * 0.4);

      // Aurora glow 1 (cyan top-left)
      const d1 = Math.hypot(nx - 0.28, ny - 0.28);
      const glow1 = Math.exp(-d1 * d1 * 9.5);
      r += glow1 * 48;
      g += glow1 * 178;
      b += glow1 * 238;

      // Aurora glow 2 (indigo-violet bottom-right)
      const d2 = Math.hypot(nx - 0.75, ny - 0.74);
      const glow2 = Math.exp(-d2 * d2 * 8.0);
      r += glow2 * 124;
      g += glow2 * 96;
      b += glow2 * 240;

      // Outer liquid glass lens circle
      const dCenter = Math.hypot(x - cx, y - cy) / size;
      const ringDist = Math.abs(dCenter - 0.295);
      const ringGlow = Math.exp(-(ringDist * ringDist) / 0.00028);
      r = lerp(r, 140, ringGlow * 0.65);
      g = lerp(g, 232, ringGlow * 0.78);
      b = lerp(b, 255, ringGlow * 0.9);

      // Inner translucent glass core
      if (dCenter < 0.28) {
        const glassMix = 0.22 + (1 - ny) * 0.16;
        r = lerp(r, 200, glassMix * 0.55);
        g = lerp(g, 235, glassMix * 0.65);
        b = lerp(b, 255, glassMix * 0.78);

        // Specular top crescent highlight inside glass orb
        const dSpec = Math.hypot(nx - 0.44, ny - 0.36);
        const spec = Math.exp(-dSpec * dSpec * 42);
        r += spec * 110;
        g += spec * 120;
        b += spec * 130;
      }

      // Neural core glowing diamond node at center
      const dDiamond = (Math.abs(nx - 0.5) + Math.abs(ny - 0.5));
      if (dDiamond < 0.115) {
        const coreMix = Math.max(0, 1 - dDiamond / 0.115);
        r = lerp(r, 240, coreMix * 0.85);
        g = lerp(g, 250, coreMix * 0.95);
        b = lerp(b, 255, coreMix);
      }

      // Subtle glass rim around icon border
      if (!maskable) {
        const edgeDist = Math.min(x, y, size - 1 - x, size - 1 - y);
        if (edgeDist < 2.2) {
          const rim = (1 - edgeDist / 2.2) * (1 - ny * 0.5) * 0.35;
          r = lerp(r, 255, rim);
          g = lerp(g, 255, rim);
          b = lerp(b, 255, rim);
        }
      }

      rgba[idx] = clampByte(r);
      rgba[idx + 1] = clampByte(g);
      rgba[idx + 2] = clampByte(b);
      rgba[idx + 3] = alpha;
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), renderIcon(192, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), renderIcon(512, false));
fs.writeFileSync(path.join(outDir, 'icon-maskable.png'), renderIcon(512, true));
console.log('Generated PWA icons in', outDir);
