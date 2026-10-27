// 파티클: 하트, 반짝이, 음표, 색종이, 불꽃놀이, 비/눈
import { R, WIN, W, H } from './scene.js';

const HEART = ['.x.x.', 'xxxxx', '.xxx.', '..x..'];
const NOTE = ['..xx', '..x.', '..x.', 'xxx.', 'xx..'];
let parts = [];

export function spawnHearts(x, y, n = 3) {
  for (let i = 0; i < n; i++) parts.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 12, life: 1.4, age: -i * 0.15, col: Math.random() < 0.5 ? '#f06a8a' : '#ff9ab4' });
}
export function spawnSparkles(x, y, n = 8, spread = 14) {
  for (let i = 0; i < n; i++) parts.push({ kind: 'spark', x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread, vx: 0, vy: -6, life: 0.7 + Math.random() * 0.5, age: -Math.random() * 0.3, col: Math.random() < 0.5 ? '#fff6c0' : '#ffffff' });
}
export function spawnNote(x, y) {
  parts.push({ kind: 'note', x, y, vx: (Math.random() - 0.5) * 10, vy: -14, life: 2, age: 0, col: ['#f2c14e', '#9ad0f0', '#f59ab4'][Math.floor(Math.random() * 3)] });
}
export function spawnPuff(x, y, n = 6, col = '#cfc8bc') {
  for (let i = 0; i < n; i++) parts.push({ kind: 'puff', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10, life: 0.6, age: 0, col });
}
export function spawnZ(x, y) {
  parts.push({ kind: 'z', x, y, vx: 4, vy: -6, life: 2.4, age: 0, col: '#cfd8ff' });
}
export function spawnMist(x, y, purple) {
  parts.push({ kind: 'mist', x: x + (Math.random() - 0.5) * 2, y, vx: (Math.random() - 0.5) * 3, vy: -7 - Math.random() * 4, life: 1.8, age: 0, col: purple ? 'rgba(220,200,255,0.55)' : 'rgba(235,240,250,0.5)' });
}
export function spawnCrumbs(x, y) {
  for (let i = 0; i < 3; i++) parts.push({ kind: 'puff', x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 16, vy: -10 - Math.random() * 8, life: 0.45, age: 0, col: '#b07a3a' });
}
export function spawnConfetti(n = 80) {
  const cols = ['#e05a5a', '#f2c14e', '#5ab0e0', '#7ad08a', '#c97ad8', '#ffffff'];
  for (let i = 0; i < n; i++) parts.push({ kind: 'conf', x: Math.random() * W, y: -Math.random() * 60, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 30, life: 8, age: 0, col: cols[i % cols.length], ph: Math.random() * 6 });
}

// 불꽃놀이 (창밖)
let rockets = [];
export function launchFirework() {
  rockets.push({ x: WIN.x + 20 + Math.random() * (WIN.w - 40), y: WIN.y + WIN.h, ty: WIN.y + 18 + Math.random() * 40, vy: -70, col: ['#ff7a8a', '#ffd35a', '#8ad8ff', '#b8ff9a', '#e0a0ff'][Math.floor(Math.random() * 5)] });
}

export function updateEffects(dt, onBoom) {
  const s = dt / 1000;
  for (const p of parts) {
    p.age += s;
    if (p.age < 0) continue;
    p.x += p.vx * s; p.y += p.vy * s;
    if (p.kind === 'conf') { p.x += Math.sin(p.age * 3 + p.ph) * 0.4; if (p.y > H - 2) { p.vy = 0; p.vx = 0; } }
    if (p.kind === 'ember') p.vy += 40 * s;
  }
  parts = parts.filter(p => p.age < p.life);
  for (const r of rockets) {
    r.y += r.vy * s;
    if (r.y <= r.ty) {
      r.done = true;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, sp = 22 + Math.random() * 8;
        parts.push({ kind: 'ember', x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.4, age: 0, col: r.col, clip: true });
      }
      onBoom?.();
    }
  }
  rockets = rockets.filter(r => !r.done);
}

// 창밖(유리 안쪽)에 그릴 것: 불꽃놀이
export function drawWindowEffects(g) {
  g.save();
  g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
  for (const r of rockets) { R(g, r.x, r.y, 1, 2, '#fff2c0'); R(g, r.x, r.y + 2, 1, 2, 'rgba(255,200,120,0.5)'); }
  for (const p of parts) {
    if (!p.clip || p.age < 0) continue;
    const k = 1 - p.age / p.life;
    g.globalAlpha = Math.max(0, k);
    R(g, p.x, p.y, 1, 1, k > 0.6 ? '#fff6d8' : p.col);
  }
  g.restore();
}

export function drawEffects(g) {
  for (const p of parts) {
    if (p.clip || p.age < 0) continue;
    const k = 1 - p.age / p.life;
    g.globalAlpha = Math.max(0, Math.min(1, k * 1.5));
    g.fillStyle = p.col;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.kind === 'heart') HEART.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'x') g.fillRect(x + i, y + j, 1, 1); });
    else if (p.kind === 'note') NOTE.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'x') g.fillRect(x + i, y + j, 1, 1); });
    else if (p.kind === 'spark') { const big = Math.floor(p.age * 10) % 2 === 0; g.fillRect(x, y, 1, 1); if (big) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
    else if (p.kind === 'puff') { g.fillRect(x, y, 2, 2); }
    else if (p.kind === 'mist') { const r = 1 + Math.floor(p.age * 1.5); g.fillRect(x - r + 1, y, r * 2 - 1, r); }
    else if (p.kind === 'z') { const s = p.age > 1 ? 4 : 3; g.fillRect(x, y, s, 1); g.fillRect(x + s - 2, y + 1, 1, 1); if (s > 3) g.fillRect(x + 1, y + 2, 1, 1); g.fillRect(x, y + s - 1, s, 1); }
    else if (p.kind === 'conf') g.fillRect(x, y, Math.floor(p.age * 6 + p.ph) % 2 ? 2 : 1, Math.floor(p.age * 6 + p.ph) % 2 ? 1 : 2);
  }
  g.globalAlpha = 1;
}

// 비·눈 (창밖)
const drops = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));
export function drawPrecip(g, weather, t, dt) {
  if (!['rain', 'snow', 'storm'].includes(weather)) return;
  const snow = weather === 'snow';
  g.save(); g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
  for (const d of drops) {
    d.y += (snow ? 0.04 : 0.9) * d.s * dt / 1000;
    if (snow) d.x += Math.sin(t / 800 + d.s * 10) * 0.0004;
    if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
    const x = WIN.x + d.x * WIN.w, y = WIN.y + d.y * WIN.h;
    if (snow) R(g, x, y, d.s > 1 ? 2 : 1, d.s > 1 ? 2 : 1, '#f4f6ff');
    else { R(g, x, y, 1, 4, 'rgba(190,210,240,0.55)'); }
  }
  if (weather === 'storm' && Math.sin(t / 1300) > 0.995) { g.fillStyle = 'rgba(230,235,255,0.5)'; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); }
  g.restore();
}
