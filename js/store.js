// 진척도 저장 (localStorage)
const KEY = 'neuru.progress.v1';

const defaults = () => ({
  firstVisit: 0,
  read: [],            // 읽은 편지 Day 번호
  played: [],          // 한 번이라도 튼 LP Day 번호
  clean: { messAt: -1, items: [], done: [] }, // 현재 어질러짐(messAt)에 대해 어질러진 곳 / 치운 곳
  plants: { rose: { n: 0, last: '' }, lisianthus: { n: 0, last: '' }, celosia: { n: 0, last: '' } }, // 물 준 횟수, 마지막 날짜
  torch: { hung: false, lit: false },
  ramen: { until: 0, bites: 0 },
  humid: { refillAt: 0, light: true },
  vol: { sfx: 0.8, music: 0.8, amb: 0.45 },
  lastGrowDay: 0,
  love: { on: true, every: 60, from: 9, to: 22 }, // 느루의 한마디 알림 설정
  loveSeq: 0,          // 몇 번째 한마디인지 (같은 말이 연달아 나오지 않게)
  fire: false,
  lampFloor: true,
  lampWall: true,
  sound: true,
  celebrated: false,
  notified: [],        // 앱이 직접 띄운 시스템 알림 태그 (중복 방지)
});

let data;
try { data = { ...defaults(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
catch { data = defaults(); }

export const store = new Proxy(data, {
  set(obj, prop, value) { obj[prop] = value; persist(); return true; },
});

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function resetProgress() {
  const keep = { sound: data.sound };
  Object.keys(data).forEach(k => delete data[k]);
  Object.assign(data, defaults(), keep);
  persist();
}

export function addUnique(listName, value) {
  if (!data[listName].includes(value)) { data[listName].push(value); persist(); }
}
