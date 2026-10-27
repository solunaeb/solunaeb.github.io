// 느루 — 움직임 / 표정 / 잠 / 밥 / 놀이
import { drawCat, catBox, catHead } from './catdraw.js';

export const FLOOR_Y = 205;
export const SPOTS = {
  sofa: { x: 100, y: 158, pose: 'loaf', up: true },
  sill: { x: 196, y: 130, pose: 'back', up: true },
  chair: { x: 244, y: 166, pose: 'loaf', up: true },
  fire: { x: 314, y: 211, pose: 'loaf' },
  rug: { x: 214, y: 204, pose: 'loaf' },
};
const SLEEP_AFTER = 50000; // 이 시간 동안 건드리지 않으면 잠

export class Cat {
  constructor() {
    this.x = 214; this.y = FLOOR_Y; this.up = false;
    this.pose = 'sit'; this.facing = 1;
    this.steps = []; this.step = null;
    this.look = 0;
    this.blinkUntil = 0; this.nextBlink = 2000;
    this.happyUntil = 0; this.hop = 0; this.hopT = 0;
    this.nextDecision = 8000; this.holdUntil = 0;
    this.spot = null; this.walkPhase = 0;
    this.weather = 'clear'; this.fireOn = false;
    this.onArrive = null;
    this.grow = 0;
    this.sleeping = false; this.lastTouch = performance.now(); this.nextZ = 0;
  }

  get box() {
    const [bx, by, w, h] = catBox(this.pose, this.grow);
    const flip = (this.pose === 'walk' || this.pose === 'eat') && this.facing < 0;
    return { x: flip ? this.x - bx - w : this.x + bx, y: this.y + by - this.hop, w, h };
  }
  get head() {
    const [hx, hy] = catHead(this.pose, this.grow);
    const flip = (this.pose === 'walk' || this.pose === 'eat') && this.facing < 0;
    return [this.x + (flip ? -hx : hx), this.y + hy - this.hop];
  }
  hit(px, py) {
    const b = this.box;
    return px >= b.x - 2 && px <= b.x + b.w + 2 && py >= b.y - 2 && py <= b.y + b.h + 2;
  }
  get busy() { return this.steps.length > 0 || !!this.step; }

  // ── 이동 계획 ──
  plan(steps) { this.steps = steps; this.step = null; this.spot = null; this.sleeping = false; }
  goToSpot(name, pose) {
    const sp = SPOTS[name];
    const steps = [];
    if (this.up) steps.push({ type: 'jump', x: this.x + (sp.x > this.x ? 6 : -6), y: FLOOR_Y });
    if (sp.up) {
      steps.push({ type: 'walk', x: sp.x + (sp.x > 200 ? -10 : 10) });
      steps.push({ type: 'jump', x: sp.x, y: sp.y, up: true });
    } else steps.push({ type: 'walk', x: sp.x });
    steps.push({ type: 'pose', pose: pose || sp.pose, spot: name, sleep: pose === 'sleep' });
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
    this.plan([{ type: 'walk', x: toX, run: true }, { type: 'pose', pose: 'sit' }, { type: 'celebrate', ms: 1400 }]);
    this.onArrive = onDone;
    this.nextDecision = 9000; this.lastTouch = performance.now();
  }
  // 밥그릇 오른쪽에 서서 왼쪽을 보고 오물오물
  goEat(bowlX, ms = 5000) {
    const standX = bowlX + 12 + 16 * (0.6 + 0.4 * this.grow);
    const steps = [];
    if (this.up) steps.push({ type: 'jump', x: this.x - 6, y: FLOOR_Y });
    steps.push({ type: 'walk', x: standX, run: Math.abs(standX - this.x) > 60 }, { type: 'face', dir: -1 }, { type: 'pose', pose: 'eat' }, { type: 'wait', ms, tick: 'eat' }, { type: 'pose', pose: 'sit' });
    this.plan(steps);
  }
  // 공을 향해 달려가 덮치기
  pounce(targetX) {
    const steps = [];
    if (this.up) steps.push({ type: 'jump', x: this.x + (targetX > this.x ? 6 : -6), y: FLOOR_Y });
    const dir = targetX > this.x ? 1 : -1;
    steps.push({ type: 'walk', x: targetX - dir * 10, run: true }, { type: 'jump', x: targetX - dir * 4, y: FLOOR_Y, hopH: 10, pounce: true }, { type: 'pose', pose: 'sit' });
    this.plan(steps);
  }

  happy(ms = 1600) { this.happyUntil = performance.now() + ms; }
  bounce() { this.hopT = 0.0001; }
  hold(ms) { this.holdUntil = performance.now() + ms; }
  touch() {
    this.lastTouch = performance.now();
    if (this.sleeping) this.wake();
  }
  wake() {
    this.sleeping = false;
    this.pose = this.up || this.spot === 'fire' || this.spot === 'rug' ? (SPOTS[this.spot]?.pose || 'sit') : 'sit';
    this.happy(1200); this.bounce();
    this.lastTouch = performance.now();
  }

  setPointer(px, py) {
    const b = this.box;
    const dx = px - (b.x + b.w / 2);
    this.look = Math.abs(dx) < 10 ? 0 : Math.sign(dx);
  }

  update(dt, ctx) {
    const nowMs = performance.now();
    if (nowMs > this.nextBlink) { this.blinkUntil = nowMs + 140; this.nextBlink = nowMs + 2500 + Math.random() * 4000; }
    if (this.hopT > 0) {
      this.hopT += dt / 380;
      this.hop = Math.round(Math.sin(Math.min(1, this.hopT) * Math.PI) * 7);
      if (this.hopT >= 1) { this.hopT = 0; this.hop = 0; }
    }
    if (!this.step && this.steps.length) this.step = { ...this.steps.shift(), t: 0, sx: this.x, sy: this.y };
    const st = this.step;
    if (st) {
      if (st.type === 'walk') {
        const speed = (st.run ? 115 : 38) * (0.75 + 0.25 * this.grow);
        const d = st.x - this.x;
        this.pose = 'walk'; this.facing = d >= 0 ? 1 : -1;
        this.walkPhase += dt / (st.run ? 45 : 110);
        this.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt / 1000);
        if (Math.abs(st.x - this.x) < 0.5) { this.x = st.x; this.step = null; }
      } else if (st.type === 'jump') {
        st.t += dt / (st.pounce ? 380 : 450);
        const p = Math.min(1, st.t);
        this.pose = st.pounce ? 'walk' : 'sit';
        this.facing = st.x >= st.sx ? 1 : -1;
        this.x = st.sx + (st.x - st.sx) * p;
        this.y = st.sy + (st.y - st.sy) * p - Math.sin(p * Math.PI) * (st.hopH || 16);
        if (p >= 1) { this.y = st.y; this.up = st.y < FLOOR_Y - 2; this.step = null; if (st.pounce) ctx?.pounce?.(this); }
      } else if (st.type === 'face') {
        this.facing = st.dir; this.step = null;
      } else if (st.type === 'wait') {
        st.t += dt;
        if (st.tick === 'eat' && Math.floor(st.t / 700) !== Math.floor((st.t - dt) / 700)) ctx?.eatTick?.(this);
        if (st.t >= st.ms) this.step = null;
      } else if (st.type === 'pose') {
        this.pose = st.pose; this.spot = st.spot || null; this.step = null;
        if (st.sleep) { this.sleeping = true; this.pose = 'sleep'; }
      } else if (st.type === 'celebrate') {
        if (st.t === 0) { this.happy(st.ms); ctx?.celebrate?.(this); }
        st.t += dt;
        if (Math.floor(st.t / 450) !== Math.floor((st.t - dt) / 450)) this.bounce();
        if (st.t >= st.ms) { this.step = null; this.onArrive?.(); this.onArrive = null; }
      }
      return;
    }
    if (this.sleeping) {
      if (nowMs > this.nextZ) { this.nextZ = nowMs + 2200; ctx?.zzz?.(this); }
      return;
    }
    if (nowMs < this.holdUntil) return;
    // 한동안 아무도 안 건드리면 잠들기
    if (nowMs - this.lastTouch > SLEEP_AFTER) {
      const spots = this.fireOn ? ['fire', 'fire', 'sofa'] : ['sofa', 'rug', 'chair'];
      this.goToSpot(spots[Math.floor(Math.random() * spots.length)], 'sleep');
      return;
    }
    this.nextDecision -= dt;
    if (this.nextDecision <= 0) {
      this.nextDecision = 14000 + Math.random() * 16000;
      this.decide(ctx);
    }
  }

  decide(ctx) {
    const w = {
      sofa: 3, sill: this.weather === 'rain' || this.weather === 'snow' ? 5 : 2,
      chair: 2, fire: this.fireOn ? 5 : 0.6, rug: 2, wander: 2,
      eat: ctx?.canEat?.() ? 2 : 0, play: ctx?.canPlay?.() ? 2 : 0,
    };
    if (this.spot) delete w[this.spot];
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(w)) {
      r -= v;
      if (r <= 0) {
        if (k === 'wander') this.goToFloor(70 + Math.random() * 250, Math.random() < 0.5 ? 'sit' : 'loaf');
        else if (k === 'eat') ctx.startEat();
        else if (k === 'play') ctx.startPlay();
        else this.goToSpot(k);
        return;
      }
    }
  }

  draw(g, festive) {
    const nowMs = performance.now();
    const happy = nowMs < this.happyUntil;
    const side = this.pose === 'walk' || this.pose === 'eat';
    const b = this.box;
    if (!this.hop && this.step?.type !== 'jump') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(Math.round(b.x + 3), Math.round(this.y), Math.max(1, b.w - 6), 1); }
    drawCat(g, this.pose, Math.round(this.x), Math.round(this.y - this.hop), {
      t: nowMs, look: this.look, blink: nowMs < this.blinkUntil, happy,
      walkPhase: this.walkPhase, flip: side ? this.facing < 0 : false, festive, grow: this.grow,
      sway: this.sleeping ? 0.2 : happy ? 1.0 : side ? 0.35 : 0.55,
      speed: this.sleeping ? 1400 : happy ? 110 : side ? 160 : 520,
    });
  }
}
