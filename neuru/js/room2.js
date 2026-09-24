// 방 안의 움직이는 물건들 — 청소 대상, 청소 도구, 자라는 화분, 횃불, 서랍, 액자 사진
import { R, ell, mulberry, PAL } from './scene.js';

const dith = (g, x, y, w, h, c) => { g.fillStyle = c; for (let j = 0; j < h; j++) for (let i = j & 1; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1); };

// ─────────── 청소 대상 (12곳) ───────────
// hit: [x, y, w, h] 여러 개 가능, pos: 도구/반짝이 위치, tool: 청소 도구
export const MESS = {
  blanket: { label: '담요', tool: 'hand', dur: 800, sfx: 'whoosh', hit: [[106, 140, 56, 20], [136, 152, 42, 46]], pos: [150, 165] },
  cushions: { label: '쿠션', tool: 'hand', dur: 700, sfx: 'whoosh', hit: [[98, 194, 34, 16]], pos: [114, 200] },
  trash: { label: '러그 위 쓰레기', tool: 'vacuum', dur: 1300, sfx: 'vacuum', hit: [[122, 192, 64, 20], [236, 192, 30, 20]], pos: [190, 206] },
  stain: { label: '바닥 얼룩', tool: 'mop', dur: 1100, sfx: 'wipe', hit: [[266, 200, 30, 12]], pos: [280, 208] },
  bowls: { label: '밥그릇', tool: 'sponge', dur: 1000, sfx: 'wipe', hit: [[60, 200, 36, 14]], pos: [76, 207] },
  litter: { label: '화장실', tool: 'scoop', dur: 1000, sfx: 'scoop', hit: [[30, 186, 32, 26]], pos: [46, 203] },
  books: { label: '떨어진 책', tool: 'hand', dur: 800, sfx: 'thump', hit: [[180, 194, 22, 16]], pos: [190, 202] },
  fur: { label: '소파 털뭉치', tool: 'roller', dur: 1000, sfx: 'wipe', hit: [[62, 140, 54, 16]], pos: [88, 150] },
  papers: { label: '구겨진 종이', tool: 'hand', dur: 700, sfx: 'whoosh', hit: [[196, 118, 26, 15]], pos: [208, 128] },
  ash: { label: '벽난로 재', tool: 'broom', dur: 1100, sfx: 'wipe', hit: [[314, 204, 34, 12]], pos: [330, 210] },
  soil: { label: '쏟아진 흙', tool: 'broom', dur: 1000, sfx: 'wipe', hit: [[4, 206, 30, 10]], pos: [20, 212] },
  yarn: { label: '털실 뭉치', tool: 'hand', dur: 900, sfx: 'whoosh', hit: [[196, 200, 44, 14]], pos: [218, 207] },
};
export const MESS_IDS = Object.keys(MESS);

// 어질러지는 시각마다 7~12곳을 무작위로 고름 (같은 시각이면 어느 기기에서나 같음)
export function pickMess(messAt) {
  const rnd = mulberry((messAt / 60000) | 0);
  const count = 7 + Math.floor(rnd() * 6);
  const ids = [...MESS_IDS];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, count);
}
export function trashBits(messAt) {
  const rnd = mulberry(((messAt / 60000) | 0) + 7);
  const spots = [[128, 200], [124, 208], [172, 207], [246, 196], [258, 209], [140, 209], [262, 201]];
  const out = [];
  while (out.length < 4) { const s = spots[Math.floor(rnd() * spots.length)]; if (!out.some(o => o.x === s[0])) out.push({ x: s[0], y: s[1], kind: out.length % 3 }); }
  return out;
}

export function drawPillows(g, messy) {
  if (!messy) {
    R(g, 150, 132, 20, 18, PAL.pillowDk); R(g, 151, 132, 18, 16, PAL.pillow);
    for (let i = 0; i < 6; i++) R(g, 153 + i * 3, 136 + (i % 2) * 4, 2, 1, PAL.pillowDk);
    R(g, 134, 136, 16, 15, PAL.pillowGDk); R(g, 135, 136, 14, 13, PAL.pillowG);
    return;
  }
  // 바닥에 떨어진 쿠션 두 개
  R(g, 100, 199, 18, 9, PAL.pillowDk); R(g, 101, 198, 16, 8, PAL.pillow);
  for (let i = 0; i < 5; i++) R(g, 103 + i * 3, 200 + (i % 2) * 3, 2, 1, PAL.pillowDk);
  R(g, 114, 202, 16, 8, PAL.pillowGDk); R(g, 115, 201, 14, 7, PAL.pillowG);
  R(g, 100, 208, 30, 1, 'rgba(0,0,0,0.35)');
}

export function drawMessItem(g, id, messAt, t) {
  switch (id) {
    case 'trash':
      for (const it of trashBits(messAt)) {
        const { x, y } = it;
        if (it.kind === 0) { ell(g, x, y, 3, 2, '#d8d6cc'); R(g, x - 1, y - 1, 2, 1, '#f4f2ea'); R(g, x + 1, y, 1, 1, '#a8a69c'); }
        else if (it.kind === 1) { R(g, x - 3, y - 1, 7, 3, '#e05a8a'); R(g, x - 3, y - 1, 7, 1, '#f58ab0'); R(g, x - 4, y, 1, 1, '#c93a6a'); R(g, x + 4, y, 1, 1, '#c93a6a'); }
        else { dith(g, x - 4, y - 1, 9, 3, '#9a948a'); R(g, x - 2, y - 2, 5, 1, '#b8b2a6'); }
      }
      break;
    case 'stain':
      ell(g, 280, 206, 10, 3, '#3a2230'); ell(g, 276, 205, 5, 2, '#4a2a3c'); ell(g, 289, 208, 3, 1, '#3a2230'); R(g, 273, 204, 3, 1, '#6a4a5a');
      break;
    case 'books':
      R(g, 181, 204, 14, 4, '#2f5a6c'); R(g, 181, 204, 14, 1, '#4a7a8c'); R(g, 181, 205, 1, 3, '#e8dcc0');
      R(g, 186, 200, 12, 4, '#7b2e2a'); R(g, 186, 200, 12, 1, '#a34a3a'); R(g, 197, 201, 1, 3, '#e8dcc0');
      for (let i = 0; i < 7; i++) R(g, 184 + i, 199 - Math.floor(i / 2), 2, 2, '#b0883a');
      break;
    case 'fur':
      for (const [x, y] of [[68, 149], [80, 152], [95, 148], [106, 153], [74, 154]]) {
        R(g, x, y, 3, 2, '#2a2c33'); R(g, x + 1, y - 1, 1, 1, '#3a3d48'); R(g, x - 1, y + 1, 1, 1, '#3a3d48'); R(g, x + 3, y, 1, 1, '#1a1b20');
      }
      break;
    case 'papers':
      ell(g, 202, 128, 3, 2, '#e8e4d8'); R(g, 201, 127, 2, 1, '#ffffff'); R(g, 203, 129, 1, 1, '#b8b2a0');
      ell(g, 210, 129, 3, 2, '#efe6cf'); R(g, 209, 128, 1, 1, '#ffffff'); R(g, 211, 130, 1, 1, '#b8b2a0');
      ell(g, 216, 127, 2, 2, '#e8e4d8');
      break;
    case 'ash':
      dith(g, 316, 208, 30, 5, '#6e6a66'); dith(g, 318, 207, 20, 5, '#8a8682'); R(g, 322, 211, 3, 1, '#4a4644'); R(g, 334, 209, 2, 1, '#4a4644');
      break;
    case 'soil':
      dith(g, 6, 210, 26, 5, '#4a2e1a'); dith(g, 9, 211, 16, 4, '#5e3a22'); R(g, 26, 212, 2, 1, '#3a2212'); R(g, 14, 213, 3, 1, '#3a2212');
      break;
    case 'yarn': {
      ell(g, 232, 206, 4, 4, '#d8506a'); R(g, 230, 204, 3, 1, '#f08aa0'); R(g, 229, 207, 6, 1, '#a83a52'); R(g, 231, 209, 4, 1, '#a83a52');
      for (let x = 198; x < 228; x++) R(g, x, 208 + Math.round(Math.sin(x / 3) * 2), 1, 1, '#d8506a');
      break;
    }
  }
}

// 담요 / 밥그릇 / 화장실 은 청결 상태 그림이 따로 있음 (scene.js 의 drawBlanket 사용)
export function drawBowls(g, dirty) {
  ell(g, 69, 209, 6, 2, '#a8322a'); R(g, 63, 206, 13, 3, '#c9443a'); ell(g, 69, 206, 6, 1, dirty ? '#5a2a20' : '#8a5a2a');
  if (!dirty) { R(g, 66, 205, 2, 1, '#b07a3a'); R(g, 70, 205, 2, 1, '#b07a3a'); }
  else { R(g, 78, 211, 1, 1, '#8a5a2a'); R(g, 61, 211, 1, 1, '#8a5a2a'); R(g, 90, 212, 2, 1, '#6a8aa0'); }
  ell(g, 86, 209, 6, 2, '#2f5f9a'); R(g, 80, 206, 13, 3, '#3f78b8'); ell(g, 86, 206, 6, 1, dirty ? '#6a7a6a' : '#8fd0f0');
  if (!dirty) R(g, 83, 206, 3, 1, '#d8f0ff');
}
export function drawLitter(g, dirty, t) {
  R(g, 32, 199, 28, 11, '#3f6f70'); R(g, 32, 199, 28, 1, '#6a9a9a'); R(g, 34, 200, 24, 4, '#d8c79a');
  if (dirty) {
    R(g, 38, 200, 3, 2, '#8a7a5a'); R(g, 48, 201, 4, 2, '#7a6a4a'); R(g, 53, 200, 2, 1, '#8a7a5a');
    dith(g, 30, 209, 8, 3, '#d8c79a');
    for (let i = 0; i < 3; i++) { const ph = Math.sin(t / 300 + i) * 1.5; R(g, 40 + i * 6 + ph, 190 - i, 1, 3, 'rgba(160,190,120,0.8)'); R(g, 41 + i * 6 - ph, 186 - i, 1, 3, 'rgba(160,190,120,0.6)'); }
  }
  dith(g, 32, 210, 28, 1, 'rgba(0,0,0,0.4)');
}

// ─────────── 청소 도구 ───────────
export function drawTool(g, tool, x, y, p) {
  const sw = Math.sin(p * Math.PI * 6);
  switch (tool) {
    case 'vacuum':
      R(g, x - 1, y - 20, 2, 16, '#9a9ea6'); R(g, x - 3, y - 22, 6, 3, '#3a3b41');
      R(g, x - 5, y - 8, 10, 6, '#d8402e'); R(g, x - 5, y - 8, 10, 1, '#f06a4a');
      R(g, x - 8, y - 2, 16, 3, '#3a3b41'); R(g, x - 8, y + 1, 3, 1, '#1a1a1a'); R(g, x + 5, y + 1, 3, 1, '#1a1a1a');
      break;
    case 'mop': {
      const mx = x + sw * 8;
      R(g, mx, y - 26, 1, 22, '#c9a06a');
      for (let i = -4; i <= 4; i++) R(g, mx + i, y - 4 + (i % 2), 1, 5, '#e8e4dc');
      break;
    }
    case 'sponge': case 'roller': {
      const sx = x + sw * 10;
      if (tool === 'sponge') { R(g, sx - 4, y - 3, 9, 3, '#f2d24a'); R(g, sx - 4, y, 9, 2, '#3f9a4a'); }
      else { R(g, sx - 5, y - 3, 11, 4, '#e8e4dc'); R(g, sx - 5, y - 3, 11, 1, '#ffffff'); R(g, sx, y - 10, 1, 7, '#d8402e'); R(g, sx - 1, y - 13, 3, 3, '#d8402e'); }
      break;
    }
    case 'scoop': {
      const sy = y - 6 - Math.abs(sw) * 5;
      R(g, x + 3, sy - 10, 2, 10, '#5ab0e0'); R(g, x - 4, sy, 10, 4, '#5ab0e0'); for (let i = 0; i < 4; i++) R(g, x - 3 + i * 2, sy + 1, 1, 2, '#2f7aa8');
      break;
    }
    case 'broom': {
      const bx = x + sw * 9;
      R(g, bx + 4, y - 24, 1, 20, '#b08a5a'); R(g, bx - 2, y - 5, 10, 3, '#c9403a');
      for (let i = 0; i < 10; i++) R(g, bx - 3 + i, y - 2, 1, 4, i % 2 ? '#e0c070' : '#c9a050');
      break;
    }
    case 'hand': {
      const hy = y - 4 - Math.abs(sw) * 4;
      for (let i = 0; i < 3; i++) R(g, x - 10 + i * 8 + sw * 4, hy - i * 3, 6, 1, 'rgba(255,255,255,0.65)');
      break;
    }
  }
}

// ─────────── 자라는 화분 (물 21번 → 꽃) ───────────
export const PLANTS = {
  rose: { name: '장미', hit: [0, 150, 32, 58], drop: [14, 150] },
  lisianthus: { name: '리시안셔스', hit: [326, 16, 40, 52], drop: [334, 20] },
  celosia: { name: '맨드라미', hit: [352, 104, 30, 40], drop: [367, 106] },
};
const GREEN = ['#2c5a2b', '#3e7a3a', '#5d9c49', '#7bb85a'];

function leaf(g, x, y, dir, big) {
  R(g, x, y, big ? 3 : 2, 1, GREEN[2]); R(g, x + (dir > 0 ? 1 : -1), y - 1, big ? 2 : 1, 1, GREEN[3]); R(g, x, y + 1, big ? 2 : 1, 1, GREEN[1]);
}

// 장미 — 바닥 화분, 곧게 자라는 줄기 + 가지, 21일째 붉은 장미 세 송이
export function drawRose(g, s, t, watered) {
  const bx = 14, by = 194;
  if (watered) R(g, 7, 194, 14, 1, '#4a2e1a');
  const h = 5 + Math.round(s * 1.35);
  const sway = Math.sin(t / 1400) * (s / 21) * 1.2;
  let top = [bx, by - h];
  for (let i = 0; i <= h; i++) {
    const x = Math.round(bx + sway * (i / h) * (i / h)), y = by - i;
    R(g, x, y, 1, 1, GREEN[1]);
    if (i > 2 && i % 4 === 1) leaf(g, x + (i % 8 === 1 ? 1 : -3), y, i % 8 === 1 ? 1 : -1, s > 8);
    top = [x, y];
  }
  const branches = s >= 10 ? [[-1, 0.62], [1, 0.48]] : [];
  const tips = [top];
  for (const [dir, at] of branches) {
    const i0 = Math.round(h * at);
    const len = Math.min(8, Math.round((s - 9) * 0.8));
    let x = bx + sway * at * at, y = by - i0;
    for (let k = 0; k < len; k++) { x += dir * 0.8; y -= 0.7; R(g, Math.round(x), Math.round(y), 1, 1, GREEN[1]); }
    if (len > 3) leaf(g, Math.round(x) - dir * 2, Math.round(y) + 2, dir, false);
    tips.push([Math.round(x), Math.round(y)]);
  }
  tips.forEach(([x, y], i) => roseBud(g, x, y, i === 0 ? s : s - 2));
  if (s < 3) { leaf(g, bx - 3, by - 2, -1, false); leaf(g, bx + 1, by - 3, 1, false); }
}
function roseBud(g, x, y, s) {
  if (s < 12) return;
  if (s < 16) { R(g, x - 1, y - 2, 3, 3, GREEN[1]); R(g, x, y - 2, 1, 1, s >= 14 ? '#c9303a' : GREEN[2]); return; }
  if (s < 19) { R(g, x - 1, y - 4, 3, 4, '#b8283a'); R(g, x, y - 4, 1, 1, '#e8506a'); R(g, x - 2, y - 1, 5, 1, GREEN[1]); return; }
  if (s < 21) { R(g, x - 2, y - 5, 5, 5, '#c42a3e'); R(g, x - 1, y - 5, 3, 1, '#e8506a'); R(g, x - 1, y - 3, 1, 1, '#8a1a2a'); R(g, x - 2, y, 5, 1, GREEN[1]); return; }
  // 활짝 핀 장미
  R(g, x - 3, y - 5, 7, 5, '#c42a3e'); R(g, x - 2, y - 6, 5, 1, '#d83a50'); R(g, x - 4, y - 3, 1, 2, '#a82034'); R(g, x + 4, y - 3, 1, 2, '#a82034');
  R(g, x - 1, y - 4, 3, 1, '#8a1a2a'); R(g, x + 1, y - 3, 1, 1, '#8a1a2a'); R(g, x - 1, y - 2, 2, 1, '#8a1a2a'); R(g, x - 2, y - 5, 1, 1, '#f07a8a');
  R(g, x - 3, y, 7, 1, GREEN[1]); R(g, x - 4, y - 1, 1, 1, GREEN[2]); R(g, x + 4, y - 1, 1, 1, GREEN[2]);
}

// 리시안셔스 — 매달린 화분, 줄기가 양옆으로 늘어지며 보라·흰 컵 모양 꽃
export function drawLisianthus(g, s, t, watered) {
  const px = 347, py = 24;
  if (watered) R(g, 341, 24, 13, 1, '#4a2e1a');
  // 줄기: 화분 가장자리에서 위로 솟았다가 바깥쪽으로 휘어 늘어짐
  const stems = [[-1, 1.0, 0.0], [1, 0.95, 0.1], [0, 0.45, 0], [-1, 0.7, 0.25], [1, 0.65, 0.3]];
  const count = s < 5 ? 2 : s < 10 ? 3 : s < 15 ? 4 : 5;
  for (let si = 0; si < count; si++) {
    const [dir, scale, delay] = stems[si];
    const len = Math.max(3, Math.round((3 + s * 1.35) * scale));
    const pts = [];
    let x = px + (dir || 0) * 6, y = py + 1, a = dir > 0 ? 0.2 : dir < 0 ? Math.PI - 0.2 : -Math.PI / 2;
    for (let k = 0; k < len; k++) {
      if (dir > 0) a = Math.min(Math.PI / 2 - 0.15, a + 0.13);
      else if (dir < 0) a = Math.max(Math.PI / 2 + 0.15, a - 0.13);
      else a += 0.03;
      const sw = Math.sin(t / 1700 + si) * 0.25 * (k / len);
      x += Math.cos(a) * 0.9 + sw * 0.1; y += Math.sin(a) * 0.9;
      pts.push([Math.round(x), Math.round(y)]);
      R(g, Math.round(x), Math.round(y), 1, 1, GREEN[1]);
      if (k % 4 === 2) leaf(g, Math.round(x) + (dir >= 0 ? 1 : -3), Math.round(y), dir >= 0 ? 1 : -1, s > 10);
    }
    const tip = pts[pts.length - 1];
    lisiFlower(g, tip[0], tip[1], s - si, si % 2 === 0);
    if (s >= 21 && pts.length > 12) { const m = pts[Math.floor(pts.length * 0.55)]; lisiFlower(g, m[0] + (dir >= 0 ? 2 : -2), m[1], 21, si % 2 === 1); }
  }
  if (s < 3) { leaf(g, px - 4, py - 2, -1, false); leaf(g, px + 2, py - 3, 1, false); }
}
function lisiFlower(g, x, y, s, purple) {
  if (s < 12) return;
  const c1 = purple ? '#7a4ac8' : '#f2ecf8', c2 = purple ? '#b08ae8' : '#ffffff', c3 = purple ? '#4a2a8a' : '#b08ae8';
  if (s < 17) { R(g, x - 1, y - 1, 2, 4, s >= 14 ? c1 : GREEN[2]); return; }
  if (s < 21) { R(g, x - 2, y - 1, 4, 4, c1); R(g, x - 1, y - 1, 2, 1, c2); return; }
  R(g, x - 3, y - 2, 7, 5, c1); R(g, x - 3, y - 2, 7, 1, c2); R(g, x - 4, y - 1, 1, 2, c2); R(g, x + 4, y - 1, 1, 2, c2);
  R(g, x - 1, y, 3, 2, c3); R(g, x, y + 3, 1, 1, '#f2d24a');
}

// 맨드라미 — 벽난로 선반, 잎이 넓고 꼭대기에 붉은 볏 모양 꽃
export function drawCelosia(g, s, t, watered) {
  const bx = 367, by = 136;
  if (watered) R(g, 362, 136, 10, 1, '#4a2e1a');
  const h = 3 + Math.round(s * 0.75);
  for (let i = 0; i <= h; i++) R(g, bx, by - i, 1, 1, GREEN[1]);
  for (let i = 2; i < h; i += 3) { const w = Math.min(4, 2 + Math.floor(s / 7)); R(g, bx - w, by - i, w, 2, GREEN[2]); R(g, bx + 1, by - i - 1, w, 2, GREEN[1]); }
  const top = by - h;
  if (s < 10) return;
  const ph = Math.min(1, (s - 9) / 12);
  const pw = Math.round(2 + ph * 5), phh = Math.round(2 + ph * 9);
  const cols = s >= 21 ? ['#e0203a', '#ff4a5a', '#a8102a'] : ['#c83048', '#e05a6a', '#8a1a2a'];
  for (let j = 0; j < phh; j++) {
    const k = j / phh;
    const w = Math.max(1, Math.round(pw * (1 - Math.abs(k - 0.35) * 1.1)));
    const wob = Math.round(Math.sin(j * 1.3 + t / 700) * (s >= 21 ? 1 : 0.4));
    R(g, bx - w + wob, top - j, w * 2 + 1, 1, cols[j % 3 === 0 ? 2 : 0]);
    if (j % 2) R(g, bx - w + 1 + wob, top - j, 1, 1, cols[1]);
  }
  if (s >= 21) for (const dx of [-5, 5]) { for (let j = 0; j < 5; j++) R(g, bx + dx - 1, top + 5 - j, 3 - (j > 3 ? 2 : 0), 1, cols[j % 2]); R(g, bx + dx, top + 6, 1, 3, GREEN[1]); }
}

export function drawWateringCan(g, x, y, p) {
  const tilt = Math.min(1, p * 3);
  const cx = x + 6, cy = y - 16;
  R(g, cx, cy, 9, 6, '#5ab0e0'); R(g, cx, cy, 9, 1, '#8ad0f8'); R(g, cx + 2, cy - 3, 5, 1, '#3a88b8'); R(g, cx + 2, cy - 3, 1, 3, '#3a88b8'); R(g, cx + 6, cy - 3, 1, 3, '#3a88b8');
  for (let i = 0; i < 5; i++) R(g, cx - 1 - i, cy + 1 + Math.round(i * tilt * 0.7), 1, 1, '#3a88b8');
  if (p > 0.25 && p < 0.9) for (let i = 0; i < 4; i++) { const k = ((p * 5 + i * 0.25) % 1); R(g, cx - 6 + i % 2, cy + 4 + k * 12, 1, 2, 'rgba(140,210,255,0.9)'); }
}

export function drawDropHint(g, x, y, t) {
  const b = Math.round(Math.sin(t / 300) * 1.5);
  R(g, x, y - 4 + b, 1, 1, '#8ad0f8'); R(g, x - 1, y - 3 + b, 3, 2, '#5ab0e0'); R(g, x - 1, y - 1 + b, 3, 1, '#3a88b8'); R(g, x, y - 3 + b, 1, 1, '#d8f4ff');
}

// ─────────── 서랍 / 횃불 / 불닭 / 액자 ───────────
export const DRAWERS = [[297, 145], [297, 162], [297, 179]]; // 각 32×14
export function drawDrawerOpen(g, i, p) {
  const [x, y] = DRAWERS[i];
  const out = Math.round(Math.sin(Math.min(1, p) * Math.PI) * 3);
  if (!out) return;
  R(g, x, y, 32, 14, '#1a0d06');
  R(g, x - out, y + out, 32 + out * 2, 14, '#3a2012'); R(g, x - out + 1, y + out + 1, 30 + out * 2, 12, PAL.wood);
  R(g, x - out + 1, y + out + 1, 30 + out * 2, 1, PAL.woodLt); R(g, x + 13, y + out + 6, 6, 2, '#c9a24a');
}
// 서랍 손잡이에 작은 표식 (사진 / 횃불 / 라면)
export function drawDrawerMarks(g) {
  R(g, 302, 150, 3, 2, '#efe6cf'); R(g, 303, 150, 1, 1, '#8fb0c0');
  R(g, 303, 166, 1, 3, '#8a5a2a'); R(g, 302, 165, 3, 1, '#f2c14e');
  R(g, 302, 184, 3, 2, '#f08aa8');
}

export const TORCH_AT = [118, 48];
export function drawTorch(g, lit, t) {
  const [x, y] = TORCH_AT;
  R(g, x - 3, y + 16, 7, 2, '#3a3b41'); R(g, x - 2, y + 14, 5, 2, '#5b5d66'); // 벽 고리
  R(g, x - 1, y + 4, 3, 16, '#6a4424'); R(g, x - 1, y + 4, 1, 16, '#8a5a30'); R(g, x + 1, y + 4, 1, 16, '#4a2e16');
  R(g, x - 1, y + 2, 3, 3, lit ? '#3a2412' : '#2a1a0e');
  if (!lit) { R(g, x, y + 1, 1, 1, '#4a4644'); return; }
  const f = Math.floor(t / 120) % 3;
  R(g, x - 1, y - 1, 3, 3, '#ffb030'); R(g, x, y - 3 - (f === 1 ? 1 : 0), 1, 3, '#ffe070');
  R(g, x - 1 + (f === 2 ? 2 : 0), y - 2, 1, 1, '#ff7a20'); R(g, x, y, 1, 1, '#fff4c0');
}
export function drawTorchGlow(g, t) {
  const [x, y] = TORCH_AT;
  const f = 0.9 + Math.sin(t / 80) * 0.06 + Math.sin(t / 33) * 0.04;
  const gr = g.createRadialGradient(x, y, 0, x, y, 30);
  gr.addColorStop(0, `rgba(255,170,70,${0.32 * f})`); gr.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60);
}

// 러그 위 라면 그릇 (김이 모락모락)
export const RAMEN_AT = [156, 194];
export function drawRamen(g, t, bites) {
  const [x, y] = RAMEN_AT;
  R(g, x - 9, y + 7, 19, 2, 'rgba(0,0,0,0.3)');
  R(g, x - 8, y, 17, 7, '#f2ece0'); R(g, x - 8, y, 17, 1, '#ffffff'); R(g, x - 6, y + 6, 13, 1, '#c9c2b2'); R(g, x - 8, y + 3, 17, 1, '#e05a8a');
  const fill = Math.max(0, 3 - bites);
  if (fill) { R(g, x - 7, y - 1, 15, 2, '#f0b060'); for (let i = 0; i < 6; i++) R(g, x - 6 + i * 2, y - 1 + (i % 2), 2, 1, '#e8883a'); R(g, x + 3, y - 1, 2, 1, '#e02a2a'); }
  if (fill > 1) for (let i = 0; i < 3; i++) { const k = ((t / 1400 + i / 3) % 1); R(g, x - 4 + i * 4 + Math.round(Math.sin(t / 300 + i) * 1.5), y - 3 - k * 12, 1, 2, `rgba(255,255,255,${0.6 * (1 - k)})`); }
  R(g, x + 6, y - 6, 1, 7, '#c9a06a'); R(g, x + 8, y - 5, 1, 6, '#c9a06a');
}

// 액자 사진 (도트로 줄여 그린 캔버스)
export function drawFramePhoto(g, img) {
  if (img) g.drawImage(img, 74, 46);
}
