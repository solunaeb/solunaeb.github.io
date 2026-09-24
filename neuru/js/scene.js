// 방 그리기 — 384×216 저해상도 캔버스에 픽셀 단위로 그린 뒤 CSS 로 확대
import { DISC } from './sprites.js';

export const W = 384, H = 216;

export const PAL = {
  wall: '#4d5c50', wallDk: '#435146', wallLt: '#566657',
  wood: '#6d3f22', woodDk: '#4f2b16', woodLt: '#8b5731', woodHi: '#a36a3c',
  wain: '#673a20', wainDk: '#57301a', wainLt: '#7b4829',
  floor: '#5a3520', floorDk: '#472916', floorLt: '#6a4127',
  sofa: '#992c22', sofaDk: '#71201a', sofaLt: '#b63e2e', sofaTuft: '#5f1a14',
  blanket: '#d9c6a1', blanketDk: '#b39d78', blanketSt: '#8d7657',
  pillow: '#c9a576', pillowDk: '#a7865a', pillowG: '#9aa4aa', pillowGDk: '#7a848b',
  rug: '#556446', rugDk: '#44523a', rugBorder: '#8b3a2b', rugPat: '#c8a064',
  metal: '#3a3b41', metalLt: '#5b5d66',
  brick: '#7c3726', brickLt: '#924430', mortar: '#55251a',
  shade: '#f1dfae', shadeOff: '#bfb391', glow: '255,214,140',
  plant: '#3e7a3a', plantLt: '#5d9c49', plantDk: '#2c5a2b', pot: '#a2552f', potDk: '#7e3f22',
  paper: '#efe6cf', ink: '#2b2622',
};

const BOOK_COLORS = ['#7b2e2a', '#2f5a6c', '#3f6b3a', '#b0883a', '#5a3a6c', '#2a3f6b', '#8a4a2a', '#a33d2f', '#3d5f5a', '#6b5a2a', '#c2b28a'];

// ── 기본 도구 ──
export function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function dither(g, x, y, w, h, c, ph = 0) {
  g.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = (j + ph) & 1; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
}
export function ell(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}
export function drawRows(g, rows, pal, x, y, flip = false) {
  const w = rows[0].length;
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const c = pal[r[i]];
      if (!c) continue;
      g.fillStyle = c; g.fillRect(x + (flip ? w - 1 - i : i), y + j, 1, 1);
    }
  }
}
function canvas(w = W, h = H) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return [c, g];
}

// ── 창문 영역 ──
export const WIN = { x: 138, y: 12, w: 152, h: 118 }; // 유리 전체 (창살 포함)
const PANES = [
  [138, 12, 26, 26], [168, 12, 92, 26], [264, 12, 26, 26],
  [138, 44, 26, 86], [168, 44, 92, 86], [264, 44, 26, 86],
];

// ── 시간대 ──
export function timeOfDay(hourFrac) {
  if (hourFrac < 5.5 || hourFrac >= 19.5) return 'night';
  if (hourFrac < 7.5) return 'dawn';
  if (hourFrac < 17.3) return 'day';
  return 'dusk';
}

const SKY = {
  night: ['#1c2347', '#27305a', '#343a68', '#4a4272'],
  dawn: ['#3d4d82', '#7d6f9c', '#d59a8c', '#f2c28a'],
  day: ['#4f8fd0', '#6aa6dc', '#8cbde6', '#b6d6ef'],
  dusk: ['#3a3f78', '#7a5487', '#cc6f6a', '#f0a15e'],
};
const SKY_GREY = {
  night: ['#1e2230', '#262b3a', '#2e3444', '#363c4c'],
  dawn: ['#5b6272', '#6c7282', '#7f8491', '#9296a1'],
  day: ['#8a94a3', '#98a2b0', '#a8b1bd', '#b8c0ca'],
  dusk: ['#4c4a5c', '#5e5868', '#766a74', '#8a7a7c'],
};

// 창밖 풍경 (시간대·날씨마다 한 번만 그려 캐시)
const viewCache = new Map();
export function getView(tod, weather) {
  const key = tod + '|' + weather;
  if (viewCache.has(key)) return viewCache.get(key);
  const [c, g] = canvas();
  const grey = weather !== 'clear';
  const sky = (grey ? SKY_GREY : SKY)[tod];
  const { x, y, w, h } = WIN;
  // 하늘: 4단 띠 + 경계 디더
  const band = Math.ceil(80 / 4);
  sky.forEach((col, i) => R(g, x, y + i * band, w, band + 40, col));
  sky.forEach((col, i) => { if (i) dither(g, x, y + i * band - 2, w, 2, col, i); });
  const rnd = mulberry(7);
  const night = tod === 'night';
  if (night && !grey) for (let i = 0; i < 40; i++) R(g, x + rnd() * w, y + rnd() * 50, 1, 1, rnd() < 0.3 ? '#fff6d8' : '#aab4e0');
  // 해 / 달
  if (!grey) {
    if (night) { ell(g, 270, 26, 6, 6, '#f3edd2'); ell(g, 273, 24, 5, 5, sky[0]); }
    else if (tod === 'day') { ell(g, 262, 26, 7, 7, '#fff3c4'); ell(g, 262, 26, 5, 5, '#ffe58a'); }
    else ell(g, 252, 74, 8, 8, tod === 'dawn' ? '#ffd9a0' : '#ffb070');
  }
  // 구름
  if (grey) {
    const cc = night ? '#3a4050' : tod === 'day' ? '#c9ced6' : '#8a8a96';
    const cd = night ? '#2c3140' : tod === 'day' ? '#a9b0bb' : '#6e6e7c';
    for (let i = 0; i < 7; i++) {
      const cx = x + 10 + rnd() * (w - 20), cy = y + 8 + rnd() * 34;
      ell(g, cx, cy + 2, 14 + rnd() * 8, 4, cd); ell(g, cx, cy, 12 + rnd() * 6, 4, cc); ell(g, cx + 6, cy - 3, 6, 3, cc);
    }
  } else if (tod !== 'night') {
    for (let i = 0; i < 3; i++) { const cx = x + 20 + rnd() * 110, cy = y + 10 + rnd() * 30; ell(g, cx, cy, 10, 2, '#ffffffaa'); ell(g, cx + 4, cy - 2, 5, 2, '#ffffffaa'); }
  }
  // 먼 산
  const mt = night ? '#303a5c' : tod === 'day' ? '#6f8fa6' : '#6a5f80';
  const mt2 = night ? '#2a3350' : tod === 'day' ? '#5f7f8f' : '#5a5070';
  for (let i = x; i < x + w; i++) {
    const t = (i - x) / w;
    const hgt = 18 + Math.sin(t * 6 + 1) * 6 + Math.sin(t * 17) * 2 + (t > 0.45 && t < 0.8 ? 10 * Math.sin((t - 0.45) / 0.35 * Math.PI) : 0);
    R(g, i, y + 88 - hgt, 1, hgt + 4, mt);
    R(g, i, y + 94 - hgt * 0.6, 1, hgt, mt2);
  }
  // 숲 (오른쪽)
  const tr = night ? '#1f3a2c' : tod === 'day' ? '#3f7a44' : '#34583c';
  const tr2 = night ? '#284a36' : tod === 'day' ? '#4f9450' : '#3f6a45';
  for (let i = 0; i < 70; i++) {
    const tx = x + 58 + rnd() * (w - 58), ty = y + 80 + rnd() * 34;
    ell(g, tx, ty, 3 + rnd() * 3, 3 + rnd() * 2, rnd() < 0.5 ? tr : tr2);
  }
  R(g, x + 60, y + 100, w - 60, 20, tr);
  // 강
  const rv = night ? '#3a5f9a' : tod === 'day' ? '#6aa8e0' : '#b98a9a';
  const rvHi = night ? '#6f94cc' : tod === 'day' ? '#a8d4f4' : '#e6b6a6';
  for (let s = 0; s < 1; s += 0.01) {
    const rx = x + 70 + s * (w - 70) + Math.sin(s * 9) * 6;
    const ry = y + 116 - s * 26 + Math.sin(s * 7) * 3;
    const rw = 8 - s * 5;
    R(g, rx, ry, rw, 2, rv);
    if (s * 100 % 7 < 1) R(g, rx + 1, ry, 2, 1, rvHi);
  }
  // 도시 (왼쪽)
  const bd = night ? ['#1d2440', '#232b4c', '#2a3358'] : tod === 'day' ? ['#6b7a90', '#7d8ca2', '#5d6b80'] : ['#4a4466', '#564e72', '#3f3a5a'];
  const lit = night ? ['#f2d27a', '#e8b95a', '#fff0b0'] : tod === 'dusk' || tod === 'dawn' ? ['#e8c07a', '#d9a060'] : ['#9fb4c8', '#b7c8d8'];
  const litChance = night ? 0.45 : tod === 'day' ? 0.25 : 0.3;
  let bx = x - 2;
  const brnd = mulberry(21);
  while (bx < x + 82) {
    const bw = 8 + Math.floor(brnd() * 10);
    const bh = 30 + Math.floor(brnd() * 50) * (bx < x + 60 ? 1 : 0.5);
    const top = y + h - bh - 6;
    const col = bd[Math.floor(brnd() * bd.length)];
    R(g, bx, top, bw, bh + 6, col);
    if (brnd() < 0.3) { R(g, bx + bw / 2 - 1, top - 8, 2, 8, col); if (night) R(g, bx + bw / 2 - 1, top - 9, 1, 1, '#ff6a5a'); }
    for (let wy = top + 3; wy < y + h - 4; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) if (brnd() < litChance) R(g, wx, wy, 1, 2, lit[Math.floor(brnd() * lit.length)]);
    bx += bw + (brnd() < 0.3 ? 2 : 0);
  }
  // 앞쪽 지붕들
  const roof = night ? '#161b30' : tod === 'day' ? '#4f5a6a' : '#352f48';
  for (let i = x; i < x + w; i += 12) { const rh = 4 + ((i * 7) % 5); R(g, i, y + h - rh, 12, rh, roof); }
  // 안개
  if (weather === 'fog') for (let j = 0; j < h; j += 1) { g.fillStyle = `rgba(200,205,215,${0.15 + j / h * 0.35})`; g.fillRect(x, y + j, w, 1); }
  viewCache.set(key, c);
  return c;
}

// ── 정적인 방 (가구 포함) ──
let bgCanvas = null;
export function getBackground() {
  if (bgCanvas) return bgCanvas;
  const [c, g] = canvas();
  const rnd = mulberry(1119);

  // 윗벽 (세로 줄무늬 벽지)
  R(g, 0, 0, W, 88, PAL.wall);
  for (let x = 0; x < W; x += 12) { R(g, x, 0, 1, 88, PAL.wallDk); for (let y = 6; y < 84; y += 12) R(g, x + 6, y, 1, 1, PAL.wallLt); }
  R(g, 0, 0, W, 3, PAL.woodDk); R(g, 0, 3, W, 1, PAL.woodLt);
  // 굽도리 판재
  R(g, 0, 84, W, 2, PAL.woodHi); R(g, 0, 86, W, 3, PAL.wood); R(g, 0, 89, W, 1, PAL.woodDk);
  R(g, 0, 90, W, 68, PAL.wain);
  for (let x = 4; x < W; x += 34) {
    R(g, x, 95, 28, 56, PAL.wainDk); R(g, x + 1, 96, 26, 54, PAL.wain);
    R(g, x, 95, 28, 1, PAL.woodDk); R(g, x, 95, 1, 56, PAL.woodDk);
    R(g, x, 150, 28, 1, PAL.wainLt); R(g, x + 27, 95, 1, 56, PAL.wainLt);
    R(g, x + 4, 100, 1, 46, PAL.wainLt);
  }
  R(g, 0, 156, W, 1, PAL.woodHi); R(g, 0, 157, W, 7, PAL.woodDk);
  // 바닥 판자
  for (let y = 164, row = 0; y < H; y += 6, row++) {
    R(g, 0, y, W, 6, row % 2 ? PAL.floor : PAL.floorLt);
    R(g, 0, y + 5, W, 1, PAL.floorDk);
    for (let x = (row * 23) % 40; x < W; x += 40 + (row % 3) * 7) R(g, x, y, 1, 5, PAL.floorDk);
  }
  // 바닥 그림자 (벽쪽)
  dither(g, 0, 164, W, 2, 'rgba(0,0,0,0.35)');

  drawWindow(g);
  drawPicture(g);
  drawShelf(g, 0, 0, 30, 216, rnd, 'left');
  drawShelf(g, 356, 0, 28, 146, rnd, 'right');
  drawFireplaceFrame(g);
  drawRug(g);
  // 창턱 작은 화분 (소파 뒤)
  R(g, 144, 124, 10, 7, PAL.potDk); R(g, 145, 124, 8, 6, PAL.pot);
  leaves(g, 149, 123, 9, 5);
  drawSofa(g);
  drawDesk(g);
  drawChair(g);
  drawPlants(g);
  bgCanvas = c;
  return c;
}

function drawWindow(g) {
  // 장식 상단
  R(g, 170, 1, 88, 6, PAL.woodDk); R(g, 176, 0, 76, 2, PAL.wood);
  ell(g, 214, 4, 5, 2, PAL.woodLt); R(g, 196, 3, 10, 1, PAL.woodHi); R(g, 222, 3, 10, 1, PAL.woodHi);
  // 틀
  R(g, 132, 6, 164, 128, PAL.woodDk);
  R(g, 134, 8, 160, 124, PAL.wood);
  R(g, 134, 8, 160, 1, PAL.woodHi);
  // 유리 비우기
  PANES.forEach(([x, y, w, h]) => g.clearRect(x, y, w, h));
  // 바깥 두 칸 위쪽 아치 모서리
  for (let i = 0; i < 8; i++) {
    const k = Math.round(8 - Math.sqrt(64 - (8 - i) * (8 - i)));
    R(g, 138, 12 + i, k, 1, PAL.wood);
    R(g, 290 - k, 12 + i, k, 1, PAL.wood);
  }
  // 창살 그림자
  PANES.forEach(([x, y, w]) => R(g, x, y, w, 1, 'rgba(0,0,0,0.25)'));
  // 창턱
  R(g, 128, 130, 172, 5, PAL.woodLt); R(g, 128, 130, 172, 1, PAL.woodHi); R(g, 130, 135, 168, 2, PAL.woodDk);
}

function drawPicture(g) {
  R(g, 70, 42, 34, 26, PAL.woodDk); R(g, 71, 43, 32, 24, '#b88a4a'); R(g, 73, 45, 28, 20, PAL.woodDk);
  R(g, 74, 46, 26, 18, '#8fb0c0'); R(g, 74, 56, 26, 8, '#5f8a5a');
  ell(g, 82, 57, 7, 4, '#4a6f5a'); ell(g, 93, 58, 6, 3, '#56805e'); ell(g, 94, 50, 2, 2, '#f4e2a0');
  R(g, 86, 38, 2, 4, PAL.metal);
}

function drawShelf(g, x, y, w, h, rnd, side) {
  R(g, x, y, w, h, PAL.woodDk);
  R(g, x + 2, y, w - 4, h, '#3a2012');
  const step = 29;
  for (let sy = y + 4; sy < y + h - 4; sy += step) {
    // 책
    let bx = x + 3;
    while (bx < x + w - 4) {
      const bw = 2 + Math.floor(rnd() * 3);
      if (bx + bw > x + w - 3) break;
      const bh = 15 + Math.floor(rnd() * 9);
      const col = BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)];
      const lean = rnd() < 0.08;
      R(g, bx, sy + step - 4 - bh, bw, bh, col);
      R(g, bx, sy + step - 4 - bh, 1, bh, 'rgba(255,255,255,0.12)');
      R(g, bx, sy + step - 4 - bh + 3, bw, 1, 'rgba(255,230,160,0.35)');
      if (lean) bx += 2;
      bx += bw;
    }
    R(g, x, sy + step - 4, w, 3, PAL.woodLt); R(g, x, sy + step - 4, w, 1, PAL.woodHi);
  }
  R(g, side === 'left' ? x + w - 2 : x, y, 2, h, PAL.wood);
}

function drawFireplaceFrame(g) {
  const x = 334, y = 144;
  R(g, x - 4, y, 54, 5, PAL.woodDk); R(g, x - 4, y, 54, 1, PAL.woodLt); // 선반
  R(g, x, y + 5, 50, H - y - 5, PAL.brick);
  for (let by = y + 5, r = 0; by < H; by += 4, r++) {
    R(g, x, by + 3, 50, 1, PAL.mortar);
    for (let bx = x + (r % 2 ? 0 : 5); bx < x + 50; bx += 10) R(g, bx, by, 1, 3, PAL.mortar);
    if (r % 3 === 0) R(g, x + ((r * 13) % 40), by, 6, 1, PAL.brickLt);
  }
  // 아치 입구
  const ox = 343, ow = 32, oy = 166, oh = 46;
  for (let j = 0; j < oh; j++) {
    const arch = j < 10 ? Math.round(10 - Math.sqrt(100 - (10 - j) * (10 - j))) : 0;
    R(g, ox + arch - 2, oy + j, ow - arch * 2 + 4, 1, PAL.brickLt);
    R(g, ox + arch, oy + j, ow - arch * 2, 1, '#1a0d08');
  }
  R(g, x - 2, H - 4, 54, 4, '#5e5a58'); R(g, x - 2, H - 4, 54, 1, '#7a7674'); // 난로 바닥돌
}

function drawRug(g) {
  // 원근감 있는 사다리꼴
  for (let j = 0; j < 24; j++) {
    const y = 190 + j, inset = Math.round((24 - j) * 0.9);
    const x0 = 110 + inset, x1 = 304 - inset;
    R(g, x0, y, x1 - x0, 1, j < 2 || j > 21 ? PAL.rugBorder : PAL.rug);
    R(g, x0, y, 3, 1, PAL.rugBorder); R(g, x1 - 3, y, 3, 1, PAL.rugBorder);
    if (j > 3 && j < 20 && j % 4 === 2) for (let x = x0 + 8; x < x1 - 8; x += 9) R(g, x + (j % 8 ? 0 : 4), y, 3, 1, PAL.rugPat);
    if (j === 3 || j === 20) R(g, x0 + 4, y, x1 - x0 - 8, 1, PAL.rugPat);
  }
  for (let x = 90; x < 330; x += 3) R(g, x, 214, 1, 2, '#c8b890');
}

function drawSofa(g) {
  const x = 44, w = 142;
  // 등받이
  R(g, x + 10, 116, w - 20, 36, PAL.sofaDk);
  R(g, x + 11, 117, w - 22, 34, PAL.sofa);
  R(g, x + 11, 117, w - 22, 2, PAL.sofaLt);
  for (let ty = 123, r = 0; ty < 148; ty += 7, r++) for (let tx = x + 18 + (r % 2) * 7; tx < x + w - 16; tx += 14) {
    R(g, tx, ty, 1, 1, PAL.sofaTuft);
    R(g, tx - 3, ty + 3, 3, 1, 'rgba(0,0,0,0.15)'); R(g, tx + 1, ty + 3, 3, 1, 'rgba(255,255,255,0.06)');
  }
  // 방석
  R(g, x + 12, 150, w - 24, 22, PAL.sofaDk);
  R(g, x + 13, 150, 57, 14, PAL.sofa); R(g, x + 72, 150, 57, 14, PAL.sofa);
  R(g, x + 13, 150, 57, 1, PAL.sofaLt); R(g, x + 72, 150, 57, 1, PAL.sofaLt);
  // 앞판
  R(g, x + 8, 164, w - 16, 26, PAL.sofaDk); R(g, x + 9, 165, w - 18, 22, PAL.sofa);
  R(g, x + 9, 165, w - 18, 1, PAL.sofaLt);
  for (let fx = x + 12; fx < x + w - 12; fx += 3) R(g, fx, 186, 1, 4, '#5f1a14');
  // 팔걸이
  for (const ax of [x, x + w - 16]) {
    R(g, ax, 128, 16, 62, PAL.sofaDk);
    R(g, ax + 1, 129, 14, 60, PAL.sofa);
    ell(g, ax + 8, 131, 8, 4, PAL.sofaLt); ell(g, ax + 8, 132, 7, 3, PAL.sofa);
    R(g, ax + 1, 136, 2, 50, PAL.sofaLt);
  }
  // 다리
  for (const lx of [x + 4, x + w - 10]) R(g, lx, 190, 6, 6, PAL.woodDk);
  // 쿠션
  R(g, 150, 132, 20, 18, PAL.pillowDk); R(g, 151, 132, 18, 16, PAL.pillow);
  for (let i = 0; i < 6; i++) R(g, 153 + i * 3, 136 + (i % 2) * 4, 2, 1, PAL.pillowDk);
  R(g, 134, 136, 16, 15, PAL.pillowGDk); R(g, 135, 136, 14, 13, PAL.pillowG);
  // 바닥 그림자
  dither(g, x + 2, 196, w - 4, 2, 'rgba(0,0,0,0.4)');
}

function drawDesk(g) {
  const x = 196, w = 138;
  R(g, x, 131, w, 2, PAL.woodHi); R(g, x, 133, w, 4, PAL.woodLt); R(g, x, 137, w, 4, PAL.wood); R(g, x, 141, w, 1, PAL.woodDk);
  // 왼쪽 판
  R(g, x + 2, 142, 7, 56, PAL.wood); R(g, x + 2, 142, 1, 56, PAL.woodLt); R(g, x + 8, 142, 1, 56, PAL.woodDk);
  // 가운데 빈 공간
  R(g, x + 9, 142, w - 49, 20, '#2a160b');
  // 오른쪽 서랍장
  R(g, x + w - 40, 142, 38, 56, PAL.wood);
  R(g, x + w - 40, 142, 1, 56, PAL.woodLt);
  for (let i = 0; i < 3; i++) {
    const dy = 145 + i * 17;
    R(g, x + w - 37, dy, 32, 14, PAL.woodDk); R(g, x + w - 36, dy + 1, 30, 12, PAL.wood);
    R(g, x + w - 36, dy + 1, 30, 1, PAL.woodLt);
    R(g, x + w - 24, dy + 6, 6, 2, '#c9a24a');
  }
  dither(g, x, 198, w, 2, 'rgba(0,0,0,0.4)');

  // 편지 보관 상자
  R(g, 252, 121, 17, 11, PAL.woodDk); R(g, 253, 122, 15, 9, '#9a6034');
  R(g, 252, 119, 17, 3, PAL.woodLt); R(g, 252, 119, 17, 1, PAL.woodHi);
  R(g, 255, 117, 10, 2, PAL.paper);
  R(g, 258, 125, 1, 1, '#d24a5a'); R(g, 260, 125, 1, 1, '#d24a5a'); R(g, 257, 126, 5, 1, '#d24a5a'); R(g, 258, 127, 3, 1, '#d24a5a'); R(g, 259, 128, 1, 1, '#d24a5a');
}

// 의자 (앞모습, 방 쪽으로 돌려 둠)
function drawChair(g) {
  const cx = 244;
  R(g, cx - 14, 139, 28, 26, PAL.woodDk); R(g, cx - 13, 140, 26, 24, '#6f4528');
  R(g, cx - 11, 142, 22, 20, '#825534'); R(g, cx - 11, 142, 22, 1, '#9a6a44');
  for (let i = 0; i < 3; i++) R(g, cx - 8 + i * 8, 146, 1, 12, '#6f4528');
  // 팔걸이
  R(g, cx - 18, 156, 5, 3, PAL.woodDk); R(g, cx + 13, 156, 5, 3, PAL.woodDk);
  R(g, cx - 17, 159, 2, 8, PAL.metal); R(g, cx + 15, 159, 2, 8, PAL.metal);
  // 좌석
  R(g, cx - 16, 164, 32, 6, PAL.woodDk); R(g, cx - 15, 164, 30, 4, '#8a5a36'); R(g, cx - 15, 164, 30, 1, '#a8764c');
  // 다리
  R(g, cx - 1, 170, 3, 16, PAL.metal); R(g, cx, 170, 1, 16, PAL.metalLt);
  R(g, cx - 14, 186, 30, 2, PAL.metal);
  for (const wx of [cx - 15, cx - 2, cx + 13]) R(g, wx, 188, 4, 3, '#1c1c20');
  dither(g, cx - 16, 191, 32, 1, 'rgba(0,0,0,0.4)');
}

function drawPlants(g) {
  // 왼쪽 바닥 화분
  R(g, 6, 196, 16, 14, PAL.potDk); R(g, 7, 196, 14, 12, PAL.pot); R(g, 5, 194, 18, 3, PAL.potDk);
  leaves(g, 14, 194, 18, 11);
  // 매달린 화분
  R(g, 342, 3, 1, 22, '#8a7a5a'); R(g, 352, 3, 1, 22, '#8a7a5a');
  R(g, 340, 24, 15, 9, PAL.potDk); R(g, 341, 24, 13, 7, PAL.pot);
  leaves(g, 347, 24, 10, 7);
  for (let i = 0; i < 4; i++) { const vx = 340 + i * 5; for (let vy = 32; vy < 44 + i * 9; vy += 3) R(g, vx + ((vy / 3) % 2), vy, 2, 2, vy % 2 ? PAL.plant : PAL.plantLt); }
}
function leaves(g, cx, by, spread, n) {
  const rnd = mulberry(cx * 31 + by);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, len = spread * (0.5 + rnd() * 0.6);
    for (let s = 0; s < len; s++) {
      const px = cx + Math.cos(a) * s, py = by + Math.sin(a) * s * 0.9;
      R(g, px, py, s > len * 0.3 && s < len * 0.8 ? 3 : 2, 2, s > len * 0.6 ? PAL.plantLt : i % 2 ? PAL.plant : PAL.plantDk);
    }
  }
}

// ─────────── 움직이는 요소들 ───────────

export function drawLamps(g, s, t) {
  // 스탠드
  const onF = s.lampFloor;
  R(g, 37, 84, 2, 86, '#b08a4a'); R(g, 38, 84, 1, 86, '#d4b070');
  ell(g, 38, 171, 7, 2, '#8a6a3a');
  for (let j = 0; j < 22; j++) { const hw = 7 + Math.round(j * 0.4); R(g, 38 - hw, 62 + j, hw * 2, 1, onF ? (j % 5 ? PAL.shade : '#e3cc94') : (j % 5 ? PAL.shadeOff : '#a99d7c')); }
  R(g, 28, 84, 20, 1, '#c8b07a');
  R(g, 44, 86, 1, 8, '#8a6a3a'); R(g, 43, 94, 3, 2, '#c9a24a');
  // 벽등
  const onW = s.lampWall;
  R(g, 322, 50, 5, 10, '#a37a3a'); ell(g, 324, 60, 3, 2, '#b88a44'); R(g, 321, 46, 7, 4, '#c9a24a');
  for (let j = 0; j < 12; j++) { const hw = 4 + Math.round(j * 0.35); R(g, 324 - hw, 34 + j, hw * 2 + 1, 1, onW ? PAL.shade : PAL.shadeOff); }
}

export function drawGlows(g, s, tod, fireOn, t) {
  const add = (x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${PAL.glow},${a})`); gr.addColorStop(1, `rgba(${PAL.glow},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const strength = tod === 'night' ? 1 : tod === 'day' ? 0.35 : 0.7;
  g.save(); g.globalCompositeOperation = 'lighter';
  if (s.lampFloor) { add(38, 74, 40, 0.22 * strength); add(38, 110, 60, 0.08 * strength); }
  if (s.lampWall) add(324, 40, 34, 0.25 * strength);
  if (fireOn) {
    const f = 0.85 + Math.sin(t / 90) * 0.08 + Math.sin(t / 37) * 0.05;
    g.fillStyle = `rgba(255,140,60,${0.14 * f * (0.6 + strength * 0.4)})`;
    const gr = g.createRadialGradient(358, 196, 0, 358, 196, 90);
    gr.addColorStop(0, `rgba(255,150,70,${0.3 * f})`); gr.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = gr; g.fillRect(268, 106, 180, 180);
  }
  g.restore();
}

// 밤이면 방 전체를 어둡게 (조명 개수에 따라)
export function drawShade(g, s, tod, fireOn) {
  let a = { night: 0.3, dusk: 0.16, dawn: 0.14, day: 0 }[tod];
  if (!s.lampFloor) a += 0.08;
  if (!s.lampWall) a += 0.05;
  if (!fireOn) a += 0.03;
  if (a <= 0) return;
  g.fillStyle = `rgba(12,10,32,${Math.min(0.5, a)})`;
  g.fillRect(0, 0, W, H);
}

// 벽난로 불
export function drawFire(g, on, t) {
  const bx = 359, by = 208;
  // 장작
  R(g, 347, 206, 24, 4, '#5a3620'); R(g, 347, 206, 24, 1, '#7a4a2c'); R(g, 350, 203, 20, 4, '#6a4028'); ell(g, 347, 208, 2, 2, '#c9965a'); ell(g, 370, 205, 2, 2, '#c9965a');
  // 받침
  for (let i = 0; i < 6; i++) R(g, 346 + i * 5, 210, 1, 4, '#2a2a2e');
  R(g, 345, 210, 28, 1, '#3a3a40');
  if (!on) {
    // 잔불
    for (let i = 0; i < 5; i++) { const fl = Math.sin(t / 400 + i * 2) > 0.3; R(g, 351 + i * 4, 205, 2, 1, fl ? '#c9401a' : '#7a2a14'); }
    return;
  }
  const layers = [['#e2471b', 12, 26], ['#ff9d2e', 9, 20], ['#ffd35a', 5, 12]];
  layers.forEach(([col, hw, hh], li) => {
    g.fillStyle = col;
    for (let x = -hw; x <= hw; x++) {
      const k = 1 - Math.abs(x) / (hw + 1);
      const wob = Math.sin(t / 110 + x * 0.9 + li) * 2 + Math.sin(t / 53 + x * 1.7) * 1.5;
      const hgt = Math.max(1, Math.round(hh * k * k + wob * k));
      g.fillRect(bx + x, by - 3 - hgt, 1, hgt);
    }
  });
  // 불씨
  for (let i = 0; i < 4; i++) {
    const p = ((t / 900 + i * 0.25) % 1);
    R(g, bx - 6 + ((i * 7 + Math.floor(t / 300)) % 12), by - 10 - p * 34, 1, 1, p < 0.6 ? '#ffd35a' : '#e2471b');
  }
}

// 타자기
export function drawTypewriter(g, alert, t) {
  const x = 222, y = 112;
  R(g, x + 6, y - 9, 16, 11, PAL.paper); R(g, x + 8, y - 6, 10, 1, '#b8ad96'); R(g, x + 8, y - 3, 12, 1, '#b8ad96');
  R(g, x, y, 28, 4, '#3a3d3c'); R(g, x - 2, y + 1, 2, 2, '#9a9e9c'); R(g, x + 28, y + 1, 3, 1, '#9a9e9c');
  R(g, x + 1, y + 4, 26, 6, '#5b605e'); R(g, x + 1, y + 4, 26, 1, '#7a807e');
  R(g, x + 9, y + 5, 10, 3, '#2a2c2c');
  R(g, x - 1, y + 10, 30, 10, '#4c504f'); R(g, x - 1, y + 10, 30, 1, '#6d7270');
  for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) R(g, x + 2 + k * 3 + (r % 2), y + 12 + r * 2, 2, 1, '#e6e0d0');
  R(g, x + 6, y + 18, 16, 1, '#e6e0d0');
  if (alert) drawBubble(g, x + 14, y - 22 + Math.round(Math.sin(t / 250) * 2), '!');
}

export function drawBubble(g, cx, cy, kind) {
  R(g, cx - 5, cy - 6, 11, 11, '#2b2622'); R(g, cx - 4, cy - 5, 9, 9, '#fff6dc');
  R(g, cx - 1, cy + 5, 3, 1, '#2b2622'); R(g, cx, cy + 6, 1, 1, '#2b2622');
  if (kind === '!') { R(g, cx, cy - 3, 1, 4, '#d8402e'); R(g, cx, cy + 2, 1, 1, '#d8402e'); }
  else if (kind === 'note') { R(g, cx + 1, cy - 3, 1, 5, '#2b2622'); R(g, cx - 1, cy + 1, 2, 2, '#2b2622'); R(g, cx + 2, cy - 3, 2, 1, '#2b2622'); }
}

// 팩스
export function drawFax(g, printing, t) {
  const x = 271, y = 115;
  R(g, x, y + 4, 28, 13, '#c9c2b2'); R(g, x, y + 4, 28, 1, '#e4ddcc'); R(g, x, y + 16, 28, 1, '#8f897b');
  R(g, x + 4, y - 2, 20, 7, '#b5ae9e'); // 급지대
  const paperH = printing ? 6 + Math.floor((t / 120) % 6) : 7;
  R(g, x + 7, y - 2 - paperH + 7, 14, paperH, PAL.paper);
  R(g, x + 9, y - paperH + 7, 8, 1, '#b8ad96');
  R(g, x + 2, y + 6, 8, 3, '#3a4e44'); R(g, x + 3, y + 7, 6, 1, '#7fd6a0');
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) R(g, x + 13 + k * 3, y + 7 + r * 3, 2, 2, '#7a7466');
  R(g, x - 4, y + 5, 5, 10, '#b5ae9e'); R(g, x - 4, y + 5, 5, 2, '#8f897b'); R(g, x - 4, y + 13, 5, 2, '#8f897b');
  R(g, x + 24, y + 13, 2, 1, printing ? (Math.floor(t / 300) % 2 ? '#7fd6a0' : '#2a5a3a') : '#2a5a3a');
}

// 턴테이블
export function drawTurntable(g, playing, labelColor, t) {
  const x = 301, y = 120;
  // 뚜껑 (열림)
  R(g, x + 2, y - 15, 28, 14, '#6a4226'); R(g, x + 3, y - 14, 26, 12, '#8a5a33'); R(g, x + 3, y - 14, 26, 1, '#a8764a');
  R(g, x + 12, y - 11, 8, 4, '#c9a24a');
  R(g, x, y, 32, 12, '#6a4226'); R(g, x + 1, y + 1, 30, 10, '#8a5a33'); R(g, x + 1, y + 1, 30, 1, '#a8764a');
  R(g, x + 2, y + 2, 28, 3, '#3a2616');
  ell(g, x + 13, y + 3, 10, 2, '#16161a');
  if (playing) {
    ell(g, x + 13, y + 3, 3, 1, labelColor);
    const a = (t / 180) % (Math.PI * 2);
    R(g, x + 13 + Math.round(Math.cos(a) * 7), y + 3 + Math.round(Math.sin(a) * 1.4), 1, 1, '#6a6a78');
  } else {
    R(g, x + 13, y + 3, 1, 1, '#555');
  }
  R(g, x + 26, y + 1, 2, 2, '#c9c9c9'); R(g, x + 22, y + (playing ? 3 : 2), 5, 1, '#c9c9c9');
  R(g, x + 3, y + 7, 3, 2, '#2a1a10'); R(g, x + 26, y + 7, 3, 2, '#2a1a10');
}

// LP 디스크 색 (21장 모두 다름)
export function discColors(day) {
  const hue = Math.round(((day - 1) * 360 / 21 + (day % 2 ? 0 : 180)) % 360);
  const bodies = ['#17171c', '#1d1624', '#161d22', '#221a14', '#14201a', '#201418', '#1a1a26'];
  return {
    L: `hsl(${hue} 70% 55%)`,
    M: `hsl(${(hue + 40) % 360} 85% 70%)`,
    k: bodies[day % bodies.length],
    h: '#3d3f48',
    g: `hsl(${hue} 30% 60%)`,
  };
}
export function drawDisc(g, day, x, y, scale = 1) {
  const pal = discColors(day);
  if (scale === 1) { drawRows(g, DISC, pal, x, y); return; }
  DISC.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { g.fillStyle = c; g.fillRect(x + i * scale, y + j * scale, scale, scale); } } });
}

// 청소 대상
export function drawBlanket(g, messy, t) {
  if (!messy) {
    // 왼쪽 팔걸이에 가지런히 걸쳐진 담요
    R(g, 46, 124, 18, 44, PAL.blanketDk); R(g, 47, 124, 16, 42, PAL.blanket);
    for (let yy = 128; yy < 166; yy += 5) R(g, 47, yy, 16, 1, PAL.blanketSt);
    for (let xx = 47; xx < 63; xx += 2) R(g, xx, 166, 1, 3, PAL.blanketDk);
    R(g, 58, 120, 30, 6, PAL.blanketDk); R(g, 59, 120, 28, 5, PAL.blanket); R(g, 64, 121, 1, 4, PAL.blanketSt); R(g, 72, 121, 1, 4, PAL.blanketSt);
    return;
  }
  // 소파 방석 위에 구겨져 있다가 바닥까지 흘러내린 담요
  const B = PAL.blanket, D = PAL.blanketDk, S = PAL.blanketSt;
  ell(g, 134, 150, 26, 7, D); ell(g, 133, 149, 25, 6, B);         // 방석 위 뭉치
  ell(g, 122, 146, 9, 4, B); ell(g, 146, 145, 8, 3, B);
  for (let y = 152; y < 190; y++) {                                  // 앞으로 흘러내린 부분
    const k = (y - 152) / 38;
    const x0 = Math.round(146 - k * 6 + Math.sin(y / 3) * 1.5), x1 = Math.round(170 + k * 4 + Math.sin(y / 4 + 1) * 1.5);
    R(g, x0 - 1, y, x1 - x0 + 2, 1, D); R(g, x0, y, x1 - x0, 1, B);
  }
  ell(g, 158, 192, 20, 5, D); ell(g, 157, 191, 19, 4, B);          // 바닥에 고인 부분
  // 주름
  for (const [x, y, len] of [[120, 148, 10], [136, 151, 12], [150, 160, 1], [160, 170, 1]]) R(g, x, y, len, 1, D);
  for (let y = 158; y < 186; y += 2) { R(g, 156 + Math.round(Math.sin(y / 5) * 2), y, 1, 2, D); R(g, 164 + Math.round(Math.sin(y / 6) * 2), y, 1, 2, D); }
  // 줄무늬
  for (let y = 162; y < 190; y += 7) R(g, 142 + Math.round((y - 152) / 38 * -6), y, 28, 1, S);
  R(g, 112, 147, 42, 1, S); R(g, 142, 191, 30, 1, S);
  for (let x = 140; x < 176; x += 2) R(g, x, 196, 1, 2, D);            // 술
}

export function trashItems(seed) {
  const rnd = mulberry(seed);
  return [0, 1, 2].map(i => ({ x: 128 + i * 52 + Math.round(rnd() * 30), y: 194 + Math.round(rnd() * 14), kind: i }));
}
export function drawTrash(g, items, t) {
  for (const it of items) {
    const { x, y } = it;
    if (it.kind === 0) { ell(g, x, y, 3, 2, '#d8d6cc'); R(g, x - 1, y - 1, 2, 1, '#f4f2ea'); R(g, x + 1, y, 1, 1, '#a8a69c'); }
    else if (it.kind === 1) { R(g, x - 3, y - 1, 7, 3, '#e05a8a'); R(g, x - 3, y - 1, 7, 1, '#f58ab0'); R(g, x - 4, y, 1, 1, '#c93a6a'); R(g, x + 4, y, 1, 1, '#c93a6a'); }
    else { dither(g, x - 4, y - 1, 9, 3, '#9a948a'); R(g, x - 2, y - 2, 5, 1, '#b8b2a6'); }
  }
}
export function drawStain(g, alpha) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha;
  ell(g, 280, 206, 10, 3, '#3a2230'); ell(g, 276, 205, 5, 2, '#4a2a3c'); ell(g, 289, 208, 3, 1, '#3a2230');
  R(g, 273, 204, 3, 1, '#6a4a5a');
  g.restore();
}
export function drawPetCorner(g, dirty, t) {
  // 화장실
  R(g, 32, 199, 28, 11, '#3f6f70'); R(g, 32, 199, 28, 1, '#6a9a9a'); R(g, 34, 200, 24, 4, '#d8c79a');
  if (dirty) {
    R(g, 38, 200, 3, 2, '#8a7a5a'); R(g, 48, 201, 4, 2, '#7a6a4a'); R(g, 53, 200, 2, 1, '#8a7a5a');
    for (let i = 0; i < 3; i++) { const ph = Math.sin(t / 300 + i) * 1.5; R(g, 40 + i * 6 + ph, 190 - i, 1, 3, 'rgba(160,190,120,0.8)'); R(g, 41 + i * 6 - ph, 186 - i, 1, 3, 'rgba(160,190,120,0.6)'); }
  }
  dither(g, 32, 210, 28, 1, 'rgba(0,0,0,0.4)');
  // 밥그릇 / 물그릇
  ell(g, 69, 209, 6, 2, '#a8322a'); R(g, 63, 206, 13, 3, '#c9443a'); ell(g, 69, 206, 6, 1, dirty ? '#5a2a20' : '#8a5a2a');
  if (!dirty) { R(g, 66, 205, 2, 1, '#b07a3a'); R(g, 70, 205, 2, 1, '#b07a3a'); }
  else { R(g, 78, 211, 1, 1, '#8a5a2a'); R(g, 61, 211, 1, 1, '#8a5a2a'); }
  ell(g, 86, 209, 6, 2, '#2f5f9a'); R(g, 80, 206, 13, 3, '#3f78b8'); ell(g, 86, 206, 6, 1, dirty ? '#6a7a6a' : '#8fd0f0');
  if (!dirty) R(g, 83, 206, 3, 1, '#d8f0ff');
}

// 청소 도구 애니메이션 (p: 0..1)
export function drawVacuum(g, x, y, p) {
  R(g, x - 1, y - 20, 2, 16, '#9a9ea6'); R(g, x - 3, y - 22, 6, 3, '#3a3b41');
  R(g, x - 5, y - 8, 10, 6, '#d8402e'); R(g, x - 5, y - 8, 10, 1, '#f06a4a');
  R(g, x - 8, y - 2, 16, 3, '#3a3b41'); R(g, x - 8, y + 1, 3, 1, '#1a1a1a'); R(g, x + 5, y + 1, 3, 1, '#1a1a1a');
}
export function drawMop(g, x, y) {
  R(g, x, y - 26, 1, 22, '#c9a06a');
  for (let i = -4; i <= 4; i++) R(g, x + i, y - 4 + (i % 2), 1, 5, '#e8e4dc');
}
export function drawSponge(g, x, y) {
  R(g, x - 4, y - 3, 9, 3, '#f2d24a'); R(g, x - 4, y, 9, 2, '#3f9a4a');
}

// 축하 모드 장식
export function drawFestive(g, t) {
  // 가랜드
  const cols = ['#e05a5a', '#f2c14e', '#5ab0e0', '#7ad08a', '#c97ad8'];
  for (const [x0, x1] of [[4, 132], [296, 380]]) {
    for (let x = x0, i = 0; x < x1; x += 9, i++) {
      const sag = Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 8);
      R(g, x, 8 + sag, 9, 1, '#e8dcc0');
      const c = cols[i % cols.length];
      for (let j = 0; j < 5; j++) R(g, x + 1 + j, 9 + sag + j, 7 - j * 2 > 0 ? 7 - j * 2 : 1, 1, c);
    }
  }
  // 풍선
  [[112, '#e05a5a'], [124, '#f2c14e'], [304, '#5ab0e0']].forEach(([bx, c], i) => {
    const by = 30 + Math.round(Math.sin(t / 600 + i * 2) * 3);
    ell(g, bx, by, 5, 6, c); R(g, bx - 2, by - 3, 2, 2, 'rgba(255,255,255,0.6)');
    for (let s = 0; s < 22; s++) R(g, bx + Math.round(Math.sin(s / 4 + t / 500) * 1), by + 7 + s, 1, 1, '#e8dcc0');
  });
  // 굽도리 위 전구 줄
  for (let x = 6; x < 380; x += 10) {
    const on = Math.floor(t / 400 + x / 10) % 3 !== 0;
    R(g, x, 88, 2, 2, on ? cols[(x / 10) % cols.length | 0] : '#5a4a3a');
  }
  // 케이크 (러그 위)
  const cx = 160, cy = 196;
  R(g, cx - 9, cy, 19, 8, '#f3e6d2'); R(g, cx - 9, cy, 19, 2, '#f6a8c0'); R(g, cx - 9, cy + 4, 19, 1, '#e88aa8');
  R(g, cx - 11, cy + 8, 23, 2, '#d8d2c8');
  for (let i = 0; i < 3; i++) { R(g, cx - 5 + i * 5, cy - 5, 1, 5, ['#5ab0e0', '#f2c14e', '#e05a5a'][i]); R(g, cx - 5 + i * 5, cy - 7 - (Math.floor(t / 150 + i) % 2), 1, 2, '#ffd35a'); }
}
