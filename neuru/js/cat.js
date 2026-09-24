// 느루 — 움직임 / 표정 / 그리기
import { drawCat, catBox } from './catdraw.js';

const FLOOR_Y = 205;
export const SPOTS = {
  sofa: { x: 100, y: 158, pose: 'loaf', up: true },
  sill: { x: 196, y: 130, pose: 'back', up: true },
  desk: { x: 208, y: 131, pose: 'sit', up: true },
  chair: { x: 244, y: 166, pose: 'loaf', up: true },
  fire: { x: 314, y: 211, pose: 'loaf' },
  rug: { x: 214, y: 204, pose: 'loaf' },
};


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

  get box() {
    const [bx, by, w, h] = catBox(this.pose);
    return { x: this.x + bx, y: this.y + by - this.hop, w, h };
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
        this.walkPhase += dt / (st.run ? 45 : 110);
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
    const nowMs = performance.now();
    const happy = nowMs < this.happyUntil;
    const walking = this.pose === 'walk';
    const b = this.box;
    if (!this.hop && this.step?.type !== 'jump') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(Math.round(b.x + 3), Math.round(this.y), b.w - 6, 1); }
    drawCat(g, this.pose, Math.round(this.x), Math.round(this.y - this.hop), {
      t: nowMs, look: this.look, blink: nowMs < this.blinkUntil, happy,
      walkPhase: this.walkPhase, flip: walking ? this.facing < 0 : false, festive,
      sway: happy ? 1.0 : walking ? 0.35 : 0.55,
      speed: happy ? 110 : walking ? 160 : 520,
    });
  }
}
