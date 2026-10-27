// 느루 그리기 — 동글동글한 오리지널 도트 고양이
// 도형을 겹쳐 그리고, 꼬리는 매 프레임 움직임. o.grow(0~1)로 아기 고양이 → 어른 고양이
const C = {
  body: '#16171c', shade: '#0d0e12', hi: '#2b2e38', hi2: '#3b3f4d',
  ear: '#5a3444', nose: '#e0909f', mouth: '#3a2028', whisker: '#7a8192',
  eye: '#6ee888', eyeDk: '#2f9e52', pupil: '#08090c', shine: '#effff3', blush: '#d9788a',
  rim: 'rgba(160,170,215,0.30)',
};

function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  const R = Math.max(1, Math.round(ry));
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (R * R))) - 0.15);
    g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}
function tri(g, pts, col) {
  g.fillStyle = col;
  const ys = pts.map(p => p[1]);
  const y0 = Math.round(Math.min(...ys)), y1 = Math.round(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3];
      if (y >= Math.min(ay, by) && y <= Math.max(ay, by) && ay !== by) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
    }
    if (xs.length >= 2) { const a = Math.round(Math.min(...xs)), b = Math.round(Math.max(...xs)); g.fillRect(a, y, b - a + 1, 1); }
  }
}
const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };

// 꼬리: 굵은 뿌리에서 끝으로 갈수록 가늘어짐
function tailPoints(base, a0, curl, sway, t, speed, n = 12, step = 1.6) {
  const pts = [[base[0], base[1]]];
  let x = base[0], y = base[1];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = a0 + curl * k + sway * Math.sin(t / speed - i * 0.3) * Math.pow(k, 1.4);
    x += Math.cos(a) * step; y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
}

// 포즈별 모양 (발 가운데가 (0,0), 오른쪽을 보는 기준). head:true 인 도형은 머리에 붙는 부분
function shapes(pose, o) {
  const S = [];
  let H = false;
  const e = (x, y, rx, ry, col = C.body) => S.push({ k: 'e', x, y, rx, ry, col, head: H });
  const t3 = (pts, col = C.body) => S.push({ k: 't', pts, col, head: H });
  const r = (x, y, w, h, col) => S.push({ k: 'r', x, y, w, h, col, deco: true, head: H });
  const tail = (pts, front = false) => S.push({ k: 'tail', pts, front });
  const breathe = Math.round(Math.sin(o.t / (pose === 'sleep' ? 1300 : 900)) * (pose === 'sleep' ? 1 : 0.6));

  if (pose === 'sit') {
    tail(tailPoints([9, -5], -0.1, -2.2, o.sway, o.t, o.speed, 12, 1.7));
    e(-8, -5, 6, 5); e(8, -5, 6, 5);
    e(0, -9 - breathe, 11, 9); e(0, -5, 12, 5);
    e(0, -14 - breathe, 8, 6);
    e(-4, -1, 3, 2); e(4, -1, 3, 2);
    r(-2, -15, 1, 4, C.hi); r(-5, -1, 1, 1, C.hi); r(3, -1, 1, 1, C.hi);
    H = true;
    e(0, -22, 10, 8);
    e(-7, -19, 5, 4); e(7, -19, 5, 4);
    t3([[-10, -24], [-8, -33], [-3, -28]]); t3([[10, -24], [8, -33], [3, -28]]);
    t3([[-8, -26], [-8, -31], [-5, -28]], C.ear); t3([[8, -26], [8, -31], [5, -28]], C.ear);
    r(-4, -30, 8, 1, C.hi); r(-6, -29, 2, 1, C.hi); r(4, -29, 2, 1, C.hi);
    r(-12, -19, 1, 2, C.body); r(11, -19, 1, 2, C.body);
    return { S, headC: [0, -22], eyes: [[-6, -24], [3, -24]], nose: [-1, -20], whiskers: [[-14, -20], [-14, -18], [12, -20], [12, -18]], hat: [0, -31], box: [-14, -34, 28, 34] };
  }
  if (pose === 'loaf') {
    e(10, -8, 7, 6);
    e(0, -7 - breathe, 16, 7);
    e(-5, -1, 3, 1); e(3, -1, 3, 1);
    r(-12, -11, 6, 1, C.hi); r(8, -13, 6, 1, C.hi);
    tail(tailPoints([14, -4], Math.PI + 0.15, -0.4, o.sway * 0.35, o.t, o.speed, 13, 1.6), true);
    H = true;
    e(0, -17, 10, 8);
    e(-7, -14, 5, 4); e(7, -14, 5, 4);
    t3([[-10, -19], [-8, -28], [-3, -23]]); t3([[10, -19], [8, -28], [3, -23]]);
    t3([[-8, -21], [-8, -26], [-5, -23]], C.ear); t3([[8, -21], [8, -26], [5, -23]], C.ear);
    r(-4, -25, 8, 1, C.hi);
    r(-12, -14, 1, 2, C.body); r(11, -14, 1, 2, C.body);
    return { S, headC: [0, -17], eyes: [[-6, -19], [3, -19]], nose: [-1, -15], whiskers: [[-14, -15], [-14, -13], [12, -15], [12, -13]], hat: [0, -26], box: [-18, -29, 36, 29] };
  }
  if (pose === 'sleep') {
    // 동그랗게 말고 자는 모습 (머리를 앞발에 얹고 꼬리로 감쌈)
    e(2, -7 - breathe, 15, 7);
    e(9, -9 - breathe, 7, 6);
    r(-2, -13 - breathe, 12, 1, C.hi); r(8, -14 - breathe, 5, 1, C.hi2);
    H = true;
    e(-9, -8, 8, 6);
    e(-13, -6, 4, 3);
    t3([[-15, -11], [-15, -17], [-10, -13]]); t3([[-8, -13], [-5, -18], [-3, -12]]);
    t3([[-14, -12], [-14, -15], [-12, -13]], C.ear); t3([[-7, -13], [-5, -16], [-4, -13]], C.ear);
    r(-12, -13, 5, 1, C.hi);
    H = false;
    e(-6, -1, 4, 1.5); e(-12, -1, 3, 1.5);
    tail(tailPoints([16, -3], Math.PI + 0.1, -0.25, o.sway * 0.25, o.t, o.speed, 16, 1.6), true);
    return { S, headC: [-9, -8], sleepEyes: [[-14, -9], [-8, -9]], nose: null, box: [-18, -20, 36, 20] };
  }
  if (pose === 'back') {
    e(-8, -5, 6, 5); e(8, -5, 6, 5);
    e(0, -10 - breathe, 11, 10); e(0, -5, 12, 5);
    r(0, -18, 1, 9, C.hi); r(-9, -16, 3, 1, C.hi); r(7, -16, 3, 1, C.hi);
    tail(tailPoints([9, -3], 0.1, -2.1, o.sway, o.t, o.speed, 12, 1.7), true);
    H = true;
    e(0, -24, 9, 8);
    e(-6, -21, 4, 3); e(6, -21, 4, 3);
    t3([[-9, -26], [-7, -35], [-2, -30]]); t3([[9, -26], [7, -35], [2, -30]]);
    r(-7, -33, 1, 4, C.hi2); r(6, -33, 1, 4, C.hi2);
    r(-4, -32, 8, 1, C.hi);
    return { S, headC: [0, -24], hat: [0, -33], box: [-14, -36, 28, 36] };
  }
  // walk / eat (옆모습). eat 는 제자리에서 머리를 숙여 오물오물
  const eat = pose === 'eat';
  const ph = eat ? 0 : o.walkPhase;
  const bob = eat ? 0 : Math.round(Math.abs(Math.sin(ph)) * -1);
  const nib = eat ? Math.round((Math.sin(o.t / 140) + 1) * 0.8) : 0;
  tail(tailPoints([-13, -15 + bob], -2.25, 1.2, o.sway * 0.8, o.t, o.speed * 0.8, 12, 1.7));
  const leg = (x, off, col) => {
    const s = eat ? 0 : Math.sin(ph + off);
    const lift = Math.max(0, s) * 2.2;
    const dx = eat ? 0 : Math.round(Math.cos(ph + off) * 1.5);
    S.push({ k: 'r', x: x + dx, y: -7 + bob, w: 4, h: Math.round(7 - lift), col });
    S.push({ k: 'r', x: x + dx, y: -1 - Math.round(lift), w: 5, h: 1, col });
  };
  leg(-11, Math.PI, C.shade); leg(6, 0, C.shade);
  e(-9, -12 + bob, 7, 6);
  e(-1, -11 + bob, 13, 7);
  e(-1, -8 + bob, 11, 5);
  e(8, -12 + bob, 6, 6);
  leg(-8, 0, C.body); leg(9, Math.PI, C.body);
  r(-12, -18 + bob, 16, 1, C.hi);
  H = true;
  const hy = eat ? 8 + nib : 0, hx = eat ? 3 : 0;
  e(13 + hx, -18 + bob + hy, 8, 7);
  e(16 + hx, -15 + bob + hy, 5, 4);
  t3([[8 + hx, -22 + bob + hy], [9 + hx, -29 + bob + hy], [13 + hx, -23 + bob + hy]]); t3([[12 + hx, -23 + bob + hy], [16 + hx, -29 + bob + hy], [18 + hx, -21 + bob + hy]]);
  t3([[10 + hx, -23 + bob + hy], [10 + hx, -27 + bob + hy], [12 + hx, -23 + bob + hy]], C.ear); t3([[14 + hx, -23 + bob + hy], [16 + hx, -27 + bob + hy], [17 + hx, -22 + bob + hy]], C.ear);
  r(9 + hx, -25 + bob + hy, 6, 1, C.hi);
  return {
    S, side: true, eatEyes: eat, headC: [13 + hx, -18 + bob + hy], eyes: [[16 + hx, -20 + bob + hy]], nose: [21 + hx, -16 + bob + hy],
    whiskers: [[19 + hx, -14 + bob + hy], [19 + hx, -12 + bob + hy]], hat: [13 + hx, -26 + bob + hy], box: [-22, -30, 44, 30],
  };
}

// 성장: 몸 전체 k 배, 머리는 아기일수록 상대적으로 크게
function growth(grow) {
  const gr = Math.max(0, Math.min(1, grow ?? 1));
  return { k: 0.6 + 0.4 * gr, hb: 1 + 0.3 * (1 - gr) };
}
function transform(d, grow) {
  const { k, hb } = growth(grow);
  const hc = d.headC;
  const hcS = [hc[0] * k, hc[1] * k];
  const P = (x, y, head) => head ? [hcS[0] + (x - hc[0]) * k * hb, hcS[1] + (y - hc[1]) * k * hb] : [x * k, y * k];
  const out = [];
  for (const s of d.S) {
    const m = s.head ? k * hb : k;
    if (s.k === 'e') { const [x, y] = P(s.x, s.y, s.head); out.push({ ...s, x, y, rx: Math.max(1, s.rx * m), ry: Math.max(1, s.ry * m) }); }
    else if (s.k === 't') out.push({ ...s, pts: s.pts.map(([x, y]) => P(x, y, s.head)) });
    else if (s.k === 'r') { const [x, y] = P(s.x, s.y, s.head); out.push({ ...s, x, y, w: Math.max(1, s.w * (s.deco ? m : k)), h: Math.max(1, s.h * (s.deco ? m : k)) }); }
    else if (s.k === 'tail') out.push({ ...s, pts: s.pts.map(([x, y]) => [x * k, y * k]), thick: 0.75 + 0.25 * k });
  }
  const head = (p) => p && P(p[0], p[1], true);
  const hk = 1 + (hb - 1) * 0.5;
  return {
    ...d, S: out,
    eyes: d.eyes?.map(head), sleepEyes: d.sleepEyes?.map(head),
    nose: head(d.nose), hat: head(d.hat), whiskers: d.whiskers?.map(head),
    box: [d.box[0] * k, d.box[1] * k * hk, d.box[2] * k, d.box[3] * k * hk],
  };
}

export function catBox(pose, grow) {
  return transform(shapes(pose, { t: 0, sway: 0, speed: 1, walkPhase: 0 }), grow).box;
}
export function catHead(pose, grow) {
  const d = transform(shapes(pose, { t: 0, sway: 0, speed: 1, walkPhase: 0 }), grow);
  return d.hat || [0, d.box[1]];
}

// o: { t, look, blink, happy, walkPhase, sway, speed, festive, flip, grow }
export function drawCat(g, pose, x0, y0, o) {
  const f = o.flip ? -1 : 1;
  const d = transform(shapes(pose, o), o.grow);
  const X = (x) => x0 + x * f;
  const put = (s, col, grow = 0) => {
    if (s.k === 'e') ellipse(g, X(s.x), y0 + s.y, s.rx + grow, s.ry + grow, col);
    else if (s.k === 't') tri(g, s.pts.map(([x, y]) => [X(x), y0 + y - grow]), col);
    else if (s.k === 'r') { const w = Math.round(s.w); const x = f > 0 ? X(s.x) : X(s.x) - w + 1; rect(g, x - grow, y0 + s.y - grow, w + grow * 2, s.h + grow * 2, col); }
    else if (s.k === 'tail') {
      const n = s.pts.length;
      s.pts.forEach(([x, y], i) => {
        const taper = 1 - i / (n - 1);
        const rr = Math.max(1.2, (1.5 + taper * 1.5) * (s.thick ?? 1));
        ellipse(g, X(x), y0 + y, rr + grow, rr + grow, col);
      });
      if (!grow) { const [x, y] = s.pts[n - 1]; rect(g, X(x), y0 + y - 1, 1, 1, C.hi); }
    }
  };
  for (const s of d.S) if (!s.deco && s.col !== C.ear) put(s, C.rim, 1);
  for (const s of d.S) if (s.k === 'tail' && !s.front) put(s, C.body);
  for (const s of d.S) if (s.k !== 'tail' && !s.deco) put(s, s.col);
  for (const s of d.S) if (s.k === 'tail' && s.front) { put(s, C.hi, 1); put(s, C.body); }
  for (const s of d.S) if (s.deco) put(s, s.col);

  if (d.sleepEyes) {
    for (const [ex, ey] of d.sleepEyes) { const x = Math.round(X(ex)), y = Math.round(y0 + ey); rect(g, x, y + 1, 1, 1, '#3a8a50'); rect(g, x + 1, y + 2, 2, 1, '#3a8a50'); rect(g, x + 3, y + 1, 1, 1, '#3a8a50'); }
  }
  if (d.eyes) {
    for (const [ex0, ey0] of d.eyes) {
      const ey = Math.round(y0 + ey0);
      if (d.side) {
        const ex = Math.round(f > 0 ? X(ex0) : X(ex0) - 2);
        if (o.blink || o.happy || d.eatEyes) { rect(g, ex, ey + 2, 3, 1, C.eye); continue; }
        rect(g, ex, ey, 3, 4, C.eye); rect(g, ex, ey + 3, 3, 1, C.eyeDk);
        rect(g, f > 0 ? ex + 2 : ex, ey, 1, 4, C.pupil); rect(g, f > 0 ? ex : ex + 2, ey, 1, 1, C.shine);
        continue;
      }
      const ex = Math.round(X(ex0));
      if (o.happy) { rect(g, ex, ey + 2, 1, 1, C.eye); rect(g, ex + 1, ey + 1, 2, 1, C.eye); rect(g, ex + 3, ey + 2, 1, 1, C.eye); }
      else if (o.blink) rect(g, ex, ey + 2, 4, 1, C.eyeDk);
      else {
        rect(g, ex, ey, 4, 4, C.eye); rect(g, ex, ey + 3, 4, 1, C.eyeDk);
        rect(g, ex + 1 + o.look, ey, 2, 4, C.pupil);
        rect(g, o.look > 0 ? ex : ex + 3, ey, 1, 1, C.shine);
      }
    }
    if (o.happy && !d.side) { rect(g, X(d.eyes[0][0]) - 1, y0 + d.eyes[0][1] + 5, 3, 1, C.blush); rect(g, X(d.eyes[1][0]) + 2, y0 + d.eyes[1][1] + 5, 3, 1, C.blush); }
  }
  if (d.nose) {
    const nx = Math.round(X(d.nose[0])), ny = Math.round(y0 + d.nose[1]);
    if (d.side) rect(g, nx, ny, 1, 1, C.nose);
    else { rect(g, nx, ny, 3, 1, C.nose); rect(g, nx, ny + 2, 1, 1, C.mouth); rect(g, nx + 2, ny + 2, 1, 1, C.mouth); rect(g, nx + 1, ny + 1, 1, 1, C.mouth); }
  }
  if (d.whiskers) for (const [wx, wy] of d.whiskers) rect(g, f > 0 ? X(wx) : X(wx) - 2, y0 + wy, 3, 1, C.whisker);
  if (o.festive && d.hat) {
    const hx = Math.round(X(d.hat[0])), hy = Math.round(y0 + d.hat[1]);
    for (let j = 0; j < 9; j++) rect(g, hx - Math.floor(j / 2), hy - 9 + j, Math.floor(j / 2) * 2 + 1, 1, j % 3 === 1 ? '#f2c14e' : '#e05a8a');
    rect(g, hx - 1, hy - 11, 3, 2, '#fff2a8');
  }
}
