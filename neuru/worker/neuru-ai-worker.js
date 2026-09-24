// 널 사랑할고양 — AI 중계 서버 (Cloudflare Workers, 무료)
// 구글 Gemini 키는 이 서버의 비밀값(GEMINI_API_KEY)에만 있고, 브라우저에는 절대 전달되지 않아요.
//
// 필요한 설정값 (Worker → Settings → Variables and Secrets)
//   GEMINI_API_KEY   (Secret) AI Studio 에서 받은 키
//   APP_TOKEN        (Secret) 앱 비밀번호 — 앱의 테스트 모드에 같은 값을 넣음
//   ALLOWED_ORIGINS  (Text)   허용할 사이트 주소, 쉼표로 구분  예) https://아이디.github.io,http://localhost:8000
//   DAILY_LIMIT      (Text)   하루 최대 대화 수 (기본 300)
// 선택: KV 네임스페이스를 USAGE 라는 이름으로 연결하면 하루 사용량 제한이 켜져요.

const GOOGLE = 'https://generativelanguage.googleapis.com';
const MAX_BODY = 32 * 1024;        // 요청 크기 제한
const MAX_OUTPUT_TOKENS = 1024;    // 대답 길이 제한

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : (allowed[0] || 'null'),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Neuru-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (status, message, reason) => new Response(JSON.stringify({ error: { code: status, message, status: reason } }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return json(403, 'origin not allowed', 'ORIGIN_NOT_ALLOWED');
    if (!env.APP_TOKEN || req.headers.get('X-Neuru-Token') !== env.APP_TOKEN) return json(401, 'wrong app token', 'APP_TOKEN');
    if (!env.GEMINI_API_KEY) return json(500, 'GEMINI_API_KEY is not set', 'NO_KEY');

    const url = new URL(req.url);
    // 허용하는 길은 딱 두 개: 모델 목록 보기, 대화 만들기
    const m = url.pathname.match(/^\/v1beta\/models(?:\/([A-Za-z0-9.\-]+):generateContent)?$/);
    if (!m) return json(404, 'not found', 'NOT_FOUND');

    let upstream, init;
    if (m[1]) {
      if (req.method !== 'POST') return json(405, 'POST only', 'METHOD');
      const raw = await req.text();
      if (raw.length > MAX_BODY) return json(413, 'request too large', 'TOO_LARGE');
      let body;
      try { body = JSON.parse(raw); } catch { return json(400, 'invalid json', 'BAD_JSON'); }
      body.generationConfig = { ...(body.generationConfig || {}) };
      body.generationConfig.maxOutputTokens = Math.min(MAX_OUTPUT_TOKENS, body.generationConfig.maxOutputTokens || MAX_OUTPUT_TOKENS);
      delete body.tools; delete body.toolConfig; delete body.cachedContent;

      // 하루 사용량 제한 (KV 를 연결했을 때만)
      if (env.USAGE) {
        const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
        const used = +(await env.USAGE.get(day)) || 0;
        if (used >= (+env.DAILY_LIMIT || 300)) return json(429, 'daily limit reached', 'DAILY_LIMIT');
        await env.USAGE.put(day, String(used + 1), { expirationTtl: 3 * 86400 });
      }
      upstream = `${GOOGLE}/v1beta/models/${m[1]}:generateContent`;
      init = { method: 'POST', body: JSON.stringify(body) };
    } else {
      if (req.method !== 'GET') return json(405, 'GET only', 'METHOD');
      const q = new URLSearchParams();
      q.set('pageSize', '200');
      const token = url.searchParams.get('pageToken');
      if (token && /^[A-Za-z0-9_\-=]+$/.test(token)) q.set('pageToken', token);
      upstream = `${GOOGLE}/v1beta/models?${q}`;
      init = { method: 'GET' };
    }

    const res = await fetch(upstream, { ...init, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY } });
    return new Response(res.body, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
