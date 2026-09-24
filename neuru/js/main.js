// 널 사랑할고양 — 메인
import { CAT_NAME, END_AT, FIRST_LETTER_AT, TOTAL_DAYS } from './config.js';
import * as T from './time.js';
import { store, persist, resetProgress, addUnique } from './store.js';
import { loadContent, getLetter, getFinale } from './content.js';
import { initAudio, sfx, purr, setAmbience, setMuted, playDay as audioPlay, stopMusic as audioStop, nowPlaying as audioNow } from './audio.js';
import * as S from './scene.js';
import { Cat } from './cat.js';
import * as FX from './effects.js';
import { refreshWeather, weather, weatherText, setWeatherOverride } from './weather.js';
import * as N from './notify.js';
import { toast, banner, modalOpen, closeModal } from './ui.js';
import * as P from './panels.js';

const { W, H } = S;
const canvas = document.getElementById('room');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const stage = document.getElementById('stage');

const cat = new Cat();
let manifest = null;
let entered = false;
let festiveForced = false;
let weatherOverride = null;
let testEnabled = false;
let deferredInstall = null;

// ────────── 화면 배치 (가로: 꽉 맞춤 / 세로: 좌우로 둘러보기) ──────────
const view = { scale: 1, offX: 0, offY: 0, pan: false };
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  view.pan = vw / vh < 1.2;
  stage.classList.toggle('pan', view.pan);
  if (!view.pan) {
    view.scale = Math.min(vw / W, vh / H);
    view.offX = (vw - W * view.scale) / 2;
    view.offY = (vh - H * view.scale) / 2;
  } else {
    view.scale = Math.min((vh * 0.72) / H, vw / (W * 0.36));
    const cssH = H * view.scale;
    const hud = document.getElementById('hud').getBoundingClientRect();
    view.offY = Math.max(hud.bottom + 10, (vh - cssH) / 2);
    if (view.offY + cssH > vh - 70) view.offY = Math.max(hud.bottom + 4, vh - 70 - cssH);
    if (!layout.didCenter) { view.offX = vw / 2 - 232 * view.scale; layout.didCenter = true; }
    clampPan();
  }
  canvas.style.width = W * view.scale + 'px';
  canvas.style.height = H * view.scale + 'px';
  applyPan();
}
function clampPan() {
  if (!view.pan) return;
  const vw = window.innerWidth;
  view.offX = Math.min(0, Math.max(vw - W * view.scale, view.offX));
}
function applyPan() { canvas.style.transform = `translate(${Math.round(view.offX)}px, ${Math.round(view.offY)}px)`; }
function toScene(cx, cy) { return { x: (cx - view.offX) / view.scale, y: (cy - view.offY) / view.scale }; }
function visibleRange() { return { a: -view.offX / view.scale, b: (window.innerWidth - view.offX) / view.scale }; }
window.addEventListener('resize', layout);

// ────────── 상태 계산 ──────────
const now = () => T.now();
const ended = () => festiveForced || T.isEnded(now());
const unlocked = () => (ended() ? TOTAL_DAYS : T.unlockedCount(now()));
const CLEAN_ITEMS = ['blanket', 'trash', 'stain', 'pets'];

function currentMess() {
  if (ended()) return 0;
  const m = T.latestMessAt(now());
  if (m && store.clean.messAt !== m) { store.clean = { messAt: m, done: [] }; }
  return m;
}
const cleaning = [];
function isDirty(item) {
  const m = currentMess();
  return !!m && !store.clean.done.includes(item);
}
function faxDiscDay() {
  if (ended()) return 0;
  const u = unlocked();
  return u && !store.played.includes(u) ? u : 0;
}
const unreadDays = () => { const u = unlocked(); const out = []; for (let d = 1; d <= u; d++) if (!store.read.includes(d)) out.push(d); return out; };

// ────────── 음악 ──────────
let noteTimer = 0;
const playerEl = document.getElementById('player');
function playDay(day) {
  initAudio();
  sfx.needle();
  addUnique('played', day);
  showPlayer(day);
  audioPlay(day, () => {
    if (ended()) playDay((day % TOTAL_DAYS) + 1); // 축하 모드: 다음 곡 이어서
    else playerEl.hidden = true;
  });
}
function stopMusic() { audioStop(); playerEl.hidden = true; }
function showPlayer(day) {
  playerEl.hidden = false;
  document.getElementById('player-title').textContent = `LP ${day}`;
  document.getElementById('player-song').textContent = songOf(day) || '';
  const pc = document.getElementById('player-disc').getContext('2d');
  pc.clearRect(0, 0, 16, 16); S.drawDisc(pc, day, 0, 0);
}
document.getElementById('player-stop').addEventListener('click', stopMusic);
const songCache = {};
function songOf(day) {
  if (day > unlocked()) return '';
  if (!(day in songCache)) { songCache[day] = ''; getLetter(day).then(l => { songCache[day] = l.song || ''; }).catch(() => {}); }
  return songCache[day];
}

// ────────── 앱 API (패널에서 사용) ──────────
const app = {
  store, now, unlocked, ended, getLetter, getFinale, songOf, playDay, stopMusic,
  nowPlaying: () => audioNow,
  markRead(day) { if (!store.read.includes(day)) { store.read.push(day); persist(); } },
  onLetterStored(day) {
    FX.spawnSparkles(260, 118, 10, 8);
    sfx.sparkle();
    if (faxDiscDay() === day) { printingUntil = performance.now() + 2600; toast(`팩스에서 LP ${day}가 나왔어요. 턴테이블에 올려 보세요.`); }
  },
  toggleSound() { initAudio(); setMuted(store.sound); syncSoundBtn(); },
  permission: N.permission,
  requestPermission: N.requestPermission,
  subscribePush: N.subscribePush,
  canInstall: () => !!deferredInstall,
  async install() { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; },
  timeStatus: T.timeStatus,
  build: () => manifest?.build || '-',
  kstDayStart: T.kstDayStart,
  setTestTime(t) { T.setTestTime(t); lastEventT = now(); festiveForced = false; syncTestFlag(); },
  clearTestTime() { T.clearTestTime(); lastEventT = now(); festiveForced = false; syncTestFlag(); },
  weatherOverride: () => weatherOverride,
  setWeather(k) { weatherOverride = k || null; setWeatherOverride(weatherOverride); },
  testNotify: async () => { await N.requestPermission(); if (!(await N.testNotify())) toast('알림 권한이 없어요.'); },
  celebrate: (force) => celebrate(force),
  replayGreeting: () => greet(),
  resetProgress() { resetProgress(); stopMusic(); },
  exitTest() {
    T.clearTestTime(); setWeatherOverride(null); weatherOverride = null; festiveForced = false;
    sessionStorage.removeItem('neuru.testok'); testEnabled = false;
    document.getElementById('btn-test').hidden = true; syncTestFlag();
    const u = new URL(location.href); u.searchParams.delete('test'); history.replaceState(null, '', u);
    closeModal(true); toast('테스트 모드를 끝냈어요');
  },
};

// ────────── 청소 ──────────
function startClean(item) {
  if (cleaning.some(c => c.item === item)) return;
  initAudio();
  const dur = { blanket: 800, trash: 1400, stain: 1100, pets: 1200 }[item];
  cleaning.push({ item, start: performance.now(), dur });
  ({ blanket: sfx.whoosh, trash: sfx.vacuum, stain: sfx.wipe, pets: sfx.wipe })[item]();
}
function finishClean(c) {
  if (!store.clean.done.includes(c.item)) { store.clean.done.push(c.item); persist(); }
  const pos = { blanket: [60, 140], trash: [210, 200], stain: [280, 204], pets: [60, 200] }[c.item];
  FX.spawnSparkles(pos[0], pos[1], 10, 12); sfx.sparkle();
  if (CLEAN_ITEMS.every(i => store.clean.done.includes(i))) {
    setTimeout(() => {
      banner('방 청소 완료!'); sfx.fanfare(); catCelebrate(2200);
      const b = cat.box; FX.spawnHearts(b.x + b.w / 2, b.y, 6);
    }, 250);
  }
}
function catCelebrate(ms) {
  const step = { type: 'celebrate', ms };
  if (cat.step?.type === 'jump') cat.steps = [{ type: 'pose', pose: 'sit' }, step];
  else { cat.plan([{ type: 'pose', pose: cat.pose === 'walk' ? 'sit' : cat.pose }, step]); }
  cat.hold(6000);
}

// ────────── 고양이 ──────────
let purrOff = null, lastPet = 0;
function petCat() {
  const t = performance.now();
  if (t - lastPet < 250) return;
  lastPet = t;
  initAudio();
  const b = cat.box;
  FX.spawnHearts(b.x + b.w / 2 - 2, b.y - 2, 2);
  cat.happy(1800); cat.hold(9000);
  if (!cat.busy && Math.random() < 0.5) cat.bounce();
  purr(true);
  clearTimeout(purrOff); purrOff = setTimeout(() => purr(false), 1900);
  if (Math.random() < 0.25) sfx.meow();
}
const catCtx = {
  thump() { /* 착지는 조용히 */ },
  celebrate(c) { const b = c.box; FX.spawnHearts(b.x + b.w / 2, b.y, 5); sfx.meow(); },
};
function greet(onDone) {
  const { a, b } = visibleRange();
  const center = Math.max(80, Math.min(310, (a + b) / 2));
  const fromRight = Math.random() < 0.5;
  const from = fromRight ? Math.min(W + 30, b + 30) : Math.max(-30, a - 30);
  cat.greet(from, center, onDone);
}

// ────────── 물건 판정 ──────────
function hitTest(x, y) {
  if (discDrag) return 'disc';
  if (cat.hit(x, y)) return 'cat';
  const inR = (x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dd = faxDiscDay();
  if (dd && !discFly && inR(274, 78 + discBob() , 22, 22)) return 'disc';
  if (isDirty('trash')) for (const it of S.trashItems(store.clean.messAt / 1000 | 0)) if (Math.abs(x - it.x) < 8 && Math.abs(y - it.y) < 6) return 'trash';
  if (isDirty('stain') && inR(266, 200, 28, 12)) return 'stain';
  if (isDirty('pets') && inR(30, 186, 66, 28)) return 'pets';
  if (inR(30, 186, 66, 28)) return 'pets-clean';
  if (isDirty('blanket') && (inR(106, 140, 56, 20) || inR(136, 152, 42, 46))) return 'blanket';
  if (ended() && inR(146, 186, 28, 22)) return 'cake';
  if (inR(218, 98, 36, 34)) return 'typewriter';
  if (inR(250, 114, 20, 19)) return 'box';
  if (inR(265, 104, 36, 29)) return 'fax';
  if (inR(299, 103, 36, 30)) return 'turntable';
  if (inR(334, 146, 50, 70)) return 'fire';
  if (inR(24, 60, 30, 26) || inR(34, 84, 8, 88)) return 'lampFloor';
  if (inR(314, 32, 20, 30)) return 'lampWall';
  if (inR(2, 176, 26, 38) || inR(138, 104, 22, 27) || inR(334, 16, 24, 50)) return 'plant';
  if (inR(68, 38, 38, 32)) return 'picture';
  if (inR(0, 0, 30, 176) || inR(356, 0, 28, 144)) return 'books';
  if (inR(S.WIN.x, S.WIN.y, S.WIN.w, S.WIN.h - (x < 186 ? 12 : 0))) return 'window';
  if (inR(226, 138, 36, 34)) return 'chair';
  if (inR(196, 124, 24, 10)) return 'deskTop';
  if (inR(44, 116, 142, 80)) return 'sofa';
  if (y >= 172) return 'floor';
  return null;
}

const BOOK_LINES = [
  '책 사이에 끼워 둔 네잎클로버를 찾았어요.',
  '"오늘도 잘 버텼어." 누군가 연필로 적어 둔 문장이에요.',
  '책장이 살짝 기울어 있어요. 느루가 올라갔던 걸까요?',
  '먼지 냄새 대신 따뜻한 종이 냄새가 나요.',
  '읽다 만 페이지에 영수증 책갈피가 꽂혀 있어요.',
  '제목만 봐도 설레는 책이에요. 다음에 같이 읽어요.',
];

let printingUntil = 0;
function tap(x, y) {
  initAudio();
  const k = hitTest(x, y);
  const beforeStart = !ended() && now() < FIRST_LETTER_AT;
  switch (k) {
    case 'cat': petCat(); break;
    case 'typewriter': {
      sfx.click();
      if (beforeStart) { toast('10월 29일 밤 11시부터 편지가 도착해요.'); break; }
      const un = unreadDays();
      if (un.length) P.openLetter(app, un[0], { typing: true });
      else toast('오늘 편지는 이미 읽었어요. 보관 상자에서 다시 볼 수 있어요.');
      break;
    }
    case 'box': sfx.click(); P.openArchive(app); break;
    case 'disc': startDiscFly(faxDiscDay(), 284, 88 + discBob()); break;
    case 'fax':
      sfx.click();
      if (faxDiscDay()) startDiscFly(faxDiscDay(), 284, 88 + discBob());
      else if (beforeStart) toast('10월 29일 밤 11시부터 음반이 도착해요.');
      else toast('새 음반은 매일 밤 11시에 팩스로 도착해요.');
      break;
    case 'turntable': sfx.click(); P.openCrate(app); break;
    case 'fire':
      store.fire = !store.fire; setAmbience('fire', store.fire);
      if (store.fire) { sfx.whoosh(); FX.spawnSparkles(359, 196, 6, 8); } else { sfx.puff?.(); FX.spawnPuff(359, 196, 8, '#8a847c'); }
      break;
    case 'lampFloor': store.lampFloor = !store.lampFloor; sfx.click(); break;
    case 'lampWall': store.lampWall = !store.lampWall; sfx.click(); break;
    case 'blanket': case 'trash': case 'stain': case 'pets': startClean(k); break;
    case 'pets-clean': FX.spawnSparkles(60, 200, 4, 10); toast(`${CAT_NAME}의 밥그릇이 반짝반짝해요.`); break;
    case 'cake': FX.spawnConfetti(60); sfx.fanfare(); for (let i = 0; i < 4; i++) setTimeout(FX.launchFirework, i * 400); catCelebrate(1600); break;
    case 'plant': FX.spawnSparkles(x, y, 4, 6); sfx.pop(); toast('잎이 살랑 흔들려요.', 1600); break;
    case 'picture': FX.spawnSparkles(87, 54, 5, 10); toast('언젠가 같이 가 보고 싶은 풍경이에요.'); break;
    case 'books': sfx.pop(); toast(BOOK_LINES[Math.floor(Math.random() * BOOK_LINES.length)]); break;
    case 'window': toast(`창밖은 지금 ${weatherText()}`); if (!cat.busy) cat.goToSpot('sill'); cat.hold(12000); break;
    case 'chair': cat.goToSpot('chair'); cat.hold(12000); break;
    case 'deskTop': cat.goToSpot('desk'); cat.hold(12000); break;
    case 'sofa': cat.goToSpot('sofa'); cat.hold(12000); break;
    case 'floor': cat.goToFloor(x, 'sit'); cat.hold(8000); break;
  }
}

// ────────── LP 끌어다 놓기 / 날아가기 ──────────
let discDrag = null, discFly = null;
const discBob = () => Math.round(Math.sin(performance.now() / 400) * 2);
const TT = { x: 314, y: 123 };
function startDiscFly(day, fx, fy) {
  if (!day || discFly) return;
  discDrag = null;
  discFly = { day, fx, fy, t: 0 };
  sfx.whoosh();
}

// ────────── 입력 처리 ──────────
let down = null;
stage.addEventListener('pointerdown', (e) => {
  if (!entered) return;
  const p = toScene(e.clientX, e.clientY);
  down = { x: e.clientX, y: e.clientY, sx: p.x, sy: p.y, offX: view.offX, moved: false, id: e.pointerId };
  stage.setPointerCapture(e.pointerId);
  if (hitTest(p.x, p.y) === 'disc' && faxDiscDay() && !discFly) discDrag = { day: faxDiscDay(), x: p.x, y: p.y };
});
stage.addEventListener('pointermove', (e) => {
  const p = toScene(e.clientX, e.clientY);
  pointer.x = p.x; pointer.y = p.y; pointer.at = performance.now();
  if (entered) cat.setPointer(p.x, p.y);
  if (down && down.id === e.pointerId) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 6) down.moved = true;
    if (discDrag) { discDrag.x = p.x; discDrag.y = p.y; stage.classList.add('dragging'); return; }
    if (view.pan && down.moved) { view.offX = down.offX + dx; clampPan(); applyPan(); return; }
    if (down.moved && cat.hit(p.x, p.y)) petCat();
  } else if (e.pointerType === 'mouse' && entered) {
    const k = hitTest(p.x, p.y);
    stage.classList.toggle('hovering', !!k && k !== 'floor' && k !== 'books' && k !== 'sofa');
  }
});
const endPointer = (e) => {
  if (!down || down.id !== e.pointerId) return;
  const p = toScene(e.clientX, e.clientY);
  stage.classList.remove('dragging');
  if (discDrag) {
    const d = discDrag; discDrag = null;
    const onTT = Math.abs(p.x - TT.x) < 22 && Math.abs(p.y - TT.y) < 18;
    if (!down.moved || onTT) startDiscFly(d.day, p.x, p.y);
  } else if (!down.moved && e.type === 'pointerup') tap(p.x, p.y);
  down = null;
};
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => { if (!view.pan) return; view.offX -= e.deltaY + e.deltaX; clampPan(); applyPan(); }, { passive: true });
const pointer = { x: -99, y: -99, at: 0 };

// ────────── 알림 예약 (앱이 켜져 있는 동안) ──────────
let lastEventT = 0;
function checkEvents() {
  const t = now();
  if (lastEventT && t > lastEventT && t - lastEventT < 10 * 60 * 1000) {
    for (const ev of T.upcomingEvents(lastEventT, t - lastEventT)) if (ev.at <= t) handleEvent(ev);
  }
  lastEventT = t;
}
function handleEvent(ev) {
  N.systemNotify(ev.type, N.eventTag(ev));
  if (ev.type === 'mess') {
    toast(N.MESSAGES.mess.body); sfx.chime(); FX.spawnPuff(150, 190, 10); FX.spawnPuff(60, 200, 6);
  } else if (ev.type === 'letter') {
    toast(N.MESSAGES.letter.body); sfx.chime(); printingUntil = performance.now() + 3000;
  } else if (ev.type === 'end') {
    celebrate(false);
  }
}

// ────────── 축하 ──────────
let nextFirework = 0;
function celebrate(force) {
  if (!entered) return;
  if (force) festiveForced = true;
  if (!store.fire) { store.fire = true; setAmbience('fire', true); }
  FX.spawnConfetti(120); sfx.fanfare();
  for (let i = 0; i < 6; i++) setTimeout(FX.launchFirework, 300 + i * 450);
  catCelebrate(2400);
  if (!store.celebrated || force) {
    store.celebrated = true;
    closeModal(true);
    P.showCelebration(app);
  }
}

// ────────── HUD ──────────
const hud = document.getElementById('hud');
const cdEls = ['d', 'h', 'm', 's', 'ms'].map(k => document.getElementById('cd-' + k));
const untilEl = document.getElementById('cd-until');
const clock = document.getElementById('clock').getContext('2d');
let lastClockMin = -1;
const pad = (n, l = 2) => String(n).padStart(l, '0');
function updateHud() {
  const t = now();
  const done = t >= END_AT;
  const diff = Math.abs(done ? t - END_AT : END_AT - t);
  const vals = [pad(Math.floor(diff / 86400000)), pad(Math.floor(diff / 3600000) % 24), pad(Math.floor(diff / 60000) % 60), pad(Math.floor(diff / 1000) % 60), pad(Math.floor(diff % 1000), 3)];
  vals.forEach((v, i) => { if (cdEls[i].textContent !== v) cdEls[i].textContent = v; });
  hud.classList.toggle('ended', done);
  const u = done ? 'TOGETHER SINCE NOV 19, 2026 ♥' : 'UNTIL NOV 19, 2026';
  if (untilEl.textContent !== u) untilEl.textContent = u;
  const k = T.kst(t);
  if (k.mi !== lastClockMin) { lastClockMin = k.mi; drawClock(k); }
}
function drawClock(k) {
  const c = clock;
  c.clearRect(0, 0, 24, 24);
  S.ell(c, 12, 12, 11, 11, '#5a3420'); S.ell(c, 12, 12, 10, 10, '#c9a24a'); S.ell(c, 12, 12, 9, 9, '#f3e6c8');
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = '#5a4a3a'; c.fillRect(Math.round(12 + Math.sin(a) * 8), Math.round(12 - Math.cos(a) * 8), 1, 1); }
  const hand = (ang, len, col) => { c.fillStyle = col; for (let s = 0; s <= len; s += 0.5) c.fillRect(Math.round(12 + Math.sin(ang) * s), Math.round(12 - Math.cos(ang) * s), 1, 1); };
  hand(((k.h % 12) + k.mi / 60) / 12 * Math.PI * 2, 5, '#2b2622');
  hand(k.mi / 60 * Math.PI * 2, 7, '#2b2622');
  c.fillStyle = '#b8322a'; c.fillRect(12, 12, 1, 1);
}

// ────────── 그리기 루프 ──────────
let lastFrame = performance.now(), lastSlow = 0;
function frame(tms) {
  const dt = Math.min(50, tms - lastFrame); lastFrame = tms;
  const t = now();
  const k = T.kst(t);
  const tod = S.timeOfDay(k.h + k.mi / 60);
  const wk = weather();
  const festive = ended();

  if (tms - lastSlow > 250) {
    lastSlow = tms;
    checkEvents();
    updateMission();
    cat.weather = wk; cat.fireOn = store.fire;
    setAmbience('rain', entered && (wk === 'rain' || wk === 'storm'));
  }
  cat.update(dt, catCtx);
  FX.updateEffects(dt, () => sfx.firework());
  if (festive && entered && tms > nextFirework) { FX.launchFirework(); nextFirework = tms + 2200 + Math.random() * 3200; }

  // 사용자가 바닥에 커서를 두면 느루가 따라옴
  if (entered && !cat.busy && !cat.up && pointer.y > 172 && tms - pointer.at < 1200 && Math.abs(pointer.x - cat.x) > 40 && tms > (frame.chaseAt || 0) && tms > cat.holdUntil) {
    frame.chaseAt = tms + 5000; cat.goToFloor(pointer.x, 'sit');
  }

  // 창밖
  g.drawImage(S.getView(tod, wk === 'storm' ? 'rain' : wk), 0, 0);
  FX.drawWindowEffects(g);
  FX.drawPrecip(g, wk, tms, dt);
  // 방
  g.drawImage(S.getBackground(), 0, 0);
  if (festive) S.drawFestive(g, tms);
  S.drawLamps(g, store, tms);
  S.drawFire(g, store.fire, tms);
  S.drawTypewriter(g, false, tms);
  S.drawFax(g, tms < printingUntil, tms);
  const playing = audioNow;
  S.drawTurntable(g, !!playing, playing ? S.discColors(playing).L : '#555', tms);
  if (playing && tms > noteTimer) { noteTimer = tms + 900; FX.spawnNote(312, 112); }

  // 청소 대상 + 청소 애니메이션
  const mess = currentMess();
  const anim = {};
  for (const c of [...cleaning]) {
    const p = (tms - c.start) / c.dur;
    if (p >= 1) { cleaning.splice(cleaning.indexOf(c), 1); finishClean(c); } else anim[c.item] = p;
  }
  const dirty = (i) => mess && !store.clean.done.includes(i);
  if (dirty('stain')) S.drawStain(g, anim.stain !== undefined ? 1 - anim.stain : 1);
  if (dirty('trash')) {
    let items = S.trashItems(store.clean.messAt / 1000 | 0);
    if (anim.trash !== undefined) { const vx = 110 + anim.trash * 200; items = items.filter(it => it.x > vx); }
    S.drawTrash(g, items, tms);
  }
  S.drawPetCorner(g, dirty('pets') && !(anim.pets > 0.6), tms);
  if (anim.blanket !== undefined) {
    g.globalAlpha = 1 - anim.blanket; S.drawBlanket(g, true, tms);
    g.globalAlpha = anim.blanket; S.drawBlanket(g, false, tms); g.globalAlpha = 1;
  } else S.drawBlanket(g, dirty('blanket'), tms);

  cat.draw(g, festive);

  if (anim.trash !== undefined) S.drawVacuum(g, 110 + anim.trash * 200, 206, anim.trash);
  if (anim.stain !== undefined) S.drawMop(g, 280 + Math.sin(anim.stain * Math.PI * 6) * 9, 208);
  if (anim.pets !== undefined) { const p = anim.pets; S.drawSponge(g, p < 0.5 ? 38 + p * 40 : 64 + (p - 0.5) * 50, p < 0.5 ? 201 : 206); }
  if (anim.blanket !== undefined) for (let i = 0; i < 3; i++) S.R(g, 80 + anim.blanket * 30 + i * 10, 150 - anim.blanket * 20 + i * 4, 6, 1, 'rgba(255,255,255,0.6)');

  // 어둡기 → 불빛
  S.drawShade(g, store, tod, store.fire);
  S.drawGlows(g, store, tod, store.fire, tms);

  // 알림 말풍선, LP
  const beforeStart = !festive && t < FIRST_LETTER_AT;
  if (entered && unreadDays().length) S.drawBubble(g, 236, 90 + Math.round(Math.sin(tms / 250) * 2), '!');
  const dd = faxDiscDay();
  if (dd && !discFly) {
    const [dx, dy] = discDrag ? [discDrag.x - 8, discDrag.y - 8] : [276, 80 + discBob()];
    if (!discDrag) { g.save(); g.globalCompositeOperation = 'lighter'; S.ell(g, 284, 88 + discBob(), 11, 11, 'rgba(255,230,160,0.12)'); g.restore(); }
    S.drawDisc(g, dd, dx, dy);
    if (discDrag) { const on = Math.abs(discDrag.x - TT.x) < 22 && Math.abs(discDrag.y - TT.y) < 18; if (on) S.ell(g, TT.x, TT.y, 12, 3, 'rgba(255,240,180,0.35)'); }
  }
  if (discFly) {
    discFly.t += dt / 550;
    const p = Math.min(1, discFly.t);
    const x = discFly.fx + (TT.x - discFly.fx) * p, y = discFly.fy + (TT.y - discFly.fy) * p - Math.sin(p * Math.PI) * 14;
    S.drawDisc(g, discFly.day, x - 8, y - 8);
    if (p >= 1) { const d = discFly.day; discFly = null; playDay(d); FX.spawnSparkles(TT.x, TT.y - 4, 8, 8); }
  }
  if (beforeStart && entered && Math.floor(tms / 4000) % 3 === 0) S.drawBubble(g, 236, 90, 'note');
  FX.drawEffects(g);

  if (entered) updateHud();
  requestAnimationFrame(frame);
}

// 청소 표시
const missionEl = document.getElementById('mission');
const missionText = document.getElementById('mission-text');
function updateMission() {
  const m = currentMess();
  const n = store.clean.done.length;
  const show = entered && m && n < CLEAN_ITEMS.length;
  missionEl.hidden = !show;
  if (show) missionText.textContent = `방 청소 ${n}/${CLEAN_ITEMS.length}`;
}

// ────────── 하단 버튼 ──────────
const soundBtn = document.getElementById('btn-sound');
function syncSoundBtn() {
  soundBtn.classList.toggle('muted', !store.sound);
  soundBtn.setAttribute('aria-label', store.sound ? '소리 끄기' : '소리 켜기');
}
soundBtn.addEventListener('click', () => { initAudio(); setMuted(store.sound); syncSoundBtn(); });
document.getElementById('btn-settings').addEventListener('click', () => { initAudio(); P.openSettings(app); });
document.getElementById('btn-test').addEventListener('click', () => P.openTest(app));
function syncTestFlag() { document.getElementById('testflag').hidden = !(testEnabled && T.isTestClock()); }

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { T.syncTime(); refreshWeather(); lastEventT = now(); }
});

// ────────── 시작 화면 ──────────
function drawDoor() {
  const c = document.getElementById('door').getContext('2d');
  c.imageSmoothingEnabled = false;
    S.R(c, 18, 6, 60, 80, '#3a2012'); S.R(c, 22, 10, 52, 76, '#6d3f22');
  for (const [x, y] of [[27, 15], [51, 15], [27, 50], [51, 50]]) { S.R(c, x, y, 18, 30, '#5b3420'); S.R(c, x + 1, y + 1, 16, 1, '#8b5731'); }
  S.R(c, 64, 48, 4, 4, '#c9a24a');
  S.R(c, 22, 84, 52, 3, '#ffcf7a'); S.R(c, 14, 87, 68, 2, 'rgba(255,200,110,0.5)'); S.R(c, 6, 89, 84, 1, 'rgba(255,200,110,0.25)');
  S.R(c, 28, 89, 40, 5, '#8b3a2b'); S.R(c, 30, 90, 36, 3, '#a8452f');
  c.fillStyle = '#f2c14e'; [[45, 90], [47, 90], [44, 91], [45, 91], [46, 91], [47, 91], [48, 91], [45, 92], [46, 92], [47, 92], [46, 93]].forEach(([x, y]) => c.fillRect(x + 2, y - 1, 1, 1));
}

async function enter() {
  if (entered) return;
  initAudio();
  entered = true;
  document.getElementById('start').classList.add('leaving');
  setTimeout(() => { document.getElementById('start').hidden = true; }, 650);
  syncSoundBtn();
  if (store.fire) setAmbience('fire', true);
  if (N.permission() === 'default') N.requestPermission(); else if (N.permission() === 'granted') N.subscribePush().catch(() => {});
  lastEventT = now();
  const first = !store.firstVisit;
  if (first) store.firstVisit = now();
  greet(() => afterGreet(first));
}

function afterGreet(first) {
  const doTest = () => {
    if (new URLSearchParams(location.search).has('test') && !testEnabled) {
      P.promptTestPassword(() => { sessionStorage.setItem('neuru.testok', '1'); enableTest(); });
    }
  };
  if (ended() && !store.celebrated) { celebrate(false); return; }
  if (first) { toast(`방 안의 물건을 눌러 보세요. ${CAT_NAME}도 쓰다듬을 수 있어요.`, 4200); doTest(); return; }
  const items = [];
  const un = unreadDays();
  if (un.length === 1) items.push(['✉️', T.letterUnlockAt(un[0]) < T.kstDayStart(now()) ? '어젯밤 도착한 편지가 있어요!' : '오늘 밤 도착한 편지가 있어요!']);
  else if (un.length > 1) items.push(['✉️', `읽지 않은 편지가 ${un.length}통 있어요!`]);
  if (currentMess() && store.clean.done.length < CLEAN_ITEMS.length) items.push(['🧹', '밀린 방 청소가 필요해요!']);
  if (faxDiscDay()) items.push(['💿', `팩스에 LP ${faxDiscDay()}가 도착해 있어요.`]);
  if (items.length) P.showNotices(items, doTest); else doTest();
}
function enableTest() {
  testEnabled = true;
  window.__neuru = { cat, app, tap };
  document.getElementById('btn-test').hidden = false;
  syncTestFlag();
  toast('테스트 모드가 켜졌어요. 오른쪽 아래 벌레 버튼을 눌러 보세요.');
}

// ────────── 시작 ──────────
async function boot() {
  layout();
  drawDoor();
  document.getElementById('enter').addEventListener('click', enter);
  requestAnimationFrame(frame);
  N.registerSW();
  try { manifest = await loadContent(); } catch { document.getElementById('start-note').textContent = '편지 데이터를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 열어 주세요.'; }
  T.syncTime().then(() => { lastEventT = now(); });
  refreshWeather();
  setInterval(() => { if (document.visibilityState === 'visible') { T.syncTime(); refreshWeather(); } }, 5 * 60 * 1000);
  if (new URLSearchParams(location.search).has('test') && sessionStorage.getItem('neuru.testok')) { testEnabled = true; window.__neuru = { cat, app, tap }; document.getElementById('btn-test').hidden = false; syncTestFlag(); }
  cat.x = 214; cat.pose = 'sit';
  cat.x = -40; // 입장 전에는 방 밖에서 대기
}
boot();
