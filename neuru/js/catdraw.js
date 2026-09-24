// 느루 그리기 — 동글동글한 오리지널 도트 고양이 (도형을 겹쳐 그림, 꼬리는 매 프레임 움직임)
const C = {
  body: '#16171c', shade: '#0d0e12', hi: '#2b2e38', hi2: '#3b3f4d',
  ear: '#5a3444', nose: '#e0909f', mouth: '#3a2028', whisker: '#7a8192',
  eye: '#6ee888', eyeDk: '#2f9e52', pupil: '#08090c', shine: '#effff3', blush: '#d9788a',
  rim: 'rgba(160,170,215,0.30)',
};

// ── 도형 ──
function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) - 0.15);
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
      if ((y >= Math.min(ay, by)) && (y <= Math.max(ay, by)) && ay !== by) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
    }
    if (xs.length >= 2) { const a = Math.round(Math.min(...xs)), b = Math.round(Math.max(...xs)); g.fillRect(a, y, b - a + 1, 1); }
  }
}
const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };

// 꼬리 점 계산
function tailPoints(base, a0, curl, sway, t, speed, n = 13, step = 1.7) {
  const pts = [[base[0], base[1]]];
  let x = base[0], y = base[1];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = a0 + curl * k + sway * Math.sin(t / speed - i * 0.32) * Math.pow(k, 1.3);
    x += Math.cos(a) * step; y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
}

// 포즈별 모양 정의 (발 가운데가 (0,0), 오른쪽을 보는 기준)
function shapes(pose, o) {
  const S = [];
  const e = (x, y, rx, ry, col = C.body) => S.push({ k: 'e', x, y, rx, ry, col });
  const t3 = (pts, col = C.body) => S.push({ k: 't', pts, col });
  const r = (x, y, w, h, col) => S.push({ k: 'r', x, y, w, h, col, deco: true });
  const tail = (pts, front = false) => S.push({ k: 'tail', pts, front });
  const breathe = Math.round(Math.sin(o.t / 900) * 0.6);

  if (pose === 'sit') {
    tail(tailPoints([9, -4], -0.15, -2.4, o.sway, o.t, o.speed));
    e(-8, -5, 6, 5); e(8, -5, 6, 5);             // 엉덩이
    e(0, -9 - breathe, 11, 9); e(0, -5, 12, 5);   // 몸통
    e(0, -14 - breathe, 8, 6);                    // 가슴
    e(-4, -1, 3, 2); e(4, -1, 3, 2);              // 앞발
    e(0, -22, 10, 8);                             // 머리
    e(-7, -19, 5, 4); e(7, -19, 5, 4);            // 볼살
    t3([[-10, -24], [-8, -33], [-3, -28]]); t3([[10, -24], [8, -33], [3, -28]]);
    t3([[-8, -26], [-8, -31], [-5, -28]], C.ear); t3([[8, -26], [8, -31], [5, -28]], C.ear);
    r(-4, -30, 8, 1, C.hi); r(-6, -29, 2, 1, C.hi); r(4, -29, 2, 1, C.hi);
    r(-2, -15, 1, 4, C.hi); r(-5, -1, 1, 1, C.hi); r(3, -1, 1, 1, C.hi);
    r(-12, -19, 1, 2, C.body); r(11, -19, 1, 2, C.body);
    return { S, eyes: [[-6, -24], [3, -24]], nose: [-1, -20], whiskers: [[-14, -20], [-14, -18], [12, -20], [12, -18]], hat: [0, -31], box: [-14, -34, 28, 34] };
  }
  if (pose === 'loaf') {
    e(10, -8, 7, 6);
    e(0, -7 - breathe, 16, 7);
    e(-5, -1, 3, 1); e(3, -1, 3, 1);
    e(0, -17, 10, 8);
    e(-7, -14, 5, 4); e(7, -14, 5, 4);
    t3([[-10, -19], [-8, -28], [-3, -23]]); t3([[10, -19], [8, -28], [3, -23]]);
    t3([[-8, -21], [-8, -26], [-5, -23]], C.ear); t3([[8, -21], [8, -26], [5, -23]], C.ear);
    r(-4, -25, 8, 1, C.hi); r(-12, -11, 6, 1, C.hi); r(8, -13, 6, 1, C.hi);
    r(-12, -14, 1, 2, C.body); r(11, -14, 1, 2, C.body);
    tail(tailPoints([14, -4], Math.PI + 0.15, -0.4, o.sway * 0.35, o.t, o.speed, 14, 1.6), true);
    return { S, eyes: [[-6, -19], [3, -19]], nose: [-1, -15], whiskers: [[-14, -15], [-14, -13], [12, -15], [12, -13]], hat: [0, -26], box: [-18, -29, 36, 29] };
  }
  if (pose === 'back') {
    e(-8, -5, 6, 5); e(8, -5, 6, 5);
    e(0, -10 - breathe, 11, 10); e(0, -5, 12, 5);
    e(0, -24, 9, 8);
    e(-6, -21, 4, 3); e(6, -21, 4, 3);
    t3([[-9, -26], [-7, -35], [-2, -30]]); t3([[9, -26], [7, -35], [2, -30]]);
    r(-7, -33, 1, 4, C.hi2); r(6, -33, 1, 4, C.hi2);
    r(-4, -32, 8, 1, C.hi); r(0, -18, 1, 9, C.hi); r(-9, -16, 3, 1, C.hi); r(7, -16, 3, 1, C.hi);
    tail(tailPoints([9, -3], 0.1, -2.1, o.sway, o.t, o.speed, 12, 1.7), true);
    return { S, hat: [0, -33], box: [-14, -36, 28, 36] };
  }
  // walk (옆모습)
  const ph = o.walkPhase;
  const bob = Math.round(Math.abs(Math.sin(ph)) * -1);
  tail(tailPoints([-14, -15 + bob], -2.3, 1.3, o.sway * 0.8, o.t, o.speed * 0.8));
  const leg = (x, off, col) => {
    const s = Math.sin(ph + off);
    const lift = Math.max(0, s) * 2.2;
    const dx = Math.round(Math.cos(ph + off) * 1.5);
    S.push({ k: 'r', x: x + dx, y: -7 + bob, w: 4, h: Math.round(7 - lift), col, leg: true });
    S.push({ k: 'r', x: x + dx - (col === C.body ? 0 : 0), y: -1 - Math.round(lift) + 0, w: 5, h: 1, col, leg: true });
  };
  leg(-11, Math.PI, C.shade); leg(6, 0, C.shade);
  e(-9, -12 + bob, 7, 6);                   // 엉덩이
  e(-1, -11 + bob, 13, 7);                  // 몸통
  e(-1, -8 + bob, 11, 5);                   // 배
  e(8, -12 + bob, 6, 6);                    // 가슴
  leg(-8, 0, C.body); leg(9, Math.PI, C.body);
  e(13, -18 + bob, 8, 7);                   // 머리
  e(16, -15 + bob, 5, 4);                   // 볼
  t3([[8, -22 + bob], [9, -29 + bob], [13, -23 + bob]]); t3([[12, -23 + bob], [16, -29 + bob], [18, -21 + bob]]);
  t3([[10, -23 + bob], [10, -27 + bob], [12, -23 + bob]], C.ear); t3([[14, -23 + bob], [16, -27 + bob], [17, -22 + bob]], C.ear);
  r(-12, -18 + bob, 16, 1, C.hi); r(9, -25 + bob, 6, 1, C.hi);
  return { S, side: true, eyes: [[16, -20 + bob]], nose: [21, -16 + bob], whiskers: [[19, -14 + bob], [19, -12 + bob]], hat: [13, -26 + bob], box: [-22, -30, 44, 30] };
}

export function catBox(pose) {
  return shapes(pose, { t: 0, sway: 0, speed: 1, walkPhase: 0 }).box;
}

// o: { t, look, blink, happy, walkPhase, sway, speed, festive, flip }
export function drawCat(g, pose, x0, y0, o) {
  const f = o.flip ? -1 : 1;
  const d = shapes(pose, o);
  const X = (x) => x0 + x * f;
  const put = (s, col, grow = 0) => {
    if (s.k === 'e') ellipse(g, X(s.x), y0 + s.y, s.rx + grow, s.ry + grow, col);
    else if (s.k === 't') tri(g, s.pts.map(([x, y]) => [X(x), y0 + y + (grow ? -grow : 0)]), col);
    else if (s.k === 'r') { const x = f > 0 ? X(s.x) : X(s.x) - s.w + 1; rect(g, x - grow, y0 + s.y - grow, s.w + grow * 2, s.h + grow * 2, col); }
    else if (s.k === 'tail') {
      s.pts.forEach(([x, y], i) => {
        const n = s.pts.length; const rr = i < n * 0.35 ? 2 : i < n * 0.8 ? 1.5 : 1;
        ellipse(g, X(x), y0 + y, rr + grow, rr + grow, i === s.pts.length - 1 && !grow ? C.hi : col);
      });
    }
  };
  // 테두리 빛 → 몸 → 장식
  for (const s of d.S) if (!s.deco && s.col !== C.ear) put(s, C.rim, 1);
  for (const s of d.S) if (s.k === 'tail' && !s.front) put(s, C.body);
  for (const s of d.S) if (s.k !== 'tail' && !s.deco) put(s, s.col);
  for (const s of d.S) if (s.k === 'tail' && s.front) { put(s, C.hi, 1); put(s, C.body); }
  for (const s of d.S) if (s.deco) put(s, s.col);

  // 눈
  if (d.eyes) {
    for (const [ex0, ey0] of d.eyes) {
      const ey = y0 + ey0;
      if (d.side) {
        const ex = f > 0 ? X(ex0) : X(ex0) - 2;
        if (o.blink || o.happy) { rect(g, ex, ey + 2, 3, 1, C.eye); continue; }
        rect(g, ex, ey, 3, 4, C.eye); rect(g, ex, ey + 3, 3, 1, C.eyeDk);
        rect(g, f > 0 ? ex + 2 : ex, ey, 1, 4, C.pupil); rect(g, f > 0 ? ex : ex + 2, ey, 1, 1, C.shine);
        continue;
      }
      const ex = X(ex0);
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
    const nx = d.side ? (f > 0 ? X(d.nose[0]) : X(d.nose[0])) : X(d.nose[0]);
    rect(g, d.side ? nx : nx, y0 + d.nose[1], d.side ? 1 : 3, 1, C.nose);
    if (!d.side) { rect(g, X(-1), y0 + d.nose[1] + 2, 1, 1, C.mouth); rect(g, X(1), y0 + d.nose[1] + 2, 1, 1, C.mouth); rect(g, X(0), y0 + d.nose[1] + 1, 1, 1, C.mouth); }
  }
  if (d.whiskers) for (const [wx, wy] of d.whiskers) rect(g, f > 0 ? X(wx) : X(wx) - 2, y0 + wy, 3, 1, C.whisker);
  if (o.festive && d.hat) {
    const hx = X(d.hat[0]), hy = y0 + d.hat[1];
    for (let j = 0; j < 9; j++) rect(g, hx - Math.floor(j / 2), hy - 9 + j, Math.floor(j / 2) * 2 + 1, 1, j % 3 === 1 ? '#f2c14e' : '#e05a8a');
    rect(g, hx - 1, hy - 11, 3, 2, '#fff2a8');
  }
}
