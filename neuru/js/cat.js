// 느루 — 움직임 / 표정 / 그리기
import { SIT, LOAF, WALK, BACK, CAT_PAL } from './sprites.js';
import { drawRows, R } from './scene.js';

const FLOOR_Y = 205;
export const SPOTS = {
  sofa: { x: 100, y: 158, pose: 'loaf', up: true },
  sill: { x: 196, y: 130, pose: 'back', up: true },
  desk: { x: 208, y: 131, pose: 'sit', up: true },
  chair: { x: 244, y: 166, pose: 'loaf', up: true },
  fire: { x: 314, y: 211, pose: 'loaf' },
  rug: { x: 214, y: 204, pose: 'loaf' },
};

const POSES = { sit: SIT, loaf: LOAF, back: BACK };
const HAT_AT = { sit: [10, 0], loaf: [12, 0], back: [10, 0], walk: [33, 0] };

export class Cat {
  constructor() {
    this.x = 214; this.y = FLOOR_Y; this.up = false;
    this.pose = 'sit'; this.facing = 1; // 1 = 오른쪽
    this.steps = []; this.step = null;
    this.look = 0; this.lookY = 0;
    this.blinkUntil = 0; this.nextBlink = 2000;
    this.happyUntil = 0; this.hop = 0; this.hopT = 0;
    this.nextDecision = 8000; this.holdUntil = 0;
    this.spot = null; this.walkPhase = 0;
    this.weather = 'clear'; this.fireOn = false;
    this.onArrive = null;
  }

  get sprite() {
    if (this.pose === 'walk') return WALK[Math.floor(this.walkPhase) % 2];
    return POSES[this.pose];
  }
  get box() {
    const s = this.sprite, h = s.rows.length;
    return { x: this.x - s.w / 2, y: this.y - h - this.hop, w: s.w, h };
  }
  hit(px, py) {
    const b = this.box;
    return px >= b.x - 2 && px <= b.x + b.w + 2 && py >= b.y - 2 && py <= b.y + b.h + 2;
  }
  get busy() { return this.steps.length > 0 || !!this.step; }

  // ── 이동 계획 ──
  plan(steps) { this.steps = steps; this.step = null; this.spot = null; }
  goToSpot(name) {
    const sp = SPOTS[name];
    const steps = [];
    if (this.up) steps.push({ type: 'jump', x: this.x + (sp.x > this.x ? 6 : -6), y: FLOOR_Y });
    if (sp.up) {
      steps.push({ type: 'walk', x: sp.x + (sp.x > 200 ? -10 : 10) });
      steps.push({ type: 'jump', x: sp.x, y: sp.y, up: true });
    } else steps.push({ type: 'walk', x: sp.x });
    steps.push({ type: 'pose', pose: sp.pose, spot: name });
    this.plan(steps);
  }
  goToFloor(x, pose = 'sit', run = false) {
    x = Math.max(66, Math.min(322, x));
    const steps = [];
    if (this.up) steps.push({ type: 'jump', x: this.x + (x > this.x ? 6 : -6), y: FLOOR_Y });
    steps.push({ type: 'walk', x, run });
    steps.push({ type: 'pose', pose });
    this.plan(steps);
  }
  greet(fromX, toX, onDone) {
    this.x = fromX; this.y = FLOOR_Y; this.up = false; this.pose = 'walk';
    this.plan([
      { type: 'walk', x: toX, run: true },
      { type: 'pose', pose: 'sit' },
      { type: 'celebrate', ms: 1400 },
    ]);
    this.onArrive = onDone;
    this.nextDecision = 9000;
  }

  happy(ms = 1600) { this.happyUntil = performance.now() + ms; }
  bounce() { this.hopT = 0.0001; }
  hold(ms) { this.holdUntil = performance.now() + ms; }

  setPointer(px, py) {
    const b = this.box;
    const cx = b.x + b.w / 2, cy = b.y + 6;
    const dx = px - cx, dy = py - cy;
    this.look = Math.abs(dx) < 10 ? 0 : Math.sign(dx);
    this.lookY = dy > 18 ? 1 : 0;
  }

  update(dt, ctx) {
    const nowMs = performance.now();
    // 깜빡임
    if (nowMs > this.nextBlink) { this.blinkUntil = nowMs + 140; this.nextBlink = nowMs + 2500 + Math.random() * 4000; }
    // 폴짝
    if (this.hopT > 0) {
      this.hopT += dt / 380;
      this.hop = Math.round(Math.sin(Math.min(1, this.hopT) * Math.PI) * 7);
      if (this.hopT >= 1) { this.hopT = 0; this.hop = 0; }
    }
    if (!this.step && this.steps.length) this.step = { ...this.steps.shift(), t: 0, sx: this.x, sy: this.y };
    const st = this.step;
    if (st) {
      if (st.type === 'walk') {
        const speed = st.run ? 115 : 38;
        const d = st.x - this.x;
        this.pose = 'walk'; this.facing = d >= 0 ? 1 : -1;
        this.walkPhase += dt / (st.run ? 90 : 200);
        const mv = Math.sign(d) * Math.min(Math.abs(d), speed * dt / 1000);
        this.x += mv;
        if (Math.abs(st.x - this.x) < 0.5) { this.x = st.x; this.step = null; }
      } else if (st.type === 'jump') {
        st.t += dt / 450;
        const p = Math.min(1, st.t);
        this.pose = 'sit';
        this.facing = st.x >= st.sx ? 1 : -1;
        this.x = st.sx + (st.x - st.sx) * p;
        this.y = st.sy + (st.y - st.sy) * p - Math.sin(p * Math.PI) * 16;
        if (p >= 1) { this.y = st.y; this.up = !!st.up; this.step = null; ctx?.thump?.(); }
      } else if (st.type === 'pose') {
        this.pose = st.pose; this.spot = st.spot || null; this.step = null;
      } else if (st.type === 'celebrate') {
        if (st.t === 0) { this.happy(st.ms); ctx?.celebrate?.(this); }
        st.t += dt;
        if (Math.floor(st.t / 450) !== Math.floor((st.t - dt) / 450)) this.bounce();
        if (st.t >= st.ms) { this.step = null; this.onArrive?.(); this.onArrive = null; }
      }
      return;
    }
    // 가만히 있을 때: 가끔 자리 옮기기
    if (nowMs < this.holdUntil) return;
    this.nextDecision -= dt;
    if (this.nextDecision <= 0) {
      this.nextDecision = 14000 + Math.random() * 16000;
      this.decide();
    }
  }

  decide() {
    const w = {
      sofa: 3, sill: this.weather === 'rain' || this.weather === 'snow' ? 5 : 2,
      desk: 2, chair: 2, fire: this.fireOn ? 5 : 0.6, rug: 2, wander: 2,
    };
    if (this.spot) delete w[this.spot];
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(w)) {
      r -= v;
      if (r <= 0) {
        if (k === 'wander') this.goToFloor(70 + Math.random() * 250, Math.random() < 0.5 ? 'sit' : 'loaf');
        else this.goToSpot(k);
        return;
      }
    }
  }

  draw(g, festive) {
    const s = this.sprite;
    const h = s.rows.length;
    const x0 = Math.round(this.x - s.w / 2), y0 = Math.round(this.y - h - this.hop);
    const flip = this.pose === 'walk' ? this.facing < 0 : false;
    // 그림자
    if (!this.hop && this.step?.type !== 'jump') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 + 1, Math.round(this.y), s.w - 2, 1); }
    // 어두운 배경에서도 보이도록 은은한 테두리 빛
    const rim = { k: 'rgba(150,160,200,0.28)', h: 'rgba(150,160,200,0.28)', e: 'rgba(150,160,200,0.28)', n: 'rgba(150,160,200,0.28)' };
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1]]) drawRows(g, s.rows, rim, x0 + ox, y0 + oy, flip);
    drawRows(g, s.rows, CAT_PAL, x0, y0, flip);
    const nowMs = performance.now();
    const blink = nowMs < this.blinkUntil;
    const happy = nowMs < this.happyUntil;
    if (s.eyes) {
      const G = '#62e07c';
      for (const [ex, ey] of s.eyes) {
        if (s.side) {
          const fx = flip ? s.w - ex - 3 : ex;
          if (blink || happy) R(g, x0 + fx, y0 + ey + 2, 3, 1, G);
          else { R(g, x0 + fx, y0 + ey, 3, 3, G); R(g, x0 + fx + (flip ? 0 : 2), y0 + ey, 1, 3, '#0b0c0f'); }
          continue;
        }
        if (happy) {
          R(g, x0 + ex, y0 + ey + 2, 1, 1, G); R(g, x0 + ex + 1, y0 + ey + 1, 2, 1, G); R(g, x0 + ex + 3, y0 + ey + 2, 1, 1, G);
        } else if (blink) {
          R(g, x0 + ex, y0 + ey + 2, 4, 1, '#3a8a50');
        } else {
          R(g, x0 + ex, y0 + ey, 4, 3, G);
          R(g, x0 + ex + 1 + this.look, y0 + ey, 2, 3, '#0b0c0f');
          R(g, x0 + ex + (this.look > 0 ? 0 : 3), y0 + ey, 1, 1, '#c8ffd4');
        }
      }
      if (happy && !s.side) { R(g, x0 + s.eyes[0][0] - 1, y0 + s.eyes[0][1] + 4, 3, 1, '#c96a7a'); R(g, x0 + s.eyes[1][0] + 2, y0 + s.eyes[1][1] + 4, 3, 1, '#c96a7a'); }
    }
    if (festive) {
      const [hx, hy] = HAT_AT[this.pose];
      const fx = flip ? s.w - 1 - hx : hx;
      const bx = x0 + fx, by = y0 + hy;
      for (let j = 0; j < 9; j++) R(g, bx - Math.floor(j / 2), by - 9 + j, Math.floor(j / 2) * 2 + 1, 1, j % 3 === 1 ? '#f2c14e' : '#e05a8a');
      R(g, bx - 1, by - 11, 3, 2, '#fff2a8');
    }
  }
}
