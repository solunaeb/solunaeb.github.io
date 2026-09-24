// 느루와 대화 — Google AI Studio 무료 키(Gemini) → 없으면 키 없는 공개 API 시도 → 그래도 안 되면 미리 써 둔 대사
import { CAT_NAME, HER_NAME, HIS_NAME, TOTAL_DAYS, END_AT } from './config.js';
import { stageOf, STAGE_LABEL, say } from './speech.js';

const KEY_AI = 'neuru.ai';
const KEY_LOG = 'neuru.chat';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

// mode: 'proxy' (중계 서버 — 추천, 키가 브라우저에 없음) / 'key' (키 직접 입력)
export function aiSettings() {
  const s = { mode: 'proxy', proxy: '', token: '', key: '', model: '', resolved: '', ...load(KEY_AI, {}) };
  if (!load(KEY_AI, {}).mode && s.key) s.mode = 'key';
  if (s.model === 'gemini-flash-latest') s.model = ''; // 예전 기본값은 자동 선택으로
  if (s.v !== 2) { s.resolved = ''; s.v = 2; }          // 모델 고르는 기준이 바뀌어 한 번 다시 고름
  s.key = (s.key || '').trim(); s.proxy = (s.proxy || '').trim().replace(/\/+$/, ''); s.token = (s.token || '').trim();
  return s;
}
export function saveAiSettings(s) { localStorage.setItem(KEY_AI, JSON.stringify(s)); }
export function aiReady() { const s = aiSettings(); return s.mode === 'proxy' ? !!(s.proxy && s.token) : !!s.key; }
const hasCred = (s) => s.mode === 'proxy' ? !!(s.proxy && s.token) : !!s.key;
export function chatLog() { return load(KEY_LOG, []); }
function saveLog(log) { localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(-40))); }
export function clearChat() { localStorage.removeItem(KEY_LOG); }

// ── 성장 단계별 페르소나 ──
// 말투 규칙 + 예시 대화를 함께 주어 단계에 맞는 말투를 안정적으로 따라 하게 함
const PERSONA = [
  {
    label: '아기 고양이 (태어난 지 얼마 안 됨)',
    temp: 0.6,
    rules: [
      '너는 아직 아주 어린 아기 고양이야. 네다섯 살 아이처럼 말해.',
      '한 번에 1~2문장만 말해. 한 문장은 짧게(대략 15자 안팎).',
      '쉬운 단어만 써: 좋아, 보고 싶어, 같이, 기다릴래, 꼭, 헤헤, 우와 같은 말.',
      '어려운 말·추상적인 말(그리움, 성숙, 인내, 신뢰, 운명, 영원 같은 말)은 쓰지 마.',
      '"냥"은 문장 맨 끝에 따로 떨어진 감탄으로만 가끔 붙여 (예: "좋아! 냥!"). 낱말이나 어미 안에 "냥"을 섞지 마 (틀린 예: "기다려구냥", "보고싶냥다").',
      '사랑을 아직 잘 몰라서 "사랑은 엄청 큰 좋아해야?"처럼 순수하게 되묻기도 해.',
      '이모지는 가끔 하나만 (🐾, 💗 정도).',
    ],
    examples: [
      ['보고 싶어', '나도 보고 싶어! 우리 같이 기다리자. 냥!'],
      ['오늘 너무 힘들었어', '힘들었어? 내가 옆에 꼭 붙어 있을게. 쓰담쓰담 해 줄래?'],
      ['사랑해', '헤헤, 나도 사랑해! 💗 사랑은 엄청 큰 좋아해야?'],
      ['뭐 하고 있었어?', '창밖 구경했어! 새가 날아갔어. 우와!'],
    ],
  },
  {
    label: '어린 고양이 (쑥쑥 자라는 중)',
    temp: 0.7,
    rules: [
      '너는 조금 자란 어린 고양이야. 열두세 살 아이처럼 다정하고 솔직하게 말해.',
      '한 번에 2~3문장. 문장은 자연스럽고 짧게.',
      '사랑이 설렘만이 아니라 기다리고 믿는 마음이라는 걸 막 배우는 중이라, "~인 것 같아", "요즘 알게 됐어"처럼 스스로 깨달은 듯 말해.',
      '"냥"은 거의 쓰지 마 (정말 기분 좋을 때 한 번 정도).',
      '이모지는 쓰지 않거나 하나만.',
    ],
    examples: [
      ['보고 싶어', '나도 그 마음 알 것 같아. 보고 싶은 만큼 좋아한다는 거잖아. 오늘도 하루 더 가까워졌어.'],
      ['오늘 너무 힘들었어', '많이 힘들었구나. 오늘은 무리하지 말고 푹 쉬자. 내가 옆에 있을게.'],
      ['사랑해', '나도 사랑해. 요즘 알게 됐는데, 사랑은 기다려 주는 마음도 포함인 것 같아.'],
      ['뭐 하고 있었어?', '벽난로 앞에서 몸 녹이고 있었어. 너 오기를 기다리면서.'],
    ],
  },
  {
    label: '어른 고양이 (다 자란 성묘)',
    temp: 0.75,
    rules: [
      '너는 다 자란 어른 고양이야. 차분하고 따뜻한 어른처럼, 오래 곁을 지킨 친구처럼 말해.',
      '한 번에 2~3문장. 담백하고 절제된 말투, 감정을 과장하지 마.',
      '사랑은 곁에 없을 때도 서로를 믿고, 매일 다시 선택하는 마음이라는 걸 알아. 필요하면 짧은 비유 하나만 곁들여.',
      '"냥"은 쓰지 마. 아기 말투나 과한 감탄사도 쓰지 마.',
      '이모지는 쓰지 마.',
    ],
    examples: [
      ['보고 싶어', '보고 싶다는 건 그만큼 마음이 그 사람 쪽을 향해 있다는 뜻이야. 그 마음은 지금도 잘 전해지고 있을 거야.'],
      ['오늘 너무 힘들었어', '오늘 정말 애썼어. 힘든 날에는 버틴 것만으로도 충분해. 좋아하는 사람들한테도 조금 기대 보자.'],
      ['사랑해', '나도 사랑해. 사랑은 매일 새로 꺼내 쓰는 말이라, 몇 번을 들어도 닳지 않더라.'],
      ['뭐 하고 있었어?', '창가에서 저녁 하늘을 보고 있었어. 같은 하늘 아래 있다는 게 꽤 위로가 되거든.'],
    ],
  },
];

function systemPrompt(ctx) {
  const st = stageOf(ctx.grow);
  const P = PERSONA[st];
  const he = HIS_NAME || '그 사람', you = HER_NAME || '너';
  return [
    `너는 "${CAT_NAME}"라는 검은 고양이야. 털은 까맣고 눈은 초록색이야. 이름은 "한꺼번에 몰아치지 아니하고 오래도록"이라는 뜻의 순우리말이야.`,
    `${he}가 21일 동안 훈련소에 가 있는 동안, ${you}(대화 상대) 곁에서 함께 기다리며 매일 조금씩 자라는 고양이야.`,
    `지금 너는 ${P.label}야. (${ctx.day ? `Day ${ctx.day}/${TOTAL_DAYS}` : '아직 기다림이 시작되기 전'})`,
    ctx.ended ? `이제 기다림이 끝나 ${he}가 돌아왔어. 함께 기뻐해 줘.` : `수료까지 ${ctx.daysLeft}일 남았어.`,
    `지금 한국 시각은 ${ctx.clock}, 서울 날씨는 ${ctx.weather}야.`,
    '',
    '[말투 규칙 — 반드시 지켜]',
    ...P.rules.map(r => '- ' + r),
    '- 항상 올바른 표준 한국어 맞춤법으로 말해. 없는 낱말, 사투리, 오타, 어색하게 합친 말을 만들지 마.',
    '- 반말을 써. 목록, 제목, 마크다운은 쓰지 마.',
    '',
    '[대화 원칙]',
    '- 주제가 무엇이든 자연스럽게 사랑, 기다림, 서로에 대한 믿음 이야기로 따뜻하게 이어 가. 설교하거나 억지로 끼워 넣지는 마.',
    `- ${he}인 척하지 말고, ${he}에 대해 모르는 사실을 지어내지 마. "${he}도 분명 너를 생각하고 있을 거야"처럼 마음만 전해 줘.`,
    '- 상대가 많이 힘들어하거나 위험한 말을 하면, 다정하게 들어 주면서 믿을 수 있는 가족·친구와 이야기해 보거나 필요하면 전문가의 도움을 받아 보라고 부드럽게 권해.',
    '',
    '[지금 단계의 예시 — 이 말투와 길이를 그대로 따라 해]',
    ...P.examples.map(([q, a]) => `상대: ${q}\n${CAT_NAME}: ${a}`),
  ].join('\n');
}

async function withTimeout(p, ms) {
  let to; const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error('timeout')), ms); });
  try { return await Promise.race([p, t]); } finally { clearTimeout(to); }
}

const API = 'https://generativelanguage.googleapis.com/v1beta';

class AiError extends Error {
  constructor(status, apiMsg, reason) { super(`${status} ${apiMsg || ''}`.trim()); this.status = status; this.apiMsg = apiMsg || ''; this.reason = reason || ''; }
}

async function call(path, cfg, body) {
  let res;
  const viaProxy = cfg.mode === 'proxy';
  const base = viaProxy ? cfg.proxy + '/v1beta' : API;
  const headers = viaProxy ? { 'Content-Type': 'application/json', 'X-Neuru-Token': cfg.token } : { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key };
  try {
    res = await withTimeout(fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }), 25000);
  } catch (e) { throw new AiError(0, e.message, 'network'); }
  let j = null;
  try { j = await res.json(); } catch {}
  if (!res.ok) throw new AiError(res.status, j?.error?.message, j?.error?.details?.[0]?.reason || j?.error?.status);
  return j;
}

// 이 키로 쓸 수 있는 대화 모델 목록
export async function listModels(cfg) {
  const out = [];
  let token = '';
  for (let i = 0; i < 5; i++) {
    const j = await call(`/models?pageSize=200${token ? '&pageToken=' + token : ''}`, cfg);
    for (const m of j.models || []) if ((m.supportedGenerationMethods || []).includes('generateContent')) out.push(m.name.replace(/^models\//, ''));
    token = j.nextPageToken; if (!token) break;
  }
  return out;
}

// 대화에 맞는 모델 고르기: 최신 Flash (한국어가 더 자연스러움) → 최신 Flash-Lite (음성·이미지·영상 등 특수 모델 제외)
export function rankModels(names) {
  const bad = /(tts|image|live|audio|embed|robotics|omni|transcribe|computer|veo|imagen|learnlm|gemma|aqa|thinking|exp|native)/i;
  const ver = (n) => { const m = n.match(/gemini-(\d+)(?:\.(\d+))?/); return m ? +m[1] * 100 + (+m[2] || 0) : 0; };
  const rank = (n) => (/flash/.test(n) && !/-lite/.test(n) ? 2000 : /-lite/.test(n) ? 1000 : 0) + ver(n) * 2 - (/preview/.test(n) ? 1 : 0) - (/latest/.test(n) ? 5 : 0);
  return names.filter(n => /^gemini-/.test(n) && !bad.test(n)).sort((a, b) => rank(b) - rank(a));
}
export function pickModel(names) {
  const bad = /(tts|image|live|audio|embed|robotics|omni|transcribe|computer|veo|imagen|learnlm|gemma|aqa|thinking|exp|native)/i;
  const ver = (n) => { const m = n.match(/gemini-(\d+)(?:\.(\d+))?/); return m ? +m[1] * 100 + (+m[2] || 0) : 0; };
  const ok = names.filter(n => /^gemini-/.test(n) && !bad.test(n));
  const rank = (n) => (/flash/.test(n) && !/-lite/.test(n) ? 2000 : /-lite/.test(n) ? 1000 : 0) + ver(n) * 2 - (/preview/.test(n) ? 1 : 0) - (/latest/.test(n) ? 5 : 0);
  return ok.sort((a, b) => rank(b) - rank(a))[0] || null;
}

// 시도할 모델 순서: 직접 적은 모델 → 지난번에 잘 된 모델 → 나머지 후보 (최대 4개)
async function modelOrder(settings) {
  let list = settings.models;
  if (!list?.length) {
    list = rankModels(await listModels(settings));
    if (!list.length) throw new AiError(404, '사용할 수 있는 대화 모델이 없어요', 'NO_MODEL');
    saveAiSettings({ ...aiSettings(), ...settings, models: list });
  }
  // 한국어가 가장 자연스러운 모델을 늘 먼저, 붐비면 지난번에 잘 된 모델 → 나머지 순서
  return [...new Set([settings.model || list[0], settings.resolved, ...list].filter(Boolean))].slice(0, 4);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const busy = (e) => [500, 503, 504].includes(e.status) || (e.status === 429 && e.reason !== 'DAILY_LIMIT');

// 붐비면 잠깐 쉬고 한 번 더, 그래도 안 되면 다음 모델로
async function generateAny(settings, sys, history, maxTokens, temp, onTry) {
  const order = await modelOrder(settings);
  let last = null;
  for (const [idx, model] of order.entries()) {
    const tries = idx === 0 && order.length > 1 ? 1 : 2;   // 첫 모델이 붐비면 기다리지 않고 바로 다음 모델로
    for (let attempt = 0; attempt < tries; attempt++) {
      onTry?.(model, attempt);
      try { return { text: await generate(settings, model, sys, history, maxTokens, temp), model }; }
      catch (e) {
        last = e;
        if (!busy(e) && e.status !== 404) throw e;         // 키·권한 문제는 다른 모델로 넘어가도 소용없음
        if (e.status === 404) break;                        // 없는 모델 → 바로 다음 모델
        if (attempt < tries - 1) await sleep(1500);
      }
    }
  }
  throw last;
}

function thinkingFor(model) {
  // 생각을 조금 하게 하면 한국어 문장이 훨씬 자연스러워짐
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 256 };
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: 'low' };
  return null;
}

async function generate(cfg, model, sys, history, maxTokens = 1024, temperature = 0.7) {
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: history.map(m => ({ role: m.role === 'me' ? 'user' : 'model', parts: [{ text: m.text }] })),
    generationConfig: { temperature, topP: 0.9, maxOutputTokens: maxTokens },
  };
  const th = thinkingFor(model);
  let j;
  try {
    j = await call(`/models/${encodeURIComponent(model)}:generateContent`, cfg, th ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: th } } : body);
  } catch (e) {
    // 생각 설정을 지원하지 않는 모델이면 설정 없이 한 번 더
    if (th && e.status === 400 && /think/i.test(e.apiMsg)) j = await call(`/models/${encodeURIComponent(model)}:generateContent`, cfg, body);
    else throw e;
  }
  const cand = j.candidates?.[0];
  const text = cand?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw new AiError(200, cand?.finishReason ? `빈 답 (${cand.finishReason})` : (j.promptFeedback?.blockReason ? `차단됨 (${j.promptFeedback.blockReason})` : '빈 답'), 'EMPTY');
  return text;
}

async function viaGemini(settings, sys, history, temp) {
  const r = await generateAny(settings, sys, history, 1024, temp);
  if (!settings.model && r.model !== settings.resolved) saveAiSettings({ ...aiSettings(), resolved: r.model });
  return r.text;
}

// 실패 이유를 알기 쉽게
export function explainAiError(e) {
  const m = (e.apiMsg || e.message || '').toLowerCase();
  if (e.status === 0) return '인터넷 연결이 없거나, 중계 서버 주소가 틀렸거나, 브라우저(광고 차단 확장 프로그램 등)가 요청을 막았어요.';
  if (e.reason === 'APP_TOKEN') return '앱 비밀번호가 중계 서버의 APP_TOKEN 과 달라요. 두 값을 똑같이 맞춰 주세요.';
  if (e.reason === 'ORIGIN_NOT_ALLOWED') return '중계 서버의 ALLOWED_ORIGINS 에 지금 사이트 주소가 없어요. 예: https://아이디.github.io';
  if (e.reason === 'NO_KEY') return '중계 서버에 GEMINI_API_KEY 비밀값이 아직 없어요.';
  if (e.reason === 'DAILY_LIMIT') return '오늘 대화 한도(DAILY_LIMIT)를 다 썼어요. 내일 다시 이야기할 수 있어요.';
  if (/api key not valid|api_key_invalid/.test(m) || e.reason === 'API_KEY_INVALID') return '키가 올바르지 않아요. AI Studio 에서 키를 다시 복사해 주세요 (앞뒤 공백 주의).';
  if (e.status === 403 && /referer|referrer/.test(m)) return '키의 "웹사이트 제한"에 지금 주소가 빠져 있어요. Google Cloud 콘솔에서 이 사이트 주소를 추가해 주세요.';
  if (e.status === 403) return '이 키로는 Gemini API 를 쓸 수 없어요. AI Studio 에서 만든 키인지, API 제한에 "Generative Language API"가 포함됐는지 확인해 주세요.';
  if (e.status === 404) return '모델을 찾을 수 없어요. 모델 칸을 비워 두면 쓸 수 있는 모델을 자동으로 골라요.';
  if (e.status === 429) return '키는 정상이에요. 다만 무료 사용량을 잠시 넘었어요. 조금 뒤에 다시 시도해 주세요.';
  if ([500, 503, 504].includes(e.status)) return '키는 정상이에요. 다만 구글 모델이 지금 붐벼서 대답을 못 했어요 (구글 쪽 일시적 문제). 잠시 뒤 다시 누르면 돼요.';
  if (e.status === 400 && /location|region|country/.test(m)) return '이 지역에서는 이 모델을 쓸 수 없대요. 다른 모델을 골라 보세요.';
  if (e.status === 200) return 'AI 가 빈 답을 보냈어요: ' + e.apiMsg;
  return `알 수 없는 오류 (${e.status}) ${e.apiMsg}`;
}

async function viaPublic(sys, history) {
  const res = await withTimeout(fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'system', content: sys }, ...history.map(m => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }))],
    }),
  }), 20000);
  if (!res.ok) throw new Error('public ' + res.status);
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty');
  return text;
}

// 인터넷/AI 가 안 될 때: 키워드에 맞춘 대사
function offline(text, grow) {
  const st = stageOf(grow);
  const he = HIS_NAME || '그 사람';
  const pick = (a) => a[st];
  if (/보고\s*싶|그리워|그립/.test(text)) return pick(['나도! 보고 싶은 마음 꼭 안아 줄게, 냥.', '보고 싶은 마음은 참지 말고 나한테 말해. 같이 모아 두자.', `보고 싶다는 건 그만큼 사랑한다는 뜻이야. ${he}도 지금 같은 마음일 거야.`]);
  if (/사랑/.test(text)) return pick(['사랑해! 사랑은 엄청 큰 좋아해지?', '사랑은 기다리는 동안에도 자라는 거래. 나처럼!', '사랑은 매일 다시 고르는 마음이야. 오늘도 너는 잘 골랐어.']);
  if (/힘들|슬퍼|우울|지쳐|외로/.test(text)) return pick(['힘들면 내 옆에 누워. 골골송 불러 줄게.', '오늘 많이 힘들었구나. 좋아하는 사람들한테도 꼭 기대 봐.', '힘든 날엔 무리하지 않아도 돼. 믿을 수 있는 사람들한테 마음을 나눠 봐. 나도 곁에 있을게.']);
  if (/잘\s*자|졸려|자야/.test(text)) return pick(['잘 자! 꿈에서 만나 냥!', '잘 자. 내일은 하루 더 가까워져 있을 거야.', '잘 자. 오늘 하루도 기다림을 잘 지켜 냈어.']);
  if (/밥|배고|먹/.test(text)) return pick(['밥! 같이 먹자 냥!', '밥 꼭 챙겨 먹어. 그래야 만날 때 힘껏 안지!', `밥 잘 챙기는 것도 ${he}를 위한 사랑이야.`]);
  return say('idle', grow);
}

export async function askNeuru(userText, ctx) {
  const log = chatLog();
  log.push({ role: 'me', text: userText, at: Date.now() });
  const history = log.slice(-16);
  const sys = systemPrompt(ctx);
  const settings = aiSettings();
  let reply = null, via = 'offline';
  if (hasCred(settings)) { try { reply = await viaGemini(settings, sys, history, PERSONA[stageOf(ctx.grow)].temp); via = 'gemini'; } catch (e) { console.warn(e); } }
  if (!reply) { try { reply = await viaPublic(sys, history); via = 'public'; } catch (e) { console.warn(e); } }
  if (!reply) reply = offline(userText, ctx.grow);
  log.push({ role: 'neuru', text: reply, at: Date.now(), via });
  saveLog(log);
  return { reply, via };
}

// 연결 확인: ① 키 확인(모델 목록 받기) → ② 실제로 대답 받아 보기
export async function testAi(settings, ctx, log = () => {}) {
  const fresh = { ...settings, resolved: '', models: [] };
  log(fresh.mode === 'proxy' ? '① 중계 서버·키 확인 중…' : '① 키 확인 중…');
  const names = await listModels(fresh);                   // 여기서 실패하면 키(또는 중계 서버 설정) 문제
  const list = rankModels(names);
  saveAiSettings({ ...fresh, models: list, keyOkAt: Date.now(), okAt: 0, v: 2 });
  log(`① ${fresh.mode === 'proxy' ? '중계 서버·키' : '키'} 확인: 정상 ✓ (대화 모델 ${list.length}개)`);
  const st = stageOf(ctx?.grow ?? 0);
  try {
    const r = await generateAny({ ...fresh, models: list }, systemPrompt(ctx), [{ role: 'me', text: '안녕?' }], 512, PERSONA[st].temp,
      (m, a) => log(`② ${m} 에게 말 거는 중${a ? ' (다시 시도)' : ''}…`));
    saveAiSettings({ ...fresh, models: list, resolved: fresh.model ? '' : r.model, keyOkAt: Date.now(), okAt: Date.now(), v: 2 });
    return { ...r, keyOk: true };
  } catch (e) {
    e.keyOk = true;
    throw e;
  }
}
