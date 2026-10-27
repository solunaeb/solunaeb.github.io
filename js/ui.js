// 공용 UI: 모달, 토스트, 배너
const modal = document.getElementById('modal');
const body = document.getElementById('sheet-body');
let onCloseCb = null;

export function openModal(build, onClose) {
  closeModal(true);
  body.innerHTML = '';
  build(body);
  modal.hidden = false;
  onCloseCb = onClose || null;
  const first = body.querySelector('button, [tabindex], input, select, textarea');
  (first || modal.querySelector('.close')).focus({ preventScroll: true });
}

export function closeModal(silent = false) {
  if (modal.hidden) return;
  modal.hidden = true;
  body.innerHTML = '';
  const cb = onCloseCb; onCloseCb = null;
  if (!silent) cb?.();
}
export const modalOpen = () => !modal.hidden;

modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// 앱 안 알림 카드
let noticeTimer = null, noticeClick = null;
const noticeEl = document.getElementById('notice');
noticeEl.addEventListener('click', (e) => {
  const cb = noticeClick;
  hideNotice();
  if (!e.target.closest('.n-close')) cb?.();
});
export function hideNotice() { noticeEl.hidden = true; clearTimeout(noticeTimer); noticeClick = null; }
export function showNotice({ em = '🐾', title = '', body = '', hint = '', ms = 9000, onClick = null }) {
  noticeEl.querySelector('.n-em').textContent = em;
  noticeEl.querySelector('.n-title').textContent = title;
  noticeEl.querySelector('.n-body').textContent = body;
  noticeEl.querySelector('.n-hint').textContent = hint;
  noticeEl.hidden = false;
  noticeEl.style.animation = 'none'; void noticeEl.offsetWidth; noticeEl.style.animation = '';
  noticeClick = onClick;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(hideNotice, ms);
}

let toastTimer = null;
export function toast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function banner(msg) {
  const el = document.getElementById('banner');
  el.textContent = msg;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
