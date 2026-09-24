// GitHub Actions 가 정해진 시각에 실행하는 웹 푸시 발송 스크립트
// 예약 실행은 몇 분~수십 분 늦게 시작될 수 있어서, 목표 시각 30분 전에 시작해 정각까지 기다린 뒤 보냅니다.
import webpush from 'web-push';

const KST = 9 * 3600e3, HOUR = 3600e3, DAY = 86400e3;
const FIRST_LETTER_AT = Date.parse('2026-10-29T23:00:00+09:00');
const END_AT = Date.parse('2026-11-19T00:00:00+09:00');
const PERIOD_START = Date.parse('2026-10-29T00:00:00+09:00');
const CAT = '느루';

const MSG = {
  mess: { title: '널 사랑할고양', body: `🧹 청소할 시간이에요! ${CAT}가 기다리고 있어요.` },
  letter: { title: '널 사랑할고양', body: '✉️ 오늘의 편지와 음악이 도착했어요!' },
  end: { title: '널 사랑할고양', body: '🎉 드디어 오늘이에요! 21일의 기다림이 끝났어요.' },
  test: { title: '널 사랑할고양', body: '🔔 푸시 알림 테스트예요. 잘 도착했나요?' },
};
import { loveLine } from '../js/speech.js';   // 앱과 같은 문구 목록
const LOVE_HOURS = [9, 12, 15, 18, 21];

// 어떤 cron 이 실행했는지로 목표 시각을 정함 (UTC 기준 cron, 목표는 30분 뒤)
const SCHEDULE_TO_EVENT = {
  '30 0 * 10,11 *': { type: 'mess', hour: 10 },
  '30 12 * 10,11 *': { type: 'mess', hour: 22 },
  '30 13 * 10,11 *': { type: 'letter', hour: 23 },
  '30 14 18 11 *': { type: 'end', hour: 0 },
  '30 23,2,5,8,11 * 10,11 *': { type: 'love' },
};

function kstDayStart(t) { return Math.floor((t + KST) / DAY) * DAY - KST; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function pickEvent() {
  const manual = process.env.MANUAL_EVENT;
  if (manual) return { type: manual, at: Date.now() };
  const ev = SCHEDULE_TO_EVENT[process.env.SCHEDULE];
  if (!ev) { console.log('알 수 없는 스케줄:', process.env.SCHEDULE); return null; }
  const now = Date.now();
  if (ev.type === 'love') {
    // 지금부터 가장 가까운 LOVE_HOURS 정각 (시작이 늦어져도 같은 회차로 판단)
    const start = kstDayStart(now);
    const cands = [];
    for (const off of [-1, 0, 1]) for (const h of LOVE_HOURS) cands.push(start + off * DAY + h * HOUR);
    cands.sort((a, b) => Math.abs(a - now - 30 * 60e3) - Math.abs(b - now - 30 * 60e3));
    return { type: 'love', at: cands[0] };
  }
  // 가장 가까운 목표 시각 (앞뒤 12시간 이내)
  let base = kstDayStart(now) + ev.hour * HOUR;
  if (base - now > 12 * HOUR) base -= DAY;
  if (now - base > 12 * HOUR) base += DAY;
  return { type: ev.type, at: base };
}

function inPeriod(ev) {
  if (process.env.MANUAL_EVENT) return true;   // 직접 실행(Run workflow)은 언제든 보냄
  if (ev.type === 'test') return true;
  if (ev.type === 'end') return ev.at === END_AT;
  if (ev.type === 'letter') return ev.at >= FIRST_LETTER_AT && ev.at < END_AT;
  if (ev.type === 'mess' || ev.type === 'love') return ev.at >= PERIOD_START && ev.at < END_AT;
  return false;
}

function tagFor(ev) {
  if (ev.type === 'letter') return 'letter-' + (Math.round((ev.at - FIRST_LETTER_AT) / DAY) + 1);
  if (ev.type === 'end') return 'end';
  if (ev.type === 'test') return 'test-' + Date.now();
  if (ev.type === 'love') { const d = new Date(ev.at + KST); return `love-${d.getUTCMonth() + 1}${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCHours()).padStart(2, '0')}00`; }
  const d = new Date(ev.at + KST);
  return `mess-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCHours()}`;
}

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTIONS } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTIONS) { console.log('비밀값(Secrets)이 설정되지 않아 건너뜁니다.'); return; }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:neuru@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const ev = pickEvent();
  if (!ev) return;
  if (!inPeriod(ev)) { console.log('기간 밖이라 보내지 않습니다:', new Date(ev.at).toISOString(), ev.type); return; }

  const wait = ev.at - Date.now();
  if (wait > 0) { console.log(`정각까지 ${Math.round(wait / 1000)}초 기다립니다`); await sleep(wait); }
  else if (-wait > 3 * HOUR) { console.log('너무 늦게 시작되어 보내지 않습니다'); return; }

  let subs = JSON.parse(PUSH_SUBSCRIPTIONS);
  if (!Array.isArray(subs)) subs = [subs];
  const msg = ev.type === 'love'
    ? { title: '느루의 한마디 💌', body: loveLine(Math.floor(ev.at / (3 * HOUR)), new Date(ev.at + KST).getUTCHours()) }
    : MSG[ev.type];
  const payload = JSON.stringify({ ...msg, tag: tagFor(ev) });
  for (const [i, sub] of subs.entries()) {
    try { await webpush.sendNotification(sub, payload, { TTL: 6 * 3600 }); console.log(`#${i + 1} 발송 성공`); }
    catch (err) { console.log(`#${i + 1} 발송 실패: ${err.statusCode || ''} ${err.body || err.message}`); }
  }
}
main();
