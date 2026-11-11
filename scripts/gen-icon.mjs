// 生成 src-tauri/icons/icon.ico（含 16~256 多种尺寸，纯 Node 无依赖）
// 图案：绿色圆角底 + 白色钱包 + 探出的金币（¥ 符号），带抗锯齿
// 用法：node scripts/gen-icon.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

// ---------- 微型矢量渲染器（SDF + alpha 混合，天然抗锯齿） ----------

/** 圆角矩形 SDF */
function rrSdf(cx, cy, hw, hh, r) {
  return (x, y) => {
    const qx = Math.abs(x - cx) - (hw - r);
    const qy = Math.abs(y - cy) - (hh - r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  };
}

/** 圆形 SDF */
function circleSdf(cx, cy, r) {
  return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

/** 线段胶囊 SDF（描边） */
function segSdf(ax, ay, bx, by, halfW) {
  return (x, y) => {
    const vx = bx - ax, vy = by - ay;
    const wx = x - ax, wy = y - ay;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(wx - t * vx, wy - t * vy) - halfW;
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const mixC = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t), mix(c1[3] ?? 255, c2[3] ?? 255, t)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 在 size×size 画布上按顺序混合图层。
 * 图层：{ sdf: (x,y)=>距离, color: [r,g,b] 或 (x,y,u)=>[r,g,b,a?] }
 * 覆盖率按 1x1 像素内 4 采样平均，边缘平滑。
 */
function render(size, layers) {
  const px = new Array(size * size).fill([0, 0, 0, 0]);
  const u = size / 48; // 设计稿 48 网格 → 目标尺寸
  const offs = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dst = px[y * size + x];
      for (const layer of layers) {
        let cov = 0;
        for (const [ox, oy] of offs) {
          // 目标像素 → 设计稿坐标（u 像素/设计单位），SDF 距离再换算回像素
          const dx = (x + ox) / u;
          const dy = (y + oy) / u;
          cov += clamp01(0.5 - layer.sdf(dx, dy) * u);
        }
        cov /= offs.length;
        if (cov <= 0.002) continue;
        const cx = (x + 0.5) / u;
        const cy = (y + 0.5) / u;
        const src = typeof layer.color === "function" ? layer.color(cx, cy, u) : layer.color;
        dst = mixC(dst, src, cov);
      }
      px[y * size + x] = dst;
    }
  }
  return px;
}

// ---------- 配色 ----------
const BG_TOP = [74, 222, 128];      // #4ade80
const BG_BOT = [5, 150, 105];       // #059669
const BODY = [255, 255, 255, 255];
const BODY_BOT = [235, 246, 240, 255];
const FLAP = [6, 78, 59, 255];      // #064e3b
const FLAP_HI = [16, 122, 87, 255];
const COIN_RIM = [245, 158, 11, 255];  // #f59e0b
const COIN_IN = [251, 191, 36, 255];   // #fbbf24
const GLYPH = [146, 64, 14, 255];      // #92400e

// ---------- 图案图层（48 设计网格坐标） ----------
function buildLayers() {
  const layers = [];

  // 背景：绿色渐变圆角方块
  layers.push({
    sdf: rrSdf(24, 24, 24, 24, 8.6),
    color: (_x, y) => mixC(BG_TOP, BG_BOT, clamp01((y - 4) / 44)),
  });

  // 背景装饰小圆（半透明白）
  layers.push({ sdf: circleSdf(9.5, 38.5, 5), color: [255, 255, 255, 36] });
  layers.push({ sdf: circleSdf(41, 8.5, 3.6), color: [255, 255, 255, 30] });

  // 钱包主体（白色，底部微绿）
  layers.push({
    sdf: rrSdf(24, 28.5, 17, 12.5, 5.5),
    color: (_x, y) => mixC(BODY, BODY_BOT, clamp01((y - 22) / 18)),
  });

  // 钱包上翻盖（深绿，顶部圆角）
  layers.push({ sdf: rrSdf(24, 21.5, 17, 5.5, 5.5), color: FLAP });
  // 翻盖下缘高光线
  layers.push({ sdf: segSdf(13, 27.2, 35, 27.2, 0.7), color: FLAP_HI });

  // 金币：外圈深琥珀 + 内盘亮琥珀 + ¥ 符号
  layers.push({ sdf: circleSdf(34, 21, 10), color: COIN_RIM });
  layers.push({ sdf: circleSdf(34, 21, 8), color: COIN_IN });
  layers.push({ sdf: segSdf(30.6, 16.6, 34, 21, 1.15), color: GLYPH });       // 左撇
  layers.push({ sdf: segSdf(37.4, 16.6, 34, 21, 1.15), color: GLYPH });       // 右撇
  layers.push({ sdf: segSdf(30.4, 23, 37.6, 23, 0.85), color: GLYPH });       // 横 1
  layers.push({ sdf: segSdf(30.4, 25.8, 37.6, 25.8, 0.85), color: GLYPH });   // 横 2
  layers.push({ sdf: segSdf(34, 25.8, 34, 28.8, 0.95), color: GLYPH });       // 竖

  return layers;
}

// ---------- ICO 打包（32bpp BMP-in-ICO） ----------
function bmpEntry(size, canvas) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight (XOR + AND)
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  const pxBytes = size * size * 4;
  const maskRow = Math.ceil(size / 32) * 4;
  const maskBytes = maskRow * size;
  header.writeUInt32LE(pxBytes + maskBytes, 20); // biSizeImage

  const pixels = Buffer.alloc(pxBytes);
  let o = 0;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = canvas[y * size + x];
      pixels[o++] = b;
      pixels[o++] = g;
      pixels[o++] = r;
      pixels[o++] = a;
    }
  }
  const mask = Buffer.alloc(maskBytes); // alpha 通道已表达透明度，掩码全 0
  return Buffer.concat([header, pixels, mask]);
}

// ---------- PNG 编码（用于 128/256 大图标帧） ----------
// Windows Shell 的 256×256 大图标/任务栏路径不认 BMP 帧，只认 PNG 编码帧；
// 这与 Tauri 官方 `tauri icon` 生成的 ico 一致（>64 的帧用 PNG）。
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function pngEntry(size, canvas) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = canvas[y * size + x];
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a ?? 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const layers = buildLayers();
const sizes = [16, 24, 32, 48, 64, 128, 256];
const entries = sizes.map((s) => {
  const canvas = render(s, layers);
  return { size: s, data: s >= 128 ? pngEntry(s, canvas) : bmpEntry(s, canvas) };
});

const count = entries.length;
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(count, 4);

const offset = 6 + 16 * count;
const dirEntries = [];
let cur = offset;
for (const e of entries) {
  const d = Buffer.alloc(16);
  d.writeUInt8(e.size === 256 ? 0 : e.size, 0); // width（256 写 0）
  d.writeUInt8(e.size === 256 ? 0 : e.size, 1); // height
  d.writeUInt8(0, 2); // palette
  d.writeUInt8(0, 3); // reserved
  d.writeUInt16LE(1, 4); // planes
  d.writeUInt16LE(32, 6); // bpp
  d.writeUInt32LE(e.data.length, 8);
  d.writeUInt32LE(cur, 12);
  cur += e.data.length;
  dirEntries.push(d);
}

const ico = Buffer.concat([dir, ...dirEntries, ...entries.map((e) => e.data)]);
writeFileSync(join(outDir, "icon.ico"), ico);
console.log("icon.ico written:", join(outDir, "icon.ico"), ico.length, "bytes");
