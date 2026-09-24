// 느루와 대화 — 여러 AI 서비스 중 하나의 키를 이 기기에 암호화해 보관하고 직접 호출
// 연결이 안 되면 미리 써 둔 대사로 대답
import { CAT_NAME, HER_NAME, HIS_NAME, TOTAL_DAYS, END_AT } from './config.js';
import { stageOf, STAGE_LABEL, say } from './speech.js';
import { sealSecret, openSecret, forgetWrapKey } from './secure.js';

const KEY_AI = 'neuru.ai';
const KEY_LOG = 'neuru.chat';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

// ── 연결할 수 있는 AI 서비스 ──
export const PROVIDERS = {
  gemini: { label: 'Google AI Studio (Gemini)', kind: 'gemini', keyHint: 'AIza… 로 시작', site: 'https://aistudio.google.com' },
  openrouter: { label: 'OpenRouter (무료 모델)', kind: 'openai', base: 'https://openrouter.ai/api/v1', keyHint: 'sk-or-… 로 시작', site: 'https://openrouter.ai/keys', defaultModel: 'openrouter/free' },
  groq: { label: 'Groq', kind: 'openai', base: 'https://api.groq.com/openai/v1', keyHint: 'gsk_… 로 시작', site: 'https://console.groq.com/keys' },
  custom: { label: '기타 (OpenAI 호환 주소 직접 입력)', kind: 'openai', base: '', keyHint: 'API 키', site: '' },
};

// 저장 형식: { provider, base, model, resolved, models[], sealed:{iv,ct}, hint, keyOkAt, okAt }
// 키 원문은 저장하지 않음 (sealed 만 저장)
export function aiSettings() {
  const s = { provider: 'gemini', base: '', model: '', resolved: '', models: [], sealed: null, hint: '', ...load(KEY_AI, {}) };
  if (!PROVIDERS[s.provider]) s.provider = 'gemini';
  if (s.model === 'gemini-flash-latest') s.model = '';
  return s;
}
export function saveAiSettings(s) {
  const { key, ...rest } = s;                 // 혹시라도 원문 키가 섞여 들어오면 버림
  localStorage.setItem(KEY_AI, JSON.stringify(rest));
}
export function aiReady() { return !!aiSettings().sealed; }

let keyCache = null;                          // 이번 실행 동안만 메모리에 둠
export async function getKey() {
  if (keyCache) return keyCache;
  const s = load(KEY_AI, {});
  // 예전 버전(v1.2.x)에서 원문으로 저장된 키가 있으면 암호화해서 옮기고 원문은 지움
  if (s.key && !s.sealed) {
    const sealed = await sealSecret(s.key.trim());
    const hint = maskKey(s.key.trim());
    keyCache = s.key.trim();
    delete s.key; delete s.mode; delete s.proxy; delete s.token;
    localStorage.setItem(KEY_AI, JSON.stringify({ provider: 'gemini', ...s, sealed, hint, keyOkAt: Date.now() }));
    return keyCache;
  }
  keyCache = await openSecret(s.sealed);
  return keyCache;
}
export async function storeKey(settings, plainKey) {
  const sealed = await sealSecret(plainKey);
  keyCache = plainKey;
  saveAiSettings({ ...settings, sealed, hint: maskKey(plainKey) });
}
export async function forgetKey() {
  keyCache = null;
  localStorage.removeItem(KEY_AI);
  await forgetWrapKey();
}
export function maskKey(k) { return k ? `${k.slice(0, 5)}…${k.slice(-4)}` : ''; }

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

class AiError extends Error {
  constructor(status, apiMsg, reason) { super(`${status} ${apiMsg || ''}`.trim()); this.status = status; this.apiMsg = apiMsg || ''; this.reason = reason || ''; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const busy = (e) => [429, 500, 502, 503, 504].includes(e.status);

async function request(url, init) {
  let res;
  try { res = await withTimeout(fetch(url, init), 30000); }
  catch (e) { throw new AiError(0, e.message, 'network'); }
  let j = null;
  try { j = await res.json(); } catch {}
  if (!res.ok) {
    const err = j?.error;
    const msg = typeof err === 'string' ? err : err?.message || j?.message || res.statusText;
    throw new AiError(res.status, msg, err?.details?.[0]?.reason || err?.status || err?.code || '');
  }
  return j;
}

// ── Google Gemini ──
const G = 'https://generativelanguage.googleapis.com/v1beta';
const gHeaders = (key) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key });
async function gList(key) {
  const out = []; let token = '';
  for (let i = 0; i < 5; i++) {
    const j = await request(`${G}/models?pageSize=200${token ? '&pageToken=' + token : ''}`, { headers: gHeaders(key) });
    for (const m of j.models || []) if ((m.supportedGenerationMethods || []).includes('generateContent')) out.push(m.name.replace(/^models\//, ''));
    token = j.nextPageToken; if (!token) break;
  }
  return out;
}
function gThinking(model) {
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 256 };
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: 'low' };
  return null;
}
async function gGenerate(key, model, sys, history, maxTokens, temperature) {
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: history.map(m => ({ role: m.role === 'me' ? 'user' : 'model', parts: [{ text: m.text }] })),
    generationConfig: { temperature, topP: 0.9, maxOutputTokens: maxTokens },
  };
  const url = `${G}/models/${encodeURIComponent(model)}:generateContent`;
  const th = gThinking(model);
  let j;
  try { j = await request(url, { method: 'POST', headers: gHeaders(key), body: JSON.stringify(th ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: th } } : body) }); }
  catch (e) { if (th && e.status === 400 && /think/i.test(e.apiMsg)) j = await request(url, { method: 'POST', headers: gHeaders(key), body: JSON.stringify(body) }); else throw e; }
  const cand = j.candidates?.[0];
  const text = cand?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw new AiError(200, cand?.finishReason ? `빈 답 (${cand.finishReason})` : '빈 답', 'EMPTY');
  return text;
}

// ── OpenAI 호환 (OpenRouter, Groq, 기타) ──
function oHeaders(provider, key) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  if (provider === 'openrouter') { h['HTTP-Referer'] = location.origin; h['X-Title'] = 'Neuru'; }
  return h;
}
async function oList(cfg, key) {
  const j = await request(`${cfg.base}/models`, { headers: oHeaders(cfg.provider, key) });
  return (j.data || j.models || []).map(m => m.id || m.name).filter(Boolean);
}
async function oGenerate(cfg, key, model, sys, history, maxTokens, temperature) {
  const j = await request(`${cfg.base}/chat/completions`, {
    method: 'POST', headers: oHeaders(cfg.provider, key),
    body: JSON.stringify({
      model, temperature, top_p: 0.9, max_tokens: maxTokens,
      messages: [{ role: 'system', content: sys }, ...history.map(m => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }))],
    }),
  });
  let text = j.choices?.[0]?.message?.content || '';
  if (Array.isArray(text)) text = text.map(p => p.text || '').join('');
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();   // 생각 과정을 내보내는 모델 대비
  if (!text) throw new AiError(200, `빈 답 (${j.choices?.[0]?.finish_reason || '?'})`, 'EMPTY');
  return text;
}

// ── 모델 고르기 ──
export function rankModels(provider, names) {
  const bad = /(tts|image|live|audio|embed|robotics|omni|transcribe|computer|veo|imagen|learnlm|aqa|whisper|guard|moderation|vision-only|rerank|speech|code|coder)/i;
  const list = names.filter(n => !bad.test(n));
  if (provider === 'gemini') {
    const ver = (n) => { const m = n.match(/gemini-(\d+)(?:\.(\d+))?/); return m ? +m[1] * 100 + (+m[2] || 0) : 0; };
    const rank = (n) => (/flash/.test(n) && !/-lite/.test(n) ? 2000 : /-lite/.test(n) ? 1000 : 0) + ver(n) * 2 - (/preview/.test(n) ? 1 : 0) - (/latest|exp|thinking|native|gemma/.test(n) ? 50 : 0);
    return list.filter(n => /^gemini-/.test(n)).sort((a, b) => rank(b) - rank(a));
  }
  if (provider === 'openrouter') {
    // 무료 모델만: openrouter/free(무료 모델 자동 선택)를 맨 앞에
    const free = list.filter(n => n.endsWith(':free'));
    return ['openrouter/free', ...free.filter(n => n !== 'openrouter/free')];
  }
  const size = (n) => { const m = n.match(/(\d+)b/i); return m ? +m[1] : 0; };
  return list.sort((a, b) => size(b) - size(a));
}
export function pickModel(provider, names) { return rankModels(provider, names)[0] || null; }

function cfgOf(settings) {
  const P = PROVIDERS[settings.provider];
  return { ...settings, kind: P.kind, base: (settings.provider === 'custom' ? settings.base : P.base || '').replace(/\/+$/, '') };
}
export async function listModels(settings, key) {
  const cfg = cfgOf(settings);
  return cfg.kind === 'gemini' ? gList(key) : oList(cfg, key);
}
async function generate(cfg, key, model, sys, history, maxTokens, temp) {
  return cfg.kind === 'gemini' ? gGenerate(key, model, sys, history, maxTokens, temp) : oGenerate(cfg, key, model, sys, history, maxTokens, temp);
}

// 시도할 모델 순서: 직접 적은 모델 → 가장 좋은 모델 → 지난번에 잘 된 모델 → 나머지 (최대 4개)
async function modelOrder(cfg, key) {
  let list = cfg.models;
  if (!list?.length) {
    try { list = rankModels(cfg.provider, await listModels(cfg, key)); }
    catch (e) { if (cfg.model || PROVIDERS[cfg.provider].defaultModel) list = []; else throw e; }
    saveAiSettings({ ...aiSettings(), models: list });
  }
  const order = [...new Set([cfg.model || list[0] || PROVIDERS[cfg.provider].defaultModel, cfg.resolved, ...list].filter(Boolean))].slice(0, 4);
  if (!order.length) throw new AiError(404, '사용할 수 있는 대화 모델이 없어요', 'NO_MODEL');
  return order;
}

// 붐비면(429·503 등) 다음 모델로, 마지막 모델은 한 번 쉬었다 다시
async function generateAny(settings, key, sys, history, maxTokens, temp, onTry) {
  const cfg = cfgOf(settings);
  const order = await modelOrder(cfg, key);
  let last = null;
  for (const [idx, model] of order.entries()) {
    const tries = idx === order.length - 1 ? 2 : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      onTry?.(model, attempt);
      try { return { text: await generate(cfg, key, model, sys, history, maxTokens, temp), model }; }
      catch (e) {
        last = e;
        if (!busy(e) && e.status !== 404 && e.reason !== 'EMPTY') throw e;   // 키·권한 문제는 다른 모델로 넘어가도 소용없음
        if (!busy(e)) break;
        if (attempt < tries - 1) await sleep(1500);
      }
    }
  }
  throw last;
}

// 실패 이유를 알기 쉽게
export function explainAiError(e) {
  const m = (e.apiMsg || e.message || '').toLowerCase();
  if (e.status === 0) return '인터넷 연결이 없거나, 이 서비스가 브라우저에서 바로 부르는 걸 막고 있거나(CORS), 광고 차단 확장 프로그램이 막았어요. 다른 서비스를 골라 보세요.';
  if (e.status === 401 || /api key not valid|invalid api key|api_key_invalid|unauthorized|incorrect api key/.test(m)) return '키가 올바르지 않아요. 고른 서비스와 키가 맞는지, 앞뒤 공백 없이 복사했는지 확인해 주세요.';
  if (e.status === 402) return '이 모델은 유료예요. 무료 모델(OpenRouter 는 이름 끝이 :free)을 골라 주세요.';
  if (e.status === 403) return '이 키로는 이 서비스를 쓸 수 없어요. 키를 만든 곳과 권한을 확인해 주세요.';
  if (e.status === 404) return '모델이나 주소를 찾을 수 없어요. 모델 칸을 비워 두면 자동으로 골라요.';
  if (e.status === 429) return '키는 정상이에요. 무료 사용량을 잠시 넘었어요. 조금 뒤에 다시 시도해 주세요.';
  if ([500, 502, 503, 504].includes(e.status)) return '키는 정상이에요. 다만 모델이 지금 붐벼서 대답을 못 했어요 (서비스 쪽 일시적 문제). 잠시 뒤 다시 누르면 돼요.';
  if (e.status === 400 && /location|region|country/.test(m)) return '이 지역에서는 이 모델을 쓸 수 없대요. 다른 모델을 골라 보세요.';
  if (e.status === 200) return 'AI 가 빈 답을 보냈어요: ' + e.apiMsg;
  return `알 수 없는 오류 (${e.status}) ${e.apiMsg}`;
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

// 예전 버전의 원문 키를 암호화 보관으로 옮기기 (앱 시작 때 한 번)
export async function migrateLegacyKey() {
  const s = load(KEY_AI, {});
  if (s.key && !s.sealed) { try { await getKey(); } catch (e) { console.warn(e); } }
  else if (s.mode || s.proxy || s.token) { delete s.mode; delete s.proxy; delete s.token; localStorage.setItem(KEY_AI, JSON.stringify(s)); }
}

export async function askNeuru(userText, ctx) {
  await migrateLegacyKey();
  const log = chatLog();
  log.push({ role: 'me', text: userText, at: Date.now() });
  const history = log.slice(-16);
  const settings = aiSettings();
  let reply = null, via = 'offline';
  if (settings.sealed) {
    const key = await getKey();
    if (key) {
      try {
        const r = await generateAny(settings, key, systemPrompt(ctx), history, 1024, PERSONA[stageOf(ctx.grow)].temp);
        reply = r.text; via = 'ai';
        if (!settings.model && r.model !== settings.resolved) saveAiSettings({ ...aiSettings(), resolved: r.model });
      } catch (e) { console.warn(e); }
    }
  }
  if (!reply) reply = offline(userText, ctx.grow);
  log.push({ role: 'neuru', text: reply, at: Date.now(), via });
  saveLog(log);
  return { reply, via };
}

// 연결 확인: ① 키 확인(모델 목록) → ② 실제로 대답 받기 → 성공하면 키를 암호화해 저장
export async function testAi(settings, plainKey, ctx, log = () => {}) {
  const fresh = { ...settings, resolved: '', models: [] };
  const key = plainKey || await getKey();
  if (!key) throw new AiError(401, '저장된 키가 없어요', 'NO_KEY');
  log('① 키 확인 중…');
  let list = [];
  try {
    list = rankModels(fresh.provider, await listModels(fresh, key));
    log(`① 키 확인: 정상 ✓ (대화 모델 ${list.length}개)`);
  } catch (e) {
    // 모델 목록을 공개로 주는 서비스도 있어서, 목록 실패는 대답 받기로 최종 판단
    if (e.status === 401 || e.status === 403 || e.status === 0) throw e;
    log('① 모델 목록은 못 받았지만 대답 받기로 확인할게요');
  }
  const st = stageOf(ctx?.grow ?? 0);
  const withModels = { ...fresh, models: list };
  try {
    const r = await generateAny(withModels, key, systemPrompt(ctx), [{ role: 'me', text: '안녕?' }], 512, PERSONA[st].temp,
      (m, a) => log(`② ${m} 에게 말 거는 중${a ? ' (다시 시도)' : ''}…`));
    await storeKey({ ...withModels, resolved: fresh.model ? '' : r.model, keyOkAt: Date.now(), okAt: Date.now() }, key);
    return { ...r, keyOk: true };
  } catch (e) {
    if (busy(e)) { await storeKey({ ...withModels, keyOkAt: Date.now(), okAt: 0 }, key); e.keyOk = true; e.saved = true; }
    throw e;
  }
}
