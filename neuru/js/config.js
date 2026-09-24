// ─────────────────────────────────────────────
//  널 사랑할고양 — 설정 파일
//  날짜/시간은 모두 한국 시간(KST, UTC+9) 기준입니다.
// ─────────────────────────────────────────────

export const APP_NAME = '널 사랑할고양';
export const CAT_NAME = '느루';

// Day 1 편지가 도착하는 시각. Day N은 여기서 (N-1)일 뒤 같은 시각에 열립니다.
export const FIRST_LETTER_AT = Date.parse('2026-10-29T23:00:00+09:00');
export const TOTAL_DAYS = 21;

// 카운트다운 목표 (수료일). 이 시각이 지나면 축하 모드로 바뀝니다.
export const END_AT = Date.parse('2026-11-19T00:00:00+09:00');

// 방이 어질러지는 시각 (KST 시)
export const MESS_HOURS = [10, 22];

// 편지·음원 간단 암호화용 비밀값. tools/build_content.py 도 이 값을 읽습니다.
// 바꾸면 반드시 build_content.py 를 다시 실행하세요.
export const CONTENT_SECRET = '88lOoyxNuFAncBzta0iJ9xq7Tyt077vw';

// 테스트 모드 비밀번호의 SHA-256 해시 (sha256("neuru:" + 비밀번호)).
// 기본 비밀번호는 nuru1119 — README의 방법으로 꼭 바꿔 주세요.
export const TEST_PASSWORD_HASH = '4b6f67a3baf99a0add6c5bd2c340ef2bc8fe6a7387d95ba0021f1cee65004a56';

// 웹 푸시(VAPID) 공개키. 비워 두면 앱이 켜져 있을 때의 알림만 동작합니다.
// 테스트 모드 > "푸시 키 만들기"로 만든 공개키를 붙여 넣으세요.
export const VAPID_PUBLIC_KEY = '';

// 날씨 (Open-Meteo, 서울)
export const WEATHER = { lat: 37.5665, lon: 126.978, label: '서울' };

// 오프라인일 때 기기 시간을 믿는 최대 범위 (마지막 서버 확인 이후)
export const OFFLINE_TRUST_MS = 48 * 60 * 60 * 1000;

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
