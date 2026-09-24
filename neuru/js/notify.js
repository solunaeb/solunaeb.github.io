// 알림: 권한 요청, 시스템 알림, 웹 푸시 구독
import { VAPID_PUBLIC_KEY, CAT_NAME } from './config.js';
import { store, persist } from './store.js';
import { kst } from './time.js';

let reg = null;

export const MESSAGES = {
  mess: { title: '널 사랑할고양', body: `🧹 청소할 시간이에요! ${CAT_NAME}가 기다리고 있어요.` },
  letter: { title: '널 사랑할고양', body: '✉️ 오늘의 편지와 음악이 도착했어요!' },
  end: { title: '널 사랑할고양', body: '🎉 드디어 오늘이에요! 21일의 기다림이 끝났어요.' },
};

export function eventTag(ev) {
  if (ev.type === 'letter') return 'letter-' + ev.day;
  if (ev.type === 'end') return 'end';
  const k = kst(ev.at);
  return `mess-${k.y}${String(k.mo).padStart(2, '0')}${String(k.d).padStart(2, '0')}-${k.h}`;
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try { reg = await navigator.serviceWorker.register('./sw.js'); } catch { reg = null; }
  return reg;
}

export function permission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  if (Notification.permission === 'granted') subscribePush().catch(() => {});
  return Notification.permission;
}

function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

export function pushConfigured() { return !!VAPID_PUBLIC_KEY; }

// 이 기기의 푸시 구독 정보 (GitHub 비밀값에 붙여 넣을 "알림 연결 코드")
export async function subscribePush() {
  if (!VAPID_PUBLIC_KEY || !('PushManager' in window)) return null;
  const r = reg || await navigator.serviceWorker.ready;
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID_PUBLIC_KEY) });
  return sub.toJSON();
}

export async function systemNotify(kind, tag) {
  if (store.notified.includes(tag)) return;
  store.notified.push(tag); persist();
  if (permission() !== 'granted') return;
  const m = MESSAGES[kind];
  try {
    const r = reg || await navigator.serviceWorker.ready;
    await r.showNotification(m.title, { body: m.body, tag, icon: './icons/icon-192.png', badge: './icons/badge-96.png', data: { url: './' } });
  } catch {
    try { new Notification(m.title, { body: m.body, tag, icon: './icons/icon-192.png' }); } catch {}
  }
}

export async function testNotify() {
  if (permission() !== 'granted') return false;
  const r = reg || await navigator.serviceWorker.ready;
  await r.showNotification('널 사랑할고양', { body: '🔔 알림 테스트예요. 잘 보이나요?', tag: 'test-' + Date.now(), icon: './icons/icon-192.png', badge: './icons/badge-96.png' });
  return true;
}
