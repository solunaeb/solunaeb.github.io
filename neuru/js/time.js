// 시간 검증(하이브리드) + 일정 계산
import { FIRST_LETTER_AT, TOTAL_DAYS, END_AT, MESS_HOURS, OFFLINE_TRUST_MS, KST_OFFSET_MS, GROW_START, LOVE_HOURS } from './config.js';

const DAY = 86400000;
const HOUR = 3600000;
const LS_KEY = 'neuru.time';
const LS_TEST = 'neuru.testclock';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

const state = load(LS_KEY, { offset: 0, verifiedAt: 0 });
let lastSyncPerf = -Infinity;
let testClock = load(LS_TEST, null); // { real, virtual } — 테스트 모드 가상 시계
export let online = false;

// 서버 시간 확인: 같은 사이트에 HEAD 요청을 보내 응답의 Date 헤더를 읽는다.
// (GitHub Pages 가 주는 시각이므로 기기 시계를 바꿔도 영향을 받지 않음)
export async function syncTime() {
  const url = new URL('./?__time=' + Math.random().toString(36).slice(2), location.href);
  try {
    const t0 = performance.now();
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const t1 = performance.now();
    const h = res.headers.get('date');
    if (!h) throw new Error('no date header');
    // Date 헤더는 초 단위라 0.5초를 더해 평균 오차를 줄인다
    const server = Date.parse(h) + 500 + (t1 - t0) / 2;
    state.offset = server - Date.now();
    state.verifiedAt = server;
    save(LS_KEY, state);
    lastSyncPerf = performance.now();
    online = true;
  } catch {
    online = false;
  }
  return online;
}

// 앱 전체가 쓰는 "검증된 현재 시각"
export function now() {
  if (testClock) return testClock.virtual + (Date.now() - testClock.real);
  const t = Date.now() + state.offset;
  const freshSync = performance.now() - lastSyncPerf < 30 * 60 * 1000;
  if (!freshSync && state.verifiedAt && t - state.verifiedAt > OFFLINE_TRUST_MS) {
    // 오프라인 상태에서 기기 시계가 마지막 확인보다 지나치게 앞서 있음 → 해금 기준을 묶어 둔다
    return state.verifiedAt + OFFLINE_TRUST_MS;
  }
  return t;
}

export function timeStatus() {
  if (testClock) return 'test';
  if (performance.now() - lastSyncPerf < 30 * 60 * 1000) return 'online';
  return state.verifiedAt ? 'offline' : 'unverified';
}

// ── 테스트 시계 ──
export function setTestTime(virtualMs) {
  testClock = { real: Date.now(), virtual: virtualMs };
  save(LS_TEST, testClock);
}
export function clearTestTime() {
  testClock = null;
  localStorage.removeItem(LS_TEST);
}
export function isTestClock() { return !!testClock; }

// ── KST 도우미 ──
export function kst(t) {
  const d = new Date(t + KST_OFFSET_MS);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
export function kstDayStart(t) {
  return Math.floor((t + KST_OFFSET_MS) / DAY) * DAY - KST_OFFSET_MS;
}

// ── 편지 일정 ──
export function letterUnlockAt(day) { return FIRST_LETTER_AT + (day - 1) * DAY; }
export function unlockedCount(t) {
  if (t < FIRST_LETTER_AT) return 0;
  return Math.min(TOTAL_DAYS, Math.floor((t - FIRST_LETTER_AT) / DAY) + 1);
}
export function isEnded(t) { return t >= END_AT; }

// ── 청소 일정: t 이전 가장 최근의 "어질러지는 시각" (없으면 0) ──
export function latestMessAt(t) {
  if (t >= END_AT) return 0; // 수료 후에는 청소 미션 없음
  const start = kstDayStart(t);
  const cands = [];
  for (const off of [-1, 0]) for (const h of MESS_HOURS) cands.push(start + off * DAY + h * HOUR);
  const past = cands.filter(c => c <= t);
  return Math.max(0, ...past);
}

// 다음 "사건" 시각 목록 (알림 스케줄러용)
export function upcomingEvents(t, withinMs = DAY) {
  const out = [];
  const start = kstDayStart(t);
  for (let off = 0; off <= 1; off++) {
    for (const h of MESS_HOURS) {
      const at = start + off * DAY + h * HOUR;
      if (at > t && at - t <= withinMs && at < END_AT) out.push({ at, type: 'mess' });
    }
  }
  for (let off = 0; off <= 1; off++) {
    for (const h of LOVE_HOURS) {
      const at = start + off * DAY + h * HOUR;
      if (at > t && at - t <= withinMs && at >= GROW_START && at < END_AT) out.push({ at, type: 'love' });
    }
  }
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    const at = letterUnlockAt(d);
    if (at > t && at - t <= withinMs) out.push({ at, type: 'letter', day: d });
  }
  if (END_AT > t && END_AT - t <= withinMs) out.push({ at: END_AT, type: 'end' });
  return out.sort((a, b) => a.at - b.at);
}

export { DAY, HOUR };

// 느루 성장 (0 = 아기 고양이, 1 = 어른 고양이)
export function growthAt(t) { return Math.max(0, Math.min(1, (t - GROW_START) / (END_AT - GROW_START))); }
export function growDay(t) { return t < GROW_START ? 0 : Math.min(TOTAL_DAYS, Math.floor((t - GROW_START) / DAY) + 1); }
