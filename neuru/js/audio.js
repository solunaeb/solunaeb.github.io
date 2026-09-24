// 모든 효과음은 Web Audio 로 합성 (파일 없이 오프라인에서도 동작)
import { store } from './store.js';
import { getAudioUrl } from './content.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = store.sound ? 1 : 0;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
}

export function setMuted(muted) {
  store.sound = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
  if (htmlAudio) htmlAudio.muted = muted;
}

const T = () => ctx.currentTime;

function env(gainNode, t, a, peak, d) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq, dur, { type = 'square', vol = 0.2, at = 0, slideTo = null, dest = sfxBus } = {}) {
  if (!ctx) return;
  const t = T() + at;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, at = 0, filter = 'bandpass', freq = 1500, q = 1, attack = 0.005, dest = sfxBus, sweepTo = null } = {}) {
  if (!ctx) return;
  const t = T() + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
}

export const sfx = {
  key() { noise(0.04, { vol: 0.35, freq: 2500 + Math.random() * 1500, q: 3 }); tone(180, 0.03, { type: 'square', vol: 0.05 }); },
  ding() { tone(2093, 0.9, { type: 'sine', vol: 0.18 }); tone(4186, 0.5, { type: 'sine', vol: 0.05 }); },
  carriage() { noise(0.35, { vol: 0.2, freq: 800, sweepTo: 3000, q: 2 }); },
  pop() { tone(500, 0.08, { type: 'square', vol: 0.12, slideTo: 1100 }); },
  click() { tone(900, 0.04, { type: 'square', vol: 0.08 }); },
  lock() { tone(160, 0.12, { type: 'square', vol: 0.12, slideTo: 90 }); },
  whoosh() { noise(0.4, { vol: 0.25, freq: 400, sweepTo: 2400, q: 0.8, attack: 0.08 }); },
  vacuum() { noise(1.3, { vol: 0.22, filter: 'lowpass', freq: 900, attack: 0.15 }); tone(110, 1.3, { type: 'sawtooth', vol: 0.03, slideTo: 140 }); },
  wipe() { for (let i = 0; i < 4; i++) noise(0.18, { vol: 0.18, at: i * 0.22, freq: 1200 + (i % 2) * 700, q: 1.5, attack: 0.05 }); },
  sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.08, at: i * 0.07 })); },
  meow() {
    if (!ctx) return;
    const t = T();
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(820, t + 0.18); o.frequency.linearRampToValueAtTime(480, t + 0.55);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1800, t + 0.2); f.frequency.linearRampToValueAtTime(1000, t + 0.55);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f).connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.65);
  },
  needle() { noise(0.08, { vol: 0.3, freq: 3000, q: 2 }); noise(0.6, { vol: 0.05, freq: 5000, q: 0.5, at: 0.08 }); },
  chime() { [784, 988, 1175].forEach((f, i) => tone(f, 0.6, { type: 'sine', vol: 0.12, at: i * 0.12 })); },
  fanfare() {
    const n = [523, 659, 784, 1047, 784, 1047];
    n.forEach((f, i) => tone(f, i === 5 ? 0.8 : 0.16, { type: 'square', vol: 0.08, at: i * 0.14 }));
    n.forEach((f, i) => tone(f / 2, i === 5 ? 0.8 : 0.16, { type: 'triangle', vol: 0.1, at: i * 0.14 }));
  },
  firework() { tone(300, 0.5, { type: 'sine', vol: 0.04, slideTo: 1200 }); noise(0.7, { vol: 0.2, at: 0.5, filter: 'lowpass', freq: 1800, sweepTo: 200, attack: 0.01 }); },
  thump() { tone(90, 0.15, { type: 'sine', vol: 0.25, slideTo: 50 }); },
};

// ── 골골송 (쓰다듬는 동안) ──
let purrNodes = null;
export function purr(on) {
  if (!ctx) return;
  if (on && !purrNodes) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 24;
    const depth = ctx.createGain(); depth.gain.value = 0.5;
    lfo.connect(depth).connect(am.gain);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, T()); out.gain.exponentialRampToValueAtTime(0.9, T() + 0.3);
    s.connect(f).connect(am).connect(out).connect(sfxBus);
    s.start(); lfo.start();
    purrNodes = { s, lfo, out };
  } else if (!on && purrNodes) {
    const { s, lfo, out } = purrNodes; purrNodes = null;
    out.gain.setTargetAtTime(0.0001, T(), 0.15);
    s.stop(T() + 0.6); lfo.stop(T() + 0.6);
  }
}

// ── 배경 앰비언스: 장작, 빗소리 ──
const ambience = {};
export function setAmbience(name, on) {
  if (!ctx) return;
  if (on && !ambience[name]) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(sfxBus);
    out.gain.setTargetAtTime(name === 'rain' ? 0.12 : 0.18, T(), 0.5);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter();
    if (name === 'rain') { f.type = 'highpass'; f.frequency.value = 1200; }
    else { f.type = 'lowpass'; f.frequency.value = 300; }
    s.connect(f).connect(out); s.start();
    let timer = null;
    if (name === 'fire') {
      timer = setInterval(() => {
        const n = Math.random() < 0.5 ? 1 : 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) noise(0.02 + Math.random() * 0.03, { vol: 0.15 + Math.random() * 0.25, at: Math.random() * 0.25, freq: 1500 + Math.random() * 3000, q: 4, dest: out });
      }, 260);
    }
    ambience[name] = { out, s, timer };
  } else if (!on && ambience[name]) {
    const { out, s, timer } = ambience[name]; delete ambience[name];
    clearInterval(timer);
    out.gain.setTargetAtTime(0, T(), 0.3);
    s.stop(T() + 1.5);
  }
}

// ── 음악 재생 ──
let htmlAudio = null, chip = null, onEndCb = null;
export let nowPlaying = 0;

export async function playDay(day, onEnd) {
  stopMusic();
  nowPlaying = day; onEndCb = onEnd;
  let url = null;
  try { url = await getAudioUrl(day); } catch { url = null; }
  if (nowPlaying !== day) return;
  if (url) {
    htmlAudio = new Audio(url);
    htmlAudio.muted = !store.sound;
    htmlAudio.onended = () => finish(day);
    htmlAudio.play().catch(() => finish(day));
  } else {
    chip = chiptune(day, () => finish(day));
  }
}

function finish(day) {
  if (nowPlaying !== day) return;
  nowPlaying = 0;
  htmlAudio = null; chip = null;
  onEndCb?.();
}

export function stopMusic() {
  if (htmlAudio) { htmlAudio.pause(); htmlAudio.onended = null; htmlAudio = null; }
  if (chip) { chip.stop(); chip = null; }
  nowPlaying = 0;
}

// mp3 가 없을 때 Day 번호를 씨앗으로 만드는 잔잔한 8비트 멜로디 (약 70초)
function chiptune(day, onDone) {
  let seed = day * 9301 + 49297;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roots = [57, 60, 62, 55, 64, 59, 53];
  const root = roots[day % roots.length];
  const penta = [0, 2, 4, 7, 9, 12, 14, 16];
  const progs = [[0, 7, 9, 5], [0, 5, 7, 7], [9, 5, 0, 7], [0, 9, 5, 7], [5, 7, 0, 0]];
  const prog = progs[Math.floor(rnd() * progs.length)];
  const bpm = 78 + Math.floor(rnd() * 22);
  const step = 60 / bpm / 2; // 8분음표
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 4마디 멜로디를 만들어 변형 반복
  const phrase = [];
  let idx = 2;
  for (let i = 0; i < 32; i++) {
    if (rnd() < 0.28) { phrase.push(null); continue; }
    idx = Math.max(0, Math.min(penta.length - 1, idx + Math.floor(rnd() * 5) - 2));
    phrase.push(penta[idx]);
  }
  const bars = 36;
  const total = bars * 8;
  let i = 0, stopped = false;
  const startAt = T() + 0.1;
  const timer = setInterval(() => {
    if (stopped) return;
    while (i < total && startAt + i * step < T() + 0.4) {
      const t = startAt + i * step - T();
      const bar = Math.floor(i / 8);
      const chord = root - 12 + prog[bar % 4];
      if (i % 4 === 0) tone(midi(chord), step * 3.6, { type: 'triangle', vol: 0.16, at: t, dest: musicBus });
      if (i % 2 === 0) tone(midi(chord + 12 + [0, 4, 7, 12][(i / 2) % 4]), step * 0.9, { type: 'square', vol: 0.025, at: t, dest: musicBus });
      const section = Math.floor(bar / 8);
      const note = phrase[(i + (section % 2 ? 8 : 0)) % 32];
      if (note !== null && bar >= 2 && bar < bars - 1) tone(midi(root + 12 + note), step * 1.6, { type: 'square', vol: 0.05, at: t, dest: musicBus });
      i++;
    }
    if (i >= total && T() > startAt + total * step + 1) { clearInterval(timer); if (!stopped) onDone(); }
  }, 100);
  return { stop() { stopped = true; clearInterval(timer); } };
}
