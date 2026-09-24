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

// 느루 성장·화분 물 주기 시작 (이때부터 수료까지 21일 동안 아기 고양이 → 어른 고양이)
export const GROW_START = Date.parse('2026-10-29T00:00:00+09:00');

// 느루가 "보고 싶어!" 같은 말을 전하는 시각 (KST 시, 3시간 간격)
export const LOVE_HOURS = [9, 12, 15, 18, 21];

// 느루가 대화에서 부를 이름 (비워 두면 "너" / "그 사람")
export const HER_NAME = '';
export const HIS_NAME = '';

// 방이 어질러지는 시각 (KST 시)
export const MESS_HOURS = [10, 22];

// 편지·음원 간단 암호화용 비밀값. tools/build_content.py 도 이 값을 읽습니다.
// 바꾸면 반드시 build_content.py 를 다시 실행하세요.
export const CONTENT_SECRET = '88lOoyxNuFAncBzta0iJ9xq7Tyt077vw';

// 테스트 모드 비밀번호의 SHA-256 해시 (sha256("neuru:" + 비밀번호)).
// 비밀번호를 바꾸려면 README 4번의 방법으로 해시를 새로 만들어 넣으세요.
export const TEST_PASSWORD_HASH = '795620ab1da76052ef65ce90af3d30fbcd553a0ae312a5691795bbbf956b0c82';

// 웹 푸시(VAPID) 공개키. 비워 두면 앱이 켜져 있을 때의 알림만 동작합니다.
// 테스트 모드 > "푸시 키 만들기"로 만든 공개키를 붙여 넣으세요.
export const VAPID_PUBLIC_KEY = '';

// 날씨 (Open-Meteo, 서울)
export const WEATHER = { lat: 37.5665, lon: 126.978, label: '서울' };

// 오프라인일 때 기기 시간을 믿는 최대 범위 (마지막 서버 확인 이후)
export const OFFLINE_TRUST_MS = 48 * 60 * 60 * 1000;

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
