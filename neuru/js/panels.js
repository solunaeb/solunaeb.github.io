// 모달 화면들
import { openModal, closeModal, toast, h } from './ui.js';
import { sfx } from './audio.js';
import { drawDisc } from './scene.js';
import { kst, letterUnlockAt } from './time.js';
import { TOTAL_DAYS, FIRST_LETTER_AT, END_AT, TEST_PASSWORD_HASH, VAPID_PUBLIC_KEY, CAT_NAME } from './config.js';
import { WEATHER_KINDS, WEATHER_LABEL } from './weather.js';

const dateOf = (day) => { const k = kst(letterUnlockAt(day)); return { mo: k.mo, d: k.d }; };
const fmtDate = (day) => { const { mo, d } = dateOf(day); return `${mo}월 ${d}일`; };
const shortDate = (day) => { const { mo, d } = dateOf(day); return `${mo}.${String(d).padStart(2, '0')}`; };

function discCanvas(day) {
  const c = h('canvas', { width: 16, height: 16, 'aria-hidden': 'true' });
  const g = c.getContext('2d'); drawDisc(g, day, 0, 0); return c;
}

// ── 타자기 편지 ──
export async function openLetter(app, day, { typing = true, fromArchive = false } = {}) {
  let letter;
  try { letter = await app.getLetter(day); }
  catch { toast('편지를 여는 중에 문제가 생겼어요. 앱을 다시 열어 주세요.'); return; }
  let timer = null, finished = !typing;

  openModal((root) => {
    const out = h('span');
    const caret = h('span', { class: 'caret' });
    const paper = h('div', { class: 'paper', tabindex: '0', 'aria-label': `Day ${day} 편지` },
      h('div', { class: 'head' }, h('span', {}, `Day ${day}`), h('span', {}, `${fmtDate(day)} 밤`)),
      letter.title ? h('div', { class: 'title' }, letter.title) : null,
      out, caret);
    const actions = h('div', { class: 'actions' });
    root.append(h('h2', { id: 'sheet-title' }, fromArchive ? '보관 상자' : '오늘의 편지'),
      h('div', { class: 'tw' }, h('div', { class: 'tw-roller' }), paper), actions);

    const chars = [...letter.text];
    let i = 0;
    const done = () => {
      finished = true; clearTimeout(timer);
      out.textContent = letter.text; caret.remove();
      app.markRead(day);
      actions.innerHTML = '';
      if (fromArchive) actions.append(h('button', { class: 'pix-btn', onclick: () => openArchive(app) }, '목록으로'));
      actions.append(h('button', { class: 'pix-btn big', onclick: () => { closeModal(); } }, fromArchive ? '닫기' : '보관 상자에 넣기'));
    };
    const tick = () => {
      if (i >= chars.length) { sfx.ding(); done(); return; }
      const ch = chars[i++];
      out.textContent += ch;
      let delay = 42 + Math.random() * 38;
      if (ch === '\n') { sfx.carriage(); delay = 320; }
      else if (ch === ' ') delay = 28;
      else { sfx.key(); if (/[.!?…]/.test(ch)) delay += 180; }
      paper.scrollTop = paper.scrollHeight;
      timer = setTimeout(tick, delay);
    };
    if (typing) {
      actions.append(h('button', { class: 'pix-btn', onclick: done }, '빨리 넘기기'));
      timer = setTimeout(tick, 500);
    } else done();
  }, () => { clearTimeout(timer); if (finished && !fromArchive) app.onLetterStored(day); });
}

// ── 보관 상자 ──
export function openArchive(app) {
  const unlocked = app.unlocked();
  openModal((root) => {
    root.append(h('h2', { id: 'sheet-title' }, '보관 상자'));
    if (!unlocked) root.append(h('p', { class: 'sub' }, '10월 29일 밤 11시에 첫 편지가 도착해요. 그 전까지 상자는 비어 있어요.'));
    else root.append(h('p', { class: 'sub' }, '읽은 편지는 언제든 다시 꺼내 볼 수 있어요.'));
    const grid = h('div', { class: 'grid' });
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      const open = d <= unlocked;
      const isNew = open && !app.store.read.includes(d);
      const slot = h('button', {
        class: 'slot' + (open ? (isNew ? ' new' : '') : ' locked'),
        'aria-label': open ? `Day ${d} 편지 열기` : `Day ${d}, ${fmtDate(d)} 밤 11시에 도착`,
        'aria-disabled': open ? null : 'true',
        onclick: () => { if (open) openLetter(app, d, { typing: isNew, fromArchive: true }); else { sfx.lock(); toast(`${fmtDate(d)} 밤 11시에 도착해요`); } },
      }, h('span', { class: 'envelope', 'aria-hidden': 'true' }), h('span', { class: 't' }, `Day ${d}`), h('span', { class: 'd' }, open ? shortDate(d) : `${shortDate(d)} 밤 11시`));
      grid.append(slot);
    }
    root.append(h('div', { class: 'scroll' }, grid));
  });
}

// ── 음반 상자 (턴테이블) ──
export function openCrate(app) {
  const unlocked = app.unlocked();
  const festive = app.ended();
  openModal((root) => {
    root.append(h('h2', { id: 'sheet-title' }, '음반 상자'));
    root.append(h('p', { class: 'sub' }, !unlocked
      ? '10월 29일 밤 11시부터 매일 한 장씩 새 음반이 도착해요.'
      : festive ? '오늘은 모든 음반을 마음껏 틀 수 있어요. 한 곡이 끝나면 다음 곡이 이어져요.' : '지난 음반은 언제든 다시 들을 수 있어요. 앞날의 음반은 그날 밤에 열려요.'));
    const grid = h('div', { class: 'grid' });
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      const open = d <= unlocked;
      const song = app.songOf(d);
      const playing = app.nowPlaying() === d;
      grid.append(h('button', {
        class: 'slot' + (open ? '' : ' locked') + (playing ? ' playing' : ''),
        'aria-label': open ? `LP ${d} 틀기` : `LP ${d}, ${fmtDate(d)} 밤 11시에 도착`,
        onclick: () => {
          if (!open) { sfx.lock(); toast(`LP ${d}는 ${fmtDate(d)} 밤 11시에 열려요`); return; }
          closeModal(true); app.playDay(d);
        },
      }, discCanvas(d), h('span', { class: 't' }, `LP ${d}`), h('span', { class: 'd' }, playing ? '재생 중' : open ? (song || shortDate(d)) : `${shortDate(d)} 도착`)));
    }
    root.append(h('div', { class: 'scroll' }, grid));
    if (app.nowPlaying()) root.append(h('div', { class: 'actions' }, h('button', { class: 'pix-btn', onclick: () => { app.stopMusic(); closeModal(true); } }, '음악 정지')));
  });
}

// ── 앱 켜자마자 뜨는 밀린 알림 ──
export function showNotices(items, onDone) {
  openModal((root) => {
    root.append(h('h2', { id: 'sheet-title' }, `${CAT_NAME}가 전해 줄 소식`));
    root.append(h('ul', { class: 'notice-list' }, items.map(([em, text]) => h('li', {}, h('span', { class: 'em', 'aria-hidden': 'true' }, em), h('span', {}, text)))));
    root.append(h('div', { class: 'actions' }, h('button', { class: 'pix-btn big', onclick: () => closeModal() }, '확인')));
  }, onDone);
}

// ── 설정과 도움말 ──
export function openSettings(app) {
  openModal((root) => {
    root.append(h('h2', { id: 'sheet-title' }, '설정과 도움말'));
    const sc = h('div', { class: 'scroll' });
    root.append(sc);

    // 소리
    const soundBtn = h('button', { class: 'pix-btn small', onclick: () => { app.toggleSound(); soundBtn.textContent = app.store.sound ? '소리 끄기' : '소리 켜기'; } }, app.store.sound ? '소리 끄기' : '소리 켜기');
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '소리'), h('div', { class: 'row' }, soundBtn)));

    // 알림
    const perm = app.permission();
    const permLabel = { granted: ['켜져 있어요', 'ok'], denied: ['막혀 있어요', 'bad'], default: ['아직 허용하지 않았어요', 'warn'], unsupported: ['이 브라우저는 알림을 지원하지 않아요', 'bad'] }[perm];
    const notif = h('div', { class: 'set-sec' }, h('h3', {}, '알림'),
      h('div', { class: 'row' }, h('span', { class: 'pill ' + permLabel[1] }, permLabel[0])));
    if (perm === 'default') notif.append(h('div', { class: 'row' }, h('button', { class: 'pix-btn small', onclick: async () => { await app.requestPermission(); openSettings(app); } }, '알림 켜기')));
    if (perm === 'denied') notif.append(h('p', { class: 'sub' }, '주소창 왼쪽의 자물쇠(또는 사이트 정보) 아이콘 → 알림 → 허용으로 바꾼 뒤 앱을 다시 열어 주세요.'));
    notif.append(h('p', { class: 'sub' }, '오전 10시·오후 10시 청소 시간과 밤 11시 편지 도착을 알려 드려요.'));
    if (VAPID_PUBLIC_KEY && perm === 'granted') {
      const area = h('textarea', { readonly: true, 'aria-label': '알림 연결 코드' });
      notif.append(h('div', { class: 'row' }, h('button', {
        class: 'pix-btn small', onclick: async () => {
          const sub = await app.subscribePush();
          if (!sub) { toast('이 기기에서는 알림 연결 코드를 만들 수 없어요.'); return; }
          area.value = JSON.stringify(sub);
          try { await navigator.clipboard.writeText(area.value); toast('알림 연결 코드를 복사했어요.'); } catch { area.select(); }
        },
      }, '알림 연결 코드 복사')), area);
      notif.append(h('p', { class: 'sub' }, '앱이 꺼져 있어도 알림을 받으려면, 이 코드를 앱을 만든 사람에게 한 번만 보내 주세요.'));
    }
    sc.append(notif);

    // 설치
    const inst = h('div', { class: 'set-sec' }, h('h3', {}, '앱으로 설치하기'));
    if (app.canInstall()) inst.append(h('div', { class: 'row' }, h('button', { class: 'pix-btn small', onclick: () => app.install() }, '지금 설치하기')));
    inst.append(
      h('p', { class: 'sub' }, '컴퓨터 (Chrome, Edge)'),
      h('ol', {}, h('li', {}, '주소창 오른쪽의 설치 아이콘(모니터 모양)을 눌러요.'), h('li', {}, '"설치"를 누르면 바탕화면과 시작 메뉴에 생겨요.')),
      h('p', { class: 'sub' }, '갤럭시 (Chrome)'),
      h('ol', {}, h('li', {}, '오른쪽 위 ⋮ 메뉴 → "홈 화면에 추가" 또는 "앱 설치"를 눌러요.'), h('li', {}, '홈 화면에 생긴 아이콘으로 열면 전체 화면으로 열려요.')),
      h('p', { class: 'sub' }, '갤럭시 (삼성 인터넷)'),
      h('ol', {}, h('li', {}, '아래쪽 ☰ 메뉴 → "현재 페이지 추가" → "홈 화면"을 눌러요.')),
      h('p', { class: 'sub' }, '한 번 연 뒤에는 인터넷이 없어도 열려요.'));
    sc.append(inst);

    // 자동 실행
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '컴퓨터를 켜면 바로 열기 (Windows)'),
      h('p', { class: 'sub' }, `앱을 설치한 뒤 한 번만 설정하면, 컴퓨터를 켤 때마다 ${CAT_NAME}가 반겨 줘요.`),
      h('p', { class: 'sub' }, 'Chrome'),
      h('ol', {}, h('li', {}, h('span', {}, '주소창에 '), h('code', {}, 'chrome://apps'), h('span', {}, ' 를 입력해요.')), h('li', {}, '"널 사랑할고양" 아이콘을 마우스 오른쪽 버튼으로 눌러요.'), h('li', {}, '"로그인할 때 시작"(Start app when you sign in)을 체크해요.')),
      h('p', { class: 'sub' }, 'Edge'),
      h('ol', {}, h('li', {}, h('span', {}, '주소창에 '), h('code', {}, 'edge://apps'), h('span', {}, ' 를 입력해요.')), h('li', {}, '"널 사랑할고양"의 ··· 메뉴를 눌러요.'), h('li', {}, '"장치 로그인 시 자동 시작"을 켜요.')),
      h('p', { class: 'sub' }, '메뉴 이름은 브라우저 버전에 따라 조금 다를 수 있어요.')));

    const st = app.timeStatus();
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '시간 확인'),
      h('div', { class: 'row' }, h('span', { class: 'pill ' + (st === 'online' ? 'ok' : st === 'test' ? 'warn' : 'warn') }, { online: '인터넷 시간으로 확인됨', offline: '오프라인 (마지막 확인 시간 기준)', unverified: '아직 확인 전', test: '테스트 시계 사용 중' }[st]))));
  });
}

// ── 테스트 모드 ──
export async function checkTestPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('neuru:' + pw));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === TEST_PASSWORD_HASH;
}

export function promptTestPassword(onOk) {
  openModal((root) => {
    const input = h('input', { type: 'password', autocomplete: 'off', 'aria-label': '비밀번호' });
    const go = async () => {
      if (await checkTestPassword(input.value)) { closeModal(true); onOk(); }
      else { input.value = ''; toast('비밀번호가 맞지 않아요.'); }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    root.append(h('h2', { id: 'sheet-title' }, '테스트 모드'), h('p', { class: 'sub' }, '만든 사람만 쓰는 화면이에요.'), input,
      h('div', { class: 'actions' }, h('button', { class: 'pix-btn', onclick: go }, '들어가기')));
    setTimeout(() => input.focus(), 50);
  });
}

const toLocalInput = (t) => { const k = kst(t); const p = n => String(n).padStart(2, '0'); return `${k.y}-${p(k.mo)}-${p(k.d)}T${p(k.h)}:${p(k.mi)}`; };

export function openTest(app) {
  openModal((root) => {
    const k = kst(app.now()); const p = n => String(n).padStart(2, '0');
    root.append(h('h2', { id: 'sheet-title' }, '테스트 모드'),
      h('p', { class: 'sub' }, `가상 시각 (KST): ${k.y}-${p(k.mo)}-${p(k.d)} ${p(k.h)}:${p(k.mi)}:${p(k.s)}  ·  시계 ${app.timeStatus()}  ·  build ${app.build()}`));
    const sc = h('div', { class: 'scroll' }); root.append(sc);
    const jump = (t, label) => { app.setTestTime(t); toast(label + '(으)로 이동했어요'); openTest(app); };
    const HOUR = 3600000, DAY = 86400000;

    // 시간 이동
    const dt = h('input', { type: 'datetime-local', value: toLocalInput(app.now()), 'aria-label': '이동할 시각 (KST)' });
    const daySel = h('select', { 'aria-label': 'Day 선택' }, Array.from({ length: TOTAL_DAYS }, (_, i) => h('option', { value: i + 1 }, `Day ${i + 1}`)));
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '시간 이동 (KST)'),
      h('div', { class: 'row' }, dt, h('button', { class: 'pix-btn small', onclick: () => jump(Date.parse(dt.value + ':00+09:00'), dt.value) }, '이 시각으로')),
      h('div', { class: 'row' },
        h('button', { class: 'pix-btn small', onclick: () => jump(FIRST_LETTER_AT - 10000, 'Day 1 도착 10초 전') }, 'Day 1 도착 10초 전'),
        h('button', { class: 'pix-btn small', onclick: () => { const s = app.kstDayStart(app.now()); let t = s + 10 * HOUR; if (t <= app.now()) t = s + 22 * HOUR; if (t <= app.now()) t = s + DAY + 10 * HOUR; jump(t - 10000, '다음 청소 10초 전'); } }, '다음 청소 10초 전'),
        h('button', { class: 'pix-btn small', onclick: () => jump(END_AT - 10000, '수료 10초 전') }, '수료 10초 전'),
        h('button', { class: 'pix-btn small', onclick: () => jump(END_AT + 60000, '수료 직후') }, '수료 직후')),
      h('div', { class: 'row' }, daySel,
        h('button', { class: 'pix-btn small', onclick: () => jump(letterUnlockAt(+daySel.value) - 10000, `Day ${daySel.value} 도착 10초 전`) }, '도착 10초 전'),
        h('button', { class: 'pix-btn small', onclick: () => jump(letterUnlockAt(+daySel.value) + 60000, `Day ${daySel.value} 도착 직후`) }, '도착 직후')),
      h('div', { class: 'row' }, h('button', { class: 'pix-btn small', onclick: () => { app.clearTestTime(); toast('실제 시각으로 돌아왔어요'); openTest(app); } }, '실제 시각으로 돌아가기'))));

    // 날씨
    const ws = h('select', { 'aria-label': '날씨 고정' }, h('option', { value: '' }, '자동 (실제 날씨)'), WEATHER_KINDS.map(w => h('option', { value: w }, WEATHER_LABEL[w])));
    ws.value = app.weatherOverride() || '';
    ws.addEventListener('change', () => app.setWeather(ws.value));
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '날씨 고정'), ws));

    // 기타
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '기타'),
      h('div', { class: 'row' },
        h('button', { class: 'pix-btn small', onclick: () => app.testNotify() }, '알림 테스트'),
        h('button', { class: 'pix-btn small', onclick: () => { closeModal(true); app.celebrate(true); } }, '축하 연출 보기'),
        h('button', { class: 'pix-btn small', onclick: () => { closeModal(true); app.replayGreeting(); } }, '반기기 다시 보기'),
        h('button', { class: 'pix-btn small', onclick: () => { if (confirm('읽은 편지, 청소 기록 등 진행 상황을 모두 지울까요?')) { app.resetProgress(); toast('진행 상황을 지웠어요'); } } }, '진행 초기화'))));

    // 푸시 키
    const out = h('textarea', { readonly: true, 'aria-label': '생성된 키' });
    sc.append(h('div', { class: 'set-sec' }, h('h3', {}, '웹 푸시 설정'),
      h('p', { class: 'sub' }, VAPID_PUBLIC_KEY ? '공개키가 설정되어 있어요.' : '아직 공개키가 없어요. 아래 버튼으로 키를 만든 뒤 README 의 순서대로 넣어 주세요.'),
      h('div', { class: 'row' },
        h('button', { class: 'pix-btn small', onclick: async () => { out.value = await makeVapid(); } }, '푸시 키 만들기'),
        VAPID_PUBLIC_KEY ? h('button', {
          class: 'pix-btn small', onclick: async () => {
            await app.requestPermission();
            const sub = await app.subscribePush();
            out.value = sub ? JSON.stringify(sub) : '구독 실패 (알림 권한을 확인하세요)';
          },
        }, '이 기기 알림 연결 코드') : null),
      out));

    sc.append(h('div', { class: 'set-sec' }, h('div', { class: 'row' },
      h('button', { class: 'pix-btn small', onclick: () => { app.exitTest(); } }, '테스트 모드 끝내기'))));
  });
}

async function makeVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${jwk.d}\n\n※ 개인키(PRIVATE)는 GitHub Secrets 에만 넣고 코드에는 절대 넣지 마세요.`;
}

// ── 축하 화면 ──
export async function showCelebration(app, onClose) {
  const wrap = document.getElementById('celebrate');
  const box = document.getElementById('cel-letter');
  box.className = 'cel-letter paper';
  box.textContent = '';
  wrap.hidden = false;
  let text = '';
  try { const f = await app.getFinale(); text = f.text || ''; } catch {}
  if (!text) text = '21일 동안 정말 고생 많았어.\n이제 느루랑 같이 기다리던 날이야.';
  let i = 0; const chars = [...text];
  const tick = () => { if (i >= chars.length || wrap.hidden) return; box.textContent += chars[i++]; if (chars[i - 1] !== ' ' && chars[i - 1] !== '\n') sfx.key(); box.scrollTop = box.scrollHeight; setTimeout(tick, chars[i - 1] === '\n' ? 300 : 55); };
  setTimeout(tick, 900);
  const btn = document.getElementById('cel-close');
  btn.onclick = () => { wrap.hidden = true; onClose?.(); };
  btn.focus({ preventScroll: true });
}
