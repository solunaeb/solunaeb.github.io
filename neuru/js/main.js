// 널 사랑할고양 — 메인
import { CAT_NAME, END_AT, FIRST_LETTER_AT, TOTAL_DAYS, GROW_START } from './config.js';
import { say, flowerTalk, lovePing } from './speech.js';
import { migrateLegacyKey } from './chat.js';
import * as T from './time.js';
import { store, persist, resetProgress, addUnique } from './store.js';
import { loadContent, getLetter, getFinale, photos, getPhotoUrl } from './content.js';
import * as R2 from './room2.js';
import { initAudio, sfx, purr, setAmbience, setMuted, playDay as audioPlay, stopMusic as audioStop, nowPlaying as audioNow } from './audio.js';
import * as S from './scene.js';
import { Cat } from './cat.js';
import * as FX from './effects.js';
import { refreshWeather, weather, weatherText, setWeatherOverride } from './weather.js';
import * as N from './notify.js';
import { toast, banner, modalOpen, closeModal, showNotice } from './ui.js';
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
function currentMess() {
  if (ended()) return 0;
  const m = T.latestMessAt(now());
  if (m && (store.clean.messAt !== m || !Array.isArray(store.clean.items))) store.clean = { messAt: m, items: R2.pickMess(m), done: [] };
  return m;
}
const cleaning = [];
function isDirty(item) {
  const m = currentMess();
  return !!m && store.clean.items.includes(item) && !store.clean.done.includes(item);
}
const messLeft = () => (currentMess() ? store.clean.items.filter(i => !store.clean.done.includes(i)).length : 0);
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
    if (faxDiscDay() === day) toast(`팩스 위에 LP ${day}가 올라와 있어요. 턴테이블에 올려 보세요.`);
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
  setTestTime(t) {
    T.setTestTime(t); lastEventT = now(); festiveForced = false;
    // 시간을 되돌리면 그 시각에 아직 오지 않은 편지·LP 기록은 지움
    const u = T.isEnded(t) ? TOTAL_DAYS : T.unlockedCount(t);
    store.read = store.read.filter(d => d <= u);
    store.played = store.played.filter(d => d <= u);
    if (!T.isEnded(t)) store.celebrated = false;
    if ((store.humid.refillAt || 0) > t) store.humid = { ...store.humid, refillAt: t };   // 가습기 물 기록도 되돌리기
    ejectDay = 0; syncTestFlag();
  },
  clearTestTime() { T.clearTestTime(); lastEventT = now(); festiveForced = false; syncTestFlag(); },
  weatherOverride: () => weatherOverride,
  setWeather(k) { weatherOverride = k || null; setWeatherOverride(weatherOverride); },
  testNotify: async () => { await N.requestPermission(); if (await N.testNotify()) toast('시험 알림을 보냈어요. 화면 오른쪽 아래를 확인해 보세요.', 4200); else toast('알림 권한이 없어요. 설정 → 알림 켜기를 먼저 눌러 주세요.', 4200); },
  celebrate: (force) => celebrate(force),
  replayGreeting: () => greet(),
  resetProgress() { resetProgress(); stopMusic(); ejectDay = 0; },
  grow: () => cat.grow,
  growDay: () => T.growDay(now()),
  sayLine: (kind) => say(kind, cat.grow),
  chatContext() {
    const t = now(), k = T.kst(t);
    return { grow: cat.grow, day: T.growDay(t), daysLeft: Math.max(0, Math.ceil((END_AT - t) / 86400000)), ended: ended(), clock: `${k.mo}월 ${k.d}일 ${k.h}시 ${k.mi}분`, weather: weatherText() };
  },
  catListen() { cat.touch(); if (!cat.busy && !cat.up) cat.pose = 'sit'; cat.look = 0; },
  catReply(text) { cat.happy(900); if (Math.random() < 0.3) sfx.meow(); },
  emptyHumid() { store.humid = { ...store.humid, refillAt: now() - HUMID_MS }; },
  sleepNow() { cat.lastTouch = -1e9; cat.holdUntil = 0; },
  loveTest() { handleEvent({ type: 'love', at: now() }); },
  setTorch(hung) { store.torch = { hung, lit: hung }; if (hung) { sfx.ignite(); FX.spawnSparkles(118, 50, 8, 8); toast('횃불을 벽에 걸었어요. 누르면 켜고 끌 수 있어요.'); } else toast('횃불을 서랍에 넣었어요.'); },
  ramenActive: () => store.ramen.until > now() && store.ramen.bites < 3,
  cookRamen() { store.ramen = { until: now() + 20 * 60 * 1000, bites: 0 }; sfx.whoosh(); FX.spawnPuff(R2.RAMEN_AT[0], R2.RAMEN_AT[1], 8, '#ffffff'); toast('보글보글… 까르보 불닭 한 그릇 완성!'); if (!cat.busy) { cat.goToFloor(R2.RAMEN_AT[0] + 22, 'sit'); cat.hold(10000); } },
  setPlantStage(n) { for (const k of Object.keys(R2.PLANTS)) store.plants[k] = { n, last: store.plants[k].last }; persist(); },
  resetWaterToday() { for (const k of Object.keys(R2.PLANTS)) store.plants[k].last = ''; persist(); },
  remess() { const m = currentMess(); if (m) { store.clean = { messAt: m, items: R2.pickMess(m + Math.floor(Math.random() * 1e6) * 60000), done: [] }; } else toast('지금은 청소 시간이 아니에요'); },
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
  const def = R2.MESS[item];
  cleaning.push({ item, start: performance.now(), dur: def.dur });
  sfx[def.sfx]?.();
}
function finishClean(c) {
  if (!store.clean.done.includes(c.item)) { store.clean.done.push(c.item); persist(); }
  const pos = R2.MESS[c.item].pos;
  FX.spawnSparkles(pos[0], pos[1] - 4, 10, 12); sfx.sparkle();
  if (messLeft() === 0) {
    setTimeout(() => {
      banner('방 청소 완료!'); sfx.fanfare(); cat.touch(); catCelebrate(2200);
      const b = cat.box; FX.spawnHearts(b.x + b.w / 2, b.y, 6);
      setTimeout(() => speak(say('clean', cat.grow), 4200), 900);
    }, 250);
  } else if (c.item === 'bowls' && !cat.sleeping) setTimeout(startEat, 700);
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
  const wasSleeping = cat.sleeping;
  cat.touch();
  if (wasSleeping) { speak(say('wake', cat.grow), 3600); sfx.meow(); }
  else if (t - lastSpeak > 5000 && Math.random() < 0.45) speak(say('pet', cat.grow), 3800);
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
  zzz(c) { const [hx, hy] = c.head; FX.spawnZ(hx + 4, hy - 4); },
  eatTick(c) { sfx.crunch(); FX.spawnCrumbs(69, 204); },
  pounce(c) {
    const dir = ball.x >= c.x ? 1 : -1;
    ball.vx = dir * (70 + Math.random() * 50);
    FX.spawnSparkles(ball.x, ball.y - 3, 4, 4); sfx.pop();
    play.left--;
    if (play.left <= 0) { play.active = false; setTimeout(() => { if (!cat.busy) { cat.happy(1500); speak(say('play', cat.grow), 3600); } }, 700); }
  },
  canEat: () => !cat.sleeping && !isDirty('bowls') && performance.now() - lastEat > 180000,
  canPlay: () => !cat.sleeping && !play.active,
  startEat: () => startEat(),
  startPlay: () => startPlay(),
};
let lastEat = -Infinity;
function startEat() {
  if (cat.sleeping || isDirty('bowls')) return;
  lastEat = performance.now();
  cat.goEat(69, 5200); cat.hold(7000);
  setTimeout(() => { if (Math.random() < 0.6) speak(say('eat', cat.grow), 3400); }, 5600);
}
// 장난감 털 공
const ball = { x: 258, y: 213, vx: 0, rot: 0 };
const play = { active: false, left: 0 };
function startPlay() {
  if (cat.sleeping) cat.touch();
  play.active = true; play.left = 3;
  cat.pounce(ball.x); cat.hold(4000);
}
function updateBall(dt) {
  const s = dt / 1000;
  if (Math.abs(ball.vx) > 1) {
    ball.x += ball.vx * s; ball.rot += ball.vx * s / 3; ball.vx *= Math.pow(0.18, s);
    if (ball.x < 96) { ball.x = 96; ball.vx = Math.abs(ball.vx); }
    if (ball.x > 312) { ball.x = 312; ball.vx = -Math.abs(ball.vx); }
  } else if (ball.vx !== 0) {
    ball.vx = 0;
    if (play.active && play.left > 0 && !cat.sleeping) { cat.pounce(ball.x); cat.hold(4000); }
  }
}

// ── 말풍선 ──
const bubbleEl = document.getElementById('bubble');
let bubbleUntil = 0, lastSpeak = 0, nextChatter = performance.now() + 40000;
function speak(text, ms = 3500) {
  if (!text || !entered) return;
  bubbleEl.textContent = text;
  bubbleEl.hidden = false;
  bubbleEl.style.animation = 'none'; void bubbleEl.offsetWidth; bubbleEl.style.animation = '';
  bubbleUntil = performance.now() + ms + text.length * 40;
  lastSpeak = performance.now();
}
function updateBubble(tms) {
  if (bubbleEl.hidden) return;
  if (tms > bubbleUntil || modalOpen()) { bubbleEl.hidden = true; return; }
  const [hx, hy] = cat.head;
  let sx = view.offX + hx * view.scale, sy = view.offY + (hy - 6) * view.scale;
  const w = bubbleEl.offsetWidth;
  sx = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, sx));
  sy = Math.max(bubbleEl.offsetHeight + 12, sy);
  bubbleEl.style.left = sx + 'px'; bubbleEl.style.top = sy + 'px';
}
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
  const cb = cat.box;
  const onCatFeet = y > cb.y + cb.h * 0.62;
  if (cat.hit(x, y) && !(onCatFeet && R2.MESS_IDS.some(id => isDirty(id) && R2.MESS[id].hit.some(hb => x >= hb[0] && x < hb[0] + hb[2] && y >= hb[1] && y < hb[1] + hb[3])))) return 'cat';
  const inR = (x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dd = faxDiscDay();
  if (dd && !discFly && performance.now() > ejectUntil && inR(274, 78 + discBob(), 22, 22)) return 'disc';
  for (const id of R2.MESS_IDS) if (isDirty(id) && R2.MESS[id].hit.some(hb => inR(...hb))) return 'mess:' + id;
  if (inR(...R2.HUMID.hit)) return 'humid';
  if (app.ramenActive() && inR(R2.RAMEN_AT[0] - 10, R2.RAMEN_AT[1] - 8, 20, 18)) return 'ramen';
  if (inR(30, 186, 66, 28)) return 'pets-clean';
  if (ended() && inR(276, 186, 28, 22)) return 'cake';
  for (const [k, pl] of Object.entries(R2.PLANTS)) if (inR(...pl.hit)) return 'plant:' + k;
  for (let i = 0; i < 3; i++) if (inR(R2.DRAWERS[i][0], R2.DRAWERS[i][1], 32, 14)) return 'drawer:' + i;
  if (store.torch.hung && inR(R2.TORCH_AT[0] - 6, R2.TORCH_AT[1] - 6, 12, 26)) return 'torch';
  if (inR(218, 98, 36, 34)) return 'typewriter';
  if (inR(250, 114, 20, 19)) return 'box';
  if (inR(265, 104, 36, 29)) return 'fax';
  if (inR(299, 103, 36, 30)) return 'turntable';
  if (inR(334, 146, 50, 70)) return 'fire';
  if (inR(24, 60, 30, 26) || inR(34, 84, 8, 88)) return 'lampFloor';
  if (inR(314, 32, 20, 30)) return 'lampWall';
  if (inR(68, 38, 38, 32)) return 'picture';
  if (inR(0, 0, 30, 176) || inR(356, 0, 28, 144)) return 'books';
  if (inR(S.WIN.x, S.WIN.y, S.WIN.w, S.WIN.h - (x < 186 ? 12 : 0))) return 'window';
  if (inR(226, 138, 36, 34)) return 'chair';
  if (Math.abs(x - ball.x) < 6 && y > ball.y - 9 && y < ball.y + 3) return 'ball';
  if (inR(44, 116, 142, 80)) return 'sofa';
  if (y >= 172) return 'floor';
  return null;
}

const BOOK_LINES = [
  '책 사이에 삿포로행 비행기 티켓 두 장이 끼워져 있어요. 날짜 칸은 아직 비어 있네요.',
  '"눈 오는 오타루 운하 걷기"라고 적힌 메모가 책갈피로 꽂혀 있어요.',
  '여행 책 귀퉁이가 접혀 있어요. 삿포로 수프카레 맛집 페이지예요.',
  '책 속에 "다녀와서 제일 먼저 할 일" 목록이 숨어 있어요. 첫 줄은 꽉 안아 주기.',
  '낡은 지도책에 동그라미가 여러 개 그려져 있어요. 같이 가 볼 곳들인가 봐요.',
  '책갈피 대신 삿포로 눈축제 안내지가 꽂혀 있어요. 내년 겨울엔 둘이 함께!',
  '"우리 집 이름 후보"라고 적힌 쪽지가 나왔어요. 1번은 느루의 집.',
  '제목만 봐도 설레는 책이에요. 다음에 같이 읽기로 한 책이래요.',
];

let drawerAnim = null;
let watering = null;
const todayKey = () => { const k = T.kst(now()); return `${k.y}${String(k.mo).padStart(2, '0')}${String(k.d).padStart(2, '0')}`; };
const needsWater = (id) => now() >= GROW_START && store.plants[id].n < 21 && store.plants[id].last !== todayKey();
function waterPlant(id) {
  const pl = store.plants[id], name = R2.PLANTS[id].name;
  if (watering) return;
  if (now() < GROW_START) { toast(`씨앗이 10월 29일을 기다리고 있어요. 그날부터 매일 물을 줄 수 있어요.`); return; }
  if (pl.n >= 21) { FX.spawnSparkles(R2.PLANTS[id].drop[0], R2.PLANTS[id].drop[1] + 10, 6, 10); toast(`${name}가 활짝 피었어요. 꽃말은 '${R2.PLANTS[id].meaning}'.`); return; }
  if (pl.last === todayKey()) { toast(`${name}에는 오늘 이미 물을 줬어요. (${pl.n}/21)`); return; }
  watering = { id, start: performance.now() };
  sfx.water();
  setTimeout(() => {
    store.plants[id] = { n: pl.n + 1, last: todayKey() }; persist();
    const [dx, dy] = R2.PLANTS[id].drop;
    FX.spawnSparkles(dx, dy + 12, 8, 10);
    if (pl.n + 1 >= 21) { sfx.fanfare(); banner(`${name} 만개!`); FX.spawnHearts(dx, dy + 6, 4); }
    else toast(`${name}에 물을 줬어요. (${pl.n + 1}/21)`);
    const talk = flowerTalk(name, R2.PLANTS[id].meaning, pl.n + 1, cat.grow);
    if (talk) setTimeout(() => speak(talk, 5200), 600);
    watering = null;
  }, 1300);
}
const HUMID_MS = 24 * 3600 * 1000;
const humidLevel = () => {
  const since = now() - (store.humid.refillAt || 0);
  if (since < 0) return 1;                                  // 시각이 거꾸로(테스트로 과거 이동) → 가득 참
  return Math.min(1, Math.max(0, 1 - since / HUMID_MS));
};
let humidRefill = null, nextMist = 0;
function tapHumid() {
  const lv = humidLevel();
  if (humidRefill) return;
  if (lv < 0.4) {
    humidRefill = performance.now(); sfx.water();
    setTimeout(() => { store.humid = { ...store.humid, refillAt: now() }; humidRefill = null; FX.spawnSparkles(203, 118, 8, 8); toast('가습기 물을 새로 갈아 줬어요. 촉촉!'); }, 1200);
  } else {
    store.humid = { ...store.humid, light: !store.humid.light }; sfx.click();
    toast(`무드등을 ${store.humid.light ? '켰어요' : '껐어요'}. 물은 ${Math.round(lv * 100)}% 남았어요.`);
  }
}
let ejectDay = 0, ejectStart = 0, ejectUntil = 0;
const EJECT_MS = 2200;
let framePix = null, frameSrc = null;
async function loadFramePixels() {
  const f = photos('frame');
  if (!f || frameSrc === f.src) return;
  frameSrc = f.src;
  try {
    const url = await getPhotoUrl(f);
    const img = new Image(); img.src = url; await img.decode();
    // 26×18 로 줄이고 색을 단순화해 도트 느낌으로
    const c = document.createElement('canvas'); c.width = 26; c.height = 18;
    const cg = c.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
    const r = Math.max(26 / img.width, 18 / img.height), w = img.width * r, h = img.height * r;
    cg.drawImage(img, (26 - w) / 2, (18 - h) / 2, w, h);
    const d = cg.getImageData(0, 0, 26, 18);
    for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, Math.round(d.data[i + k] / 32) * 32 + 8);
    cg.putImageData(d, 0, 0);
    framePix = c;
  } catch { framePix = null; }
}
function tap(x, y) {
  initAudio();
  const k = hitTest(x, y);
  const beforeStart = !ended() && now() < FIRST_LETTER_AT;
  if (k?.startsWith('mess:')) { startClean(k.slice(5)); return; }
  if (k?.startsWith('plant:')) { waterPlant(k.slice(6)); return; }
  if (k?.startsWith('drawer:')) {
    const i = +k.slice(7); drawerAnim = { i, start: performance.now() }; sfx.drawer();
    setTimeout(() => P.openDrawer(app, i), 260); return;
  }
  if (['floor', 'sofa', 'chair', 'window', 'ball'].includes(k)) cat.touch();
  switch (k) {
    case 'cat': petCat(); break;
    case 'humid': tapHumid(); break;
    case 'ball': ball.vx = (Math.random() < 0.5 ? -1 : 1) * 90; sfx.pop(); startPlay(); break;
    case 'typewriter': {
      sfx.click();
      if (beforeStart) { toast('10월 29일 밤 11시부터 편지가 도착해요.'); break; }
      const un = unreadDays();
      if (un.length) P.openLetter(app, un[0], { typing: true });
      else toast('오늘 편지는 이미 읽었어요. 보관 상자에서 다시 볼 수 있어요.');
      break;
    }
    case 'box': sfx.click(); P.openArchive(app); break;
    case 'disc': startDiscFly(faxDiscDay(), 285, 88 + discBob()); break;
    case 'fax':
      sfx.click();
      if (faxDiscDay() && ejectUntil < performance.now()) startDiscFly(faxDiscDay(), 285, 88 + discBob());
      else if (beforeStart) toast('10월 29일 밤 11시부터 음반이 도착해요.');
      else if (ejectUntil > performance.now()) toast('LP가 올라오고 있어요!');
      else toast('새 음반은 매일 밤 11시에 팩스로 도착해요.');
      break;
    case 'turntable': sfx.click(); P.openCrate(app); break;
    case 'fire':
      store.fire = !store.fire; setAmbience('fire', store.fire);
      if (store.fire) { sfx.whoosh(); FX.spawnSparkles(359, 196, 6, 8); } else { sfx.puff?.(); FX.spawnPuff(359, 196, 8, '#8a847c'); }
      break;
    case 'lampFloor': store.lampFloor = !store.lampFloor; sfx.click(); break;
    case 'lampWall': store.lampWall = !store.lampWall; sfx.click(); break;
    case 'torch': store.torch = { hung: true, lit: !store.torch.lit }; if (store.torch.lit) { sfx.ignite(); FX.spawnSparkles(118, 46, 6, 6); } else { FX.spawnPuff(118, 46, 5, '#8a847c'); sfx.click(); } break;
    case 'ramen': {
      store.ramen = { ...store.ramen, bites: store.ramen.bites + 1 }; sfx.slurp(); FX.spawnPuff(R2.RAMEN_AT[0], R2.RAMEN_AT[1] - 4, 5, '#ffffff');
      const lines = ['스읍… 맵고 고소해!', '후하후하, 맵다 매워!', '마지막 한 입까지 싹싹!'];
      toast(lines[Math.min(2, store.ramen.bites - 1)]);
      if (store.ramen.bites >= 3) { FX.spawnHearts(R2.RAMEN_AT[0], R2.RAMEN_AT[1] - 8, 3); }
      break;
    }
    case 'pets-clean': FX.spawnSparkles(60, 200, 4, 10); toast(`${CAT_NAME}의 밥그릇이 반짝반짝해요.`); break;
    case 'cake': FX.spawnConfetti(60); sfx.fanfare(); for (let i = 0; i < 4; i++) setTimeout(FX.launchFirework, i * 400); catCelebrate(1600); break;
    case 'picture': sfx.click(); P.openFrame(app); break;
    case 'books': sfx.pop(); toast(BOOK_LINES[Math.floor(Math.random() * BOOK_LINES.length)]); break;
    case 'window': toast(`창밖은 지금 ${weatherText()}`); if (!cat.busy) cat.goToSpot('sill'); cat.hold(12000); break;
    case 'chair': cat.goToSpot('chair'); cat.hold(12000); break;
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
// Windows 알림이 안 뜬 이유를 알림 카드 아래에 한 줄로
function notifyHint(result) {
  if (result === 'default') return 'Windows 알림이 아직 꺼져 있어요. 설정(톱니바퀴) → 알림 켜기';
  if (result === 'denied') return 'Windows 알림이 막혀 있어요. 설정(톱니바퀴) → 알림에서 켜는 방법을 확인해 주세요';
  return '';
}
async function handleEvent(ev) {
  const tag = N.eventTag(ev);
  if (ev.type === 'mess') {
    sfx.chime(); FX.spawnPuff(150, 190, 10); FX.spawnPuff(60, 200, 6);
    const r = await N.systemNotify('mess', tag);
    showNotice({ em: '🧹', title: '청소 시간', body: `방이 어질러졌어요! ${CAT_NAME}랑 같이 치워 볼까요?`, hint: notifyHint(r) });
  } else if (ev.type === 'letter') {
    sfx.chime();
    const r = await N.systemNotify('letter', tag);
    if (!modalOpen()) P.showLetterArrived(app, ev.day);
    else showNotice({ em: '✉️', title: '편지 도착', body: `Day ${ev.day} 편지와 LP ${ev.day}가 도착했어요!`, hint: notifyHint(r), onClick: () => P.openLetter(app, ev.day, { typing: true }) });
  } else if (ev.type === 'end') {
    N.systemNotify('end', tag);
    celebrate(false);
  } else if (ev.type === 'love') {
    const msg = lovePing(Math.floor(ev.at / 3600000)).replace(/^[^:]+:\s*/, '');
    if (cat.sleeping) cat.touch();
    sfx.meow(); const b = cat.box; FX.spawnHearts(b.x + b.w / 2, b.y, 4);
    speak(msg, 6000);
    const r = await N.systemNotify('love', tag, msg);
    showNotice({ em: '💌', title: `${CAT_NAME}의 한마디`, body: msg, hint: notifyHint(r), ms: 10000, onClick: () => petCat() });
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
  cat.grow = T.growthAt(t);
  cat.update(dt, catCtx);
  updateBall(dt);
  updateBubble(tms);
  if (entered && tms > nextChatter) {
    nextChatter = tms + 45000 + Math.random() * 40000;
    if (!cat.sleeping && !modalOpen() && tms - lastSpeak > 20000) speak(say('idle', cat.grow), 4200);
  }
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
  const dd0 = faxDiscDay();
  if (entered && dd0 && ejectDay !== dd0) { ejectDay = dd0; ejectStart = tms; ejectUntil = tms + EJECT_MS; sfx.whirr(); }
  S.drawFax(g, tms < ejectUntil, tms);
  if (store.torch.hung) R2.drawTorch(g, store.torch.lit, tms);
  if (framePix) R2.drawFramePhoto(g, framePix);
  R2.drawDrawerMarks(g);
  if (drawerAnim) { const p = (tms - drawerAnim.start) / 900; if (p >= 1) drawerAnim = null; else R2.drawDrawerOpen(g, drawerAnim.i, p); }
  for (const [id, fn] of [['rose', R2.drawRose], ['lisianthus', R2.drawLisianthus], ['celosia', R2.drawCelosia]]) fn(g, store.plants[id].n, tms, store.plants[id].last === todayKey());
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
  const dirty = (i) => !!mess && store.clean.items.includes(i) && !store.clean.done.includes(i);
  const fade = (id, fn) => { if (!dirty(id)) return; if (anim[id] !== undefined) { g.globalAlpha = Math.max(0, 1 - anim[id] * 1.2); fn(); g.globalAlpha = 1; } else fn(); };
  for (const id of ['stain', 'ash', 'soil', 'yarn', 'books', 'fur', 'papers']) fade(id, () => R2.drawMessItem(g, id, store.clean.messAt, tms));
  // 청소기는 러그를 한 번에 슉 지나가며 쓰레기를 빨아들임
  const vacX = anim.trash !== undefined ? R2.MESS.trash.sweep[0] + anim.trash * (R2.MESS.trash.sweep[1] - R2.MESS.trash.sweep[0]) : null;
  if (dirty('trash')) {
    const bits = R2.trashBits(store.clean.messAt).filter(b => vacX === null || b.x > vacX + 4);
    for (const b of bits) R2.drawTrashBit(g, b);
  }
  // 가습기
  const hl = humidLevel();
  R2.drawHumidifier(g, hl, store.humid.light, tms, humidRefill ? (tms - humidRefill) / 1200 : 0);
  if (hl > 0 && !humidRefill && tms > nextMist) { nextMist = tms + 260; FX.spawnMist(R2.HUMID.x, R2.HUMID.y - 17, store.humid.light); }
  R2.drawBall(g, Math.round(ball.x), ball.y, ball.rot);
  R2.drawLitter(g, dirty('litter') && !(anim.litter > 0.6), tms);
  R2.drawBowls(g, dirty('bowls') && !(anim.bowls > 0.6));
  if (anim.cushions !== undefined) { g.globalAlpha = 1 - anim.cushions; R2.drawPillows(g, true); g.globalAlpha = anim.cushions; R2.drawPillows(g, false); g.globalAlpha = 1; }
  else R2.drawPillows(g, dirty('cushions'));
  if (anim.blanket !== undefined) {
    g.globalAlpha = 1 - anim.blanket; S.drawBlanket(g, true, tms);
    g.globalAlpha = anim.blanket; S.drawBlanket(g, false, tms); g.globalAlpha = 1;
  } else S.drawBlanket(g, dirty('blanket'), tms);
  if (app.ramenActive()) R2.drawRamen(g, tms, store.ramen.bites);

  cat.draw(g, festive);

  for (const [id, p] of Object.entries(anim)) { const d = R2.MESS[id]; R2.drawTool(g, d.tool, id === 'trash' ? vacX : d.pos[0], d.pos[1], id === 'trash' ? 0 : p); }
  if (watering) { const pl = R2.PLANTS[watering.id]; const [tx, ty] = pl.can(store.plants[watering.id].n); R2.drawWateringCan(g, tx, ty, (tms - watering.start) / 1300, pl.dir); }

  // 어둡기 → 불빛
  S.drawShade(g, store, tod, store.fire);
  S.drawGlows(g, store, tod, store.fire, tms);
  if (store.humid.light && humidLevel() > 0) { g.save(); g.globalCompositeOperation = 'lighter'; R2.drawHumidGlow(g, tms); g.restore(); }
  if (store.torch.hung && store.torch.lit) { g.save(); g.globalCompositeOperation = 'lighter'; R2.drawTorchGlow(g, tms); g.restore(); }
  if (entered) for (const [id, pl] of Object.entries(R2.PLANTS)) if (needsWater(id) && (!watering || watering.id !== id)) R2.drawDropHint(g, pl.drop[0], pl.drop[1], tms + pl.drop[0] * 40);

  // 알림 말풍선, LP
  const beforeStart = !festive && t < FIRST_LETTER_AT;
  if (entered && unreadDays().length) S.drawBubble(g, 236, 90 + Math.round(Math.sin(tms / 250) * 2), '!');
  const dd = faxDiscDay();
  if (dd && !discFly && tms < ejectUntil) {
    // 팩스 위 틈에서 천천히 밀려 올라오는 LP
    const p = Math.min(1, (tms - ejectStart) / EJECT_MS);
    const e = 1 - Math.pow(1 - p, 3);
    const y = S.FAX_SLOT_Y + 1 - e * (S.FAX_SLOT_Y + 1 - 80);
    g.save(); g.beginPath(); g.rect(260, 0, 50, S.FAX_SLOT_Y + 0.5); g.clip();
    S.drawDisc(g, dd, 277, Math.round(y));
    g.restore();
    if (p > 0.97 && !frame.popped) { frame.popped = true; FX.spawnSparkles(284, 86, 10, 10); sfx.pop(); }
  } else if (dd && !discFly) {
    frame.popped = false;
    const [dx, dy] = discDrag ? [discDrag.x - 8, discDrag.y - 8] : [277, 80 + discBob()];
    if (!discDrag) { g.save(); g.globalCompositeOperation = 'lighter'; S.ell(g, 285, 88 + discBob(), 11, 11, 'rgba(255,230,160,0.12)'); g.restore(); }
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
  const total = m ? store.clean.items.length : 0;
  const left = messLeft();
  const show = entered && m && left > 0;
  missionEl.hidden = !show;
  if (show) missionText.textContent = `방 청소 ${total - left}/${total}`;
}

// ────────── 하단 버튼 ──────────
const soundBtn = document.getElementById('btn-sound');
function syncSoundBtn() {
  soundBtn.classList.toggle('muted', !store.sound);
  soundBtn.setAttribute('aria-label', store.sound ? '소리 끄기' : '소리 켜기');
}
soundBtn.addEventListener('click', () => { initAudio(); setMuted(store.sound); syncSoundBtn(); });
document.getElementById('btn-settings').addEventListener('click', () => { initAudio(); P.openSettings(app); });
document.getElementById('btn-chat').addEventListener('click', () => { initAudio(); cat.touch(); P.openChat(app); });
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
  speak(say('greet', cat.grow), 3600);
  if (first) { store.humid = { ...store.humid, refillAt: now() }; toast(`방 안의 물건을 눌러 보세요. ${CAT_NAME}도 쓰다듬을 수 있어요.`, 4200); doTest(); return; }
  const items = [];
  const un = unreadDays();
  if (un.length === 1) items.push(['✉️', T.letterUnlockAt(un[0]) < T.kstDayStart(now()) ? '어젯밤 도착한 편지가 있어요!' : '오늘 밤 도착한 편지가 있어요!']);
  else if (un.length > 1) items.push(['✉️', `읽지 않은 편지가 ${un.length}통 있어요!`]);
  if (messLeft()) items.push(['🧹', `밀린 방 청소가 필요해요! (${messLeft()}곳)`]);
  const thirsty = Object.keys(R2.PLANTS).filter(needsWater);
  if (thirsty.length) items.push(['💧', `화분 ${thirsty.length}개가 오늘 물을 기다려요.`]);
  if (faxDiscDay()) items.push(['💿', `팩스에 LP ${faxDiscDay()}가 도착해 있어요.`]);
  if (humidLevel() <= 0) items.push(['💜', '가습기 물이 다 떨어졌어요. 새 물로 갈아 주세요.']);
  const gd = T.growDay(now());
  if (gd > (store.lastGrowDay || 0)) { items.push(['🐈‍⬛', gd === 1 ? `아기 고양이 ${CAT_NAME}가 오늘부터 조금씩 자라요.` : `${CAT_NAME}가 어제보다 조금 더 자랐어요. (Day ${gd})`]); store.lastGrowDay = gd; }
  if (items.length) P.showNotices(items, doTest); else doTest();
}
function enableTest() {
  testEnabled = true;
  window.__neuru = { cat, app, tap };
  document.getElementById('btn-test').hidden = false;
  syncTestFlag();
  toast('테스트 모드가 켜졌어요. 초록 벌레 버튼을 눌러 보세요.');
}

// ────────── 시작 ──────────
async function boot() {
  layout();
  drawDoor();
  document.getElementById('enter').addEventListener('click', enter);
  requestAnimationFrame(frame);
  N.registerSW();
  migrateLegacyKey();
  try { manifest = await loadContent(); loadFramePixels(); } catch { document.getElementById('start-note').textContent = '편지 데이터를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 열어 주세요.'; }
  T.syncTime().then(() => { lastEventT = now(); });
  refreshWeather();
  setInterval(() => { if (document.visibilityState === 'visible') { T.syncTime(); refreshWeather(); } }, 5 * 60 * 1000);
  if (new URLSearchParams(location.search).has('test') && sessionStorage.getItem('neuru.testok')) { testEnabled = true; window.__neuru = { cat, app, tap }; document.getElementById('btn-test').hidden = false; syncTestFlag(); }
  cat.x = 214; cat.pose = 'sit';
  cat.x = -40; // 입장 전에는 방 밖에서 대기
}
boot();
