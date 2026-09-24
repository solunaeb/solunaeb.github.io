// 느루와 대화 — Google AI Studio 무료 키(Gemini) → 없으면 키 없는 공개 API 시도 → 그래도 안 되면 미리 써 둔 대사
import { CAT_NAME, HER_NAME, HIS_NAME, TOTAL_DAYS, END_AT } from './config.js';
import { stageOf, STAGE_LABEL, say } from './speech.js';

const KEY_AI = 'neuru.ai';
const KEY_LOG = 'neuru.chat';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function aiSettings() {
  const s = { key: '', model: '', resolved: '', ...load(KEY_AI, {}) };
  if (s.model === 'gemini-flash-latest') s.model = ''; // 예전 기본값은 자동 선택으로
  s.key = (s.key || '').trim();
  return s;
}
export function saveAiSettings(s) { localStorage.setItem(KEY_AI, JSON.stringify(s)); }
export function aiReady() { return !!aiSettings().key; }
export function chatLog() { return load(KEY_LOG, []); }
function saveLog(log) { localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(-40))); }
export function clearChat() { localStorage.removeItem(KEY_LOG); }

// 성장 단계에 따라 사랑을 이해하는 깊이가 달라지는 페르소나
function systemPrompt(ctx) {
  const st = stageOf(ctx.grow);
  const he = HIS_NAME || '그 사람', you = HER_NAME || '너';
  const tone = [
    '아직 아기 고양이라서 말이 짧고 서툴고 천진난만해. 문장은 1~2개, 가끔 "냥"을 붙여. 사랑을 "좋아하는 게 엄청 큰 거"처럼 단순하고 순수하게 이해해. 궁금한 게 많아서 가끔 되물어.',
    '어린 고양이로 자라는 중이라, 사랑이 설렘만이 아니라 기다리고 믿는 마음이라는 걸 조금씩 알아가고 있어. 다정하고 솔직하게 2~3문장으로 말해. "냥"은 아주 가끔만.',
    '어른 고양이가 되어 사랑에 대해 깊고 차분하게 이해하고 있어. 사랑은 곁에 없을 때도 서로를 믿고, 매일 다시 선택하는 마음이라는 걸 알아. 따뜻하고 성숙한 말로 2~3문장, 짧은 비유를 곁들여도 좋아.',
  ][st];
  return [
    `너는 "${CAT_NAME}"라는 검은 고양이야. 털은 까맣고 눈은 초록색이야. 이름은 "한꺼번에 몰아치지 아니하고 오래도록"이라는 뜻의 순우리말이야.`,
    `${he}가 21일 동안 훈련소에 가 있는 동안, ${you}(대화 상대) 곁에서 함께 기다리며 매일 조금씩 자라는 고양이야. 지금은 ${STAGE_LABEL[st]}(${ctx.day ? `Day ${ctx.day}/${TOTAL_DAYS}` : '아직 기다림이 시작되기 전'})야.`,
    ctx.ended ? `이제 기다림이 끝나 ${he}가 돌아왔어. 함께 기뻐해 줘.` : `수료까지 ${ctx.daysLeft}일 남았어.`,
    `지금 한국 시각은 ${ctx.clock}, 서울 날씨는 ${ctx.weather}야.`,
    tone,
    '대화 주제가 무엇이든 자연스럽게 사랑, 그리움, 기다림, 서로에 대한 믿음 이야기로 따뜻하게 이어 가. 대신 설교하거나 억지로 끼워 넣지는 마.',
    `${he}를 흉내 내거나 ${he}인 척하지 말고, ${he}에 대해 모르는 사실을 지어내지 마. 대신 "${he}도 분명 너를 생각하고 있을 거야"처럼 마음을 전해 줘.`,
    '상대가 많이 힘들어하거나 위험한 말을 하면, 다정하게 들어 주면서 믿을 수 있는 가족·친구와 이야기해 보거나 필요하면 전문가의 도움을 받아 보라고 부드럽게 권해.',
    '항상 한국어 반말로, 고양이답게 귀엽고 다정하게 대답해. 이모지는 가끔 하나 정도만. 목록이나 마크다운은 쓰지 마.',
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

async function call(path, key, body) {
  let res;
  try {
    res = await withTimeout(fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: body ? JSON.stringify(body) : undefined,
    }), 25000);
  } catch (e) { throw new AiError(0, e.message, 'network'); }
  let j = null;
  try { j = await res.json(); } catch {}
  if (!res.ok) throw new AiError(res.status, j?.error?.message, j?.error?.details?.[0]?.reason || j?.error?.status);
  return j;
}

// 이 키로 쓸 수 있는 대화 모델 목록
export async function listModels(key) {
  const out = [];
  let token = '';
  for (let i = 0; i < 5; i++) {
    const j = await call(`/models?pageSize=200${token ? '&pageToken=' + token : ''}`, key);
    for (const m of j.models || []) if ((m.supportedGenerationMethods || []).includes('generateContent')) out.push(m.name.replace(/^models\//, ''));
    token = j.nextPageToken; if (!token) break;
  }
  return out;
}

// 가벼운 대화에 맞는 모델 고르기: 최신 Flash-Lite → 최신 Flash (음성·이미지·영상 등 특수 모델 제외)
export function pickModel(names) {
  const bad = /(tts|image|live|audio|embed|robotics|omni|transcribe|computer|veo|imagen|learnlm|gemma|aqa|thinking|exp|native)/i;
  const ver = (n) => { const m = n.match(/gemini-(\d+)(?:\.(\d+))?/); return m ? +m[1] * 100 + (+m[2] || 0) : 0; };
  const ok = names.filter(n => /^gemini-/.test(n) && !bad.test(n));
  const rank = (n) => (/-lite/.test(n) ? 2000 : /flash/.test(n) ? 1000 : 0) + ver(n) * 2 - (/preview/.test(n) ? 1 : 0) - (/latest/.test(n) ? 5 : 0);
  return ok.sort((a, b) => rank(b) - rank(a))[0] || null;
}

async function resolveModel(settings) {
  if (settings.model) return settings.model;
  if (settings.resolved) return settings.resolved;
  const m = pickModel(await listModels(settings.key));
  if (!m) throw new AiError(404, '사용할 수 있는 대화 모델이 없어요', 'NO_MODEL');
  saveAiSettings({ ...settings, resolved: m });
  return m;
}

function thinkingFor(model) {
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: 'minimal' };
  return null;
}

async function generate(key, model, sys, history, maxTokens = 1024) {
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: history.map(m => ({ role: m.role === 'me' ? 'user' : 'model', parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens },
  };
  const th = thinkingFor(model);
  let j;
  try {
    j = await call(`/models/${encodeURIComponent(model)}:generateContent`, key, th ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: th } } : body);
  } catch (e) {
    // 생각 설정을 지원하지 않는 모델이면 설정 없이 한 번 더
    if (th && e.status === 400 && /think/i.test(e.apiMsg)) j = await call(`/models/${encodeURIComponent(model)}:generateContent`, key, body);
    else throw e;
  }
  const cand = j.candidates?.[0];
  const text = cand?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw new AiError(200, cand?.finishReason ? `빈 답 (${cand.finishReason})` : (j.promptFeedback?.blockReason ? `차단됨 (${j.promptFeedback.blockReason})` : '빈 답'), 'EMPTY');
  return text;
}

async function viaGemini(settings, sys, history) {
  let model = await resolveModel(settings);
  try { return await generate(settings.key, model, sys, history); }
  catch (e) {
    // 자동으로 고른 모델이 사라졌으면 다시 골라서 한 번 더
    if (!settings.model && (e.status === 404 || e.status === 400 && /model/i.test(e.apiMsg))) {
      saveAiSettings({ ...settings, resolved: '' });
      model = await resolveModel({ ...settings, resolved: '' });
      return generate(settings.key, model, sys, history);
    }
    throw e;
  }
}

// 실패 이유를 알기 쉽게
export function explainAiError(e) {
  const m = (e.apiMsg || e.message || '').toLowerCase();
  if (e.status === 0) return '인터넷 연결이 없거나 브라우저(광고 차단 확장 프로그램 등)가 요청을 막았어요.';
  if (/api key not valid|api_key_invalid/.test(m) || e.reason === 'API_KEY_INVALID') return '키가 올바르지 않아요. AI Studio 에서 키를 다시 복사해 주세요 (앞뒤 공백 주의).';
  if (e.status === 403 && /referer|referrer/.test(m)) return '키의 "웹사이트 제한"에 지금 주소가 빠져 있어요. Google Cloud 콘솔에서 이 사이트 주소를 추가해 주세요.';
  if (e.status === 403) return '이 키로는 Gemini API 를 쓸 수 없어요. AI Studio 에서 만든 키인지, API 제한에 "Generative Language API"가 포함됐는지 확인해 주세요.';
  if (e.status === 404) return '모델을 찾을 수 없어요. 모델 칸을 비워 두면 쓸 수 있는 모델을 자동으로 골라요.';
  if (e.status === 429) return '무료 사용량을 잠시 넘었어요. 조금 뒤에 다시 시도해 주세요.';
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
  if (settings.key) { try { reply = await viaGemini(settings, sys, history); via = 'gemini'; } catch (e) { console.warn(e); } }
  if (!reply) { try { reply = await viaPublic(sys, history); via = 'public'; } catch (e) { console.warn(e); } }
  if (!reply) reply = offline(userText, ctx.grow);
  log.push({ role: 'neuru', text: reply, at: Date.now(), via });
  saveLog(log);
  return { reply, via };
}

export async function testAi(settings) {
  const s2 = { ...settings, resolved: '' };
  const model = await resolveModel(s2);
  const text = await generate(settings.key, model, '너는 고양이야. 한국어 한 문장으로 짧게 인사해.', [{ role: 'me', text: '안녕?' }], 512);
  return { text, model };
}
